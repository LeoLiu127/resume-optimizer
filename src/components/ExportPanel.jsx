import React, { useMemo, useState } from 'react';
import { Download, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { ClassicPreview, ModernPreview, MinimalPreview } from '../templates/PreviewTemplates';
import { exportPdf, exportDocx } from '../services/exportResume';
import { buildResumeView } from '../utils/resumeData';

const TEMPLATES = [
  {
    key: 'classic',
    name: 'Classic',
    label: '经典单栏',
    desc: '稳重通用，黑白灰配色，全场景安全选择',
    accent: '#111827',
  },
  {
    key: 'modern',
    name: 'Modern',
    label: '现代双栏',
    desc: '深色左栏 + 蓝色 accent，互联网/ToB 岗位首选',
    accent: '#2563eb',
  },
  {
    key: 'minimal',
    name: 'Minimal',
    label: '极简留白',
    desc: '大量留白 + 细字重，设计师/PM 高级感',
    accent: '#111111',
  },
];

const FORMATS = [
  { key: 'pdf', label: 'PDF', desc: '矢量清晰，适合投递与打印' },
  { key: 'docx', label: 'Word', desc: '可在 Word/WPS 中继续编辑' },
];

export function ExportPanel({ analysis, role }) {
  const [templateKey, setTemplateKey] = useState('classic');
  const [format, setFormat] = useState('pdf');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [lastFile, setLastFile] = useState('');

  const view = useMemo(() => buildResumeView(analysis), [analysis]);
  const currentTemplate = TEMPLATES.find((t) => t.key === templateKey);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const payload = {
        analysis,
        templateKey,
        variant: 'balanced',
        accent: currentTemplate.accent,
      };
      const fileName = format === 'pdf'
        ? await exportPdf(payload)
        : await exportDocx(payload);
      setLastFile(fileName);
    } catch (err) {
      setExportError(err?.message || '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-panel">
      {/* 左侧：模板 + 格式选择 */}
      <div className="export-panel-side">
        <div className="export-panel-section">
          <div className="export-panel-title">选择模板</div>
          <div className="export-template-list">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`export-template-card ${templateKey === t.key ? 'active' : ''}`}
                onClick={() => setTemplateKey(t.key)}
                style={{ '--template-accent': t.accent }}
              >
                <div className="export-template-name">{t.name}</div>
                <div className="export-template-label">{t.label}</div>
                <div className="export-template-desc">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="export-panel-section">
          <div className="export-panel-title">导出格式</div>
          <div className="export-format-row">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`export-format-btn ${format === f.key ? 'active' : ''}`}
                onClick={() => setFormat(f.key)}
              >
                <div className="export-format-name">{f.label}</div>
                <div className="export-format-desc">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {exportError ? (
          <div className="export-error">
            <AlertTriangle size={14} /> {exportError}
          </div>
        ) : null}

        {lastFile && !exportError ? (
          <div className="export-success">
            <Sparkles size={14} /> 已导出 {lastFile}
          </div>
        ) : null}

        <button
          type="button"
          className="primary-button export-action"
          onClick={handleExport}
          disabled={exporting || !view}
        >
          {exporting ? (
            <>
              <Loader2 size={16} className="spin" /> 正在生成 {format.toUpperCase()}…
            </>
          ) : (
            <>
              <Download size={16} /> 导出{format === 'pdf' ? 'PDF' : 'Word'}简历
            </>
          )}
        </button>
        <p className="export-hint">
          文件名：<code>{view?.name || '候选人'}_{role || '岗位'}_{currentTemplate?.name}.{format}</code>
        </p>
      </div>

      {/* 右侧：实时预览 */}
      <div className="export-preview">
        <div className="export-preview-header">
          <FileText size={14} />
          <span>实时预览 · {currentTemplate?.name}</span>
        </div>
        <div className="export-preview-stage">
          <div className="export-preview-paper">
            {templateKey === 'classic' && <ClassicPreview view={view} role={role} />}
            {templateKey === 'modern' && <ModernPreview view={view} role={role} accent={currentTemplate.accent} />}
            {templateKey === 'minimal' && <MinimalPreview view={view} role={role} />}
          </div>
        </div>
      </div>
    </div>
  );
}