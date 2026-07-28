function languageCounts(text = '') {
  const value = String(text || '');
  return {
    latin: (value.match(/[A-Za-z]/g) || []).length,
    cjk: (value.match(/[\u4e00-\u9fff]/g) || []).length,
  };
}

function isBilingual(text = '') {
  const { latin, cjk } = languageCounts(text);
  return latin >= 10 && cjk >= 4;
}

function splitParagraphs(text = '') {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function needsBilingualTranslation(title = '', jd = '') {
  const combined = `${title}\n${jd}`.trim();
  if (!combined || isBilingual(combined)) return false;
  const { latin, cjk } = languageCounts(combined);
  return latin >= 20 && cjk < 4;
}

export function formatBilingualTitle(original = '', translated = '') {
  const source = String(original || '').trim();
  const target = String(translated || '').trim();
  if (!source) return target;
  if (!target || source === target || isBilingual(source)) return source;
  return `${source} / ${target}`;
}

export function formatBilingualParagraphs(original = '', translated = '') {
  const source = String(original || '').trim();
  const target = String(translated || '').trim();
  if (!source) return target;
  if (!target || source === target || isBilingual(source)) return source;

  const sourceParagraphs = splitParagraphs(source);
  const translatedParagraphs = splitParagraphs(target);
  const paragraphCount = Math.max(sourceParagraphs.length, translatedParagraphs.length);
  const paired = [];

  for (let index = 0; index < paragraphCount; index += 1) {
    const sourceParagraph = sourceParagraphs[index] || '';
    const translatedParagraph = translatedParagraphs[index] || '';
    paired.push(
      [sourceParagraph, translatedParagraph]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return paired.filter(Boolean).join('\n\n');
}
