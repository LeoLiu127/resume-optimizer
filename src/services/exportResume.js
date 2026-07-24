import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { ClassicPdfDocument, ModernPdfDocument, MinimalPdfDocument } from '../templates/pdf/PdfTemplates';
import { buildClassicDocx, buildModernDocx, buildMinimalDocx } from '../templates/docx/DocxTemplates';
import { buildResumeView, buildFileName } from '../utils/resumeData';

const PDF_BUILDERS = {
  classic: (view, role) => React.createElement(ClassicPdfDocument, { view, role }),
  modern: (view, role) => React.createElement(ModernPdfDocument, { view, role }),
  minimal: (view, role) => React.createElement(MinimalPdfDocument, { view, role }),
};

const DOCX_BUILDERS = {
  classic: buildClassicDocx,
  modern: buildModernDocx,
  minimal: buildMinimalDocx,
};

/**
 * 导出 PDF 并触发下载
 */
export async function exportPdf({ analysis, templateKey, variant, accent }) {
  const view = buildResumeView(analysis, variant);
  if (!view) throw new Error('无可用简历数据，请先生成分析结果');
  const role = analysis.summary?.role || '';
  const element = PDF_BUILDERS[templateKey](view, role);
  const blob = await pdf(element).toBlob();
  const fileName = buildFileName(view, role, templateKey, 'pdf');
  saveAs(blob, fileName);
  return fileName;
}

/**
 * 导出 Word 并触发下载
 */
export async function exportDocx({ analysis, templateKey, variant, accent }) {
  const view = buildResumeView(analysis, variant);
  if (!view) throw new Error('无可用简历数据，请先生成分析结果');
  const role = analysis.summary?.role || '';
  const builder = DOCX_BUILDERS[templateKey];
  if (!builder) throw new Error('未知模板');
  const accentHex = (accent || '#2563eb').replace('#', '').toUpperCase();
  const blob = await builder(view, role, accentHex);
  const fileName = buildFileName(view, role, templateKey, 'docx');
  saveAs(blob, fileName);
  return fileName;
}