//frontend/src/auth/auth_utils/timeZoneOptions.ts

import { detectTimeZone } from './detectTimeZone';

export type TimeZoneOptionType = {
 label: string;
 value: string;
};

/**
 * The zone the database column defaults to. Kept here so the form and the
 * fallback list agree on the same identifier.
 */
export const DEFAULT_TIME_ZONE = 'UTC';

/**
 * Intl.supportedValuesOf ships in the ES2022 lib and this project compiles
 * against ES2020, so the call is typed here instead of widening the global lib
 * for every file. Optional because a runtime may genuinely not have it.
 */
type IntlWithSupportedValues = typeof Intl & {
 supportedValuesOf?: (key: 'timeZone') => string[];
};

/** Every canonical zone the runtime knows, or null when it cannot say. */
const supportedZones = (): string[] | null => {
 const intl = Intl as IntlWithSupportedValues;

 if (typeof intl.supportedValuesOf !== 'function') return null;

 try {
  return intl.supportedValuesOf('timeZone');
 } catch {
  return null;
 }
};

/**
 * Current UTC offset of a zone, as the reader would read it on a clock.
 *
 * Returned empty rather than thrown when the runtime rejects the identifier, so
 * one unknown zone degrades to a bare name instead of emptying the whole list.
 */
const zoneOffsetLabel = (timeZone: string): string => {
 try {
  const parts = new Intl.DateTimeFormat('en-US', {
   timeZone,
   timeZoneName: 'shortOffset',
  }).formatToParts(new Date());

  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
 } catch {
  return '';
 }
};

/**
 * Every IANA zone this runtime knows, as options for the profile form.
 *
 * The catalog comes from the engine, never from a hand-written list of cities:
 * a hardcoded list goes stale the next time a government moves a boundary, and
 * it would drift from the set the backend accepts, which is built from the same
 * call. 'UTC' is appended because Intl lists canonical zones only and leaves it
 * out, and it is the value every existing row already holds.
 *
 * The fallback is the device zone plus UTC — the two values that are certainly
 * valid — for a runtime without Intl.supportedValuesOf.
 */
export const buildTimeZoneOptions = (): TimeZoneOptionType[] => {
 const catalog = supportedZones();

 const zones = catalog
  ? [...catalog, DEFAULT_TIME_ZONE]
  : [detectTimeZone(), DEFAULT_TIME_ZONE];

 const unique = Array.from(new Set(zones)).sort((a, b) => a.localeCompare(b));

 return unique.map((zone) => {
  const offset = zoneOffsetLabel(zone);

  return {
   value: zone,
   label: offset ? `${zone} (${offset})` : zone,
  };
 });
};

/**
 * Whether a value is a zone this application agrees to store. Mirrors
 * isIanaTimeZone on the backend so a bad value is refused before the request
 * leaves, and case sensitive for the same reason: Postgres rejects 'utc'.
 */
export const isIanaTimeZone = (value: unknown): boolean => {
 if (typeof value !== 'string') return false;
 if (value === DEFAULT_TIME_ZONE) return true;

 const catalog = supportedZones();

 if (catalog) return catalog.includes(value);

 // Without the catalog, ask the formatter whether it accepts the identifier.
 try {
  new Intl.DateTimeFormat('en-US', { timeZone: value });
  return true;
 } catch {
  return false;
 }
};
