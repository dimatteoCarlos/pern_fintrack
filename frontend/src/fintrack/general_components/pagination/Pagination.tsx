// frontend/src/fintrack/general_components/pagination/Pagination.tsx
//
// One page of a server-paged list, and the two things a reader does to it: move
// between pages, and change how many rows a page holds.
//
// It lives in general_components/ because six lists are going to want it - the
// activity list of level 1 and the five per-domain lists of level 2 - and all
// six are paged by the same server contract: a page number, a page size, and a
// count of the whole set. Nothing here knows what a row is.
//
// It computes ONE thing, the page count, and it is arithmetic over two numbers
// the server sent rather than a reading of anything. Everything else arrives as
// a prop, so this cannot disagree with the list above it about which page is on
// screen.

import './styles/pagination-styles.css';

// The sizes offered. Five is Carlos's default and the size of the page's own
// teaser, so a reader who changes nothing sees exactly what the page shows.
//
// A short list and not a free number field: the endpoint caps the size at 100
// because it arrives from the client, and a text box would invite a reader to
// find that cap by hitting it.
// Not exported: a second export beside the component costs this file fast
// refresh, and nothing outside needs the list. A caller that has to know the
// sizes is a caller that should be given them, not one that reads them.
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

type PaginationProps = {
 page: number;
 pageSize: number;
 // The size of the whole set, not the length of the current page. It is what
 // makes "page 2 of 7" possible and what tells an empty filter from a last page.
 totalRows: number;
 onPageChange: (page: number) => void;
 onPageSizeChange: (pageSize: number) => void;
 // Names the thing being counted, in the plural, for the row count and for the
 // labels a screen reader hears. Required: "1-5 of 43" with no noun is a
 // measurement of nothing.
 itemLabel: string;
 // While a page is on the wire. The controls stay visible and go inert rather
 // than disappearing, so the block does not change height under the pointer.
 isBusy?: boolean;
};

export const Pagination = ({
 page,
 pageSize,
 totalRows,
 onPageChange,
 onPageSizeChange,
 itemLabel,
 isBusy = false,
}: PaginationProps) => {
 // At least one, so an empty set reads as "page 1 of 1" rather than "1 of 0".
 // An empty list is still a page; it is a page with nothing on it.
 const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

 const firstRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
 // Bounded by the total and not by the page size: the last page is short, and
 // "41-45 of 43" is the arithmetic showing through.
 const lastRow = Math.min(page * pageSize, totalRows);

 return (
  <div className='pagination'>
   {/* role="status" so a page change is announced. The count is the only text
       that says the list moved - the rows themselves are silent. */}
   <p className='pagination__count' role='status'>
    {totalRows === 0
     ? `No ${itemLabel}`
     : `${firstRow}-${lastRow} of ${totalRows} ${itemLabel}`}
   </p>

   <div className='pagination__controls'>
    <label className='pagination__size'>
     <span className='pagination__sizeLabel'>Rows</span>

     <select
      className='pagination__select'
      value={pageSize}
      disabled={isBusy}
      // Back to the first page, always. Keeping the number would land a reader
      // on page 7 of a list that now has 3, and the server would answer with an
      // empty page that looks like a filter with no matches.
      onChange={(event) => onPageSizeChange(Number(event.target.value))}
      aria-label={`${itemLabel} per page`}
     >
      {PAGE_SIZE_OPTIONS.map((size) => (
       <option key={size} value={size}>
        {size}
       </option>
      ))}
     </select>
    </label>

    <div className='pagination__pager'>
     <button
      type='button'
      className='pagination__step'
      onClick={() => onPageChange(page - 1)}
      disabled={isBusy || page <= 1}
      aria-label='Previous page'
     >
      ‹
     </button>

     <span className='pagination__page'>
      {page} / {pageCount}
     </span>

     <button
      type='button'
      className='pagination__step'
      onClick={() => onPageChange(page + 1)}
      disabled={isBusy || page >= pageCount}
      aria-label='Next page'
     >
      ›
     </button>
    </div>
   </div>
  </div>
 );
};
