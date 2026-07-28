function tryParseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function findBalancedObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }
  return '';
}

export function stripThinkBlocks(text = '') {
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

export function extractJsonObject(text = '') {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('MiniMax 返回内容为空');
  }

  const candidates = [raw, stripThinkBlocks(raw)];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  for (const candidate of candidates) {
    const direct = tryParseObject(candidate);
    if (direct) return direct;

    for (let index = candidate.indexOf('{'); index !== -1; index = candidate.indexOf('{', index + 1)) {
      const balanced = findBalancedObject(candidate, index);
      if (!balanced) continue;
      const parsed = tryParseObject(balanced);
      if (parsed) return parsed;
    }
  }

  throw new Error('MiniMax 返回格式异常：无法解析完整 JSON 对象');
}
