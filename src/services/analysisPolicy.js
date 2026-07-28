export function analysisFailureState(error) {
  const message = error?.message || '未知错误';
  return {
    data: null,
    engine: '',
    error: `AI 分析失败：${message}`,
  };
}
