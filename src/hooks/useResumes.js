/**
 * 简历库 Hook
 *
 * - 列出 / 加载 / 保存 / 删除云端简历
 * - 自动保存：input 改变后防抖 N 秒写入当前激活的 resume
 * - localStorage 兜底：网络失败时不丢数据
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resumes as resumesApi } from '../services/api';

const LOCAL_KEY = 'resume.draft.local';
const ACTIVE_KEY = 'resume.draft.activeId';
const AUTOSAVE_MS = 2500;

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readLocalDraft() {
  return safeParse(localStorage.getItem(LOCAL_KEY) || 'null');
}

function writeLocalDraft(payload) {
  try {
    if (payload) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(LOCAL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function useResumes() {
  const [list, setList] = useState([]);
  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);

  /* ============ 列表加载 ============ */

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await resumesApi.list();
      setList(res.resumes || []);
      // 如果激活 id 不在列表里，清空
      setActiveId((cur) => {
        if (cur && !(res.resumes || []).some((r) => r.id === cur)) {
          try {
            localStorage.removeItem(ACTIVE_KEY);
          } catch {
            /* ignore */
          }
          return '';
        }
        return cur;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============ CRUD ============ */

  const loadResume = useCallback(async (id) => {
    if (!id) return null;
    const res = await resumesApi.get(id);
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
    return res;
  }, []);

  const createResume = useCallback(async (name, content, targetRole, input) => {
    const res = await resumesApi.create({ name, content, targetRole, input });
    await refresh();
    setActiveId(res.id);
    try {
      localStorage.setItem(ACTIVE_KEY, res.id);
    } catch {
      /* ignore */
    }
    return res.id;
  }, [refresh]);

  const updateResume = useCallback(async (id, payload) => {
    await resumesApi.update(id, payload);
    await refresh();
    setLastSavedAt(new Date());
  }, [refresh]);

  const removeResume = useCallback(async (id) => {
    await resumesApi.remove(id);
    if (activeId === id) {
      setActiveId('');
      try {
        localStorage.removeItem(ACTIVE_KEY);
      } catch {
        /* ignore */
      }
    }
    await refresh();
  }, [activeId, refresh]);

  /* ============ 自动保存（防抖） ============ */

  const scheduleAutoSave = useCallback((payload) => {
    // 先写 localStorage 兜底
    writeLocalDraft({ ...payload, ts: Date.now() });
    pendingRef.current = { ...payload };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const cur = pendingRef.current;
      if (!cur) return;
      try {
        if (cur.id) {
          await resumesApi.update(cur.id, {
            name: cur.name,
            content: cur.content,
            targetRole: cur.targetRole,
            input: cur.input,
          });
          setLastSavedAt(new Date());
        } else if (cur.name) {
          const res = await resumesApi.create({
            name: cur.name,
            content: cur.content,
            targetRole: cur.targetRole,
            input: cur.input,
          });
          setActiveId(res.id);
          try {
            localStorage.setItem(ACTIVE_KEY, res.id);
          } catch {
            /* ignore */
          }
          // 同步本地草稿里的 id，下次刷新能恢复表单
          writeLocalDraft({ ...cur, id: res.id });
          setLastSavedAt(new Date());
        }
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        pendingRef.current = null;
      }
    }, AUTOSAVE_MS);
  }, [refresh]);

  const flushAutoSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const cur = pendingRef.current;
    if (!cur) return;
    try {
      if (cur.id) {
        await resumesApi.update(cur.id, {
          name: cur.name,
          content: cur.content,
          targetRole: cur.targetRole,
          input: cur.input,
        });
        setLastSavedAt(new Date());
      } else if (cur.name) {
        const res = await resumesApi.create({
          name: cur.name,
          content: cur.content,
          targetRole: cur.targetRole,
          input: cur.input,
        });
        setActiveId(res.id);
        try {
          localStorage.setItem(ACTIVE_KEY, res.id);
        } catch {
          /* ignore */
        }
        setLastSavedAt(new Date());
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      pendingRef.current = null;
    }
  }, [refresh]);

  /* ============ 登出清理 ============ */

  const clearLocal = useCallback(() => {
    setList([]);
    setActiveId('');
    setLastSavedAt(null);
    writeLocalDraft(null);
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    list,
    activeId,
    setActiveId,
    loading,
    error,
    lastSavedAt,
    refresh,
    loadResume,
    createResume,
    updateResume,
    removeResume,
    scheduleAutoSave,
    flushAutoSave,
    clearLocal,
    readLocalDraft,
  };
}
