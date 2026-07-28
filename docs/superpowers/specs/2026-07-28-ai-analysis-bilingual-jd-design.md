# AI 分析可靠性与双语 JD 设计

## 背景与问题

当前“岗位解析”会把完整 `input` 发送到 `/api/analyze`，后端也会调用
MiniMax-M3，但使用了兼容接口 `/chat/completions`、已废弃的 `max_tokens`
以及 M3 不支持的 `response_format: json_object`。M3 返回的推理文本混在
`content` 中，并在 6000 token 上限处截断；JSON 解析失败后，服务端与前端
又静默回退 Mock，造成“看起来完成、实际没有 AI 分析”的错误状态。

JD URL 提取当前只返回中文译文并覆盖原始 JD，不保存原文；岗位标题没有翻译。
点击“岗位解析”也不会对手工粘贴或历史保存的英文 JD 执行翻译，因此无法实现
按段落中英双语显示。

## 已确认的产品行为

1. 点击“岗位解析”必须把当前岗位目标、JD、简历、补充信息和追问回答发送给
   服务端，并且只有成功解析模型结果后才能标记为 MiniMax-M3。
2. AI 调用或结构化解析失败时必须显示真实错误；默认不得返回 Mock 冒充成功。
3. Mock 仅作为显式启用的演示模式存在。
4. 英文岗位名称显示为“英文 / 中文”；英文 JD 按段落显示原文，下一段紧跟中文。
5. 中文或已包含中英双语的内容不得重复翻译。
6. URL 提取和点击“岗位解析”使用同一套双语格式化规则。
7. 原有简历分析页面、评分、追问、优化、面试准备和导出数据结构保持不变。

## 方案比较

### 方案 A：只提高 token 上限

改动最小，但仍使用错误的兼容接口，推理文本仍可能污染 JSON，也无法解决静默
Mock 和双语数据链。拒绝。

### 方案 B：立即拆成多次模型调用

可靠性高，但请求次数、延迟和费用都会明显增加，并且需要重构现有一次性分析
数据流。作为方案 C 真实验收失败后的后备方案。

### 方案 C：官方文本接口 + 完成状态校验 + 双语预处理

采用 MiniMax 官方 `/text/chatcompletion_v2`，使用
`max_completion_tokens`，读取独立的最终 `content`，并检查
`finish_reason`。保留现有一次性分析 Schema；默认禁用 Mock 回退。新增独立
JD 翻译端点，在主分析前把英文标题和 JD 转为双语输入。选择此方案。

## 架构与数据流

### MiniMax 客户端

新增 `server/src/minimax-client.js`，集中负责：

- 构建官方文本生成 URL。
- 使用 `max_completion_tokens` 调用 MiniMax-M3。
- 返回 `{ content, reasoningContent, finishReason, model, usage }`。
- HTTP 失败、空内容和 `finish_reason === "length"` 时抛出可读错误。

新增 `server/src/json-response.js`，集中负责：

- 去除 `<think>...</think>`。
- 解析纯 JSON、JSON 代码块或文本中的第一个平衡 JSON 对象。
- 对不完整 JSON 给出明确错误，不生成 Mock。

主分析和 JD 翻译共享这两个模块，避免两套 API 客户端行为漂移。

### 主分析

`POST /api/analyze` 保持请求和成功响应结构不变：

```json
{ "engine": "minimax-m3", "data": {} }
```

只有 `SERVER_FALLBACK_MOCK=true` 时才允许返回 Mock。默认配置和前端异常处理
均不再静默生成 Mock。失败返回 502，前端保留输入、清除旧分析并展示错误。

### 双语 JD

新增 `POST /api/jd/translate`：

```json
{
  "title": "Mandarin Translation Specialist",
  "jdContent": "English JD"
}
```

返回：

```json
{
  "originalTitle": "Mandarin Translation Specialist",
  "translatedTitle": "普通话翻译专家",
  "bilingualTitle": "Mandarin Translation Specialist / 普通话翻译专家",
  "originalJd": "English JD",
  "translatedJd": "中文 JD",
  "bilingualJd": "English paragraph\n中文段落"
}
```

URL 提取接口返回相同字段。前端在点击“岗位解析”时检测英文且未包含足够中文的
内容，先调用翻译端点，再用双语后的 input 调用主分析。

## 错误处理

- 配置缺失：503，不默认 Mock。
- MiniMax 网络/HTTP 错误：502，包含安全、可展示的错误摘要。
- 模型输出截断：502，提示输出被截断。
- JSON 无法解析：502，提示模型返回格式异常。
- 双语翻译失败：保留原始输入并继续主分析，同时显示翻译错误；不得清空内容。
- 日志记录请求阶段、响应模型、finish reason 和错误信息，不记录 JD、简历或 Key。

## 测试与验收

1. 单元测试覆盖 `<think>`、代码块、平衡 JSON、截断和空响应。
2. API 合约测试覆盖默认禁用 Mock、显式演示 Mock 和成功引擎标记。
3. 双语测试覆盖标题拼接、按段配对、中文不重复翻译和缺失译文降级。
4. 全量服务端测试和前端生产构建通过。
5. 使用非敏感合成 JD 发起真实 MiniMax 主分析，必须得到可解析 JSON。
6. 浏览器验收必须显示 MiniMax-M3，而不是 Mock；英文标题和 JD 显示中英双语。

