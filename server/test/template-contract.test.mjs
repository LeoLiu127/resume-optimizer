import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pdf } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), 'resume-preview-vite-'));
const vite = await createServer({
  root: projectRoot,
  configFile: false,
  cacheDir,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});
const {
  ClassicPreview,
  ModernPreview,
  MinimalPreview,
} = await vite.ssrLoadModule('/src/templates/PreviewTemplates.jsx');
const {
  ClassicPdfDocument,
  ModernPdfDocument,
  MinimalPdfDocument,
} = await vite.ssrLoadModule('/src/templates/pdf/PdfTemplates.jsx');
const {
  buildClassicDocx,
  buildModernDocx,
  buildMinimalDocx,
} = await vite.ssrLoadModule('/src/templates/docx/DocxTemplates.js');

after(async () => {
  await vite.close();
  await rm(cacheDir, { recursive: true, force: true });
});

const completeView = {
  name: '张晨',
  headline: '产品负责人',
  email: 'zhangchen@example.com',
  phone: '138 0000 0000',
  location: '上海',
  jobIntention: 'AI Product Manager',
  summary: '将复杂业务问题转化为可交付产品。',
  skills: ['需求分析', '跨团队协作'],
  tools: ['Figma', 'SQL'],
  experience: [{
    company: 'A科技有限公司',
    title: '产品经理',
    period: '2021 — 至今',
    bullets: ['负责 ERP/WMS 产品规划。'],
  }],
  projects: [{
    name: '库存管理项目',
    bullets: ['设计库存预警流程。'],
  }],
  education: 'XX大学 · 信息管理本科',
  extras: ['英语可作为工作语言'],
};

function render(Component, props = {}) {
  return renderToStaticMarkup(React.createElement(Component, {
    view: completeView,
    role: 'AI Product Manager',
    ...props,
  }));
}

function elementMarkup(markup, tag) {
  return markup.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`))?.[0] || '';
}

async function docxDocumentXml(blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml').async('string');
}

test('preview templates: export real renderable components', () => {
  assert.equal(typeof ClassicPreview, 'function');
  assert.equal(typeof ModernPreview, 'function');
  assert.equal(typeof MinimalPreview, 'function');
  assert.match(render(ClassicPreview), /class="tpl-editorial"/);
  assert.match(render(ModernPreview), /class="tpl-precision-grid"/);
  assert.match(render(MinimalPreview), /class="tpl-minimal"/);
});

test('preview templates: Classic renders its selected direction with Chinese and English labels', () => {
  const zh = render(ClassicPreview, { language: 'zh' });
  const en = render(ClassicPreview, { language: 'en' });

  assert.match(zh, />职业摘要</);
  assert.match(zh, />项目经历</);
  assert.match(en, />Profile</);
  assert.match(en, />Selected Projects</);
  assert.match(en, /zhangchen@example\.com/);
});

test('preview templates: Modern renders a 31/69 information rail without invented proficiency', () => {
  const markup = render(ModernPreview, { language: 'en', accent: '#2563eb' });
  const rail = elementMarkup(markup, 'aside');
  const main = elementMarkup(markup, 'main');

  assert.match(markup, /grid-template-columns:31% 69%/);
  assert.match(rail, />Contact</);
  assert.match(rail, />Core Skills</);
  assert.match(rail, />Tools</);
  assert.match(rail, />Education</);
  assert.match(rail, /zhangchen@example\.com/);
  assert.match(rail, /需求分析/);
  assert.match(main, /A科技有限公司/);
  assert.match(main, /库存管理项目/);
  assert.doesNotMatch(markup, /role="progressbar"|aria-valuenow|proficiency/i);
});

test('preview templates: Minimal preserves its direction while localizing section labels', () => {
  const zh = render(MinimalPreview, { language: 'zh' });
  const en = render(MinimalPreview, { language: 'en' });

  assert.match(zh, />工作经历</);
  assert.match(zh, />项目经历</);
  assert.match(en, />Experience</);
  assert.match(en, />Selected Projects</);
});

test('preview templates: Modern omits the contact heading when no contact facts exist', () => {
  const view = {
    ...completeView,
    email: '',
    phone: '',
    location: '',
  };
  const rail = elementMarkup(render(ModernPreview, { view, language: 'en' }), 'aside');

  assert.doesNotMatch(rail, />Contact</);
});

test('preview templates: long resume facts remain rendered and vertically accessible', () => {
  const longView = {
    ...completeView,
    name: 'Alex Chen',
    headline: 'AI Product Manager',
    location: 'Shanghai',
    jobIntention: 'AI Product Manager',
    summary: 'Turns complex business problems into shipped products.',
    skills: Array.from({ length: 24 }, (_, index) => `Skill ${index + 1}`),
    tools: Array.from({ length: 18 }, (_, index) => `Tool ${index + 1}`),
    experience: Array.from({ length: 12 }, (_, index) => ({
      company: `Company ${index + 1}`,
      title: `Role ${index + 1}`,
      period: `20${index} — 20${index + 1}`,
      bullets: [`Long experience fact ${index + 1}`],
    })),
    projects: Array.from({ length: 12 }, (_, index) => ({
      name: `Project ${index + 1}`,
      bullets: [`Long project fact ${index + 1}`],
    })),
    education: 'BSc in Information Management, Example University',
    extras: ['English working proficiency'],
  };

  for (const [Component, className] of [
    [ClassicPreview, 'tpl-editorial'],
    [ModernPreview, 'tpl-precision-grid'],
    [MinimalPreview, 'tpl-minimal'],
  ]) {
    const markup = render(Component, { view: longView, language: 'en' });
    assert.match(markup, /Long experience fact 12/);
    assert.match(markup, /Long project fact 12/);
    assert.match(markup, new RegExp(`class="${className}" style="[^"]*overflow-y:auto`));
  }

  const modern = render(ModernPreview, { view: longView, language: 'en' });
  assert.match(modern, /Skill 24/);
  assert.match(modern, /Tool 18/);
  assert.doesNotMatch(modern, /<(?:aside|main)[^>]*style="[^"]*overflow:hidden/);
});

test('document templates: real DOCX builders localize all visible section labels', async () => {
  const cases = [
    [buildClassicDocx, ['PROFILE', 'EXPERIENCE', 'SELECTED PROJECTS', 'CORE SKILLS'], ['职业摘要', '工作经历', '项目经历'], ['职业摘要', '工作经历', '项目经历']],
    [buildModernDocx, ['CONTACT', 'EXPERIENCE', 'SELECTED PROJECTS', 'CORE SKILLS'], ['联系方式', '工作经历', '项目经历'], ['联系方式', '工作经历', '项目经历']],
    [buildMinimalDocx, ['EXPERIENCE', 'SELECTED PROJECTS', 'SKILLS', 'EDUCATION'], ['工作经历', '项目经历'], ['工作经历', '项目经历', '核心能力', '教育背景']],
  ];

  for (const [builder, expected, excluded, expectedZh] of cases) {
    const blob = await builder(completeView, 'AI Product Manager', '32B7A4', 'en');
    assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const xml = await docxDocumentXml(blob);
    for (const label of expected) assert.match(xml, new RegExp(label));
    for (const label of excluded) assert.doesNotMatch(xml, new RegExp(label));
    assert.match(xml, /Long experience fact 12|负责 ERP\/WMS 产品规划/);

    const zhXml = await docxDocumentXml(await builder(completeView, 'AI 产品经理', '32B7A4', 'zh'));
    for (const label of expectedZh) assert.match(zhXml, new RegExp(label));
  }
});

test('document templates: real PDF generators produce non-truncated multi-page artifacts', async () => {
  const longView = {
    ...completeView,
    name: 'Alex Chen',
    headline: 'AI Product Manager',
    location: 'Shanghai',
    jobIntention: 'AI Product Manager',
    summary: 'Turns complex business problems into shipped products.',
    skills: Array.from({ length: 24 }, (_, index) => `Skill ${index + 1}`),
    tools: Array.from({ length: 18 }, (_, index) => `Tool ${index + 1}`),
    experience: Array.from({ length: 12 }, (_, index) => ({
      company: `Company ${index + 1}`,
      title: `Role ${index + 1}`,
      period: `20${index} - 20${index + 1}`,
      bullets: Array.from({ length: 3 }, (_, bullet) => `Long experience fact ${index + 1}.${bullet + 1}`),
    })),
    projects: Array.from({ length: 12 }, (_, index) => ({
      name: `Project ${index + 1}`,
      bullets: [`Long project fact ${index + 1}`],
    })),
    education: 'BSc in Information Management, Example University',
    extras: ['English working proficiency'],
  };

  for (const [Component, rendersTools] of [
    [ClassicPdfDocument, true],
    [ModernPdfDocument, true],
    [MinimalPdfDocument, false],
  ]) {
    const element = React.createElement(Component, {
      view: longView,
      role: 'AI Product Manager',
      accent: '#32B7A4',
      language: 'en',
    });
    const blob = await pdf(element).toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
    assert.ok(bytes.length > 1_000);
    const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
    const document = await loadingTask.promise;
    assert.ok(document.numPages > 1);
    let renderedText = '';
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      renderedText += content.items.map(({ str }) => str).join(' ');
    }
    assert.match(renderedText, /Long experience fact 12\.3/);
    assert.match(renderedText, /Long project fact 12/);
    assert.match(renderedText, /Skill 24/);
    if (rendersTools) assert.match(renderedText, /Tool 18/);
    await loadingTask.destroy();
  }
});

test('document templates: Minimal PDF keeps the role line clear of the candidate name', async () => {
  const view = {
    name: 'Alex Chen',
    headline: 'AI Product Manager',
    email: '',
    phone: '',
    location: 'Shanghai',
    jobIntention: '',
    summary: '',
    skills: [],
    tools: [],
    experience: [],
    projects: [],
    education: '',
    extras: [],
  };
  const blob = await pdf(React.createElement(MinimalPdfDocument, {
    view,
    role: 'AI Product Manager',
    language: 'en',
  })).toBlob();
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const name = content.items.find(({ str }) => str === 'Alex Chen');
  const role = content.items.find(({ str }) => str === 'AI Product Manager | Shanghai');

  assert.ok(name && role);
  assert.ok(name.transform[5] - role.transform[5] >= 18);
  await loadingTask.destroy();
});

test('document templates: long DOCX facts survive real builders without a pinned Modern page row', async () => {
  const longView = {
    ...completeView,
    name: 'Alex Chen',
    location: 'Shanghai',
    summary: 'Turns complex business problems into shipped products.',
    skills: Array.from({ length: 24 }, (_, index) => `Skill ${index + 1}`),
    tools: Array.from({ length: 18 }, (_, index) => `Tool ${index + 1}`),
    experience: Array.from({ length: 12 }, (_, index) => ({
      company: `Company ${index + 1}`,
      title: `Role ${index + 1}`,
      period: `20${index} - 20${index + 1}`,
      bullets: [`Long experience fact ${index + 1}`],
    })),
    projects: Array.from({ length: 12 }, (_, index) => ({
      name: `Project ${index + 1}`,
      bullets: [`Long project fact ${index + 1}`],
    })),
    education: 'BSc in Information Management, Example University',
    extras: ['English working proficiency'],
  };

  for (const builder of [buildClassicDocx, buildModernDocx]) {
    const xml = await docxDocumentXml(await builder(longView, 'AI Product Manager', '32B7A4', 'en'));
    assert.match(xml, /Skill 24/);
    assert.match(xml, /Tool 18/);
    assert.match(xml, /Long experience fact 12/);
    assert.match(xml, /Long project fact 12/);
  }

  const modernXml = await docxDocumentXml(
    await buildModernDocx(longView, 'AI Product Manager', '32B7A4', 'en'),
  );
  assert.doesNotMatch(modernXml, /<w:cantSplit\/>/);
  assert.match(modernXml, /<w:tblW w:type="dxa" w:w="10700"\/>/);
  assert.match(modernXml, /<w:gridCol w:w="3317"\/><w:gridCol w:w="7383"\/>/);
});
