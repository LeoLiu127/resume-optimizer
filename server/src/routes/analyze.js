import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { config, isMiniMaxConfigured } from '../config.js';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  FOLLOW_UP_BULLET_SYSTEM,
  buildFollowUpBulletPrompt,
  OPTIMIZE_STYLE_SYSTEM,
  buildOptimizeStylePrompt,
  ENHANCEMENT_SYSTEM,
  buildEnhancementPrompt,
} from '../../../src/services/prompts.js';
import { buildMockAnalysis, exampleInput } from '../../../src/mockData.js';

const router = Router();
router.use(requireAuth);

const FALLBACK_ENABLED = (process.env.SERVER_FALLBACK_MOCK ?? 'true').toLowerCase() !== 'false';

/**
 * 通用 MiniMax Chat Completions 客户端（服务端版本，保护 API Key）
 */
async function chatCompletions(messages, options = {}) {
  const { apiKey, baseUrl, model: defaultModel, timeout } = config.minimax;
  if (!isMiniMaxConfigured()) {
    throw new Error('服务端未配置 MiniMax API Key');
  }
  const payload = {
    model: options.model || defaultModel,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 4096,
    stream: false,
  };
  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`MiniMax 请求超时（${timeout}ms）`);
    }
    throw new Error(`MiniMax 网络异常：${err.message || err}`);
  }
  clearTimeout(timer);
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`MiniMax 请求失败（${response.status}）：${detail || response.statusText}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('MiniMax 返回内容为空');
  return content;
}

function extractJson(text = '') {
  if (!text) throw new Error('模型返回为空');
  try {
    return JSON.parse(text);
  } catch {
    /* try fallback */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      /* continue */
    }
  }
  throw new Error('无法从模型输出中解析 JSON');
}

function safeMock(input, answers, requestId) {
  console.warn(`[analyze:${requestId}] API 不可用，回退到 mock 数据`);
  return buildMockAnalysis({ ...exampleInput, ...input }, answers || {});
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * 主分析接口
 * POST /api/analyze
 * body: { input, answers, variant? }
 * 响应: { engine, data, fallback? }
 */
router.post(
  '/analyze',
  asyncRoute(async (req, res) => {
    const { input, answers } = req.body || {};
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'input 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (FALLBACK_ENABLED) {
        return res.json({ engine: 'mock', data: safeMock(input, answers, 'analyze'), fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const userPrompt = buildUserPrompt(input, answers || {});
      const content = await chatCompletions(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { jsonMode: true, maxTokens: 6000 },
      );
      const data = extractJson(content);
      return res.json({ engine: 'minimax-m3', data });
    } catch (err) {
      if (FALLBACK_ENABLED) {
        return res.json({ engine: 'mock', data: safeMock(input, answers, 'analyze'), fallback: 'api-error', error: err.message });
      }
      return res.status(502).json({ error: err.message || 'MiniMax 调用失败' });
    }
  }),
);

/**
 * 追问 bullet
 * POST /api/analyze/followup
 * body: { input, askItem, userAnswer }
 */
router.post(
  '/analyze/followup',
  asyncRoute(async (req, res) => {
    const { input, askItem, userAnswer } = req.body || {};
    if (!askItem || !userAnswer) {
      return res.status(400).json({ error: 'askItem / userAnswer 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (FALLBACK_ENABLED) {
        // 用模板拼一个 demo bullet，避免 demo 环境体验中断
        const bullet = `基于「${userAnswer.slice(0, 40)}${userAnswer.length > 40 ? '…' : ''}」，已转为“场景+动作+结果”的简历 bullet（需配置 API Key 后由 AI 完善）。`;
        return res.json({ engine: 'mock', bullet, fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const prompt = buildFollowUpBulletPrompt(input || exampleInput, askItem.question, askItem.title, userAnswer);
      const content = await chatCompletions(
        [
          { role: 'system', content: FOLLOW_UP_BULLET_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 800 },
      );
      return res.json({ engine: 'minimax-m3', bullet: content.trim() });
    } catch (err) {
      return res.status(502).json({ error: err.message || '追问生成失败' });
    }
  }),
);

/**
 * 优化风格重新生成
 * POST /api/analyze/rewrite
 * body: { input, items, style }
 */
router.post(
  '/analyze/rewrite',
  asyncRoute(async (req, res) => {
    const { input, items, style } = req.body || {};
    if (!Array.isArray(items) || !style) {
      return res.status(400).json({ error: 'items / style 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (FALLBACK_ENABLED) {
        // 无 API Key 时返回原表，不变更体验
        return res.json({ engine: 'mock', items, fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const prompt = buildOptimizeStylePrompt(input || exampleInput, items, style);
      const content = await chatCompletions(
        [
          { role: 'system', content: OPTIMIZE_STYLE_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { jsonMode: true, maxTokens: 4096 },
      );
      return res.json({ engine: 'minimax-m3', items: extractJson(content) });
    } catch (err) {
      return res.status(502).json({ error: err.message || '风格重写失败' });
    }
  }),
);

/**
 * 补强建议
 * POST /api/analyze/enhance
 * body: { input, summary }
 */
router.post(
  '/analyze/enhance',
  asyncRoute(async (req, res) => {
    const { input, summary } = req.body || {};
    if (!input || !summary) {
      return res.status(400).json({ error: 'input / summary 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (FALLBACK_ENABLED) {
        // 简单占位补强建议，演示用
        return res.json({
          engine: 'mock',
          enhancement: {
            additionalProjects: ['补充一个完整的 AI 应用 Demo', '整理 1-2 个可量化的业务结果'],
            portfolioNeeded: '建议准备（AI 产品方向作品集能显著提升竞争力）',
            portfolioContent: ['PRD / 原型 / 流程图示例（脱敏后）', 'AI 探索 Demo 截图或录屏'],
            resumeVersions: ['针对目标岗位的精简版（一页）', '包含更多项目细节的完整版（两页）'],
            multiVersionAdvice: '需配置 API Key 后由 AI 生成更针对性的多版本建议。',
          },
          fallback: 'no-api-key',
        });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const prompt = buildEnhancementPrompt(input, summary);
      const content = await chatCompletions(
        [
          { role: 'system', content: ENHANCEMENT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { jsonMode: true, maxTokens: 4096 },
      );
      return res.json({ engine: 'minimax-m3', enhancement: extractJson(content) });
    } catch (err) {
      return res.status(502).json({ error: err.message || '补强建议生成失败' });
    }
  }),
);

export default router;
