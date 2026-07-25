import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  KeySquare,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { admin } from '../services/api';

const PASSWORD_MIN = 8;

function formatDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return s;
  }
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return <span className="badge">正常</span>;
  }
  if (status === 'disabled') {
    return (
      <span className="badge" style={{ color: 'var(--text-error)' }}>
        已禁用
      </span>
    );
  }
  return <span className="badge subtle">{status}</span>;
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="badge">
        <ShieldCheck size={11} /> 管理员
      </span>
    );
  }
  return <span className="badge subtle">用户</span>;
}

function InviteStatus({ invite }) {
  if (invite.revoked) {
    return <span className="badge" style={{ color: 'var(--text-error)' }}>已撤销</span>;
  }
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return <span className="badge" style={{ color: 'var(--text-error)' }}>已过期</span>;
  }
  if (invite.remaining <= 0) {
    return <span className="badge subtle">已用完</span>;
  }
  return <span className="badge">可用</span>;
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = '确认', danger }) {
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onCancel} role="presentation">
      <div
        className="dialog-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close" onClick={onCancel} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{message}</p>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            onClick={onConfirm}
            style={danger ? { background: 'var(--text-error)', borderColor: 'var(--text-error)' } : null}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordDialog({ open, user, onConfirm, onCancel }) {
  const [pw, setPw] = useState('');
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (open) {
      setPw('');
      setReveal(false);
    }
  }, [open, user?.id]);
  if (!open || !user) return null;
  const ok = pw.length >= PASSWORD_MIN;
  return (
    <div className="dialog-overlay" onClick={onCancel} role="presentation">
      <div
        className="dialog-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <span className="dialog-title">重置 {user.displayName} 的密码</span>
          <button className="dialog-close" onClick={onCancel} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          <label className="field">
            <span>新密码（≥{PASSWORD_MIN} 位）</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={reveal ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={`至少 ${PASSWORD_MIN} 位`}
                autoFocus
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReveal((r) => !r)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {reveal ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            重置后该用户当前会话不会被强制下线，但下次登录需要用新密码。
          </p>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button className="primary-button" disabled={!ok} onClick={() => onConfirm(pw)}>
            确认重置
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateInviteDialog({ open, onConfirm, onCancel }) {
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (open) {
      setLabel('');
      setMaxUses(1);
      setCount(1);
    }
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-overlay" onClick={onCancel} role="presentation">
      <div
        className="dialog-content"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <span className="dialog-title">生成新邀请码</span>
          <button className="dialog-close" onClick={onCancel} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          <label className="field">
            <span>标签（可选）</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例：朋友小张"
              maxLength={64}
            />
          </label>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label className="field">
              <span>生成数量</span>
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
              />
            </label>
            <label className="field">
              <span>每个码可注册人数</span>
              <input
                type="number"
                min={1}
                max={50}
                value={maxUses}
                onChange={(e) =>
                  setMaxUses(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
              />
            </label>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            onClick={() => onConfirm({ count, maxUses, label: label.trim() || null })}
          >
            生成
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel({ currentUser, onBack }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind, ...payload }
  const [resetting, setResetting] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await admin.listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const loadInvites = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await admin.listInvites();
      setInvites(data.invites || []);
    } catch (err) {
      setError(err.message || '加载邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') loadUsers();
    else loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleDisable = async (u) => {
    try {
      await admin.disableUser(u.id);
      showToast(`已禁用 ${u.displayName}`);
      await loadUsers();
    } catch (err) {
      alert(err.message || '禁用失败');
    }
  };
  const handleEnable = async (u) => {
    try {
      await admin.enableUser(u.id);
      showToast(`已启用 ${u.displayName}`);
      await loadUsers();
    } catch (err) {
      alert(err.message || '启用失败');
    }
  };
  const handleRevokeSessions = async (u) => {
    try {
      const r = await admin.revokeSessions(u.id);
      showToast(`${u.displayName}：已下线 ${r.revoked} 个会话`);
    } catch (err) {
      alert(err.message || '强制下线失败');
    }
  };
  const handleDelete = async (u) => {
    try {
      await admin.deleteUser(u.id);
      showToast(`已删除 ${u.displayName}`);
      await loadUsers();
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };
  const handleResetPassword = async (newPassword) => {
    if (!resetting) return;
    try {
      await admin.resetPassword(resetting.id, newPassword);
      showToast(`已重置 ${resetting.displayName} 的密码`);
      setResetting(null);
    } catch (err) {
      alert(err.message || '重置失败');
    }
  };
  const handleCreateInvite = async ({ count, maxUses, label }) => {
    try {
      const r = await admin.createInvites({ count, maxUses, label });
      showToast(`已生成 ${r.codes.length} 个邀请码`);
      setCreating(false);
      await loadInvites();
    } catch (err) {
      alert(err.message || '生成失败');
    }
  };
  const handleRevokeInvite = async (code) => {
    try {
      await admin.revokeInvite(code);
      showToast(`已撤销 ${code}`);
      await loadInvites();
    } catch (err) {
      alert(err.message || '撤销失败');
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`已复制：${code}`);
    } catch {
      showToast(`复制失败，请手动选中：${code}`);
    }
  };

  return (
    <div className="admin-panel">
      <header className="admin-header card">
        <div>
          <div className="eyebrow">管理后台</div>
          <h1 style={{ margin: '6px 0 4px' }}>用户与邀请码</h1>
          <p className="muted" style={{ margin: 0 }}>
            你正在以管理员身份查看本页。普通用户看不到此入口。
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>← 返回工作区</button>
      </header>

      <div className="admin-tabs">
        <button
          className={`chip-button ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          <Users size={14} /> 用户（{users.length}）
        </button>
        <button
          className={`chip-button ${tab === 'invites' ? 'active' : ''}`}
          onClick={() => setTab('invites')}
        >
          <KeyRound size={14} /> 邀请码（{invites.length}）
        </button>
        <div style={{ flex: 1 }} />
        {tab === 'invites' ? (
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={14} /> 生成邀请码
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="auth-error">
          <AlertTriangle size={14} /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="card empty-state" style={{ textAlign: 'center' }}>
          <Loader2 size={20} className="spin" />
          <p className="muted">加载中…</p>
        </div>
      ) : tab === 'users' ? (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>昵称</th>
                <th>角色</th>
                <th>状态</th>
                <th>简历</th>
                <th>活跃会话</th>
                <th>注册时间</th>
                <th>最后活跃</th>
                <th>邀请码</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <p>暂无用户。</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isMe = currentUser && currentUser.id === u.id;
                  const isAdmin = u.role === 'admin';
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.displayName}</strong>
                        {isMe ? (
                          <span className="badge subtle" style={{ marginLeft: 6 }}>你</span>
                        ) : null}
                      </td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td>
                        <StatusBadge status={u.status} />
                      </td>
                      <td>{u.resumeCount}</td>
                      <td>{u.activeSessions}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(u.createdAt)}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(u.lastSeenAt)}</td>
                      <td style={{ fontSize: 12 }}>
                        {u.inviteCode ? (
                          <code
                            style={{ cursor: 'pointer' }}
                            onClick={() => copyCode(u.inviteCode)}
                            title="点击复制"
                          >
                            {u.inviteCode}
                          </code>
                        ) : (
                          '—'
                        )}
                        {u.inviteLabel ? (
                          <span className="muted" style={{ marginLeft: 6 }}>
                            ({u.inviteLabel})
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <div className="action-row" style={{ flexWrap: 'nowrap' }}>
                          {u.status === 'active' ? (
                            <button
                              className="secondary-button"
                              disabled={isAdmin}
                              title={isAdmin ? '不能禁用管理员' : '禁用账号'}
                              onClick={() => handleDisable(u)}
                            >
                              <PowerOff size={12} />
                            </button>
                          ) : (
                            <button
                              className="secondary-button"
                              title="启用账号"
                              onClick={() => handleEnable(u)}
                            >
                              <Power size={12} />
                            </button>
                          )}
                          <button
                            className="secondary-button"
                            title="重置密码"
                            onClick={() => setResetting(u)}
                          >
                            <KeySquare size={12} />
                          </button>
                          <button
                            className="secondary-button"
                            title="强制下线所有会话"
                            onClick={() => handleRevokeSessions(u)}
                          >
                            <RefreshCw size={12} />
                          </button>
                          <button
                            className="secondary-button"
                            disabled={isAdmin}
                            title={isAdmin ? '不能删除管理员' : '删除用户'}
                            onClick={() => setConfirm({ kind: 'delete', user: u })}
                            style={!isAdmin ? { color: 'var(--text-error)' } : null}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>邀请码</th>
                <th>标签</th>
                <th>已用/最多</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>过期时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <p>暂无邀请码。点击右上角"生成邀请码"开始。</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invites.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <code
                        style={{ cursor: 'pointer' }}
                        onClick={() => copyCode(i.code)}
                        title="点击复制"
                      >
                        {i.code}
                      </code>
                    </td>
                    <td>{i.label || '—'}</td>
                    <td>
                      {i.usedCount} / {i.maxUses}{' '}
                      <span className="muted">（剩 {i.remaining}）</span>
                    </td>
                    <td>
                      <InviteStatus invite={i} />
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(i.createdAt)}</td>
                    <td style={{ fontSize: 12 }}>
                      {i.expiresAt ? formatDate(i.expiresAt) : '永不过期'}
                    </td>
                    <td>
                      <div className="action-row" style={{ flexWrap: 'nowrap' }}>
                        <button
                          className="secondary-button"
                          onClick={() => copyCode(i.code)}
                          title="复制"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          className="secondary-button"
                          disabled={i.revoked}
                          onClick={() => setConfirm({ kind: 'revokeInvite', code: i.code })}
                          style={
                            !i.revoked
                              ? { color: 'var(--text-error)' }
                              : null
                          }
                          title="撤销邀请码"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="删除用户"
        message={`确认删除 ${confirm?.user?.displayName}？该用户的简历、分析、会话也会一并清除，此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => {
          handleDelete(confirm.user);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'revokeInvite'}
        title="撤销邀请码"
        message={`撤销邀请码 ${confirm?.code}？尚未使用的注册额度会作废。`}
        confirmLabel="撤销"
        danger
        onConfirm={() => {
          handleRevokeInvite(confirm.code);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ResetPasswordDialog
        open={Boolean(resetting)}
        user={resetting}
        onConfirm={handleResetPassword}
        onCancel={() => setResetting(null)}
      />

      <CreateInviteDialog
        open={creating}
        onConfirm={handleCreateInvite}
        onCancel={() => setCreating(false)}
      />

      {toast ? (
        <div className="admin-toast">
          <Check size={14} /> {toast}
        </div>
      ) : null}
    </div>
  );
}

export default AdminPanel;