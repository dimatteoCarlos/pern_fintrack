// frontend/src/fintrack/general_components/exportMenu/ExportMenu.tsx
// 📥 EXPORT MENU: saving the list on screen as a file, in the format the reader
// picks.
//
// One component for budget, pocket and debts. It owns the menu and the in-flight
// flag, and it knows no endpoint: the caller hands over the request already
// built with the scope on screen, which is the only part that differs between
// the three modules. That also keeps the request out of the three list toolbars,
// each of which states in its own header that it owns no state and issues none.
//
// Same interaction as the overview's two export controls — click outside and
// Escape close the menu (RecentActivity.tsx:147-161, PeriodStatementButton.tsx:
// 77-90) — through the same hook rather than a third copy of it.

import { useEffect, useRef, useState } from 'react';

// '?react' and not the bare form: only that import carries a React type, so the
// glyph can take a className. The bare one is typed as a string.
import ChevronDownSvg from '../../../assets/exportSvg/ChevronDownSvg.svg?react';
import DownloadSvg from '../../../assets/exportSvg/DownloadSvg.svg?react';
import { ExportFormat } from '../../api/exportApi';
import { notifyError } from '../../../auth/auth_utils/notification';
import { useClickOutside } from '../../editionAndDeletion/hooks/useClickOutside';
import './styles/exportMenu-styles.css';

// The two formats every module list offers, with the words a reader uses for
// them. The extension is part of the label because what the option produces is
// a file, and its name is what the reader will look for afterwards.
const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
 { value: 'csv', label: 'Comma-separated (.csv)' },
 { value: 'xlsx', label: 'Excel workbook (.xlsx)' },
];

type ExportMenuPropType = {
 // The request, already carrying the month or the range the screen is showing,
 // so the file matches the list the reader has in front of them.
 onExport: (format: ExportFormat) => Promise<void>;
 // What the file holds, for the accessible name. A bare "Export" repeated on
 // three screens names none of the three.
 subject: string;
 // The surface the control sits on, not the colour it paints. 'seam' is the
 // line between the white header and the dark board, where the budget and
 // pocket month controls live; 'dark' is the app ground a card sits on.
 surface?: 'seam' | 'dark';
 // Held off while the scope the request needs is not on screen yet — the same
 // prop MonthPicker already takes on the header rows this joins.
 disabled?: boolean;
};

function ExportMenu({
 onExport,
 subject,
 surface = 'seam',
 disabled = false,
}: ExportMenuPropType) {
 const [isMenuOpen, setIsMenuOpen] = useState(false);
 const [isExporting, setIsExporting] = useState(false);
 const anchorRef = useRef<HTMLDivElement>(null);

 useClickOutside(anchorRef, () => setIsMenuOpen(false), isMenuOpen);

 // On the document and not the menu, same reason as the two overview controls:
 // the key has to work from the moment the menu paints.
 useEffect(() => {
  if (!isMenuOpen) return;

  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') setIsMenuOpen(false);
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => document.removeEventListener('keydown', handleKeyDown);
 }, [isMenuOpen]);

 // The failure is shown, never swallowed. downloadFile re-reads an error body
 // that arrived as a Blob, so what surfaces here is the server's own message.
 const requestDownload = async (format: ExportFormat) => {
  setIsMenuOpen(false);
  setIsExporting(true);

  try {
   await onExport(format);
  } catch (cause) {
   notifyError(
    cause instanceof Error
     ? cause.message
     : `The ${subject} file could not be downloaded.`,
   );
  } finally {
   setIsExporting(false);
  }
 };

 return (
  <div className={`exportMenu exportMenu--${surface}`} ref={anchorRef}>
   <button
    type='button'
    className={`exportMenu__trigger${isMenuOpen ? ' is-active' : ''}`}
    onClick={() => setIsMenuOpen((open) => !open)}
    // Disabled while the request is out AND worded on its face: a control that
    // only dimmed would read as broken rather than as busy.
    disabled={disabled || isExporting}
    aria-busy={isExporting}
    aria-haspopup='menu'
    aria-expanded={isMenuOpen}
    aria-label={isExporting ? `Exporting ${subject}` : `Export ${subject}`}
   >
    <DownloadSvg className='exportMenu__glyph' />

    <span className='exportMenu__label'>
     {isExporting ? 'Exporting…' : 'Export'}
    </span>

    <ChevronDownSvg className='exportMenu__chevron' />
   </button>

   {isMenuOpen && (
    <ul className='exportMenu__list' role='menu' aria-label='Download format'>
     {FORMAT_OPTIONS.map((option) => (
      <li role='none' key={option.value}>
       <button
        type='button'
        className='exportMenu__option'
        role='menuitem'
        onClick={() => {
         void requestDownload(option.value);
        }}
       >
        {option.label}
       </button>
      </li>
     ))}
    </ul>
   )}
  </div>
 );
}

export default ExportMenu;
