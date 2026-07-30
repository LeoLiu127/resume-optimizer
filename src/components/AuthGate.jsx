import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Sparkles,
  AlertTriangle,
  UserPlus,
  LogIn,
  ShieldCheck,
  X,
  Check,
} from 'lucide-react';
import { auth, getStoredUser, apiConfig } from '../services/api';
import {
  isFirstUserRegistration,
  markBootstrapAsHavingUsers,
} from '../services/registrationPolicy';

const TABS = { REGISTER: 'register', LOGIN: 'login' };
const PASSWORD_MIN = 8;

function ChangePasswordDialog({ open, onClose, onConfirm }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      setError('');
      setShowOld(false);
      setShowNew(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setError('');
    if (!oldPw) return setError('请输入当前密码');
    if (newPw.length < PASSWORD_MIN) return setError(`新密码至少 ${PASSWORD_MIN} 位`);
    if (newPw !== confirmPw) return setError('两次输入的新密码不一致');
    if (oldPw === newPw) return setError('新密码不能与当前密码相同');
    setLoading(true);
    try {
      await onConfirm({ oldPassword: oldPw, newPassword: newPw });
    } catch (err) {
      setError(err.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-content"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-header">
          <span className="dialog-title">修改密码</span>
          <button className="dialog-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          <label className="field">
            <span>当前密码</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="你正在使用的密码"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowOld((v) => !v)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {showOld ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          <label className="field">
            <span>新密码（≥{PASSWORD_MIN} 位）</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={`至少 ${PASSWORD_MIN} 位`}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowNew((v) => !v)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {showNew ? '隐藏' : '显示'}
              </button>
            </div>
          </label>
          <label className="field">
            <span>再输一遍新密码</span>
            <input
              type={showNew ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="确认新密码"
              autoComplete="new-password"
            />
          </label>
          {error ? (
            <div className="auth-error">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : null}
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            修改后当前会话仍然有效，但下次登录需要用新密码。
          </p>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onClose}>取消</button>
          <button className="primary-button" onClick={submit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={14} className="spin" /> 修改中…
              </>
            ) : (
              <>
                <Check size={14} /> 确认修改
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 登录门：注册或登录
 * - 未登录：显示注册/登录 tab
 * - 已登录：渲染 children，并提供登出按钮 + 角色徽章
 */
export function AuthGate({ children }) {
  const [authed, setAuthed] = useState(() => Boolean(getStoredUser()));
  const [user, setUser] = useState(() => getStoredUser());
  const [tab, setTab] = useState(TABS.REGISTER);

  // 通用字段
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // 注册专属
  const [code, setCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bootstrap, setBootstrap] = useState(null);
  const firstUserRegistration = isFirstUserRegistration(bootstrap);
  // 修改密码弹窗
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changePwToast, setChangePwToast] = useState('');

  // 服务端能力探测
  useEffect(() => {
    auth
      .bootstrap()
      .then(setBootstrap)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setAuthed(false);
      setTab(TABS.LOGIN);
      setPassword('');
    };
    window.addEventListener('resume:logout', onLogout);
    return () => window.removeEventListener('resume:logout', onLogout);
  }, []);

  // 切 tab 清空状态
  useEffect(() => {
    setError('');
    setPassword('');
  }, [tab]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (tab === TABS.REGISTER) {
      if (!firstUserRegistration && !code.trim()) return setError('请输入邀请码');
      if (!displayName.trim()) return setError('请填写昵称');
      if (password.length < 8) return setError('密码至少 8 位');
    } else {
      if (!displayName.trim()) return setError('请填写昵称');
      if (!password) return setError('请填写密码');
    }

    setSubmitting(true);
    try {
      const data =
        tab === TABS.REGISTER
          ? await auth.register({
              code: code.trim(),
              displayName: displayName.trim(),
              password,
            })
          : await auth.login({ displayName: displayName.trim(), password });

      if (tab === TABS.REGISTER) {
        setBootstrap((currentBootstrap) => markBootstrapAsHavingUsers(currentBootstrap));
      }
      setUser(data.user);
      setAuthed(true);
      setCode('');
      setPassword('');
      try {
        window.dispatchEvent(new CustomEvent('resume:login'));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message || (tab === TABS.REGISTER ? '注册失败' : '登录失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    try {
      window.dispatchEvent(new CustomEvent('resume:logout', { detail: { reason: 'manual' } }));
    } catch {
      /* ignore */
    }
  };

  const handleChangePassword = async ({ oldPassword, newPassword }) => {
    await auth.changePassword({ oldPassword, newPassword });
    setChangePwOpen(false);
    setChangePwToast('密码已更新，下次登录请用新密码');
    setTimeout(() => setChangePwToast(''), 2500);
  };

  if (!authed) {
    return (
      <div className="auth-gate">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-icon">
            <KeyRound size={28} />
          </div>
          <h1 className="auth-title">简历优化大师</h1>
          <p className="auth-subtitle">
            {firstUserRegistration
              ? '欢迎第一位用户：你将自动成为管理员。'
              : '朋友分享的简历优化工具。首次使用请注册，已有账号直接登录。'}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === TABS.REGISTER ? 'active' : ''}`}
              onClick={() => setTab(TABS.REGISTER)}
            >
              <UserPlus size={14} /> 注册
            </button>
            <button
              type="button"
              className={`auth-tab ${tab === TABS.LOGIN ? 'active' : ''}`}
              onClick={() => setTab(TABS.LOGIN)}
            >
              <LogIn size={14} /> 登录
            </button>
          </div>

          {tab === TABS.REGISTER && !firstUserRegistration ? (
            <label className="field">
              <span>邀请码</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例：CAEVRSTUJJ"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          ) : null}

          <label className="field">
            <span>昵称</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={tab === TABS.REGISTER ? '给自己起个名字（之后用这个登录）' : '你注册时的昵称'}
              maxLength={32}
              autoFocus={tab === TABS.LOGIN}
              spellCheck={false}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span>密码{tab === TABS.REGISTER ? '（≥8 位）' : ''}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === TABS.REGISTER ? '设一个密码' : '输入密码'}
              autoComplete={tab === TABS.REGISTER ? 'new-password' : 'current-password'}
            />
          </label>

          {error ? (
            <div className="auth-error">
              <AlertTriangle size={14} /> {error}
            </div>
          ) : null}

          <button type="submit" className="primary-button auth-submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> {tab === TABS.REGISTER ? '注册中…' : '登录中…'}
              </>
            ) : (
              <>
                {tab === TABS.REGISTER ? <Sparkles size={16} /> : <LogIn size={16} />}{' '}
                {tab === TABS.REGISTER ? '注册并开始' : '登录'}
              </>
            )}
          </button>

          <div className="auth-footer">
            <p>
              {tab === TABS.REGISTER ? (
                firstUserRegistration ? (
                  <>首位用户免邀请码，将自动成为管理员。</>
                ) : (
                  <>
                    还没有邀请码？联系开通者获取。
                    <br />
                    第一个注册的账号会自动成为管理员。
                  </>
                )
              ) : (
                <>忘记密码？联系管理员重置。</>
              )}
              <br />
              API: <code>{apiConfig.API_BASE}</code>
            </p>
            {bootstrap && !bootstrap.minimaxConfigured ? (
              <p className="auth-warn">
                ⚠️ 服务端未配置 MiniMax API Key，AI 分析暂不可用。
              </p>
            ) : null}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-topbar">
        <div className="auth-user">
          <span className="auth-user-dot" />
          <span className="auth-user-name">{user?.displayName || '匿名用户'}</span>
          {user?.role === 'admin' ? (
            <span className="auth-role-badge" title="管理员">
              <ShieldCheck size={12} /> 管理员
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="auth-logout"
            onClick={() => setChangePwOpen(true)}
            title="修改密码"
          >
            <Lock size={14} /> 修改密码
          </button>
          <button type="button" className="auth-logout" onClick={handleLogout} title="登出当前账号">
            <LogOut size={14} /> 登出
          </button>
        </div>
      </div>
      <div className="auth-content">{children}</div>

      <ChangePasswordDialog
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        onConfirm={handleChangePassword}
      />

      {changePwToast ? (
        <div className="admin-toast">
          <Check size={14} /> {changePwToast}
        </div>
      ) : null}
    </div>
  );
}
