import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { ClassicPreview, ModernPreview, MinimalPreview } from '../templates/PreviewTemplates';
import { exportPdf, exportDocx } from '../services/exportResume';
import { ai } from '../services/api';
import { LANGUAGES, TEMPLATES } from '../templates/templateCatalog';
import {
  createEnglishCacheKey,
  deriveLocalizedExport,
  shouldApplyEnglishResponse,
} from '../services/resumeExportLanguage';
import { buildResumeView } from '../utils/resumeData';

const FORMATS = [
  { key: 'pdf', label: 'PDF', desc: '矢量清晰，适合投递与打印' },
  { key: 'docx', label: 'Word', desc: '可在 Word/WPS 中继续编辑' },
];

export function ExportPanel({ analysis, role }) {
  const [templateKey, setTemplateKey] = useState('classic');
  const [format, setFormat] = useState('pdf');
  const [language, setLanguage] = useState('zh');
  const [englishState, setEnglishState] = useState('idle');
  const [englishStateKey, setEnglishStateKey] = useState('');
  const [englishError, setEnglishError] = useState('');
  const [englishPayload, setEnglishPayload] = useState(null);
  const [englishRetry, setEnglishRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [lastFile, setLastFile] = useState('');

  const englishCacheRef = useRef(new Map());
  const englishRequestRef = useRef(new Map());
  const requestKeyRef = useRef('');
  const englishKey = useMemo(
    () => (analysis?.finalResume ? createEnglishCacheKey(analysis.finalResume, role) : ''),
    [analysis?.finalResume, role],
  );
  const activeEnglishKey = language === 'en' ? englishKey : '';
  requestKeyRef.current = activeEnglishKey;
  const cachedEnglishPayload = activeEnglishKey
    ? englishCacheRef.current.get(activeEnglishKey)
    : null;

  useEffect(() => {
    if (language !== 'en') {
      setEnglishPayload(null);
      setEnglishState('idle');
      setEnglishStateKey('');
      setEnglishError('');
      return undefined;
    }

    if (!englishKey) {
      setEnglishPayload(null);
      setEnglishState('error');
      setEnglishStateKey(englishKey);
      setEnglishError('暂无可翻译的简历内容');
      return undefined;
    }

    const cachedPayload = englishCacheRef.current.get(englishKey);
    if (cachedPayload) {
      setEnglishPayload({ key: englishKey, payload: cachedPayload });
      setEnglishState('ready');
      setEnglishStateKey(englishKey);
      setEnglishError('');
      return undefined;
    }

    setEnglishPayload(null);
    setEnglishState('loading');
    setEnglishStateKey(englishKey);
    setEnglishError('');
    const pendingRequest = englishRequestRef.current.get(englishKey);
    if (pendingRequest) return undefined;

    const request = ai.resumeEnglish(analysis.finalResume, role);
    englishRequestRef.current.set(englishKey, request);
    request
      .then((payload) => {
        englishCacheRef.current.set(englishKey, payload);
        if (!shouldApplyEnglishResponse(requestKeyRef.current, englishKey)) return;
        setEnglishPayload({ key: englishKey, payload });
        setEnglishState('ready');
        setEnglishStateKey(englishKey);
        setEnglishError('');
      })
      .catch((err) => {
        if (!shouldApplyEnglishResponse(requestKeyRef.current, englishKey)) return;
        setEnglishPayload(null);
        setEnglishState('error');
        setEnglishStateKey(englishKey);
        setEnglishError(err?.message || '英文简历生成失败，请重试');
      })
      .finally(() => {
        if (englishRequestRef.current.get(englishKey) === request) {
          englishRequestRef.current.delete(englishKey);
        }
      });
    return undefined;
  }, [analysis?.finalResume, englishKey, englishRetry, language, role]);

  const localizedExport = deriveLocalizedExport({
    analysis,
    language,
    englishKey,
    englishState,
    englishStateKey,
    englishPayload,
    cachedPayload: cachedEnglishPayload,
  });
  const exportAnalysis = localizedExport.analysis;
  const exportRole = exportAnalysis?.summary?.role || (language === 'zh' ? role : '');
  const view = useMemo(() => buildResumeView(exportAnalysis), [exportAnalysis]);
  const currentTemplate = TEMPLATES.find((t) => t.key === templateKey);

  const handleExport = async () => {
    if (exporting || !localizedExport.canExport) return;
    setExporting(true);
    setExportError('');
    try {
      const payload = {
        analysis: exportAnalysis,
        templateKey,
        variant: 'balanced',
        accent: currentTemplate.accent,
        language,
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

  const retryEnglish = () => {
    setEnglishError('');
    setEnglishRetry((value) => value + 1);
  };

  return (
    <div className="export-panel">
      {/* 左侧：模板 + 格式选择 */}
      <div className="export-panel-side">
        <div className="export-panel-section">
          <div className="export-panel-title">简历语言</div>
          <div className="export-language-row" role="group" aria-label="简历语言">
            {LANGUAGES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`export-language-btn ${language === item.key ? 'active' : ''}`}
                onClick={() => setLanguage(item.key)}
                aria-pressed={language === item.key}
              >
                {item.label}
              </button>
            ))}
          </div>
          {language === 'en' && localizedExport.state === 'loading' ? (
            <div className="export-language-status" role="status" aria-live="polite" aria-busy="true">
              <Loader2 size={14} className="spin" /> 正在生成英文简历…
            </div>
          ) : null}
          {language === 'en' && localizedExport.state === 'error' ? (
            <div className="export-language-error" role="alert">
              <AlertTriangle size={14} />
              <span>{englishError}</span>
              <button type="button" className="export-retry-btn" onClick={retryEnglish}>重试</button>
            </div>
          ) : null}
        </div>

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
          disabled={exporting || !view || !localizedExport.canExport}
        >
          {exporting ? (
            <>
              <Loader2 size={16} className="spin" /> 正在生成 {format.toUpperCase()}…
            </>
          ) : !localizedExport.canExport ? (
            <>
              <Loader2 size={16} className={localizedExport.state === 'loading' ? 'spin' : ''} />
              {localizedExport.state === 'loading' ? '正在生成英文简历…' : '英文简历暂不可导出'}
            </>
          ) : (
            <>
              <Download size={16} /> 导出{format === 'pdf' ? 'PDF' : 'Word'}简历
            </>
          )}
        </button>
        <p className="export-hint">
          {localizedExport.canExport ? (
            <>文件名：<code>{view?.name || '候选人'}_{exportRole || '岗位'}_{currentTemplate?.name}_{language.toUpperCase()}.{format}</code></>
          ) : language === 'en' ? (
            '文件名：等待英文简历生成完成'
          ) : (
            '文件名：暂无可导出的简历'
          )}
        </p>
      </div>

      {/* 右侧：实时预览 */}
      <div className="export-preview">
        <div className="export-preview-header">
          <FileText size={14} />
          <span>实时预览 · {currentTemplate?.name} · {language.toUpperCase()}</span>
        </div>
        <div className="export-preview-stage">
          <div className="export-preview-paper">
            {view ? (
              <>
                {templateKey === 'classic' && <ClassicPreview view={view} role={exportRole} language={language} />}
                {templateKey === 'modern' && <ModernPreview view={view} role={exportRole} accent={currentTemplate.accent} language={language} />}
                {templateKey === 'minimal' && <MinimalPreview view={view} role={exportRole} language={language} />}
              </>
            ) : (
              <div
                className="export-preview-placeholder"
                role={language === 'en' && localizedExport.state === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {language === 'en' && localizedExport.state === 'error' ? (
                  <>
                    <AlertTriangle size={16} />
                    <span>{englishError}</span>
                    <button type="button" className="export-retry-btn" onClick={retryEnglish}>重试</button>
                  </>
                ) : language === 'en' ? (
                  <><Loader2 size={16} className="spin" /> 正在生成英文预览…</>
                ) : (
                  '暂无可预览简历'
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
