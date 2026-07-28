const LEGACY_LOCAL_KEY = 'resume.draft.local';
const LEGACY_ACTIVE_KEY = 'resume.draft.activeId';

export function draftStorageKeys(userId) {
  const scope = userId || 'guest';
  return {
    localKey: `resume.draft.local.${scope}`,
    activeKey: `resume.draft.activeId.${scope}`,
  };
}

export function migrateLegacyDraft(storage, userId) {
  if (!storage || !userId) return false;
  try {
    const { localKey, activeKey } = draftStorageKeys(userId);
    const legacyDraft = storage.getItem(LEGACY_LOCAL_KEY);
    const legacyActiveId = storage.getItem(LEGACY_ACTIVE_KEY);
    if (!legacyDraft && !legacyActiveId) return false;

    if (legacyDraft && !storage.getItem(localKey)) {
      storage.setItem(localKey, legacyDraft);
    }
    if (legacyActiveId && !storage.getItem(activeKey)) {
      storage.setItem(activeKey, legacyActiveId);
    }
    storage.removeItem(LEGACY_LOCAL_KEY);
    storage.removeItem(LEGACY_ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readDraft(storage, userId) {
  if (!storage || !userId) return null;
  try {
    const { localKey } = draftStorageKeys(userId);
    const raw = storage.getItem(localKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDraft(storage, userId, payload) {
  if (!storage || !userId) return;
  try {
    const { localKey } = draftStorageKeys(userId);
    if (payload) storage.setItem(localKey, JSON.stringify(payload));
    else storage.removeItem(localKey);
  } catch {
    /* ignore unavailable storage */
  }
}

export function readActiveResumeId(storage, userId) {
  if (!storage || !userId) return '';
  try {
    return storage.getItem(draftStorageKeys(userId).activeKey) || '';
  } catch {
    return '';
  }
}

export function writeActiveResumeId(storage, userId, id) {
  if (!storage || !userId) return;
  try {
    const { activeKey } = draftStorageKeys(userId);
    if (id) storage.setItem(activeKey, id);
    else storage.removeItem(activeKey);
  } catch {
    /* ignore unavailable storage */
  }
}

