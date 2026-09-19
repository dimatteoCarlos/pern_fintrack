// backend/src/export_api/core/exportFileName.js
//
// The name the browser saves a download under, PLAN_EXPORT.md §11: the months
// the data is about, not the day it was downloaded — two exports of the same
// range taken on different days are the same file and are named alike. Also
// carries the requesting user's name, so two accounts exporting the same
// period don't overwrite each other's file on disk.

// username has no character-class rule (userSchemas.js's requiredNameSchema
// checks only length and blank-ness), so it can hold spaces or punctuation a
// filename and a Content-Disposition header can't. Collapsed to the
// characters both accept; 'user' covers the row-not-found and now-blank cases.
//
// The accent comes off the letter before the class filter runs, not with it:
// NFD splits 'é' into 'e' plus a combining mark, so removing the marks leaves
// the base letter instead of deleting the whole character. 'José Ñandú' reads
// 'jose-nandu'. The class itself stays this narrow because the result goes into
// a Content-Disposition header.
const sanitizeForFilename = (value) => {
 const clean = (value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

 return clean || 'user';
};

/**
 * @param {{from: (string|null), to: (string|null), format: string, username: string}} range -
 *  from/to as 'YYYY-MM-01' or null; format the file extension ('csv'|'xlsx')
 * @returns {string}
 */
export function exportFileName({ from, to, format, username }) {
 const who = sanitizeForFilename(username);

 if (!from && !to) {
  return `fintrack-movements-${who}-all-time.${format}`;
 }

 // One bound present, the other open-ended: named after the bound that is
 // there rather than spelled out as a range with a missing side.
 if (!from || !to || from === to) {
  const month = (from ?? to).slice(0, 7);
  return `fintrack-movements-${who}-${month}.${format}`;
 }

 return `fintrack-movements-${who}-${from.slice(0, 7)}_${to.slice(0, 7)}.${format}`;
}

/**
 * The period statement's own name: one reference month, never a range
 * (PLAN_EXPORT.md §11: `fintrack-statement-YYYY-MM.pdf|xlsx`), plus the
 * requesting user's name.
 *
 * @param {{referenceMonth: string, format: string, username: string}} statement -
 *  referenceMonth 'YYYY-MM-01'; format the file extension ('xlsx'|'pdf')
 * @returns {string}
 */
export function statementFileName({ referenceMonth, format, username }) {
 const who = sanitizeForFilename(username);
 return `fintrack-statement-${who}-${referenceMonth.slice(0, 7)}.${format}`;
}

/**
 * The name a per-module export is saved under: the dataset, the owner, and the
 * period the data is about — `pocket_ana_2026-09.csv`.
 *
 * A third shape rather than a third sanitiser: these three files keep the
 * underscored `<dataset>_<user>_<period>` name they are asked for, and what they
 * share with the two above is the one rule that decides what a username may
 * contribute to a filename.
 *
 * @param {{dataset: string, period: string, format: string, username: string}} file -
 *  dataset 'budget'|'pocket'|'debt'; period already reduced to the months the
 *  data covers, never the download date; format the extension ('csv'|'xlsx')
 * @returns {string}
 */
export function moduleExportFileName({ dataset, period, format, username }) {
 return `${dataset}_${sanitizeForFilename(username)}_${period}.${format}`;
}
