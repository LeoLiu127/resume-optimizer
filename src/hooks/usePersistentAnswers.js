/**
 * 经历追问记忆 Hook
 *
 * 功能：
 * 1. 将用户的追问回答 + AI 生成的 bullet 持久化到 localStorage
 * 2. 维护一个"回答记忆库"（answerBank），按问题文本指纹索引
 * 3. 当新 JD 产生新追问时，自动匹配已回答过的问题并预填充
 * 4. 标记出真正"新增"的追问（从未回答过的）
 *
 * 存储 key（按用户隔离）：
 *   resume.answerBank.{userId}  — 长期记忆库
 *   resume.answers.{userId}     — 当前各 askItem id → 回答
 *   resume.bullets.{userId}     — 当前各 askItem id → AI bullet
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ============ 工具函数 ============ */

/** 将问题文本标准化为指纹（用于跨分析匹配） */
function fingerprint(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* quota exceeded — ignore */
  }
}

/* ============ Hook ============ */

/**
 * @param {string} userId - 当前登录用户 id（未登录传 ''）
 */
export function usePersistentAnswers(userId) {
  const bankKey = `resume.answerBank.${userId || 'guest'}`;
  const answersKey = `resume.answers.${userId || 'guest'}`;
  const bulletsKey = `resume.bullets.${userId || 'guest'}`;

  // 当前回答 { [askItemId]: string }
  const [answers, setAnswersRaw] = useState(() => safeGet(answersKey) || {});
  // AI 生成的 bullet { [askItemId]: string }
  const [followUpBullets, setFollowUpBulletsRaw] = useState(() => safeGet(bulletsKey) || {});
  // 记忆库 { [fingerprint]: { title, question, answer, bullet, updatedAt } }
  const bankRef = useRef(safeGet(bankKey) || {});
  // 新增追问 id 集合（从未在记忆库中出现过的）
  const [newItemIds, setNewItemIds] = useState(new Set());

  // 防抖写入 timer
  const saveTimer = useRef(null);

  /* ---- 持久化 answers ---- */
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      safeSet(answersKey, answers);
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, answersKey]);

  /* ---- 持久化 bullets ---- */
  useEffect(() => {
    safeSet(bulletsKey, followUpBullets);
  }, [followUpBullets, bulletsKey]);

  /* ---- 用户切换时重新加载 ---- */
  useEffect(() => {
    setAnswersRaw(safeGet(answersKey) || {});
    setFollowUpBulletsRaw(safeGet(bulletsKey) || {});
    bankRef.current = safeGet(bankKey) || {};
    setNewItemIds(new Set());
  }, [userId, bankKey, answersKey, bulletsKey]);

  /* ---- 公开 API ---- */

  /** 更新某个 askItem 的回答（同时写入记忆库） */
  const setAnswer = useCallback(
    (askItem, value) => {
      setAnswersRaw((prev) => ({ ...prev, [askItem.id]: value }));
      // 同步到记忆库
      if (value.trim()) {
        const fp = fingerprint(askItem.question);
        bankRef.current = {
          ...bankRef.current,
          [fp]: {
            title: askItem.title,
            question: askItem.question,
            answer: value,
            bullet: followUpBullets[askItem.id] || bankRef.current[fp]?.bullet || '',
            updatedAt: Date.now(),
          },
        };
        safeSet(bankKey, bankRef.current);
      }
    },
    [bankKey, followUpBullets],
  );

  /** 批量设置 answers（用于恢复/预填充） */
  const setAnswers = useCallback((next) => {
    if (typeof next === 'function') {
      setAnswersRaw(next);
    } else {
      setAnswersRaw(next);
    }
  }, []);

  /** 保存 AI 生成的 bullet（同时更新记忆库） */
  const saveBullet = useCallback(
    (askItem, bullet) => {
      setFollowUpBulletsRaw((prev) => ({ ...prev, [askItem.id]: bullet }));
      // 更新记忆库中对应条目的 bullet
      const fp = fingerprint(askItem.question);
      const existing = bankRef.current[fp];
      if (existing) {
        bankRef.current = {
          ...bankRef.current,
          [fp]: { ...existing, bullet, updatedAt: Date.now() },
        };
      } else {
        bankRef.current = {
          ...bankRef.current,
          [fp]: {
            title: askItem.title,
            question: askItem.question,
            answer: answers[askItem.id] || '',
            bullet,
            updatedAt: Date.now(),
          },
        };
      }
      safeSet(bankKey, bankRef.current);
    },
    [bankKey, answers],
  );

  const setFollowUpBullets = useCallback((next) => {
    if (typeof next === 'function') {
      setFollowUpBulletsRaw(next);
    } else {
      setFollowUpBulletsRaw(next);
    }
  }, []);

  /**
   * 当新一轮分析产出 askItems 时调用：
   * - 用记忆库自动预填充之前回答过的问题
   * - 标记新增追问
   * - 保留已有的 AI bullet（如果问题+回答没变）
   *
   * @param {Array} askItems - normalizeAskItems 输出的追问列表
   */
  const mergeWithMemory = useCallback(
    (askItems) => {
      if (!askItems || !askItems.length) return;
      const bank = bankRef.current;
      const newIds = new Set();
      const patchedAnswers = {};
      const patchedBullets = {};

      for (const item of askItems) {
        const fp = fingerprint(item.question);
        const remembered = bank[fp];
        if (remembered && remembered.answer) {
          // 记忆库中有该问题的回答 → 预填充
          patchedAnswers[item.id] = remembered.answer;
          if (remembered.bullet) {
            patchedBullets[item.id] = remembered.bullet;
          }
        } else {
          // 从未回答过 → 标记为新增
          newIds.add(item.id);
        }
      }

      // 合并（不覆盖用户当前已手动修改的回答）
      setAnswersRaw((prev) => {
        const merged = { ...prev };
        for (const [id, val] of Object.entries(patchedAnswers)) {
          if (!merged[id]) {
            merged[id] = val;
          }
        }
        return merged;
      });
      setFollowUpBulletsRaw((prev) => {
        const merged = { ...prev };
        for (const [id, val] of Object.entries(patchedBullets)) {
          if (!merged[id]) {
            merged[id] = val;
          }
        }
        return merged;
      });
      setNewItemIds(newIds);
    },
    [],
  );

  /** 清空所有记忆（登出 / 用户主动清除） */
  const clearAll = useCallback(() => {
    setAnswersRaw({});
    setFollowUpBulletsRaw({});
    bankRef.current = {};
    setNewItemIds(new Set());
    safeSet(bankKey, null);
    safeSet(answersKey, null);
    safeSet(bulletsKey, null);
  }, [bankKey, answersKey, bulletsKey]);

  /** 仅清空当前回答（保留记忆库，用于"使用示例数据"） */
  const clearCurrent = useCallback(() => {
    setAnswersRaw({});
    setFollowUpBulletsRaw({});
    setNewItemIds(new Set());
    safeSet(answersKey, null);
    safeSet(bulletsKey, null);
  }, [answersKey, bulletsKey]);

  /** 记忆库中已有回答的数量 */
  const memoryCount = Object.keys(bankRef.current).filter(
    (k) => bankRef.current[k]?.answer,
  ).length;

  return {
    answers,
    setAnswers,
    setAnswer,
    followUpBullets,
    setFollowUpBullets,
    saveBullet,
    mergeWithMemory,
    newItemIds,
    clearAll,
    clearCurrent,
    memoryCount,
  };
}
