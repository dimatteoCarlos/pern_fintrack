// frontend/src/fintrack/pages/overview/helpers/monthLabel.ts
//
// 'YYYY-MM-01' to 'September 2026', or to 'Sep 2026'.
//
// One copy and not four. DomainCards.tsx, FinancialGoals.tsx and
// MonthlySnapshot.tsx each carried the same eight lines, and the account panels
// were about to carry a fourth: the trap below is the kind that gets fixed in
// one copy and left in the others.
//
// SPLIT AND REBUILT, never handed to the Date constructor. 'YYYY-MM-01' matches
// the date-only form of the ISO grammar, so it parses as UTC midnight - which is
// the PREVIOUS month for every reader west of Greenwich, and a page that reads
// 'August 2026' over August's own figures is the defect this avoids. The
// three-argument constructor builds a local date, where no such shift exists.

// What a month that has not arrived renders as. A dash and never a guess: the
// month is read off the served window, never computed from the browser clock.
const NO_MONTH = '—';

// 'long' is the page's default - a card title has the room for it. 'short' is
// for a figure's own line, where the month sits beside the number it belongs to.
type MonthLabelLength = 'long' | 'short';

export const monthLabel = (
 month: string | null,
 length: MonthLabelLength = 'long',
) => {
 if (!month) return NO_MONTH;

 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: length,
  year: 'numeric',
 });
};
