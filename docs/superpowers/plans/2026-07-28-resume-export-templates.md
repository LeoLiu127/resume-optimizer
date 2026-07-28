# 主操作与双语简历导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把顶部主操作改成右侧“开始智能优化”，把导出页改成“简历导出”，增加按需生成并缓存的纯英文简历，同时将 Classic/Modern 替换为编辑出版型/精准网格型并保留 Minimal。

**Architecture:** 保持现有 `analysis.finalResume → buildResumeView → HTML/PDF/DOCX 模板` 数据链。新增独立的服务端英文简历转换端点和前端会话级缓存；模板内部 key 继续使用 `classic/modern/minimal`，只替换展示元数据和两套视觉实现。

**Tech Stack:** React 18、Vite 5、Express 4、MiniMax-M3、`@react-pdf/renderer`、`docx`、Node.js `node:test`

## Global Constraints

- 主按钮初始文案为“开始智能优化”，处理中为“智能优化中…”，已有分析时为“重新生成结果”。
- 主按钮位于顶部工具栏操作序列最右侧；窄屏换行后仍保持序列末尾。
- “导出结果”统一改为“简历导出”。
- 英文简历按需由 MiniMax 按英文招聘语境重写，不逐字直译，不虚构信息。
- 英文结果仅在当前分析生命周期内缓存；新分析必须使旧缓存失效。
- `classic` 映射到编辑出版型，`modern` 映射到精准网格型，`minimal` 保持原样。
- HTML 预览、PDF 与 Word 必须消费相同的结构化视图并保持一致的信息层级。
- 不改变 MiniMax 供应商、API Base、模型名或主分析 Schema。
- 当前工作树已有用户未提交改动；执行时不得覆盖、重置或顺带提交无关改动。

---

### Task 1: 主操作文案、位置与导出页签

**Files:**
- Create: `src/services/uiCopy.js`
- Modify: `src/App.jsx`
- Modify: `src/mockData.js`
- Modify: `src/styles.css`
- Test: `server/test/ui-copy.test.mjs`

**Interfaces:**
- Produces: `getAnalysisActionLabel({ busy, hasAnalysis }): string`
- Produces: `ANALYSIS_ACTION_HINT: string`
- Consumes: `loading`, `preparingAnalysis`, `analysisIsCurrent` from `App`

- [ ] **Step 1: Write the failing copy test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYSIS_ACTION_HINT,
  getAnalysisActionLabel,
} from '../../src/services/uiCopy.js';
import { steps } from '../../src/mockData.js';

test('analysis action uses full-flow labels', () => {
  assert.equal(getAnalysisActionLabel({ busy: false, hasAnalysis: false }), '开始智能优化');
  assert.equal(getAnalysisActionLabel({ busy: true, hasAnalysis: false }), '智能优化中…');
  assert.equal(getAnalysisActionLabel({ busy: false, hasAnalysis: true }), '重新生成结果');
  assert.match(ANALYSIS_ACTION_HINT, /重新生成结果/);
});

test('export step is named resume export', () => {
  assert.equal(steps.at(-1), '简历导出');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd server && node --test --test-name-pattern="analysis action|export step" test/*.test.mjs`

Expected: FAIL because `src/services/uiCopy.js` does not exist and the final step is still “导出结果”.

- [ ] **Step 3: Add the copy helper**

```js
export const ANALYSIS_ACTION_HINT =
  '更新输入或追问回答后，点击“重新生成结果”刷新全部结果';

export function getAnalysisActionLabel({ busy, hasAnalysis }) {
  if (busy) return '智能优化中…';
  return hasAnalysis ? '重新生成结果' : '开始智能优化';
}
```

- [ ] **Step 4: Move the primary action into `.topbar-actions`**

In `src/App.jsx`:

```jsx
<button
  className="primary-button topbar-analysis-action"
  onClick={handleAnalyze}
  disabled={loading || preparingAnalysis}
  title={analysisStarted ? ANALYSIS_ACTION_HINT : '生成完整的岗位分析与定制简历'}
>
  {getAnalysisActionLabel({
    busy: loading || preparingAnalysis,
    hasAnalysis: analysisIsCurrent,
  })}
</button>
```

Remove the standalone `.topbar-main-action` block. Change the export header title and
subtitle to “简历导出” and “选择语言、模板与格式，预览并导出定制简历。”

In `src/styles.css`, remove obsolete `.topbar-main-action` rules and add:

```css
.topbar-analysis-action {
  min-width: 132px;
  height: 38px;
  margin-left: 6px;
}

@media (max-width: 900px) {
  .topbar-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

- [ ] **Step 5: Run tests and build**

Run: `cd server && node --test --test-name-pattern="analysis action|export step" test/*.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Vite build exits 0.

- [ ] **Step 6: Review only intended Task 1 diffs**

Run: `git diff -- src/services/uiCopy.js src/App.jsx src/mockData.js src/styles.css server/test/ui-copy.test.mjs`

Expected: no unrelated changes are removed. Because shared files were dirty before this task,
do not commit them automatically; preserve the reviewed diff as a checkpoint.

---

### Task 2: MiniMax 纯英文简历生成端点

**Files:**
- Create: `server/src/resume-english.js`
- Modify: `server/src/routes/analyze.js`
- Modify: `src/services/prompts.js`
- Test: `server/test/resume-english.test.mjs`
- Test: `server/test/api-contract.test.mjs`

**Interfaces:**
- Produces: `RESUME_ENGLISH_SYSTEM: string`
- Produces: `buildResumeEnglishPrompt(finalResume, role): string`
- Produces: `normalizeEnglishResume(value, fallback): finalResume`
- Produces: `POST /api/analyze/resume-english`

- [ ] **Step 1: Write failing normalization and prompt tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnglishResume } from '../src/resume-english.js';
import {
  RESUME_ENGLISH_SYSTEM,
  buildResumeEnglishPrompt,
} from '../../src/services/prompts.js';

const source = {
  basic: ['张晨', 'AI产品经理'],
  summary: '负责企业产品。',
  skills: ['需求分析'],
  tools: ['Figma'],
  experience: [{ company: 'A科技', title: '产品经理', period: '2021-至今', bullets: ['负责需求'] }],
  projects: [],
  education: 'XX大学 本科',
  extras: [],
};

test('english resume prompt preserves facts and schema', () => {
  const prompt = buildResumeEnglishPrompt(source, 'AI产品经理');
  assert.match(RESUME_ENGLISH_SYSTEM, /Do not invent/i);
  assert.match(prompt, /"finalResume"/);
  assert.match(prompt, /A科技/);
});

test('english resume normalization keeps all schema fields', () => {
  const normalized = normalizeEnglishResume({
    finalResume: {
      ...source,
      basic: ['Zhang Chen', 'AI Product Manager'],
      summary: 'Enterprise product manager.',
    },
    role: 'AI Product Manager',
  }, { finalResume: source, role: 'AI产品经理' });
  assert.equal(normalized.role, 'AI Product Manager');
  assert.equal(normalized.finalResume.basic[0], 'Zhang Chen');
  assert.deepEqual(normalized.finalResume.projects, []);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd server && node --test --test-name-pattern="english resume" test/*.test.mjs`

Expected: FAIL because the prompt exports and normalizer do not exist.

- [ ] **Step 3: Implement prompt and structural normalization**

Add a system prompt that requires `{ "role": string, "finalResume": object }`, pure-English
content, unchanged facts, preserved company/product/technology names, and JSON-only output.
`normalizeEnglishResume` must coerce strings/arrays, cap bullets consistently with
`normalizeFinalResume`, and throw `英文简历结构无效` when the response lacks `finalResume`.

- [ ] **Step 4: Add the authenticated endpoint before the generic error path**

In `server/src/routes/analyze.js`:

```js
router.post('/resume-english', asyncRoute(async (req, res) => {
  const { finalResume, role } = req.body || {};
  if (!finalResume || typeof finalResume !== 'object') {
    return res.status(400).json({ error: 'finalResume 必填' });
  }
  if (!isMiniMaxConfigured()) {
    return res.status(503).json({ error: '服务端未配置 MiniMax API Key' });
  }
  const completion = await minimaxClient.complete(
    [
      { role: 'system', content: RESUME_ENGLISH_SYSTEM },
      { role: 'user', content: buildResumeEnglishPrompt(finalResume, role) },
    ],
    { maxCompletionTokens: 12_288 },
  );
  const normalized = normalizeEnglishResume(
    extractJsonObject(completion.content),
    { finalResume, role },
  );
  return res.json({ engine: 'minimax-m3', ...normalized });
}));
```

Wrap MiniMax/JSON failures with status 502 and a specific “英文简历生成失败” message,
matching the existing route error style.

- [ ] **Step 5: Add API contract tests**

Extend `server/test/api-contract.test.mjs`:

```js
test('POST /api/analyze/resume-english validates finalResume', async () => {
  const result = await request('/api/analyze/resume-english', {
    method: 'POST',
    body: JSON.stringify({ role: 'AI Product Manager' }),
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /finalResume/);
});

test('POST /api/analyze/resume-english reports missing MiniMax config', async () => {
  const result = await request('/api/analyze/resume-english', {
    method: 'POST',
    body: JSON.stringify({ finalResume: { basic: ['张晨'] }, role: 'AI产品经理' }),
  });
  assert.equal(result.status, 503);
  assert.match(result.body.error, /MiniMax API Key/);
});
```

- [ ] **Step 6: Run focused and full server tests**

Run: `cd server && node --test --test-name-pattern="english resume|resume-english" test/*.test.mjs`

Expected: PASS.

Run: `cd server && npm test`

Expected: all tests pass.

---

### Task 3: 导出语言模型、模板目录与文件名

**Files:**
- Create: `src/services/resumeExportLanguage.js`
- Create: `src/templates/templateCatalog.js`
- Modify: `src/services/api.js`
- Modify: `src/utils/resumeData.js`
- Modify: `src/services/exportResume.js`
- Test: `server/test/resume-export-language.test.mjs`

**Interfaces:**
- Produces: `TEMPLATES`
- Produces: `LANGUAGES`
- Produces: `createEnglishCacheKey(finalResume, role): string`
- Produces: `buildLocalizedAnalysis(analysis, englishPayload): analysis`
- Produces: `ai.resumeEnglish(finalResume, role): Promise`
- Changes: `buildFileName(view, role, templateKey, ext, language)`
- Changes: `exportPdf/exportDocx` payload accepts `language`

- [ ] **Step 1: Write the failing helper test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../../src/templates/templateCatalog.js';
import {
  buildLocalizedAnalysis,
  createEnglishCacheKey,
} from '../../src/services/resumeExportLanguage.js';
import { buildFileName } from '../../src/utils/resumeData.js';

test('template catalog preserves stable keys with new names', () => {
  assert.deepEqual(TEMPLATES.map(({ key, label }) => [key, label]), [
    ['classic', '编辑出版型'],
    ['modern', '精准网格型'],
    ['minimal', '极简留白'],
  ]);
});

test('english cache key changes with resume content', () => {
  assert.notEqual(
    createEnglishCacheKey({ basic: ['A'] }, 'PM'),
    createEnglishCacheKey({ basic: ['B'] }, 'PM'),
  );
});

test('localized analysis swaps only final resume and role', () => {
  const analysis = { summary: { role: '产品经理', fitScore: 80 }, finalResume: { basic: ['张晨'] } };
  const localized = buildLocalizedAnalysis(analysis, {
    role: 'Product Manager',
    finalResume: { basic: ['Zhang Chen'] },
  });
  assert.equal(localized.summary.fitScore, 80);
  assert.equal(localized.summary.role, 'Product Manager');
  assert.equal(localized.finalResume.basic[0], 'Zhang Chen');
});

test('english filename carries readable template and language tags', () => {
  assert.equal(
    buildFileName({ name: 'Zhang Chen' }, 'Product Manager', 'classic', 'pdf', 'en'),
    'Zhang_Chen_Product_Manager_Editorial_EN.pdf',
  );
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd server && node --test --test-name-pattern="template catalog|cache key|localized analysis|english filename" test/*.test.mjs`

Expected: FAIL because the new modules and signature do not exist.

- [ ] **Step 3: Implement pure language helpers and catalog**

```js
export const LANGUAGES = [
  { key: 'zh', label: '中文简历', shortLabel: '中文' },
  { key: 'en', label: 'English Resume', shortLabel: 'EN' },
];
```

Use a stable recursive key sorter before `JSON.stringify` so object property order does not
change the cache key. `buildLocalizedAnalysis` must return a new object and preserve all
non-export analysis fields.

- [ ] **Step 4: Add API and exporter wiring**

In `src/services/api.js`:

```js
resumeEnglish(finalResume, role) {
  return request('/api/analyze/resume-english', {
    method: 'POST',
    body: { finalResume, role },
  });
}
```

Update `exportPdf` and `exportDocx` to pass the selected localized `analysis`, `role`,
`language`, and catalog accent through the existing builders. Ensure the PDF builder also
receives `accent`; the current code drops it for Modern.

- [ ] **Step 5: Run focused tests and build**

Run: `cd server && node --test --test-name-pattern="template catalog|cache key|localized analysis|english filename" test/*.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Vite build exits 0.

---

### Task 4: 导出页语言选择、按需生成与缓存

**Files:**
- Modify: `src/components/ExportPanel.jsx`
- Modify: `src/styles.css`
- Test: `server/test/resume-export-language.test.mjs`

**Interfaces:**
- Consumes: `LANGUAGES`, `TEMPLATES`, `createEnglishCacheKey`, `buildLocalizedAnalysis`
- Consumes: `ai.resumeEnglish(finalResume, role)`
- Produces UI states: `idle | loading | ready | error`

- [ ] **Step 1: Extend the helper test with stale-response protection**

```js
test('cache key includes role and structured resume', () => {
  const resume = { basic: ['张晨'], summary: '产品经理' };
  assert.notEqual(
    createEnglishCacheKey(resume, '产品经理'),
    createEnglishCacheKey(resume, '运营经理'),
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED if key omits role**

Run: `cd server && node --test --test-name-pattern="cache key includes role" test/*.test.mjs`

Expected: FAIL until both inputs participate in the key.

- [ ] **Step 3: Implement language state and one-request-per-analysis cache**

Use:

```jsx
const [language, setLanguage] = useState('zh');
const [englishState, setEnglishState] = useState('idle');
const [englishError, setEnglishError] = useState('');
const englishCacheRef = useRef(new Map());
const requestKeyRef = useRef('');
```

When `language === 'en'`, derive the key from `analysis.finalResume` and `role`. Reuse a
cached payload immediately. Otherwise call `ai.resumeEnglish`; only apply the response when
`requestKeyRef.current === key`. Clear visible English data when the analysis key changes.

- [ ] **Step 4: Add language controls and loading/error states**

Render the language section before template selection:

```jsx
<div className="export-language-row" role="group" aria-label="简历语言">
  {LANGUAGES.map((item) => (
    <button
      key={item.key}
      type="button"
      className={`export-language-btn ${language === item.key ? 'active' : ''}`}
      onClick={() => setLanguage(item.key)}
    >
      {item.label}
    </button>
  ))}
</div>
```

Disable the export action while English is loading or unavailable. Show a retry action on
English failure without disabling Chinese export. Pass `language` to preview and exporters.

- [ ] **Step 5: Run tests and build**

Run: `cd server && node --test --test-name-pattern="cache key|localized analysis" test/*.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Vite build exits 0.

---

### Task 5: HTML 预览模板重设计

**Files:**
- Modify: `src/templates/PreviewTemplates.jsx`
- Test: `server/test/template-contract.test.mjs`

**Interfaces:**
- `ClassicPreview({ view, role, language })` → 编辑出版型
- `ModernPreview({ view, role, accent, language })` → 精准网格型
- `MinimalPreview({ view, role, language })` → 现有布局 + 语言章节标题

- [ ] **Step 1: Write a source contract test for exported components and language labels**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/templates/PreviewTemplates.jsx', import.meta.url), 'utf8');

test('preview templates expose all selected visual directions', () => {
  assert.match(source, /tpl-editorial/);
  assert.match(source, /tpl-precision-grid/);
  assert.match(source, /tpl-minimal/);
  assert.match(source, /language/);
  assert.match(source, /Selected Projects/);
  assert.match(source, /项目经历/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd server && node --test --test-name-pattern="preview templates" test/*.test.mjs`

Expected: FAIL because the new class names and language contract are absent.

- [ ] **Step 3: Implement centralized section labels**

```js
const SECTION_LABELS = {
  zh: {
    profile: '职业摘要',
    skills: '核心能力',
    experience: '工作经历',
    projects: '项目经历',
    education: '教育背景',
    extras: '其他信息',
  },
  en: {
    profile: 'Profile',
    skills: 'Core Skills',
    experience: 'Experience',
    projects: 'Selected Projects',
    education: 'Education',
    extras: 'Additional Information',
  },
};
```

- [ ] **Step 4: Replace Classic and Modern markup**

Classic/编辑出版型:

- Single continuous column.
- Large left-aligned name and role; contact block aligned right.
- Warm rust accent `#9B4F36`.
- Section label rail at approximately 24% width and content at 76%.
- No decorative metric cards.

Modern/精准网格型:

- Left information rail approximately 31%, background `#11233F`.
- Main content approximately 69%, accent `#32B7A4`.
- Contact, skills, tools and education in the rail.
- Summary, experience and projects in the main column.
- Do not render fake proficiency bars; use plain skill chips so data is not invented.

Minimal keeps its present layout and only replaces hard-coded English headings with
`SECTION_LABELS[language]`.

- [ ] **Step 5: Run contract test and build**

Run: `cd server && node --test --test-name-pattern="preview templates" test/*.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Vite build exits 0.

---

### Task 6: PDF 与 Word 模板同步

**Files:**
- Modify: `src/templates/pdf/PdfTemplates.jsx`
- Modify: `src/templates/docx/DocxTemplates.js`
- Modify: `src/services/exportResume.js`
- Test: `server/test/template-contract.test.mjs`

**Interfaces:**
- `ClassicPdfDocument({ view, role, language })`
- `ModernPdfDocument({ view, role, accent, language })`
- `MinimalPdfDocument({ view, role, language })`
- `buildClassicDocx(view, role, accent, language)`
- `buildModernDocx(view, role, accent, language)`
- `buildMinimalDocx(view, role, accent, language)`

- [ ] **Step 1: Extend template contract tests**

```js
const pdfSource = readFileSync(new URL('../../src/templates/pdf/PdfTemplates.jsx', import.meta.url), 'utf8');
const docxSource = readFileSync(new URL('../../src/templates/docx/DocxTemplates.js', import.meta.url), 'utf8');

test('pdf and docx builders accept language-aware templates', () => {
  assert.match(pdfSource, /ClassicPdfDocument\\(\\{ view, role, language/);
  assert.match(pdfSource, /ModernPdfDocument\\(\\{ view, role, accent, language/);
  assert.match(docxSource, /buildClassicDocx\\(view, role, accent, language/);
  assert.match(docxSource, /buildModernDocx\\(view, role, accent, language/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd server && node --test --test-name-pattern="pdf and docx" test/*.test.mjs`

Expected: FAIL because current signatures do not include language.

- [ ] **Step 3: Rebuild Classic as Editorial in PDF and DOCX**

Implement the same hierarchy as the HTML preview:

- Header table/row with name-role and contact.
- Thin warm accent divider.
- Two-cell section rows with narrow uppercase label and wide content.
- Page-safe work/project blocks (`wrap={false}` in PDF; `keepNext` where useful in DOCX).
- Chinese uses CJK font; English uses the existing Latin fallback.

- [ ] **Step 4: Rebuild Modern as Precision Grid in PDF and DOCX**

Implement a dark left rail and white main column. For DOCX, use a borderless two-column
table with fixed widths; for PDF, use a flex row. Use plain skills text/chips and never
derive proficiency percentages.

- [ ] **Step 5: Keep Minimal layout and localize headings**

Replace hard-coded English headings with the shared `language` mapping while preserving
font sizes, margins, black-and-white palette and single-column structure.

- [ ] **Step 6: Run tests and build**

Run: `cd server && node --test --test-name-pattern="pdf and docx|preview templates" test/*.test.mjs`

Expected: PASS.

Run: `npm run build`

Expected: Vite build exits 0.

---

### Task 7: 集成验证与视觉验收

**Files:**
- Modify if needed: `src/styles.css`
- Modify if needed: files already listed above, limited to defects found during verification
- Update: `README.md`

**Interfaces:**
- Consumes all previous tasks.
- Produces a verified desktop and narrow-screen export flow.

- [ ] **Step 1: Run all automated checks**

Run: `cd server && npm test`

Expected: all tests pass with zero failures.

Run: `npm run build`

Expected: Vite production build completes with exit code 0.

- [ ] **Step 2: Start the local app and inspect the full flow**

Run the backend and frontend using the repository README. Verify:

- Top toolbar ends with “开始智能优化”.
- The workflow has “简历导出”.
- Chinese preview renders immediately.
- First English selection shows loading, then English-only content.
- Switching template/format and returning to English does not issue a second AI request.
- “重新生成结果” invalidates the previous English version.

- [ ] **Step 3: Capture desktop and narrow-screen screenshots**

Use viewport sizes `1440×1000` and `390×844`. Check:

- No topbar overlap or left-aligned orphan primary button.
- Export controls remain usable without horizontal scrolling.
- Editorial, Precision Grid and Minimal previews remain inside the paper boundary.
- Long names, titles and bullets wrap without clipping.

- [ ] **Step 4: Export six smoke-test files**

Export one PDF and one Word file for each template using a non-sensitive sample resume.
Open or render each output and confirm:

- Text is selectable.
- Chinese glyphs render.
- English section headings and body are English-only.
- No section overlaps, clipped bullet, blank page or unexpected extra page.

- [ ] **Step 5: Update the feature summary**

Update `README.md` to list:

```markdown
- 三套导出模板（编辑出版型 / 精准网格型 / 极简留白）
- 中文与纯英文简历按需生成，支持 PDF / Word 导出
```

- [ ] **Step 6: Final diff and dirty-tree safety review**

Run: `git status --short`

Run: `git diff --check`

Run: `git diff --stat`

Expected: no whitespace errors, no generated `.superpowers/` files staged, and no unrelated
user changes removed. Add `.superpowers/` to `.gitignore` only as a separate reviewed hunk
because `.gitignore` was already modified before this feature.

- [ ] **Step 7: Commit only after explicit diff review**

Because core files were already dirty before implementation, do not run a broad
`git add .`. If the user requests a commit, stage only reviewed feature hunks/files and
verify `git diff --cached --name-only` plus `git diff --cached` before committing.
