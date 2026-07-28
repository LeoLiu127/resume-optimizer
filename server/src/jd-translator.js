/**
 * JD 翻译 + 字段抽取器
 *
 * 原始文本、中文译文和双语展示文本分别返回；失败时保留原文，不制造译文。
 */

import { config, isMiniMaxConfigured } from './config.js';
import { extractJsonObject } from './json-response.js';
import { createMiniMaxClient } from './minimax-client.js';
import {
  formatBilingualParagraphs,
  formatBilingualTitle,
} from '../../src/services/bilingualJd.js';

const minimaxClient = createMiniMaxClient(config.minimax);

const SYSTEM_PROMPT = `你是「JD 双语翻译与字段抽取助手」。

基于用户给出的岗位名称和招聘 JD，完成以下任务：

1. translatedTitle
   - 把岗位名称翻译成自然、准确的中文职位名称。
   - 公司名、技术名词和缩写保留原文。

2. translatedJd
   - 把完整 JD 翻译成中文。
   - 严格保持原文段落顺序与段落数量，便于逐段中英对照。
   - 保留公司名、薪资数字、技术名词、缩写和列表结构。
   - 不润色、不补充、不删减。

3. extractedFields
   - targetIndustry：JD 明确或可合理推断的行业；无法判断输出空字符串。
   - targetCompanyType：只能取 ToB SaaS公司 / AI创业公司 / 互联网大厂 /
     传统软件企业 / 外企 / 国企/央企；无法判断输出空字符串。
   - jobStage：这是用户当前求职阶段，JD 无法提供，必须输出空字符串。
   - highlightSkills：从 JD 提取 3-6 项核心能力，用"、"分隔；没有则空字符串。

只输出合法 JSON，不要输出 Markdown、解释或思考过程：
{
  "translatedTitle": "中文岗位名称",
  "translatedJd": "保持原段落结构的完整中文译文",
  "extractedFields": {
    "targetIndustry": "",
    "targetCompanyType": "",
    "jobStage": "",
    "highlightSkills": ""
  },
  "language": "zh" | "en" | "other"
}`;

const EMPTY_FIELDS = {
  targetIndustry: '',
  targetCompanyType: '',
  jobStage: '',
  highlightSkills: '',
};

function detectLanguageSimple(text) {
  if (!text) return 'other';
  const sample = text.slice(0, 4000);
  const asciiLetters = (sample.match(/[A-Za-z]/g) || []).length;
  const cjkChars = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const total = asciiLetters + cjkChars;
  if (total === 0) return 'other';
  return asciiLetters / total > 0.3 ? 'en' : 'zh';
}

export function normalizeExtractedFields(fields = {}) {
  const targetCompanyType = String(fields.targetCompanyType || '').trim();
  const jobStage = String(fields.jobStage || '').trim();
  return {
    targetIndustry: String(fields.targetIndustry || '').trim().slice(0, 120),
    targetCompanyType: ['不限', '未知'].includes(targetCompanyType)
      ? ''
      : targetCompanyType.slice(0, 80),
    jobStage: ['不限', '未知'].includes(jobStage) ? '' : jobStage.slice(0, 80),
    highlightSkills: String(fields.highlightSkills || '').trim().slice(0, 500),
  };
}

export function normalizeTranslationResult(parsed = {}, original = {}) {
  const originalTitle = String(original.title || '').trim();
  const originalJd = String(original.jd || '').trim();
  const translatedTitle = String(parsed.translatedTitle || originalTitle).trim();
  const translatedJd = String(parsed.translatedJd || originalJd).trim();
  const detectedLanguage = detectLanguageSimple(`${originalTitle}\n${originalJd}`);
  const language = ['zh', 'en', 'other'].includes(parsed.language)
    ? parsed.language
    : detectedLanguage;

  return {
    originalTitle,
    translatedTitle,
    bilingualTitle: formatBilingualTitle(originalTitle, translatedTitle),
    originalJd,
    translatedJd,
    bilingualJd: formatBilingualParagraphs(originalJd, translatedJd),
    extractedFields: normalizeExtractedFields(parsed.extractedFields),
    language,
    translated:
      language === 'en' &&
      Boolean(translatedJd) &&
      translatedJd !== originalJd,
  };
}

function fallbackResult(title, jd, language, reason) {
  return {
    ...normalizeTranslationResult(
      {
        translatedTitle: title,
        translatedJd: jd,
        extractedFields: EMPTY_FIELDS,
        language,
      },
      { title, jd },
    ),
    translated: false,
    reason,
  };
}

/**
 * 翻译岗位名称和 JD，并抽取结构化字段。
 * 任意 AI 故障均保留原文，由调用方决定是否继续主分析。
 */
export async function translateAndExtract(jdText, titleText = '') {
  const safeJd = String(jdText || '').trim();
  const safeTitle = String(titleText || '').trim();
  const language = detectLanguageSimple(`${safeTitle}\n${safeJd}`);

  if (!safeJd || safeJd.length < 20) {
    return fallbackResult(safeTitle, safeJd, language, 'jd_too_short');
  }
  if (!isMiniMaxConfigured()) {
    return fallbackResult(safeTitle, safeJd, language, 'no_api_key');
  }

  try {
    const prompt = `【原始岗位名称】\n${safeTitle || '（未提供）'}\n\n` +
      `【原始 JD（主要语言：${language}）】\n${safeJd.slice(0, 12_000)}\n\n` +
      '请严格按系统提示输出 JSON。';
    const completion = await minimaxClient.complete(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.3,
        maxCompletionTokens: 16_384,
        timeoutMs: Math.max(config.minimax.timeout, 180_000),
      },
    );
    return normalizeTranslationResult(
      extractJsonObject(completion.content),
      { title: safeTitle, jd: safeJd },
    );
  } catch (error) {
    console.error('[jd-translator] AI 调用失败:', error.message);
    return fallbackResult(safeTitle, safeJd, language, `ai_error: ${error.message}`);
  }
}
