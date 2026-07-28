const EMPTY_DERIVED_FIELDS = {
  targetIndustry: '',
  targetCompanyType: '',
  jobStage: '',
  highlightSkills: '',
};

function normalizeExtractedFields(fields = {}) {
  const targetCompanyType = String(fields.targetCompanyType || '').trim();
  const jobStage = String(fields.jobStage || '').trim();
  return {
    targetIndustry: String(fields.targetIndustry || '').trim(),
    targetCompanyType: ['不限', '未知'].includes(targetCompanyType) ? '' : targetCompanyType,
    jobStage: ['不限', '未知'].includes(jobStage) ? '' : jobStage,
    highlightSkills: String(fields.highlightSkills || '').trim(),
  };
}

export function mergeJdExtractionIntoInput(previousInput, extraction) {
  const derivedFields = normalizeExtractedFields(extraction?.extractedFields);
  return {
    ...previousInput,
    targetRole: extraction?.title || previousInput.targetRole,
    jd: extraction?.jdContent || previousInput.jd,
    ...derivedFields,
  };
}

export function mergeBilingualTranslationIntoInput(previousInput, translation) {
  return {
    ...previousInput,
    targetRole: translation?.bilingualTitle || previousInput.targetRole,
    jd: translation?.bilingualJd || previousInput.jd,
  };
}

export function buildPositionPayload({
  input,
  extractedData,
  jdUrl = '',
  sourceSite = '',
}) {
  const hasExtraction = Boolean(extractedData);
  const derivedFields = hasExtraction
    ? normalizeExtractedFields(extractedData.extractedFields)
    : {
        ...EMPTY_DERIVED_FIELDS,
        targetIndustry: input.targetIndustry || '',
        targetCompanyType: input.targetCompanyType || '',
        jobStage: input.jobStage || '',
        highlightSkills: input.highlightSkills || '',
      };

  return {
    title: extractedData?.title || input.targetRole || '未命名岗位',
    company: extractedData?.company || '',
    url: jdUrl.trim(),
    sourceSite,
    jdContent: extractedData?.jdContent || input.jd || '',
    ...derivedFields,
    extras: input.extras || '',
  };
}
