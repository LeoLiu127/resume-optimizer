export function parseCompletionResponse(data = {}) {
  const choice = data?.choices?.[0];
  const finishReason = choice?.finish_reason || '';
  const content = String(choice?.message?.content || '');
  const reasoningContent = String(
    choice?.message?.reasoning_content || choice?.message?.reasoning || '',
  );

  if (finishReason === 'length') {
    throw new Error('MiniMax 输出被截断，请缩短输入或提高输出上限');
  }
  if (!content.trim()) {
    throw new Error('MiniMax 返回内容为空');
  }

  return {
    content,
    reasoningContent,
    finishReason,
    model: String(data?.model || ''),
    usage: data?.usage || null,
  };
}

export function createMiniMaxClient(minimaxConfig, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前 Node.js 环境不支持 fetch');
  }

  return {
    async complete(messages, options = {}) {
      const {
        apiKey,
        baseUrl,
        model: defaultModel,
        timeout: defaultTimeout,
      } = minimaxConfig;
      if (!apiKey) {
        throw new Error('服务端未配置 MiniMax API Key');
      }

      const payload = {
        model: options.model || defaultModel,
        messages,
        temperature: options.temperature ?? 0.4,
        top_p: options.topP ?? 0.95,
        max_completion_tokens: options.maxCompletionTokens ?? 16_384,
        stream: false,
      };
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? defaultTimeout;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/text/chatcompletion_v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error(`MiniMax 请求超时（${timeoutMs}ms）`);
        }
        throw new Error(`MiniMax 网络异常：${error.message || error}`);
      } finally {
        clearTimeout(timer);
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok || Number(data?.base_resp?.status_code || 0) !== 0) {
        const detail =
          data?.base_resp?.status_msg ||
          data?.error?.message ||
          data?.message ||
          response.statusText;
        throw new Error(`MiniMax 请求失败（${response.status}）：${detail || '未知错误'}`);
      }

      return parseCompletionResponse(data);
    },
  };
}
