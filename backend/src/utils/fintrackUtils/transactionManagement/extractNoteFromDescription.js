// backend/src/utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js

// What the owner types and what the server narrates share the one description
// column. Ten sites across three controllers compose that sentence and every
// one of them writes the marker below, which is the only reliable seam between
// the two halves.
//
// Interim by decision (R62): the real fix is a note column of its own. The rule
// lives here rather than in the readers so that the day the column exists, this
// file is the only one that changes.

// With the colon and the space, not the bare word. A note that legitimately
// opens "Transaction fee de Binance" would otherwise be cut at its own first
// word and come back empty.
const NARRATIVE_MARKER = 'Transaction: ';

// Composed by the server, never typed. They survive the split and read on
// screen as if the owner had written them.
const SYSTEM_PREFIXES = ['Expense Reversal.', 'Income Reversal.'];

/**
 * The owner's note, or null when the description carries none.
 *
 * Null rather than '': only two of the ten composing sites can prepend a note.
 * The other eight are account openings and counterparty narrations nobody
 * annotated, so an absent note is the ordinary case and the reader has to be
 * able to tell it apart from a note that is empty.
 *
 * @param {string|null|undefined} description
 * @returns {string|null} the note, trimmed, or null
 */
export function extractNoteFromDescription(description) {
 if (typeof description !== 'string') return null;

 let note = description.split(NARRATIVE_MARKER)[0];

 for (const prefix of SYSTEM_PREFIXES) {
  if (note.startsWith(prefix)) note = note.slice(prefix.length);
 }

 note = note.trim();

 // The composer appends a period to the note it prepends. Removing exactly one
 // returns what was typed either way: an owner who ended with a period had two
 // stored.
 if (note.endsWith('.')) note = note.slice(0, -1).trim();

 return note === '' ? null : note;
}
