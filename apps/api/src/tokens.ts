/** Dependency-injection tokens. Code depends on these, never on concrete providers. */
export const PROVIDER_SET = Symbol('PROVIDER_SET');
export const CLOCK = Symbol('CLOCK');
export const SEARCH_STORE = Symbol('SEARCH_STORE');
export const ACCOUNT_STORE = Symbol('ACCOUNT_STORE');
export const MAILER = Symbol('MAILER');
export const GOOGLE_AUTH = Symbol('GOOGLE_AUTH');
