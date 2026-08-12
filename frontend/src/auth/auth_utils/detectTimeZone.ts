//frontend/src/auth/auth_utils/detectTimeZone.ts

/**
 * The IANA zone this device is set to, used to seed a new account.
 *
 * Only sign-up may call this. Everywhere else the zone comes from
 * `userData.timezone`, which is the account's own value: a user who travels
 * must not see their budget periods move with the laptop.
 *
 * 'UTC' is the fallback and is also what the column defaults to, so a browser
 * that cannot resolve a zone lands on the same value as one that never sent
 * anything. It is a valid identifier for the API even though
 * Intl.supportedValuesOf('timeZone') omits it.
 */
export const detectTimeZone = (): string => {
 try {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
 } catch {
  return 'UTC';
 }
};
