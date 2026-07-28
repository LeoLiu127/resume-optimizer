export const ANALYSIS_ACTION_HINT =
  '更新输入或追问回答后，点击“重新生成结果”刷新全部结果';

export function getAnalysisActionLabel({ busy, hasAnalysis }) {
  if (busy) return '智能优化中…';
  return hasAnalysis ? '重新生成结果' : '开始智能优化';
}
