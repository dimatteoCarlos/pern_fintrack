// frontend/src/fintrack/pages/overview/components/PeriodStatementButton.tsx
//
// The Overview header's download control: one month, as an Excel workbook or
// a PDF summary. Built to the approved mockup, plan-docs/design-refs/
// period-statement-mockup.html (PLAN_EXPORT.md §11).
//
// Same interaction shape as RecentActivity's export trigger — click-outside
// and Escape close the menu — but with a fuller state set the mockup asked
// for and that simpler control does not need: a 'preparing' state distinct
// from 'disabled', and an error-with-retry notice rather than a toast, because
// a failed download of the reference month is worth more than two seconds on
// screen.

import { useEffect, useRef, useState } from 'react';

import { downloadStatementExport, statementFileName, StatementFormat } from '../../../api/exportApi';
import { useClickOutside } from '../../../editionAndDeletion/hooks/useClickOutside';

import '../styles/periodStatementButton-styles.css';

type PeriodStatementButtonProps = {
 // 'YYYY-MM-01', the page's referenceMonth. Sent to the backend as-is; its
 // monthBound validator accepts both 'YYYY-MM' and 'YYYY-MM-DD'.
 month: string | null;
 // True while the month is not on screen yet — mirrors the isLoading prop
 // MonthPicker already takes on the same header row.
 disabled: boolean;
};

// Decorative: the label states the action, and the trigger's own ink paints
// it through currentColor on hover, press and the two surfaces it can sit on.
const DownloadIcon = () => (
 <svg
  className='statementTrigger__icon'
  viewBox='0 0 24 24'
  fill='none'
  stroke='currentColor'
  strokeWidth='2'
  strokeLinecap='round'
  strokeLinejoin='round'
  aria-hidden='true'
  focusable='false'
 >
  <path d='M12 4v11' />
  <polyline points='7 10 12 15 17 10' />
  <path d='M5 19h14' />
 </svg>
);

const NoticeIcon = () => (
 <svg
  className='statementNotice__icon'
  viewBox='0 0 24 24'
  fill='none'
  stroke='currentColor'
  strokeWidth='2'
  strokeLinecap='round'
  strokeLinejoin='round'
  aria-hidden='true'
  focusable='false'
 >
  <circle cx='12' cy='12' r='9' />
  <path d='M12 7.5v5' />
  <path d='M12 16.5v.01' />
 </svg>
);

function PeriodStatementButton({ month, disabled }: PeriodStatementButtonProps) {
 const [isMenuOpen, setIsMenuOpen] = useState(false);
 const [isPreparing, setIsPreparing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 // The format that failed, kept only so "Try again" can repeat the same
 // request rather than asking the reader to reopen the menu and choose again.
 const [pendingFormat, setPendingFormat] = useState<StatementFormat | null>(null);
 const anchorRef = useRef<HTMLDivElement>(null);

 useClickOutside(anchorRef, () => setIsMenuOpen(false), isMenuOpen);

 // On the document and not the menu, same reason as RecentActivity's export
 // menu: the key has to work from the moment the menu paints.
 useEffect(() => {
  if (!isMenuOpen) return;

  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') setIsMenuOpen(false);
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => document.removeEventListener('keydown', handleKeyDown);
 }, [isMenuOpen]);

 async function requestDownload(format: StatementFormat) {
  if (!month) return;

  setIsMenuOpen(false);
  setIsPreparing(true);
  setError(null);

  try {
   await downloadStatementExport({ month, format });
   setPendingFormat(null);
  } catch (cause) {
   setPendingFormat(format);
   setError(cause instanceof Error ? cause.message : 'The statement could not be generated.');
  } finally {
   setIsPreparing(false);
  }
 }

 const isDisabled = disabled || isPreparing;

 return (
  <div className='statementTrigger__anchor' ref={anchorRef}>
   <button
    type='button'
    className={`statementTrigger${isMenuOpen ? ' is-active' : ''}`}
    aria-label={isPreparing ? 'Preparing period statement' : 'Period statement'}
    aria-haspopup='menu'
    aria-expanded={isMenuOpen}
    aria-busy={isPreparing}
    disabled={isDisabled}
    onClick={() => setIsMenuOpen((open) => !open)}
   >
    <DownloadIcon />
    {/* Two labels, one CSS breakpoint switch: below 480px the pill next to
        the month badge has no room for "Period statement" beside the icon,
        so a short word takes over rather than the icon standing alone. */}
    <span className='statementTrigger__label statementTrigger__label--short'>
     {isPreparing ? 'Preparing…' : 'Statement'}
    </span>
    <span className='statementTrigger__label statementTrigger__label--full'>
     {isPreparing ? 'Preparing…' : 'Period statement'}
    </span>
    <span className='statementTrigger__chevron' aria-hidden='true'>
     ▾
    </span>
   </button>

   {isMenuOpen && month && (
    <ul className='statementMenu' role='menu' aria-label='Download format'>
     <li role='none'>
      <button
       type='button'
       className='statementMenu__item'
       role='menuitem'
       onClick={() => requestDownload('xlsx')}
      >
       <span className='statementMenu__format'>Excel workbook (.xlsx)</span>
       <span className='statementMenu__file'>{statementFileName(month, 'xlsx')}</span>
      </button>
     </li>
     <li role='none'>
      <button
       type='button'
       className='statementMenu__item'
       role='menuitem'
       onClick={() => requestDownload('pdf')}
      >
       <span className='statementMenu__format'>PDF summary (.pdf)</span>
       <span className='statementMenu__file'>{statementFileName(month, 'pdf')}</span>
      </button>
     </li>
    </ul>
   )}

   {error && (
    <div className='statementNotice' role='alert'>
     <NoticeIcon />
     <div className='statementNotice__body'>
      <p className='statementNotice__text'>The statement could not be generated.</p>
      <p className='statementNotice__reason'>{error}</p>
      <button
       type='button'
       className='statementNotice__retry'
       disabled={isPreparing}
       onClick={() => pendingFormat && requestDownload(pendingFormat)}
      >
       Try again
      </button>
     </div>
    </div>
   )}
  </div>
 );
}

export default PeriodStatementButton;
