/**
 * 目标岗位管理 Hook
 *
 * - 列出 / 创建 / 更新 / 删除目标岗位
 * - JD 链接提取
 * - 从当前分析输入快速保存为岗位
 * - 选中岗位后自动填充 input 表单
 */

import { useCallback, useState } from 'react';
import { positions as positionsApi, jd as jdApi } from '../services/api';

export const POSITION_STATUS = {
  preparing: { label: '准备中', color: '#6b7280' },
  applied: { label: '已投递', color: '#2563eb' },
  interview: { label: '面试中', color: '#d97706' },
  offer: { label: 'Offer', color: '#059669' },
  rejected: { label: '已淘汰', color: '#dc2626' },
};

export function usePositions() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // JD 提取状态
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);

  /* ============ 列表加载 ============ */

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await positionsApi.list();
      setList(res.positions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============ CRUD ============ */

  const createPosition = useCallback(async (payload) => {
    const res = await positionsApi.create(payload);
    await refresh();
    return res.id;
  }, [refresh]);

  const updatePosition = useCallback(async (id, payload) => {
    await positionsApi.update(id, payload);
    await refresh();
  }, [refresh]);

  const removePosition = useCallback(async (id) => {
    await positionsApi.remove(id);
    await refresh();
  }, [refresh]);

  const saveFromInput = useCallback(async (input) => {
    const res = await positionsApi.fromInput(input);
    await refresh();
    return res.id;
  }, [refresh]);

  /* ============ JD 链接提取 ============ */

  const extractJd = useCallback(async (url) => {
    setExtracting(true);
    setExtractResult(null);
    setError('');
    try {
      const result = await jdApi.extract(url);
      setExtractResult(result);
      return result;
    } catch (err) {
      setError(err.message);
      setExtractResult({ success: false, message: err.message });
      return null;
    } finally {
      setExtracting(false);
    }
  }, []);

  const loginAssist = useCallback(async (site = 'boss') => {
    try {
      const res = await jdApi.loginAssist(site);
      return res.message;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const clearExtractResult = useCallback(() => {
    setExtractResult(null);
  }, []);

  /* ============ 岗位 → input 表单映射 ============ */

  const positionToInput = useCallback((pos) => {
    return {
      targetRole: pos.title || '',
      targetIndustry: pos.targetIndustry || '',
      targetCompanyType: pos.targetCompanyType || '',
      jobStage: pos.jobStage || '',
      highlightSkills: pos.highlightSkills || '',
      jd: pos.jdContent || '',
      extras: pos.extras || '',
    };
  }, []);

  return {
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
  };
}
