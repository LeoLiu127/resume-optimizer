# AI Analysis and Bilingual JD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“岗位解析”稳定展示真实 MiniMax-M3 分析，并把英文岗位名称和 JD 按段落转为中英双语。

**Architecture:** 抽取共享 MiniMax 官方文本客户端和 JSON 解析器，主分析与 JD 翻译复用；默认关闭静默 Mock。前端在主分析前按需调用双语翻译端点，再把同一份双语 input 发送给分析接口。

**Tech Stack:** React 18、Express 4、Node.js 24 内置测试运行器、MiniMax-M3 官方文本生成 API。

## Global Constraints

- 不改变现有分析结果 Schema 和九步页面流程。
- 不输出或记录 API Key、JD、简历正文。
- 不覆盖用户已有工作区改动，不执行 Git 提交或重置。
- 所有行为修改先写失败测试并确认 RED，再写最小实现。
- Mock 只允许通过 `SERVER_FALLBACK_MOCK=true` 显式启用。

---

### Task 1: MiniMax 响应契约

**Files:**
- Create: `server/src/json-response.js`
- Create: `server/src/minimax-client.js`
- Create: `server/test/minimax-response.test.mjs`
- Modify: `server/src/routes/analyze.js`
- Modify: `server/src/jd-translator.js`

**Interfaces:**
- Produces: `extractJsonObject(text)`
- Produces: `createMiniMaxClient(config).complete(messages, options)`

- [ ] **Step 1: Write the failing response tests**

```js
test('extracts JSON after a think block', () => {
  assert.deepEqual(extractJsonObject('<think>reason</think>\\n{"ok":true}'), { ok: true });
});

test('rejects a length-truncated completion', () => {
  assert.throws(
    () => validateCompletion({ content: '{"ok":', finishReason: 'length' }),
    /截断/,
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/minimax-response.test.mjs`

Expected: FAIL because the response modules do not exist.

- [ ] **Step 3: Implement the official API client and parser**

The client sends `max_completion_tokens`, does not send M3-unsupported
`response_format`, reads `reasoning_content` separately, and rejects empty or
length-truncated results before parsing.

- [ ] **Step 4: Route both analysis and translation through the shared client**

Replace the duplicated `/chat/completions` clients while preserving successful
route response shapes.

- [ ] **Step 5: Run GREEN**

Run: `node --test test/minimax-response.test.mjs`

Expected: all response tests pass.

### Task 2: Honest analysis failure behavior

**Files:**
- Modify: `server/src/routes/analyze.js`
- Modify: `src/hooks/useResumeAnalysis.js`
- Modify: `server/test/api-contract.test.mjs`

**Interfaces:**
- Consumes: `createMiniMaxClient(config).complete`
- Produces: HTTP 502 on AI failure unless explicit demo fallback is enabled.

- [ ] **Step 1: Add failing API tests**

```js
test('analysis does not silently return mock when fallback is not enabled', async () => {
  assert.equal(response.status, 503);
  assert.equal(response.body.engine, undefined);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/api-contract.test.mjs`

Expected: FAIL because current default returns HTTP 200 Mock.

- [ ] **Step 3: Disable default server and client Mock fallback**

Set server fallback default to false. In the React hook, keep `data` empty and
surface the API error instead of constructing local Mock data.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/api-contract.test.mjs`

Expected: API failure tests pass and explicit demo fallback remains covered.

### Task 3: Bilingual title and paragraph formatting

**Files:**
- Create: `src/services/bilingualJd.js`
- Create: `server/test/bilingual-jd.test.mjs`
- Modify: `server/src/jd-translator.js`
- Modify: `server/src/routes/jd.js`
- Modify: `src/services/jdFieldMapping.js`

**Interfaces:**
- Produces: `needsBilingualTranslation(title, jd)`
- Produces: `formatBilingualTitle(original, translated)`
- Produces: `formatBilingualParagraphs(original, translated)`

- [ ] **Step 1: Add failing bilingual formatting tests**

```js
test('pairs every English paragraph with its Chinese translation', () => {
  assert.equal(
    formatBilingualParagraphs('First.\\n\\nSecond.', '第一段。\\n\\n第二段。'),
    'First.\\n第一段。\\n\\nSecond.\\n第二段。',
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/bilingual-jd.test.mjs`

Expected: FAIL because `src/services/bilingualJd.js` does not exist.

- [ ] **Step 3: Implement pure bilingual helpers**

Preserve paragraph order, avoid duplicate translation for Chinese/bilingual
content, and retain unmatched source or translated paragraphs.

- [ ] **Step 4: Extend translator and JD route contracts**

Return original, translated and bilingual title/JD fields from both URL
extraction and direct translation.

- [ ] **Step 5: Run GREEN**

Run: `node --test test/bilingual-jd.test.mjs`

Expected: all bilingual helper and contract tests pass.

### Task 4: Analyze-time bilingual preprocessing

**Files:**
- Modify: `src/services/api.js`
- Modify: `src/App.jsx`
- Modify: `src/services/jdFieldMapping.js`

**Interfaces:**
- Consumes: `jd.translate({ title, jdContent })`
- Produces: the exact bilingual input object later sent to `ai.analyze`.

- [ ] **Step 1: Add failing mapping test**

```js
test('analysis preprocessing uses bilingual title and JD without changing resume', () => {
  assert.equal(next.targetRole, 'English / 中文');
  assert.equal(next.jd, 'English paragraph\\n中文段落');
  assert.equal(next.resume, previous.resume);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/jd-field-mapping.test.mjs`

Expected: FAIL because bilingual translation responses are not merged.

- [ ] **Step 3: Add direct translation API and preprocess before analyze**

Call `/api/jd/translate` only when the pure helper reports that English content
still needs translation. Analyze the updated local object, not stale React
state.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/jd-field-mapping.test.mjs`

Expected: mapping tests pass.

### Task 5: End-to-end verification

**Files:**
- Modify: `server/.env` only if the configured timeout is below the verified request duration.

**Interfaces:**
- Consumes: running frontend and backend.
- Produces: verified MiniMax-M3 UI analysis and bilingual input display.

- [ ] **Step 1: Run full automated verification**

Run: `npm test` in `server`.

Run: `npm run build` in the project root.

Run: `git diff --check`.

- [ ] **Step 2: Restart only the Node process listening on port 4000**

Verify `GET /api/health` returns `minimaxConfigured: true`.

- [ ] **Step 3: Run a real non-sensitive MiniMax analysis**

Send a synthetic bilingual-specialist JD and resume. Require HTTP 200,
`engine: minimax-m3`, complete JSON, and no Mock fallback.

- [ ] **Step 4: Verify the browser UI**

Confirm the title uses `English / 中文`, JD paragraphs alternate English and
Chinese, and the analysis result badge reads MiniMax-M3.

