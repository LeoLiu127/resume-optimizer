import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const cacheDir = await mkdtemp(join(tmpdir(), 'resume-pdf-font-offline-'));
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
  ClassicPdfDocument,
  ModernPdfDocument,
  MinimalPdfDocument,
} = await vite.ssrLoadModule('/src/templates/pdf/PdfTemplates.jsx');

after(async () => {
  await vite.close();
  await rm(cacheDir, { recursive: true, force: true });
});

const mixedScriptEnglishView = {
  name: '陈晓 (Alex Chen)',
  headline: 'AI Product Manager',
  email: 'alex.chen@example.com',
  phone: '+86 138 0000 0000',
  location: 'Shanghai, China',
  jobIntention: 'AI Product Manager - Cross-border Commerce',
  summary: 'Product leader who turns ambiguous marketplace operations into dependable software.',
  skills: ['Product Strategy', 'Discovery'],
  tools: ['Figma', 'SQL'],
  experience: [{
    company: 'Northstar Commerce',
    title: 'Senior Product Manager',
    period: '2022 - Present',
    bullets: ['Led an AI-assisted listing workflow across three marketplaces.'],
  }],
  projects: [{
    name: 'Marketplace Copilot',
    bullets: ['Designed a human-in-the-loop review model.'],
  }],
  education: 'BSc, Information Management - Example University',
  extras: ['Certified Scrum Product Owner'],
};

test('mixed-script English PDFs render from bundled fonts without network access', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    throw new Error(`offline PDF test forbids network access: ${String(input)}`);
  };

  try {
    for (const Component of [ClassicPdfDocument, ModernPdfDocument, MinimalPdfDocument]) {
      const blob = await pdf(React.createElement(Component, {
        view: mixedScriptEnglishView,
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
      const text = content.items.map(({ str }) => str).join(' ');

      assert.match(text, /陈晓 \(Alex Chen\)/);
      assert.doesNotMatch(text.replaceAll('陈晓 (Alex Chen)', ''), /[\u3400-\u9FFF]/);
      await loadingTask.destroy();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
