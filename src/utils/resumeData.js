import { TEMPLATES } from '../templates/templateCatalog.js';

/**
 * 把 analysis.finalResume 归一化成所有模板都能消费的标准化数据
 */
export function buildResumeView(analysis, variant = 'balanced') {
  if (!analysis?.finalResume) return null;
  const finalResume = analysis.finalResume;
  const basic = Array.isArray(finalResume.basic) ? finalResume.basic : [];

  const name = basic[0] || '候选人';
  // 联系方式行通常在 basic[1..] 中，按模式挑出邮箱/电话/位置
  const contactLines = basic.slice(1);
  const emailLine = contactLines.find((line) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(line)) || '';
  const email = emailLine.replace(/^邮箱[:：]\s*/, '');
  const phoneLine = contactLines.find((line) => /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/.test(line)) || '';
  const phone = phoneLine.replace(/^电话[:：]\s*/, '');
  const locationLine = contactLines.find((line) =>
    /^所在地[:：]/.test(line) || /(北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|重庆|天津|厦门|青岛|远程|香港|台北)/.test(line),
  ) || '';
  const location = locationLine.replace(/^所在地[:：]\s*/, '');
  const headline = contactLines.find(
    (line) => !line.includes('@') && !/1[3-9]\d/.test(line) && !line.includes('目标岗位') && !line.includes('所在地') && line !== location && line !== name,
  ) || '';

  // 应用优化风格转换到 bullets
  const transform = (text) => applyVariant(text, variant);
  const experience = (finalResume.experience || []).map((item) => ({
    company: item.company,
    title: item.title,
    period: item.period,
    bullets: (item.bullets || []).map(transform).filter(Boolean),
  }));
  const projects = (finalResume.projects || []).map((item) => ({
    name: item.name,
    bullets: (item.bullets || []).map(transform).filter(Boolean),
  }));

  return {
    name,
    headline,
    email,
    phone,
    location,
    jobIntention: finalResume.jobIntention || '',
    summary: finalResume.summary || '',
    skills: (finalResume.skills || []).filter(Boolean),
    tools: (finalResume.tools || []).filter(Boolean),
    experience,
    projects,
    education: finalResume.education || '',
    extras: (finalResume.extras || []).filter(Boolean),
  };
}

function applyVariant(text, variant) {
  if (!text) return text;
  if (variant === 'concise') {
    return text
      .replace(/围绕/g, '')
      .replace(/开展/g, '')
      .replace(/相关/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (variant === 'conservative') {
    return text.replace(/推动/g, '参与推动').replace(/完善/g, '支持完善');
  }
  if (variant === 'ai' && !/AI|大模型|Prompt|Agent|RAG/.test(text)) {
    return `${text} [可进一步补充 AI 视角]`;
  }
  return text;
}

/**
 * 把 {name, view} 转成下载文件名
 */
export function buildFileName(view, role, templateKey, ext, language = 'zh') {
  const safe = (str) =>
    String(str || '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 40) || '简历';
  const template = TEMPLATES.find(({ key }) => key === templateKey);
  const templateTag = template?.fileTag || templateKey;
  const languageTag = language === 'en' ? 'EN' : 'ZH';
  return `${safe(view.name)}_${safe(role)}_${safe(templateTag)}_${languageTag}.${ext}`;
}
