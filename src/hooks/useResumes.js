/**
 * 简历库 Hook
 *
 * - 列出 / 加载 / 保存 / 删除云端简历
 * - 自动保存：input 改变后防抖 N 秒写入当前激活的 resume
 * - 用户级 localStorage 兜底：网络失败时不丢数据，也不跨账号恢复
 * - 编辑 epoch + revision：迟到请求不能重新激活或覆盖当前简历
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { resumes as resumesApi } from '../services/api';
import { createAutoSaveCoordinator } from '../services/autoSaveCoordinator';
import {
  migrateLegacyDraft,
  readActiveResumeId,
  readDraft,
  writeActiveResumeId,
  writeDraft,
} from '../services/resumeDraftStorage';

const AUTOSAVE_MS = 2500;

export function useResumes(userId) {
  const [list, setList] = useState([]);
  const [activeId, setActiveIdState] = useState(() => {
    migrateLegacyDraft(localStorage, userId);
    return readActiveResumeId(localStorage, userId);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const timerRef = useRef(null);
  const coordinatorRef = useRef(createAutoSaveCoordinator());
  const queueRef = useRef(Promise.resolve());

  const setActiveId = useCallback((id) => {
    const next = id || '';
    setActiveIdState(next);
    writeActiveResumeId(localStorage, userId, next);
  }, [userId]);

  const readLocalDraft = useCallback(
    () => readDraft(localStorage, userId),
    [userId],
  );
  const readActiveId = useCallback(
    () => readActiveResumeId(localStorage, userId),
    [userId],
  );

  useEffect(() => {
    migrateLegacyDraft(localStorage, userId);
    coordinatorRef.current.advanceEpoch();
    setList([]);
    setActiveIdState(readActiveResumeId(localStorage, userId));
  }, [userId]);

  /* ============ 列表加载 ============ */

  const refresh = useCallback(async () => {
    if (!userId) {
      setList([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await resumesApi.list();
      const nextList = res.resumes || [];
      setList(nextList);
      setActiveIdState((cur) => {
        if (cur && !nextList.some((r) => r.id === cur)) {
          writeActiveResumeId(localStorage, userId, '');
          return '';
        }
        return cur;
      });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /* ============ CRUD ============ */

  const loadResume = useCallback(async (id) => {
    if (!id) return null;
    const res = await resumesApi.get(id);
    setActiveId(id);
    return res;
  }, [setActiveId]);

  const createResume = useCallback(async (name, content, targetRole, input, positionId = null) => {
    const res = await resumesApi.create({ name, content, targetRole, input, positionId });
    await refresh();
    setActiveId(res.id);
    return res.id;
  }, [refresh, setActiveId]);

  const updateResume = useCallback(async (id, payload) => {
    await resumesApi.update(id, payload);
    await refresh();
    setLastSavedAt(new Date());
  }, [refresh]);

  const removeResume = useCallback(async (id) => {
    const pending = coordinatorRef.current.peek();
    if (pending?.id === id) {
      coordinatorRef.current.clear();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    await resumesApi.remove(id);
    if (activeId === id) setActiveId('');
    await refresh();
  }, [activeId, refresh, setActiveId]);

  /* ============ 自动保存（防抖 + 串行持久化） ============ */

  const persistTicket = useCallback(async (ticket, { allowActivation = true } = {}) => {
    if (!ticket?.payload) return;
    const cur = ticket.payload;
    const coordinator = coordinatorRef.current;
    try {
      if (cur.id) {
        await resumesApi.update(cur.id, {
          name: cur.name,
          content: cur.content,
          targetRole: cur.targetRole,
          input: cur.input,
          positionId: cur.positionId,
        });
        if (coordinator.isSameEpoch(ticket)) setLastSavedAt(new Date());
      } else if (cur.name) {
        const res = await resumesApi.create({
          name: cur.name,
          content: cur.content,
          targetRole: cur.targetRole,
          input: cur.input,
          positionId: cur.positionId,
        });
        coordinator.adoptCreatedId(ticket, res.id);
        if (coordinator.isSameEpoch(ticket)) {
          const latest = coordinator.peek();
          writeDraft(localStorage, userId, {
            ...(latest || cur),
            id: res.id,
          });
          if (allowActivation) setActiveId(res.id);
          setLastSavedAt(new Date());
        }
      }
      if (coordinator.isSameEpoch(ticket)) await refresh();
    } catch (err) {
      if (coordinator.isSameEpoch(ticket)) setError(err.message);
      throw err;
    } finally {
      coordinator.complete(ticket);
    }
  }, [refresh, setActiveId, userId]);

  const drainPending = useCallback(({ allowActivation = true } = {}) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const run = async () => {
      const ticket = coordinatorRef.current.beginRequest();
      if (!ticket) return;
      await persistTicket(ticket, { allowActivation });
    };
    queueRef.current = queueRef.current.then(run, run);
    return queueRef.current;
  }, [persistTicket]);

  const scheduleAutoSave = useCallback((payload) => {
    if (!userId) return;
    writeDraft(localStorage, userId, { ...payload, ts: Date.now() });
    coordinatorRef.current.schedule(payload);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      drainPending().catch(() => {});
    }, AUTOSAVE_MS);
  }, [drainPending, userId]);

  const flushAutoSave = useCallback(
    () => drainPending({ allowActivation: true }),
    [drainPending],
  );

  const beginEditingSession = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const detached = coordinatorRef.current.advanceEpoch();
    if (detached) {
      const run = () => persistTicket(detached, { allowActivation: false });
      queueRef.current = queueRef.current.then(run, run).catch(() => {});
    }
    return queueRef.current;
  }, [persistTicket]);

  /* ============ 登出清理 ============ */

  const clearLocal = useCallback(() => {
    setList([]);
    setActiveIdState('');
    setLastSavedAt(null);
    setError('');
    setLoading(false);
    writeDraft(localStorage, userId, null);
    writeActiveResumeId(localStorage, userId, '');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    coordinatorRef.current.advanceEpoch();
    coordinatorRef.current.clear();
  }, [userId]);

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
    beginEditingSession,
    clearLocal,
    readLocalDraft,
    readActiveId,
  };
}
