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
  RESUME_ENGLISH_SYSTEM,
  buildResumeEnglishPrompt,
} from '../../../src/services/prompts.js';
import { buildMockAnalysis, exampleInput } from '../../../src/mockData.js';
import { normalizeRewriteItems } from '../ai-response.js';
import { normalizeEnglishResume } from '../resume-english.js';
import { extractJsonObject } from '../json-response.js';
import { createMiniMaxClient } from '../minimax-client.js';

const router = Router();
router.use(requireAuth);

const minimaxClient = createMiniMaxClient(config.minimax);

function fallbackEnabled() {
  return String(process.env.SERVER_FALLBACK_MOCK || '').toLowerCase() === 'true';
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
  '/',
  asyncRoute(async (req, res) => {
    const { input, answers } = req.body || {};
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'input 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (fallbackEnabled()) {
        return res.json({ engine: 'mock', data: safeMock(input, answers, 'analyze'), fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const userPrompt = buildUserPrompt(input, answers || {});
      const completion = await minimaxClient.complete(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          maxCompletionTokens: 32_768,
          timeoutMs: Math.max(config.minimax.timeout, 180_000),
        },
      );
      const data = extractJsonObject(completion.content);
      return res.json({ engine: 'minimax-m3', data });
    } catch (err) {
      console.error('[analyze:analyze] MiniMax 失败:', err.message);
      if (fallbackEnabled()) {
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
  '/followup',
  asyncRoute(async (req, res) => {
    const { input, askItem, userAnswer } = req.body || {};
    if (!askItem || !userAnswer) {
      return res.status(400).json({ error: 'askItem / userAnswer 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (fallbackEnabled()) {
        // 用模板拼一个 demo bullet，避免 demo 环境体验中断
        const bullet = `基于「${userAnswer.slice(0, 40)}${userAnswer.length > 40 ? '…' : ''}」，已转为“场景+动作+结果”的简历 bullet（需配置 API Key 后由 AI 完善）。`;
        return res.json({ engine: 'mock', bullet, fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const prompt = buildFollowUpBulletPrompt(input || exampleInput, askItem.question, askItem.title, userAnswer);
      const completion = await minimaxClient.complete(
        [
          { role: 'system', content: FOLLOW_UP_BULLET_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxCompletionTokens: 2_048 },
      );
      return res.json({ engine: 'minimax-m3', bullet: completion.content.trim() });
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
  '/rewrite',
  asyncRoute(async (req, res) => {
    const { input, items, style } = req.body || {};
    if (!Array.isArray(items) || !style) {
      return res.status(400).json({ error: 'items / style 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (fallbackEnabled()) {
        // 无 API Key 时返回原表，不变更体验
        return res.json({ engine: 'mock', items, fallback: 'no-api-key' });
      }
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const prompt = buildOptimizeStylePrompt(input || exampleInput, items, style);
      const completion = await minimaxClient.complete(
        [
          { role: 'system', content: OPTIMIZE_STYLE_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { maxCompletionTokens: 8_192 },
      );
      return res.json({
        engine: 'minimax-m3',
        items: normalizeRewriteItems(extractJsonObject(completion.content)),
      });
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
  '/enhance',
  asyncRoute(async (req, res) => {
    const { input, summary } = req.body || {};
    if (!input || !summary) {
      return res.status(400).json({ error: 'input / summary 必填' });
    }
    if (!isMiniMaxConfigured()) {
      if (fallbackEnabled()) {
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
      const completion = await minimaxClient.complete(
        [
          { role: 'system', content: ENHANCEMENT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        { maxCompletionTokens: 8_192 },
      );
      return res.json({
        engine: 'minimax-m3',
        enhancement: extractJsonObject(completion.content),
      });
    } catch (err) {
      return res.status(502).json({ error: err.message || '补强建议生成失败' });
    }
  }),
);

/**
 * 纯英文简历生成
 * POST /api/analyze/resume-english
 * body: { finalResume, role }
 */
router.post(
  '/resume-english',
  asyncRoute(async (req, res) => {
    const { finalResume, role } = req.body || {};
    if (!finalResume || typeof finalResume !== 'object') {
      return res.status(400).json({ error: 'finalResume 必填' });
    }
    if (!isMiniMaxConfigured()) {
      return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
    }
    try {
      const completion = await minimaxClient.complete(
        [
          { role: 'system', content: RESUME_ENGLISH_SYSTEM },
          { role: 'user', content: buildResumeEnglishPrompt(finalResume, role) },
        ],
        { maxCompletionTokens: 12_288 },
      );
      const normalized = normalizeEnglishResume(
        extractJsonObject(completion.content),
        { finalResume, role },
      );
      return res.json({ engine: 'minimax-m3', ...normalized });
    } catch (err) {
      console.error('[analyze:resume-english] MiniMax 失败:', err.message);
      return res.status(502).json({ error: `英文简历生成失败：${err.message || 'MiniMax 调用失败'}` });
    }
  }),
);

export default router;
