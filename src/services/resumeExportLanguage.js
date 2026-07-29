function sortKeysRecursively(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysRecursively(value[key])]),
    );
  }
  return value;
}

export function createEnglishCacheKey(finalResume, role) {
  return JSON.stringify(sortKeysRecursively({ finalResume, role }));
}

export function updateAnalysisLifecycle(lifecycle, analysis) {
  if (lifecycle.analysis === analysis) return lifecycle;
  return {
    analysis,
    generation: lifecycle.generation + 1,
  };
}

export function createEnglishGenerationKey(generation, contentKey) {
  return JSON.stringify([generation, contentKey]);
}

export function buildLocalizedAnalysis(analysis, englishPayload) {
  return {
    ...analysis,
    summary: {
      ...analysis?.summary,
      role: englishPayload.role,
    },
    finalResume: englishPayload.finalResume,
  };
}

export function shouldApplyEnglishResponse(activeKey, responseKey) {
  return Boolean(activeKey) && activeKey === responseKey;
}

export function deriveLocalizedExport({
  analysis,
  language,
  englishKey,
  englishState,
  englishStateKey,
  englishPayload,
  cachedPayload,
}) {
  if (language !== 'en') {
    return {
      analysis,
      state: 'ready',
      canExport: Boolean(analysis?.finalResume),
    };
  }

  const payload = englishPayload?.key === englishKey
    ? englishPayload.payload
    : cachedPayload;
  if (payload) {
    return {
      analysis: buildLocalizedAnalysis(analysis, payload),
      state: 'ready',
      canExport: true,
    };
  }

  return {
    analysis: null,
    state: englishStateKey === englishKey ? englishState : 'idle',
    canExport: false,
  };
}
