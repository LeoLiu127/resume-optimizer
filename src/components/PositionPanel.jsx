/**
 * 目标岗位管理面板
 *
 * 功能：
 * - 岗位列表（卡片式，显示公司/职位/状态/关联简历数）
 * - 新增岗位：URL 提取 JD + 手动编辑
 * - 岗位详情：JD 全文 + 关联简历
 * - 选中岗位后一键填充到分析输入
 */

import { useEffect, useState } from 'react';
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { usePositions, POSITION_STATUS } from '../hooks/usePositions';
import { positions as positionsApi } from '../services/api';

export function PositionPanel({ onApplyPosition, onBack, onOpenResume, currentUser }) {
  const {
    list,
    loading,
    error,
    extracting,
    extractResult,
    refresh,
    createPosition,
    updatePosition,
    removePosition,
    saveFromInput,
    extractJd,
    loginAssist,
    clearExtractResult,
    positionToInput,
  } = usePositions();

  const [view, setView] = useState('list'); // list | add | detail
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPos, setSelectedPos] = useState(null);
  // 新增/编辑表单
  const [form, setForm] = useState(emptyForm());
  const [jdUrl, setJdUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (currentUser) refresh();
  }, [currentUser, refresh]);

  /* ============ 列表视图 ============ */

  const filteredList = statusFilter
    ? list.filter((p) => p.status === statusFilter)
    : list;

  const handleSelectPosition = async (pos) => {
    setSelectedId(pos.id);
    setSelectedPos(pos);
    setView('detail');
    // 获取完整详情（含关联简历列表）
    try {
      const detail = await positionsApi.get(pos.id);
      setSelectedPos(detail);
    } catch {
      // 列表数据已足够展示，忽略详情加载失败
    }
  };

  const handleApplyToInput = (pos) => {
    const input = positionToInput(pos);
    onApplyPosition(input, pos.id, pos.title);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('确认删除该岗位？关联的简历不会被删除。')) return;
    try {
      await removePosition(id);
      if (selectedId === id) {
        setView('list');
        setSelectedId(null);
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updatePosition(id, { status });
    } catch (err) {
      alert(err.message || '更新失败');
    }
  };

  /* ============ 新增视图 ============ */

  const handleExtract = async () => {
    if (!jdUrl.trim()) return;
    const result = await extractJd(jdUrl.trim());
    if (result && result.success) {
      setForm((prev) => ({
        ...prev,
        title: result.title || prev.title,
        company: result.company || prev.company,
        jdContent: result.jdContent || prev.jdContent,
      }));
    }
  };

  const handleLoginAssist = async () => {
    const site = detectSite(jdUrl);
    const msg = await loginAssist(site);
    if (msg) alert(msg);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('请填写岗位名称');
      return;
    }
    setSaving(true);
    try {
      await createPosition({
        ...form,
        url: jdUrl.trim(),
        sourceSite: detectSite(jdUrl),
      });
      setForm(emptyForm());
      setJdUrl('');
      clearExtractResult();
      setView('list');
    } catch (err) {
      alert(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /* ============ 渲染 ============ */

  if (view === 'add') {
    return (
      <div className="position-panel">
        <div className="position-panel-header">
          <div className="header-left">
            {onBack ? (
              <button className="back-btn primary" onClick={onBack} title="返回主工作区">
                <ChevronLeft size={16} /> 返回工作区
              </button>
            ) : null}
            <button className="back-btn" onClick={() => { setView('list'); clearExtractResult(); }}>
              <ChevronLeft size={16} /> 列表
            </button>
          </div>
          <h3>新增目标岗位</h3>
        </div>

        {/* JD 链接提取区 */}
        <div className="card compact jd-extract-card">
          <div className="card-title">
            <Link2 size={14} /> 从招聘链接提取 JD
          </div>
          <div className="jd-extract-row">
            <input
              type="url"
              className="jd-url-input"
              placeholder="粘贴 Boss直聘 / 拉勾 / 猎聘 等招聘链接"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleExtract(); }}
            />
            <button
              className="primary-button small"
              onClick={handleExtract}
              disabled={extracting || !jdUrl.trim()}
            >
              {extracting ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {extracting ? '提取中…' : '提取 JD'}
            </button>
          </div>
          {extractResult && !extractResult.success && (
            <div className="jd-extract-fail">
              <span>{extractResult.message}</span>
              <button className="link-btn" onClick={handleLoginAssist}>
                需要登录？点击辅助登录
              </button>
            </div>
          )}
          {extractResult && extractResult.success && (
            <div className="jd-extract-success">✅ 已提取到 JD 内容，请确认后保存</div>
          )}
        </div>

        {/* 手动编辑区 */}
        <div className="card compact">
          <div className="card-title">岗位信息</div>
          <div className="position-form-grid">
            <label className="field">
              <span>岗位名称 *</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：AI产品经理" />
            </label>
            <label className="field">
              <span>公司</span>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="如：字节跳动" />
            </label>
            <label className="field">
              <span>目标行业</span>
              <input value={form.targetIndustry} onChange={(e) => setForm({ ...form, targetIndustry: e.target.value })} placeholder="如：AI应用 / 企业服务" />
            </label>
            <label className="field">
              <span>公司类型</span>
              <input value={form.targetCompanyType} onChange={(e) => setForm({ ...form, targetCompanyType: e.target.value })} placeholder="如：互联网大厂" />
            </label>
          </div>
          <label className="field">
            <span>JD 全文</span>
            <textarea
              value={form.jdContent}
              onChange={(e) => setForm({ ...form, jdContent: e.target.value })}
              placeholder="粘贴完整岗位 JD（或通过上方链接自动提取）"
              rows={14}
            />
          </label>
          <label className="field">
            <span>补充信息</span>
            <textarea
              value={form.extras}
              onChange={(e) => setForm({ ...form, extras: e.target.value })}
              placeholder="突出能力、特殊要求等（可选）"
              rows={4}
            />
          </label>
        </div>

        <div className="position-form-actions">
          <button className="secondary-button" onClick={() => { setView('list'); clearExtractResult(); }}>取消</button>
          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存岗位'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedPos) {
    const statusInfo = POSITION_STATUS[selectedPos.status] || POSITION_STATUS.preparing;
    return (
      <div className="position-panel">
        <div className="position-panel-header">
          <div className="header-left">
            {onBack ? (
              <button className="back-btn primary" onClick={onBack} title="返回主工作区">
                <ChevronLeft size={16} /> 返回工作区
              </button>
            ) : null}
            <button className="back-btn" onClick={() => setView('list')}>
              <ChevronLeft size={16} /> 列表
            </button>
          </div>
          <h3>{selectedPos.title}</h3>
        </div>

        <div className="card compact position-detail-meta">
          <div className="detail-meta-row">
            {selectedPos.company && (
              <span className="meta-chip"><Building2 size={12} /> {selectedPos.company}</span>
            )}
            <span className="meta-chip status" style={{ color: statusInfo.color, borderColor: statusInfo.color }}>
              {statusInfo.label}
            </span>
            {selectedPos.sourceSite && (
              <span className="meta-chip">{selectedPos.sourceSite}</span>
            )}
          </div>
          {selectedPos.url && (
            <a className="position-url" href={selectedPos.url} target="_blank" rel="noreferrer">
              <ExternalLink size={12} /> 查看原始链接
            </a>
          )}
          <div className="detail-actions">
            <button className="primary-button small" onClick={() => handleApplyToInput(selectedPos)}>
              <Briefcase size={14} /> 用此岗位开始优化
            </button>
            <select
              className="status-select"
              value={selectedPos.status}
              onChange={(e) => {
                handleStatusChange(selectedPos.id, e.target.value);
                setSelectedPos({ ...selectedPos, status: e.target.value });
              }}
            >
              {Object.entries(POSITION_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedPos.jdContent && (
          <div className="card compact">
            <div className="card-title">JD 内容</div>
            <pre className="jd-content-pre">{selectedPos.jdContent}</pre>
          </div>
        )}

        {selectedPos.resumes && selectedPos.resumes.length > 0 && (
          <div className="card compact">
            <div className="card-title">关联简历（{selectedPos.resumes.length}）</div>
            <ul className="linked-resumes">
              {selectedPos.resumes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="linked-resume-btn"
                    onClick={() => onOpenResume && onOpenResume(r.id)}
                    disabled={!onOpenResume}
                  >
                    <span className="linked-resume-name">{r.name}</span>
                    <span className="muted">{r.targetRole || '未设目标'}</span>
                    <span className="linked-resume-arrow">打开 ›</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              点击某份简历即可加载到工作区继续优化或导出。
            </p>
          </div>
        )}
      </div>
    );
  }

  /* ============ 列表视图（默认） ============ */

  return (
    <div className="position-panel">
      <div className="position-panel-header">
        <div className="header-left">
          {onBack ? (
            <button className="back-btn primary" onClick={onBack} title="返回主工作区">
              <ChevronLeft size={16} /> 返回工作区
            </button>
          ) : null}
          <h3>目标岗位</h3>
        </div>
        <button className="primary-button small" onClick={() => { setForm(emptyForm()); setJdUrl(''); clearExtractResult(); setView('add'); }}>
          <Plus size={14} /> 新增岗位
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="position-filter-row">
        <button className={`chip-button ${!statusFilter ? 'active' : ''}`} onClick={() => setStatusFilter('')}>全部</button>
        {Object.entries(POSITION_STATUS).map(([key, val]) => (
          <button key={key} className={`chip-button ${statusFilter === key ? 'active' : ''}`} onClick={() => setStatusFilter(key)}>
            {val.label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">加载中…</p>}
      {error && <p className="muted" style={{ color: 'var(--text-error)' }}>⚠ {error}</p>}

      {!loading && !filteredList.length && (
        <div className="position-empty">
          <Briefcase size={32} className="muted" />
          <p>暂无目标岗位</p>
          <p className="muted">粘贴招聘链接，自动提取 JD 并保存</p>
        </div>
      )}

      <div className="position-list">
        {filteredList.map((pos) => {
          const statusInfo = POSITION_STATUS[pos.status] || POSITION_STATUS.preparing;
          return (
            <div key={pos.id} className="position-card card compact" onClick={() => handleSelectPosition(pos)}>
              <div className="position-card-main">
                <div className="position-card-title">
                  <Briefcase size={14} />
                  <strong>{pos.title}</strong>
                </div>
                {pos.company && <span className="position-card-company"><Building2 size={12} /> {pos.company}</span>}
              </div>
              <div className="position-card-footer">
                <span className="position-status-dot" style={{ background: statusInfo.color }} />
                <span className="position-status-label">{statusInfo.label}</span>
                {pos.resumeCount > 0 && <span className="muted">· {pos.resumeCount} 份简历</span>}
                <button className="icon-btn danger" onClick={(e) => handleDelete(e, pos.id)} title="删除">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============ helpers ============ */

function emptyForm() {
  return {
    title: '',
    company: '',
    targetIndustry: '',
    targetCompanyType: '',
    jdContent: '',
    extras: '',
  };
}

function detectSite(url) {
  if (!url) return '';
  if (/zhipin\.com/i.test(url)) return 'boss';
  if (/lagou\.com/i.test(url)) return 'lagou';
  if (/liepin\.com/i.test(url)) return 'liepin';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/51job\.com/i.test(url)) return '51job';
  if (/zhaopin\.com/i.test(url)) return 'zhaopin';
  return 'other';
}
