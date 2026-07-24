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
  const email = contactLines.find((line) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(line)) || '';
  const phoneMatch = contactLines
    .map((line) => line.match(/1[3-9]\d{9}|\d{3,4}[-\s]?\d{3,8}/))
    .find(Boolean);
  const phone = phoneMatch ? phoneMatch[0] : '';
  const location = contactLines.find((line) =>
    /(北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|重庆|天津|厦门|青岛|远程|香港|台北)/.test(line),
  ) || '';
  const headline = contactLines.find(
    (line) => !line.includes('@') && !phoneMatch?.[0]?.includes(line) && line !== location && line !== name,
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
  if (variant === 'tob' && !/B端|客户|企业|业务/.test(text)) {
    return `${text} [突出企业客户场景]`;
  }
  return text;
}

/**
 * 把 {name, view} 转成下载文件名
 */
export function buildFileName(view, role, templateKey, ext) {
  const safe = (str) =>
    String(str || '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 40) || '简历';
  const tagMap = { classic: 'Classic', modern: 'Modern', minimal: 'Minimal' };
  return `${safe(view.name)}_${safe(role)}_${tagMap[templateKey] || templateKey}.${ext}`;
}