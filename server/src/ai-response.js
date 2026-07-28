export function normalizeRewriteItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.optimizedItems)) return payload.optimizedItems;
  throw new Error('MiniMax 返回的 optimizedItems 不是数组');
}
