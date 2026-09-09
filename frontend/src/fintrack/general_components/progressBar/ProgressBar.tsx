// frontend/src/fintrack/general_components/progressBar/ProgressBar.tsx
//
// A part-of-whole reading, drawn. Nothing here decides anything: the caller has
// already taken the reading and passes the share and the tone it resolved to,
// so the bar, the square and the percentage on one row cannot light from three
// separate decisions.
//
// It lives in general_components/ because three modules want the same object -
// a pocket against its target, a category against its budget, a month's spend
// against the month's ceiling - and PocketCard.tsx already carries a private
// copy of it. That copy is not touched here: this is the shared one, and the
// pocket module's owner decides when to adopt it.

import './styles/progressBar-styles.css';

// The status vocabulary the app already speaks (helpers/budgetStatus.ts and
// helpers/pocketStatus.ts both emit it). Named as tones rather than invented,
// so a sixth name cannot appear on a bar that a square beside it does not have.
export type ProgressTone = 'neutral' | 'ok' | 'warning' | 'alert' | 'info';

type ProgressBarProps = {
 // 0-100, and values above 100 are expected: a month can spend 142% of its
 // budget. The FILL is clamped because a bar cannot draw past its own track;
 // the figure announced is not, which is what aria-valuetext is for.
 value: number;
 // What the bar is a share OF, in words. Required and not optional: a bar with
 // no label announces a bare percentage, which is a number without a subject.
 label: string;
 tone?: ProgressTone;
};

export const ProgressBar = ({ value, label, tone = 'neutral' }: ProgressBarProps) => {
 const fill = Math.min(Math.max(value, 0), 100);

 return (
  <div
   className='progressBar'
   role='progressbar'
   aria-label={label}
   aria-valuemin={0}
   aria-valuemax={100}
   // Clamped, because a value outside the declared range is invalid ARIA and
   // assistive technology is free to ignore the whole element for it. The real
   // figure travels in valuetext, which is what a reader is given instead.
   aria-valuenow={Math.min(Math.round(value), 100)}
   aria-valuetext={`${Math.round(value)}%`}
  >
   <div
    className={`progressBar__fill progressBar__fill--${tone}`}
    style={{ width: `${fill}%` }}
   />
  </div>
 );
};
