/** Only same-site relative paths, so sign-in can't send people to another site (same rule as the API). */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])[^\s]*$/.test(next) ? next : '/account';
}
