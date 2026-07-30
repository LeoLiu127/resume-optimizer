export function isFirstUserRegistration(bootstrap) {
  return bootstrap?.hasUsers === false;
}

export function markBootstrapAsHavingUsers(bootstrap) {
  return { ...bootstrap, hasUsers: true };
}
