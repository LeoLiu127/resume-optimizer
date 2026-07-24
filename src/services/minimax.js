/**
 * MiniMax 开放平台 API 客户端
 * 兼容 OpenAI Chat Completions 协议
 *
 * 配置通过 Vite 环境变量注入（构建时）：
 *   VITE_MINIMAX_API_KEY    必填，Bearer Token
 *   VITE_MINIMAX_BASE_URL   可选，默认 https://api.minimaxi.com/v1
 *   VITE_MINIMAX_MODEL      可选，默认 MiniMax-M3
 *   VITE_MINIMAX_TIMEOUT    可选，默认 60000ms
 */

const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MODEL = 'MiniMax-M3';
const DEFAULT_TIMEOUT = 60000;

const trimTrailingSlash = (url = '') => url.replace(/\/+$/, '');

export function getMiniMaxConfig() {
  const apiKey = import.meta.env.VITE_MINIMAX_API_KEY || '';
  const baseUrl = trimTrailingSlash(import.meta.env.VITE_MINIMAX_BASE_URL || DEFAULT_BASE_URL);
  const model = import.meta.env.VITE_MINIMAX_MODEL || DEFAULT_MODEL;
  const timeout = Number(import.meta.env.VITE_MINIMAX_TIMEOUT) || DEFAULT_TIMEOUT;
  return { apiKey, baseUrl, model, timeout };
}

export function isMiniMaxConfigured() {
  const { apiKey } = getMiniMaxConfig();
  return Boolean(apiKey) && !/^请替换|^eyJhbGciOi\.\.\./.test(apiKey);
}

/**
 * 通用 MiniMax Chat Completions 调用
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {boolean} [options.jsonMode]  是否要求 JSON 输出
 * @returns {Promise<string>} assistant 文本内容
 */
export async function chatCompletions(messages, options = {}) {
  const { apiKey, baseUrl, model: defaultModel, timeout } = getMiniMaxConfig();

  if (!isMiniMaxConfigured()) {
    throw new Error('未检测到可用的 MiniMax API Key，请在 .env 中配置 VITE_MINIMAX_API_KEY');
  }

  const payload = {
    model: options.model || defaultModel,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 4096,
    stream: false,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error(`MiniMax 请求超时（${timeout}ms），请检查网络或调大 VITE_MINIMAX_TIMEOUT`);
    }
    throw new Error(`MiniMax 网络异常：${error.message || error}`);
  }
  clearTimeout(timer);

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || body?.message || JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`MiniMax 请求失败（${response.status}）：${detail || response.statusText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('MiniMax 返回内容为空，请稍后重试');
  }

  return content;
}

/**
 * 从模型输出中尽可能稳健地抽取 JSON 字符串
 * 处理 ```json ... ``` 代码块、首尾多余文本等情况
 */
export function extractJson(text = '') {
  if (!text) throw new Error('模型返回为空');

  // 直接解析成功
  try {
    return JSON.parse(text);
  } catch {
    // ignore, try fallback
  }

  // 抽取 ```json ... ``` 代码块
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }

  // 抽取首个 { 到最后一个 } 之间的内容
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  throw new Error('无法从模型输出中解析 JSON');
}