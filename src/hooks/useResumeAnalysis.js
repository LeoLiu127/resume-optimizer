/**
 * 简历分析 Hook（已迁移到后端 API 代理）
 *
 * 所有 AI 调用都通过后端 /api/analyze/*，前端不再持有 API Key。
 * 网络/认证失败时降级到本地 mock，保证演示可用。
 */

import { useCallback, useRef, useState } from 'react';
import { ai, auth as authApi } from '../services/api';
import { buildMockAnalysis, exampleInput } from '../mockData';

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
  if (!provided.length) return DEFAULT_ASK_ITEMS;
  return provided.slice(0, 6).map((item, index) => ({
    id: asString(item?.id, `q${index + 1}`),
    title: asString(item?.title, '补充信息'),
    question: asString(item?.question, '请补充你的实际经历。'),
    bullet: asString(item?.bullet, ''),
  }));
}

function normalizeStrategy(strategy) {
  return {
    positioning: asString(strategy?.positioning, '请基于简历与目标岗位，补充职业定位描述。'),
    emphasize: asArray(strategy?.emphasize).map(asString).filter(Boolean).slice(0, 6),
    downplay: asArray(strategy?.downplay).map(asString).filter(Boolean).slice(0, 6),
    keywords: asArray(strategy?.keywords).map(asString).filter(Boolean).slice(0, 8),
    heroProjects: asArray(strategy?.heroProjects).map(asString).filter(Boolean).slice(0, 3),
    // prompts.js 和 mockData.js 输出的字段名是 tone，兼容旧字段 style
    tone: asString(strategy?.tone ?? strategy?.style, '专业型'),
    style: asString(strategy?.tone ?? strategy?.style, '专业型'),
  };
}

function normalizeEnhancement(enh) {
  // 同时兼容新旧字段名（prompts.js 输出的字段名）
  const additional = asArray(enh?.additionalProjects ?? enh?.missingExperiences).map(asString).filter(Boolean);
  const gapClosing = asArray(enh?.gapClosingAdvice).map(asString).filter(Boolean);
  const portfolioContent = asArray(enh?.portfolioContent).map(asString).filter(Boolean);
  const resumeVersions = asArray(enh?.resumeVersions).map(asString).filter(Boolean);
  return {
    additionalProjects: additional.length ? additional : [
      '补充 1 个与目标岗位强相关的完整项目，突出场景、动作与结果',
      '整理 2-3 条可量化的业务结果（效率提升、成本降低、用户增长等）',
      '如有跨团队协作经验，补充 1 个体现推动力的案例',
    ],
    portfolioNeeded: asString(enh?.portfolioNeeded, '视情况'),
    portfolioContent: portfolioContent.length ? portfolioContent : [
      'PRD / 原型 / 流程图示例（脱敏后）',
      '项目上线截图或数据看板',
      '简历优化前后对比（体现方法论）',
    ],
    resumeVersions: resumeVersions.length ? resumeVersions : [
      '针对目标岗位的精简版（一页）',
      '包含更多项目细节的完整版（两页）',
    ],
    multiVersionAdvice: asString(
      enh?.multiVersionAdvice,
      '建议针对不同公司类型（大厂/创业公司/ToB SaaS）微调简历侧重点，核心经历不变，但摘要和关键词应匹配各自 JD。',
    ),
    // 兜底保留旧字段，避免下游遗留代码读取 undefined
    missingExperiences: gapClosing,
    gapClosingAdvice: gapClosing,
    portfolioAdvice: asString(enh?.portfolioAdvice, '建议沉淀 2-3 个可展示的项目案例。'),
  };
}

function inferSection(text) {
  const t = String(text || '');
  if (/项目|Project|上线|交付|客户|用户/.test(t)) return '项目经历';
  if (/技能|工具|熟练|掌握/.test(t)) return '技能';
  if (/教育|学历|本科|硕士/.test(t)) return '教育背景';
  if (/总结|简介|优势|定位/.test(t)) return '职业摘要';
  return '工作经历';
}

function normalizeRewriteTable(items) {
  return asArray(items)
    .map((item) => {
      const before = asString(item?.before ?? item?.original, '');
      const after = asString(item?.after ?? item?.revised, '');
      const reason = asString(item?.reason, '');
      const risk = asString(item?.risk, '');
      const sectionRaw = asString(item?.section, '');
      const section = sectionRaw || inferSection(before || after);
      return { before, after, reason, risk, section };
    })
    .filter((it) => it.before || it.after);
}

function normalizeInterviewPrep(prep) {
  const src = prep || {};
  return {
    questions: asArray(src.questions).map(asString).filter(Boolean),
    proofs: asArray(src.proofs).map(asString).filter(Boolean),
    riskyClaims: asArray(src.riskyClaims).map(asString).filter(Boolean),
    missingData: asArray(src.missingData).map(asString).filter(Boolean),
    answerTips: asArray(src.answerTips).map(asString).filter(Boolean),
    intro: asString(src.intro, ''),
  };
}

function normalizeFinalResume(resume, fallbackName) {
  const basic = asArray(resume?.basic);
  return {
    name: asString(basic[0], fallbackName),
    basic: basic.map(asString),
    jobIntention: asString(resume?.jobIntention, ''),
    summary: asString(resume?.summary, ''),
    skills: asArray(resume?.skills).map(asString).filter(Boolean).slice(0, 12),
    tools: asArray(resume?.tools).map(asString).filter(Boolean).slice(0, 12),
    experience: asArray(resume?.experience)
      .map((item) => ({
        company: asString(item?.company, ''),
        title: asString(item?.title, ''),
        period: asString(item?.period, ''),
        bullets: asArray(item?.bullets).map(asString).filter(Boolean).slice(0, 6),
      }))
      .filter((item) => item.company || item.title || item.bullets.length),
    projects: asArray(resume?.projects)
      .map((item) => ({
        name: asString(item?.name, ''),
        period: asString(item?.period, ''),
        bullets: asArray(item?.bullets).map(asString).filter(Boolean).slice(0, 6),
      }))
      .filter((item) => item.name || item.bullets.length),
    education: asString(resume?.education, ''),
    extras: asArray(resume?.extras).map(asString).filter(Boolean).slice(0, 6),
  };
}

function normalizeAnalysis(raw, fallbackName) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    summary: normalizeSummary(raw.summary, fallbackName),
    jdAnalysis: asArray(raw.jdAnalysis)
      .map((item) => ({ item: asString(item?.item, ''), detail: asString(item?.detail, '') }))
      .filter((it) => it.item),
    diagnosis: normalizeDiagnosis(raw.diagnosis),
    evidenceMap: normalizeEvidenceMap(raw.evidenceMap),
    askItems: normalizeAskItems(raw.askItems),
    strategy: normalizeStrategy(raw.strategy),
    enhancement: normalizeEnhancement(raw.enhancement),
    rewriteTable: normalizeRewriteTable(raw.rewriteTable),
    finalResume: normalizeFinalResume(raw.finalResume, fallbackName),
    interviewPrep: normalizeInterviewPrep(raw.interviewPrep),
  };
}

export function useResumeAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [engine, setEngine] = useState('');
  const cacheRef = useRef({});

  const fallbackToMock = (input, answers, reason) => {
    console.warn(`[useResumeAnalysis] 回退到 mock：${reason}`);
    const fallbackName = input?.resume?.split('\n')?.[0]?.slice(0, 12) || '候选人';
    const mock = buildMockAnalysis({ ...exampleInput, ...input }, answers || {});
    const normalized = normalizeAnalysis(mock, fallbackName);
    setData(normalized);
    setEngine('mock');
    return normalized;
  };

  const analyze = useCallback(async (input, answers) => {
    if (loading) return null;
    setLoading(true);
    setError('');
    try {
      const fallbackName = input?.resume?.split('\n')?.[0]?.slice(0, 12) || '候选人';
      const res = await ai.analyze(input, answers || {});
      const normalized = normalizeAnalysis(res.data, fallbackName);
      if (!normalized) {
        throw new Error('后端返回数据为空');
      }
      setData(normalized);
      setEngine(res.engine || 'minimax-m3');
      return normalized;
    } catch (err) {
      // 401 / 网络错误 → 回退 mock（不阻塞用户首次体验）
      const isUnauthed = err.code === 'UNAUTHED';
      const isNetwork = err.code === 'NETWORK';
      if (isUnauthed) {
        setError(err.message);
        return null;
      }
      if (isNetwork) {
        setError(err.message);
        return null;
      }
      // 502 等 → 静默回退 mock + 标记 fallback
      const result = fallbackToMock(input, answers, err.message);
      setError(`AI 不可用（${err.message}），已使用示例数据演示`);
      return result;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const reset = useCallback(() => {
    setData(null);
    setError('');
    setEngine('');
    cacheRef.current = {};
  }, []);

  const generateFollowUpBullet = useCallback(async (input, askItem, userAnswer) => {
    const key = `${askItem.id}::${userAnswer}`;
    if (cacheRef.current[key]) return cacheRef.current[key];
    try {
      const res = await ai.followup(input, askItem, userAnswer);
      const bullet = (res.bullet || '').trim();
      if (bullet) cacheRef.current[key] = bullet;
      return bullet;
    } catch (err) {
      // 离线兜底：用一个模板生成
      const fallback = askItem?.bullet?.replace(/\[([^\]]+)\]/g, '本次回答') || userAnswer.slice(0, 60);
      setError(err.message);
      return fallback;
    }
  }, []);

  const regenerateOptimizedItems = useCallback(async (input, variant, baseItems) => {
    try {
      const res = await ai.rewrite(input, baseItems || [], variant);
      const items = asArray(res.items);
      return items;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  const generateEnhancement = useCallback(async (input, summary) => {
    try {
      const res = await ai.enhance(input, summary);
      return res.enhancement;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const verifyAuth = useCallback(async () => {
    try {
      const me = await authApi.me();
      return { ok: true, user: me.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, []);

  return {
    analyze,
    reset,
    generateFollowUpBullet,
    regenerateOptimizedItems,
    generateEnhancement,
    verifyAuth,
    loading,
    error,
    data,
    engine,
  };
}
