// frontend/src/fintrack/pages/forms/pocketDetail/sourceAccountLabel.ts
// The source account of one history entry, as the history row and its modal
// print it. A closed account keeps its name, marked, so the reader does not
// look for it among the live ones.

import { PocketAllocationEntry } from '../../../types/pocketTypes';

export const sourceAccountLabel = (
 entry: Pick<PocketAllocationEntry, 'sourceAccountName' | 'sourceAccountIsClosed'>,
 unnamed: string,
): string => {
 if (entry.sourceAccountName === null) return unnamed;

 return entry.sourceAccountIsClosed
  ? `${entry.sourceAccountName} (closed)`
  : entry.sourceAccountName;
};
