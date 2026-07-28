export function answerStorageKeys(userId) {
  const scope = userId || 'guest';
  return {
    bankKey: `resume.answerBank.${scope}`,
    answersKey: `resume.answers.${scope}`,
    bulletsKey: `resume.bullets.${scope}`,
    contextKey: `resume.answerContext.${scope}`,
  };
}

function remove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    /* storage can be unavailable or over policy limits */
  }
}

export function clearTransientAnswerStorage(storage, userId) {
  const { answersKey, bulletsKey, contextKey } = answerStorageKeys(userId);
  remove(storage, answersKey);
  remove(storage, bulletsKey);
  remove(storage, contextKey);
}

export function clearAllAnswerStorage(storage, userId) {
  const { bankKey, answersKey, bulletsKey, contextKey } = answerStorageKeys(userId);
  remove(storage, bankKey);
  remove(storage, answersKey);
  remove(storage, bulletsKey);
  remove(storage, contextKey);
}

export function ensureTransientAnswerContext(storage, userId, nextContext) {
  if (!storage || !nextContext) return false;
  const { answersKey, bulletsKey, contextKey } = answerStorageKeys(userId);
  try {
    if (storage.getItem(contextKey) === nextContext) return false;
    remove(storage, answersKey);
    remove(storage, bulletsKey);
    storage.setItem(contextKey, nextContext);
    return true;
  } catch {
    return false;
  }
}
