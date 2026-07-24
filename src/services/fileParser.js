/**
 * 文件解析工具
 * 支持 .docx（通过 mammoth）和 .pdf（通过 pdfjs-dist）转换为纯文本
 */

import mammoth from 'mammoth';

let pdfjsLib = null;
let pdfjsInited = false;

async function ensurePdfjs() {
  if (pdfjsInited) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  // Vite 会把 ?url 后缀的资源作为 URL 处理
  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjsInited = true;
  return pdfjsLib;
}

/**
 * 解析 DOCX 文件为纯文本
 */
async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * 解析 PDF 文件为纯文本
 */
async function parsePdf(file) {
  const lib = await ensurePdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = lib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .join(' ')
      .trim();
    if (pageText) {
      fullText += (fullText ? '\n\n' : '') + pageText;
    }
  }
  return fullText;
}

/**
 * 解析上传的文件，自动识别格式
 * @param {File} file
 * @returns {Promise<string>} 提取的纯文本
 */
export async function parseFile(file) {
  if (!file) throw new Error('未选择文件');

  const name = file.name.toLowerCase();

  if (name.endsWith('.docx')) {
    return parseDocx(file);
  }

  if (name.endsWith('.pdf')) {
    return parsePdf(file);
  }

  // .txt 或其他纯文本，直接读取
  if (name.endsWith('.txt') || file.type === 'text/plain') {
    return file.text();
  }

  // .doc 旧格式不支持
  if (name.endsWith('.doc')) {
    throw new Error('暂不支持 .doc 旧格式，请转换为 .docx 或 .pdf 后上传');
  }

  throw new Error(`不支持的文件格式：${file.name}，请上传 .docx / .pdf / .txt`);
}

/**
 * 校验文件是否可接受
 */
export function isAcceptable(file) {
  const name = (file?.name || '').toLowerCase();
  return name.endsWith('.docx') || name.endsWith('.pdf') || name.endsWith('.txt');
}
