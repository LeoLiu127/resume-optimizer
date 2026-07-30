export function isFirstUserRegistration(bootstrap) {
  return bootstrap?.hasUsers === false;
}
