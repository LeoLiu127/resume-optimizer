const INPUT_KEYS = [
  'targetRole',
  'targetIndustry',
  'targetCompanyType',
  'jobStage',
  'highlightSkills',
  'jd',
  'resume',
  'extras',
];

export function isExactExampleInput(input, exampleInput) {
  return INPUT_KEYS.every((key) => (input?.[key] || '') === (exampleInput?.[key] || ''));
}

export function shouldAutoSaveDraft(input, exampleInput, resumeListLoaded) {
  if (!resumeListLoaded || isExactExampleInput(input, exampleInput)) return false;
  return Boolean(
    input?.resume ||
      input?.jd ||
      input?.targetRole ||
      input?.highlightSkills ||
      input?.extras,
  );
}

export function resumeRecordToEditorState(record) {
  const fallbackInput = {
    targetRole: record?.targetRole || '',
    targetIndustry: '',
    targetCompanyType: '',
    jobStage: '',
    highlightSkills: '',
    jd: '',
    resume: record?.content || '',
    extras: '',
  };
  const input =
    record?.input && typeof record.input === 'object'
      ? { ...fallbackInput, ...record.input }
      : fallbackInput;
  const positionId = record?.positionId || '';

  return {
    input,
    title: record?.name || '',
    positionId,
    positionTitle: positionId ? input.targetRole || record?.targetRole || '当前岗位' : '',
  };
}
