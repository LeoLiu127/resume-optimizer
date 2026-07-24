/**
 * 简历分析 Hook
 *
 * 职责：
 *   - 调用 MiniMax API 拿到结构化分析结果
 *   - 对模型输出做归一化（缺字段时安全降级，不让 UI 崩溃）
 *   - 在 API 失败或未配置时，自动回退到 mock（仅当 VITE_USE_MOCK_FALLBACK=true）
 *   - 暴露 loading / error / data / engine 给 UI 使用
 */

import { useCallback, useRef, useState } from 'react';
import { chatCompletions, extractJson, getMiniMaxConfig, isMiniMaxConfigured } from '../services/minimax';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  FOLLOW_UP_BULLET_SYSTEM,
  buildFollowUpBulletPrompt,
  OPTIMIZE_STYLE_SYSTEM,
  buildOptimizeStylePrompt,
  ENHANCEMENT_SYSTEM,
  buildEnhancementPrompt,
} from '../services/prompts';
import { buildMockAnalysis, exampleInput } from '../mockData';

const FALLBACK_ENABLED = String(import.meta.env.VITE_USE_MOCK_FALLBACK ?? 'true').toLowerCase() !== 'false';

const REQUIRED_DIMENSIONS = [
  '岗位匹配度',
  '简历结构',
  '职业定位',
  '工作经历表达',
  '项目经历表达',
  '成果量化',
  '关键词覆盖',
  '差异化亮点',
  '可信度与面试风险',
];

const DEFAULT_ASK_ITEMS = [
  { id: 'q1', title: '项目背景与场景', question: '你的核心项目主要服务什么客户或业务场景？', bullet: '服务于[客户/业务场景]，围绕[核心流程]拆解问题并输出产品方案。' },
  { id: 'q2', title: '个人职责边界', question: '你在项目里独立负责哪些环节？', bullet: '独立承担[调研/PRD/原型/推进/验收]等环节。' },
  { id: 'q3', title: '产出成果与数据', question: '上线后有无业务结果、效率提升、客户反馈等证据？', bullet: '项目上线后带来[效率/流程/协同]改善，结果为[待补充量化结果]。' },
  { id: 'q4', title: 'AI探索深度', question: '你是否做过 Prompt、知识库、Agent 工作流等实际探索？', bullet: '基于[Prompt/Coze/Dify/RAG/Agent]开展AI探索。' },
  { id: 'q5', title: '协作对象与难点', question: '你主要和哪些角色协作？遇到过什么难点，如何解决的？', bullet: '协同[研发/设计/销售/实施]团队，解决[难点]。' },
  { id: 'q6', title: '用户/客户规模', question: '你的产品/项目服务多少用户或客户？', bullet: '服务[数量]家客户/[数量]用户，覆盖[行业/场景]。' },
];

function clampScore(value, fallback = 60) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function normalizeSummary(summary, fallbackName) {
  const fitScore = clampScore(summary?.fitScore, 70);
  return {
    name: asString(summary?.name, fallbackName),
    role: asString(summary?.role, '目标岗位'),
    generatedAt: asString(summary?.generatedAt, '已基于输入生成优化结果'),
    fitScore,
    scoreLabel: asString(summary?.scoreLabel, fitScore >= 80 ? '匹配度较高' : fitScore >= 65 ? '中等匹配' : '基础匹配'),
  };
}

function normalizeDiagnosis(diagnosis) {
  const provided = asArray(diagnosis?.dimensions);
  const byName = new Map(provided.map((item) => [asString(item?.name), clampScore(item?.score)]));

  return {
    overall: clampScore(diagnosis?.overall, 70),
    dimensions: REQUIRED_DIMENSIONS.map((name) => ({ name, score: byName.get(name) ?? 60 })),
    issues: asArray(diagnosis?.issues).map(asString).filter(Boolean).slice(0, 6),
    priorities: asArray(diagnosis?.priorities).map(asString).filter(Boolean).slice(0, 6),
    deductionReason: asString(diagnosis?.deductionReason, '主要扣分来自量化结果、职责边界与 AI 证据不足。'),
  };
}

function normalizeEvidenceMap(items) {
  const list = asArray(items);
  if (!list.length) return [];
  return list.slice(0, 10).map((item) => ({
    jd: asString(item?.jd, '待补充'),
    evidence: asString(item?.evidence, '尚未发现直接证据'),
    strength: asString(item?.strength, '弱'),
    supplement: asString(item?.supplement, '是'),
    advice: asString(item?.advice, '建议补充具体场景与结果'),
  }));
}

function normalizeAskItems(items) {
  const provided = asArray(items);
  const byId = new Map(provided.map((item) => [asString(item?.id), item]));
  return DEFAULT_ASK_ITEMS.map((fallback) => {
    const item = byId.get(fallback.id) || {};
    return {
      id: fallback.id,
      title: asString(item?.title, fallback.title),
      question: asString(item?.question, fallback.question),
      bullet: asString(item?.bullet, fallback.bullet),
    };
  });
}

function normalizeStrategy(strategy) {
  return {
    positioning: asString(strategy?.positioning, ''),
    emphasize: asString(strategy?.emphasize, ''),
    downplay: asString(strategy?.downplay, ''),
    keywords: asArray(strategy?.keywords).map(asString).filter(Boolean).slice(0, 12),
    heroProjects: asArray(strategy?.heroProjects).map(asString).filter(Boolean).slice(0, 3),
    tone: asString(strategy?.tone, '业务型 + 结果导向型'),
  };
}

function normalizeRewriteTable(items) {
  return asArray(items).slice(0, 6).map((item) => ({
    before: asString(item?.before, ''),
    after: asString(item?.after, ''),
    reason: asString(item?.reason, ''),
    risk: asString(item?.risk, ''),
  })).filter((item) => item.before || item.after);
}

function normalizeFinalResume(resume) {
  const experience = asArray(resume?.experience).slice(0, 6).map((item) => ({
    company: asString(item?.company, '待补充'),
    title: asString(item?.title, '岗位待补充'),
    period: asString(item?.period, ''),
    bullets: asArray(item?.bullets).map(asString).filter(Boolean).slice(0, 5),
  }));
  const projects = asArray(resume?.projects).slice(0, 6).map((item) => ({
    name: asString(item?.name, '项目待补充'),
    bullets: asArray(item?.bullets).map(asString).filter(Boolean).slice(0, 4),
  }));

  return {
    basic: asArray(resume?.basic).map(asString).filter(Boolean),
    jobIntention: asString(resume?.jobIntention, ''),
    summary: asString(resume?.summary, ''),
    skills: asArray(resume?.skills).map(asString).filter(Boolean).slice(0, 16),
    tools: asArray(resume?.tools).map(asString).filter(Boolean).slice(0, 16),
    experience,
    projects,
    education: asString(resume?.education, '教育背景待补充'),
    extras: asArray(resume?.extras).map(asString).filter(Boolean).slice(0, 8),
  };
}

function normalizeInterviewPrep(prep) {
  return {
    questions: asArray(prep?.questions).map(asString).filter(Boolean).slice(0, 12),
    proofs: asArray(prep?.proofs).map(asString).filter(Boolean).slice(0, 8),
    riskyClaims: asArray(prep?.riskyClaims).map(asString).filter(Boolean).slice(0, 8),
    missingData: asArray(prep?.missingData).map(asString).filter(Boolean).slice(0, 8),
    answerTips: asArray(prep?.answerTips).map(asString).filter(Boolean).slice(0, 8),
    intro: asString(prep?.intro, ''),
  };
}

function normalizeEnhancement(enh) {
  return {
    additionalProjects: asArray(enh?.additionalProjects).map(asString).filter(Boolean).slice(0, 6),
    portfolioNeeded: asString(enh?.portfolioNeeded, '视情况'),
    portfolioContent: asArray(enh?.portfolioContent).map(asString).filter(Boolean).slice(0, 6),
    resumeVersions: asArray(enh?.resumeVersions).map(asString).filter(Boolean).slice(0, 6),
    multiVersionAdvice: asString(enh?.multiVersionAdvice, ''),
  };
}

function normalizeAnalysis(raw, fallbackName) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('模型返回结构无效');
  }

  return {
    summary: normalizeSummary(raw.summary, fallbackName),
    jdAnalysis: asArray(raw.jdAnalysis).slice(0, 8).map((item) => ({
      item: asString(item?.item, '分析维度'),
      detail: asString(item?.detail, ''),
    })),
    diagnosis: normalizeDiagnosis(raw.diagnosis),
    evidenceMap: normalizeEvidenceMap(raw.evidenceMap),
    askItems: normalizeAskItems(raw.askItems),
    strategy: normalizeStrategy(raw.strategy),
    rewriteTable: normalizeRewriteTable(raw.rewriteTable),
    finalResume: normalizeFinalResume(raw.finalResume),
    interviewPrep: normalizeInterviewPrep(raw.interviewPrep),
    enhancement: normalizeEnhancement(raw.enhancement),
  };
}

export function useResumeAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [engine, setEngine] = useState('idle'); // idle | minimax-m3 | mock
  const lastRequestRef = useRef(0);

  const analyze = useCallback(async (input, answers = {}) => {
    const requestId = Date.now();
    lastRequestRef.current = requestId;

    setLoading(true);
    setError('');
    setData(null);
    setEngine('idle');

    const fallbackName = (input?.resume?.split('\n').find((line) => line.trim()) || '').trim() || '候选人';

    // 触发 mock 兜底
    const fallbackToMock = (reason) => {
      console.warn(`[resume-analysis] fallback to mock: ${reason}`);
      const mockResult = buildMockAnalysis(input, answers);
      setData(mockResult);
      setEngine('mock');
      setError(reason);
    };

    // 未配置 API Key 或禁用 mock：直接走 mock
    if (!isMiniMaxConfigured()) {
      if (FALLBACK_ENABLED) {
        fallbackToMock('未配置 MiniMax API Key，已使用本地 Mock 结果');
        setLoading(false);
        return;
      }
      setError('未配置 MiniMax API Key，且未启用 mock 兜底。请在 .env 中配置 VITE_MINIMAX_API_KEY');
      setLoading(false);
      return;
    }

    try {
      const content = await chatCompletions(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input, answers) },
        ],
        { jsonMode: true, temperature: 0.4, maxTokens: 4096 },
      );

      if (lastRequestRef.current !== requestId) return;

      const raw = extractJson(content);
      const normalized = normalizeAnalysis(raw, fallbackName);
      setData(normalized);
      setEngine('minimax-m3');
    } catch (err) {
      if (lastRequestRef.current !== requestId) return;

      const message = err?.message || '未知错误';
      if (FALLBACK_ENABLED) {
        fallbackToMock(`${message}（已使用本地 Mock 结果）`);
      } else {
        setError(message);
      }
    } finally {
      if (lastRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    lastRequestRef.current = Date.now();
    setData(null);
    setError('');
    setEngine('idle');
  }, []);

  /**
   * 单条追问：把用户回答改写为专业简历 bullet
   * 未配置 API Key 时返回基于追问模板拼接的本地降级结果
   */
  const generateFollowUpBullet = useCallback(async (input, askItem, userAnswer) => {
    if (!userAnswer || !userAnswer.trim()) {
      throw new Error('请先填写追问回答');
    }
    if (!isMiniMaxConfigured()) {
      // 本地降级：把用户回答填入 [占位]，作为可读性 OK 的 bullet
      return (askItem.bullet || '').replace(/\[[^\]]*\]/g, userAnswer.trim()).trim();
    }
    const content = await chatCompletions(
      [
        { role: 'system', content: FOLLOW_UP_BULLET_SYSTEM },
        { role: 'user', content: buildFollowUpBulletPrompt(input, askItem.question, askItem.title, userAnswer) },
      ],
      { temperature: 0.5, maxTokens: 300 },
    );
    return content.replace(/["'`“”‘’]+/g, '').replace(/^[\s\n]+|[\s\n]+$/g, '');
  }, []);

  /**
   * 按指定优化风格重新生成修改对照表
   * 未配置 API Key 时直接基于现状返回（保持原数据不变）
   */
  const regenerateOptimizedItems = useCallback(async (input, style, currentItems) => {
    if (!isMiniMaxConfigured()) {
      return currentItems || [];
    }
    const content = await chatCompletions(
      [
        { role: 'system', content: OPTIMIZE_STYLE_SYSTEM },
        { role: 'user', content: buildOptimizeStylePrompt(input, style) },
      ],
      { jsonMode: true, temperature: 0.5, maxTokens: 4096 },
    );
    const raw = extractJson(content);
    const list = Array.isArray(raw) ? raw : raw?.optimizedItems;
    if (!Array.isArray(list)) return currentItems || [];
    return list.slice(0, 12).map((item, index) => ({
      id: item.id || `opt-${index + 1}`,
      section: item.section || '其他',
      before: item.before || '',
      after: item.after || '',
      reason: item.reason || '',
      risk: item.riskWarning || item.risk || '',
    }));
  }, []);

  /**
   * 重新生成补强建议
   */
  const regenerateEnhancement = useCallback(async (input, summary) => {
    if (!isMiniMaxConfigured()) return null;
    const content = await chatCompletions(
      [
        { role: 'system', content: ENHANCEMENT_SYSTEM },
        { role: 'user', content: buildEnhancementPrompt(input, summary) },
      ],
      { jsonMode: true, temperature: 0.5, maxTokens: 2048 },
    );
    return extractJson(content);
  }, []);

  return {
    analyze,
    reset,
    generateFollowUpBullet,
    regenerateOptimizedItems,
    regenerateEnhancement,
    loading,
    error,
    data,
    engine,
    config: getMiniMaxConfig(),
    fallbackEnabled: FALLBACK_ENABLED,
    exampleInput,
  };
}

export { exampleInput };