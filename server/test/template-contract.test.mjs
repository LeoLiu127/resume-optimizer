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

function collectReactText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectReactText).join('');
  if (!React.isValidElement(node)) return '';
  if (typeof node.type === 'function') return collectReactText(node.type(node.props));
  return collectReactText(node.props.children);
}

function collectReactStrings(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectReactStrings);
  if (!React.isValidElement(node)) return [];
  if (typeof node.type === 'function') return collectReactStrings(node.type(node.props));
  return collectReactStrings(node.props.children);
}

async function docxDocumentXml(blob) {
  return docxPart(blob, 'word/document.xml');
}

async function docxPart(blob, path) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file(path).async('string');
}

function xmlAttributes(element) {
  return Object.fromEntries(
    Array.from(element.matchAll(/\b([\w:]+)="([^"]*)"/g), ([, name, value]) => [name, value]),
  );
}

function xmlRunContaining(xml, text) {
  return Array.from(
    xml.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g),
    ([run]) => run,
  ).find((run) => run.includes(`>${text}</w:t>`)) || '';
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

test('document templates: English PDFs preserve a Chinese candidate name as selectable text', async () => {
  const view = {
    ...completeView,
    name: '陈晓 (Alex Chen)',
    headline: 'AI Product Manager',
    location: 'Shanghai, China',
    jobIntention: 'AI Product Manager',
    summary: 'Turns complex business problems into shipped products.',
  };

  for (const Component of [ClassicPdfDocument, ModernPdfDocument, MinimalPdfDocument]) {
    const blob = await pdf(React.createElement(Component, {
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
    const renderedText = content.items.map(({ str }) => str).join(' ');

    assert.match(renderedText, /陈晓 \(Alex Chen\)/);
    await loadingTask.destroy();
  }
});

test('document templates: Precision Grid PDF derives a Latin monogram from a mixed-script name', () => {
  const view = {
    ...completeView,
    name: '陈晓 (Alex Chen)',
    headline: 'AI Product Manager',
  };
  const strings = collectReactStrings(React.createElement(ModernPdfDocument, {
    view,
    role: 'AI Product Manager',
    language: 'en',
  }));

  assert.ok(strings.includes('AC'));
});

test('document templates: English DOCX names declare a CJK-safe East Asian font', async () => {
  const view = {
    ...completeView,
    name: '陈晓 (Alex Chen)',
    headline: 'AI Product Manager',
  };

  for (const builder of [buildClassicDocx, buildModernDocx, buildMinimalDocx]) {
    const xml = await docxDocumentXml(
      await builder(view, 'AI Product Manager', '32B7A4', 'en'),
    );
    const nameRun = xmlRunContaining(xml, '陈晓 (Alex Chen)');

    assert.match(nameRun, /w:ascii="Arial"/);
    assert.match(nameRun, /w:hAnsi="Arial"/);
    assert.match(nameRun, /w:eastAsia="Microsoft YaHei"/);
  }
});

test('document templates: Precision Grid DOCX derives a Latin monogram from a mixed-script name', async () => {
  const xml = await docxDocumentXml(await buildModernDocx({
    ...completeView,
    name: '陈晓 (Alex Chen)',
    headline: 'AI Product Manager',
  }, 'AI Product Manager', '32B7A4', 'en'));

  assert.match(xml, /<w:t(?:\s[^>]*)?>AC<\/w:t>/);
});

test('document templates: English DOCX body remains English when the candidate name is mixed-script', async () => {
  const view = {
    name: '陈晓 (Alex Chen)',
    headline: 'AI Product Manager',
    email: 'alex.chen@example.com',
    phone: '+86 138 0000 0000',
    location: 'Shanghai, China',
    jobIntention: 'AI Product Manager - Cross-border Commerce',
    summary: 'Turns complex business problems into shipped products.',
    skills: ['Product Strategy', 'Discovery'],
    tools: ['Figma', 'SQL'],
    experience: [{
      company: 'Northstar Commerce',
      title: 'Senior Product Manager',
      period: '2022 - Present',
      bullets: ['Led an AI-assisted listing workflow.'],
    }],
    projects: [{
      name: 'Marketplace Copilot',
      bullets: ['Designed a human-in-the-loop review model.'],
    }],
    education: 'BSc, Information Management - Example University',
    extras: ['Certified Scrum Product Owner'],
  };

  for (const builder of [buildClassicDocx, buildModernDocx, buildMinimalDocx]) {
    const xml = await docxDocumentXml(
      await builder(view, 'AI Product Manager', '32B7A4', 'en'),
    );
    const text = Array.from(
      xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
      ([, value]) => value,
    ).join(' ');

    assert.doesNotMatch(text.replaceAll('陈晓 (Alex Chen)', ''), /[\u3400-\u9FFF]/);
  }
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

  for (const builder of [buildClassicDocx, buildModernDocx, buildMinimalDocx]) {
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

test('document templates: realistic long Precision Grid facts remain visible, in bounds, and separated', async () => {
  const longView = {
    ...completeView,
    name: 'Alexandria Chen-Worthington',
    headline: 'AI Product Manager',
    location: 'Shanghai',
    summary: 'Turns complex business problems into shipped products.',
    skills: Array.from(
      { length: 24 },
      (_, index) => `SKILL_${String(index + 1).padStart(2, '0')} Cross-Functional Marketplace Product Strategy and Delivery`,
    ),
    tools: Array.from(
      { length: 18 },
      (_, index) => `TOOL_${String(index + 1).padStart(2, '0')} Enterprise Analytics and Workflow Platform`,
    ),
    experience: Array.from({ length: 8 }, (_, index) => ({
      company: `International Commerce Company ${index + 1}`,
      title: `Product Leadership Role ${index + 1}`,
      period: `20${index} - 20${index + 1}`,
      bullets: [`Long experience fact ${index + 1}`],
    })),
    projects: Array.from({ length: 8 }, (_, index) => ({
      name: `Marketplace Transformation Project ${index + 1}`,
      bullets: [`Long project fact ${index + 1}`],
    })),
    education: 'BSc in Information Management, Example University',
    extras: ['English working proficiency'],
  };
  const blob = await pdf(React.createElement(ModernPdfDocument, {
    view: longView,
    role: 'AI Product Manager',
    language: 'en',
  })).toBlob();
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const taggedItems = [];
  let allText = '';

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const [left, bottom, right, top] = page.view;
    const content = await page.getTextContent();
    allText += content.items.map(({ str }) => str).join(' ');
    for (const item of content.items) {
      const x = item.transform[4];
      const y = item.transform[5];
      assert.ok(x >= left && y >= bottom);
      assert.ok(x + item.width <= right + 0.5);
      assert.ok(y + item.height <= top + 0.5);
      if (/SKILL_\d{2}|TOOL_\d{2}/.test(item.str)) {
        taggedItems.push({ ...item, pageNumber, x, y });
      }
    }
  }

  assert.match(allText, /SKILL_24/);
  assert.match(allText, /TOOL_18/);
  const skillItems = taggedItems.filter(({ str }) => /SKILL_\d{2}/.test(str));
  const toolItems = taggedItems.filter(({ str }) => /TOOL_\d{2}/.test(str));
  assert.equal(skillItems.length, 24);
  assert.equal(toolItems.length, 18);
  for (const skill of skillItems) {
    for (const tool of toolItems.filter(({ pageNumber }) => pageNumber === skill.pageNumber)) {
      const separatedVertically =
        skill.y + skill.height <= tool.y ||
        tool.y + tool.height <= skill.y;
      const separatedHorizontally =
        skill.x + skill.width <= tool.x ||
        tool.x + tool.width <= skill.x;
      assert.ok(separatedVertically || separatedHorizontally);
    }
  }
  await loadingTask.destroy();
});

test('document templates: Precision Grid keeps a representative resume on one page', async () => {
  const view = {
    ...completeView,
    name: 'Alex Chen',
    location: 'Shanghai',
    summary: 'Turns complex business problems into shipped products.',
    skills: ['Product Strategy', 'Discovery', 'Roadmapping', 'Experiment Design', 'Stakeholder Alignment', 'AI Product Delivery'],
    tools: ['Figma', 'SQL', 'Python', 'Jira', 'Amplitude', 'Looker'],
    experience: [
      {
        company: 'Northstar Commerce',
        title: 'Senior Product Manager',
        period: '2022 - Present',
        bullets: [
          'Led an AI-assisted listing workflow across three marketplaces.',
          'Aligned operations, engineering, and compliance teams.',
          'Improved successful first-run completion from 61% to 79%.',
        ],
      },
      {
        company: 'Harbor Retail Systems',
        title: 'Product Manager',
        period: '2019 - 2022',
        bullets: ['Owned inventory orchestration.', 'Reduced manual reconciliation volume by 31%.'],
      },
      {
        company: 'Atlas Digital',
        title: 'Business Analyst',
        period: '2017 - 2019',
        bullets: ['Translated operator workflows.', 'Built weekly performance reporting.'],
      },
    ],
    projects: [
      { name: 'Marketplace Copilot', bullets: ['Designed the human-in-the-loop review model.', 'Defined quality gates.'] },
      { name: 'Inventory Risk Console', bullets: ['Combined demand, inbound, and account health signals.'] },
    ],
    education: 'BSc in Information Management, Example University',
  };
  const blob = await pdf(React.createElement(ModernPdfDocument, {
    view,
    role: 'AI Product Manager',
    language: 'en',
  })).toBlob();
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;

  assert.equal(document.numPages, 1);
  await loadingTask.destroy();
});

test('document templates: Minimal exports every tool fact in PDF and DOCX', async () => {
  const view = {
    ...completeView,
    name: 'Alex Chen',
    location: 'Shanghai',
    tools: Array.from({ length: 18 }, (_, index) => `Tool ${index + 1}`),
  };
  const pdfBlob = await pdf(React.createElement(MinimalPdfDocument, {
    view,
    role: 'AI Product Manager',
    language: 'en',
  })).toBlob();
  const loadingTask = getDocument({
    data: new Uint8Array(await pdfBlob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  let pdfText = '';
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pdfText += content.items.map(({ str }) => str).join(' ');
  }
  assert.match(pdfText, /Tool 18/);
  await loadingTask.destroy();

  const docxXml = await docxDocumentXml(
    await buildMinimalDocx(view, 'AI Product Manager', '32B7A4', 'en'),
  );
  assert.match(docxXml, /TOOLS/);
  assert.match(docxXml, /Tool 18/);
});

test('document templates: Minimal exports every additional information fact in PDF and DOCX', async () => {
  const view = {
    ...completeView,
    name: 'Alex Chen',
    location: 'Shanghai',
    extras: ['English and Mandarin working proficiency', 'Certified Scrum Product Owner'],
  };
  const pdfBlob = await pdf(React.createElement(MinimalPdfDocument, {
    view,
    role: 'AI Product Manager',
    language: 'en',
  })).toBlob();
  const loadingTask = getDocument({
    data: new Uint8Array(await pdfBlob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  let pdfText = '';
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pdfText += content.items.map(({ str }) => str).join(' ');
  }
  assert.match(pdfText, /English and Mandarin working proficiency/);
  assert.match(pdfText, /Certified Scrum Product Owner/);
  await loadingTask.destroy();

  const docxXml = await docxDocumentXml(
    await buildMinimalDocx(view, 'AI Product Manager', '32B7A4', 'en'),
  );
  assert.match(docxXml, /ADDITIONAL INFORMATION/);
  assert.match(docxXml, /English and Mandarin working proficiency/);
  assert.match(docxXml, /Certified Scrum Product Owner/);
});

test('document templates: PDF section labels are bilingual across every template', async () => {
  const cases = [
    [ClassicPdfDocument, ['PROFILE', 'EXPERIENCE', 'SELECTEDPROJECTS', 'TOOLS'], ['职业摘要', '工作经历', '项目经历', '技能工具']],
    [ModernPdfDocument, ['CONTACT', 'EXPERIENCE', 'SELECTEDPROJECTS', 'TOOLS'], ['联系方式', '工作经历', '项目经历', '技能工具']],
    [MinimalPdfDocument, ['EXPERIENCE', 'SELECTEDPROJECTS', 'SKILLS', 'TOOLS'], ['工作经历', '项目经历', '核心能力', '技能工具']],
  ];

  for (const [Component, expectedEn, expectedZh] of cases) {
    for (const [language, expected] of [['en', expectedEn], ['zh', expectedZh]]) {
      const compactText = collectReactText(React.createElement(Component, {
        view: language === 'en' ? { ...completeView, name: 'Alex Chen' } : completeView,
        role: language === 'en' ? 'AI Product Manager' : '人工智能产品经理',
        language,
      })).replace(/\s+/g, '').toUpperCase();
      for (const label of expected) assert.match(compactText, new RegExp(label));
    }
  }
});

test('document templates: Modern DOCX has exact page geometry and localized core titles', async () => {
  const englishBlob = await buildModernDocx(completeView, 'AI Product Manager', '32B7A4', 'en');
  const chineseBlob = await buildModernDocx(completeView, '人工智能产品经理', '32B7A4', 'zh');
  const xml = await docxDocumentXml(englishBlob);
  const layout = xml.match(/<w:tblLayout\b[^>]*\/>/)?.[0] || '';
  const cellWidths = Array.from(
    xml.matchAll(/<w:tcW\b[^>]*\/>/g),
    ([element]) => Number(xmlAttributes(element)['w:w']),
  );
  const pageSize = xmlAttributes(xml.match(/<w:pgSz\b[^>]*\/>/)?.[0] || '');
  const pageMargins = xmlAttributes(xml.match(/<w:pgMar\b[^>]*\/>/)?.[0] || '');

  assert.equal(xmlAttributes(layout)['w:type'], 'fixed');
  assert.deepEqual(cellWidths, [3317, 7383]);
  assert.equal(pageSize['w:w'], '11906');
  assert.equal(pageSize['w:h'], '16838');
  assert.deepEqual(
    {
      top: pageMargins['w:top'],
      right: pageMargins['w:right'],
      bottom: pageMargins['w:bottom'],
      left: pageMargins['w:left'],
    },
    { top: '600', right: '600', bottom: '600', left: '600' },
  );
  assert.doesNotMatch(xml, /<w:cantSplit(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:cantSplit>)/);

  const englishCore = await docxPart(englishBlob, 'docProps/core.xml');
  const chineseCore = await docxPart(chineseBlob, 'docProps/core.xml');
  assert.match(englishCore, /<dc:title>张晨 - Resume<\/dc:title>/);
  assert.match(chineseCore, /<dc:title>张晨 - 简历<\/dc:title>/);
});
