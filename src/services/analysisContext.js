const ANALYSIS_INPUT_KEYS = [
  'targetRole',
  'targetIndustry',
  'targetCompanyType',
  'jobStage',
  'highlightSkills',
  'jd',
  'resume',
  'extras',
];

function normalizeValue(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function createAnalysisContextKey(input, resumeId = '', positionId = '') {
  return JSON.stringify([
    normalizeValue(resumeId),
    normalizeValue(positionId),
    ...ANALYSIS_INPUT_KEYS.map((key) => normalizeValue(input?.[key])),
  ]);
}

export function isAnalysisCurrent(input, analyzedInput) {
  if (!analyzedInput) return false;
  return ANALYSIS_INPUT_KEYS.every(
    (key) => normalizeValue(input?.[key]) === normalizeValue(analyzedInput?.[key]),
  );
}

export function canUseAnalysis(analysis, input, analyzedInput) {
  return Boolean(analysis) && isAnalysisCurrent(input, analyzedInput);
}

