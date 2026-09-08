// frontend/src/fintrack/general_components/scrollJump/ScrollJump.tsx
// One control, two destinations, on any page long enough to need it.
//
// Extracted from AccountingDashboard, which owned the only copy. Overview is
// the second screen that runs past a viewport - six domain cards, three
// snapshots, the goals, the charts and five movement lists - and copying forty
// lines of listeners into it would have given the app two controls that answer
// the same question and drift the first time one is corrected.
//
// Which destination it offers is decided by where the reader already is: past
// half of what can be scrolled, the way back is up; before it, the far end is
// what a long page makes expensive to reach.

import { useCallback, useEffect, useState } from 'react';
import ArrowDownLightSvg from '../../../assets/ArrowDownLightSvg.svg?react';
import './styles/scrollJump-styles.css';

// A document that does not scroll can still report a fraction of a pixel of
// distance, because innerHeight is fractional on a zoomed viewport. Below this
// there is nothing to jump to.
const MIN_SCROLLABLE_PX = 1;

type ScrollJumpProps = {
 // What the button says it will reach, in the reader's words rather than the
 // page's: "list" on an inventory, "page" on a board of cards. It is the noun
 // both labels are built around.
 subject?: string;
};

function ScrollJump({ subject = 'page' }: ScrollJumpProps) {
 // Half of what can actually be SCROLLED, not half a viewport. On a page barely
 // taller than the window the bottom is reached before a viewport is travelled,
 // so a viewport-relative threshold leaves the arrow pointing down at the end
 // and the click does nothing.
 const [jumpsToTop, setJumpsToTop] = useState(false);

 // Nothing to scroll is also nothing to jump to, and the control takes itself
 // off screen rather than offering a trip of zero pixels.
 const [canJump, setCanJump] = useState(false);

 useEffect(() => {
  const decideDirection = () => {
   const scrollableDistance =
    document.documentElement.scrollHeight - window.innerHeight;

   setCanJump(scrollableDistance >= MIN_SCROLLABLE_PX);
   setJumpsToTop(window.scrollY > scrollableDistance / 2);
  };

  decideDirection();
  window.addEventListener('scroll', decideDirection, { passive: true });

  // Rotating the device changes innerHeight and a panel arriving changes
  // scrollHeight. Neither fires a scroll event, and both move the threshold.
  window.addEventListener('resize', decideDirection);

  const watchDocumentHeight = new ResizeObserver(decideDirection);
  watchDocumentHeight.observe(document.documentElement);

  return () => {
   window.removeEventListener('scroll', decideDirection);
   window.removeEventListener('resize', decideDirection);
   watchDocumentHeight.disconnect();
  };
 }, []);

 const jumpToEdge = useCallback(() => {
  // Honoured here and not only in CSS: scroll-behavior does not govern a
  // programmatic scroll that names its own behavior.
  const prefersReducedMotion = window.matchMedia(
   '(prefers-reduced-motion: reduce)',
  ).matches;

  window.scrollTo({
   top: jumpsToTop ? 0 : document.documentElement.scrollHeight,
   behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
 }, [jumpsToTop]);

 // Unmounted rather than hidden: a control that cannot act should not hold a
 // tab stop either.
 if (!canJump) return null;

 return (
  <button
   type='button'
   className='scrollJump'
   onClick={jumpToEdge}
   aria-label={
    jumpsToTop ? `Scroll to top of ${subject}` : `Scroll to bottom of ${subject}`
   }
   title={jumpsToTop ? 'Back to top' : 'Go to the end'}
  >
   {/* One drawing for both directions, rotated. A second file would be the
       same arrow upside down. */}
   <ArrowDownLightSvg
    className={`scrollJump__glyph${jumpsToTop ? ' scrollJump__glyph--up' : ''}`}
    aria-hidden='true'
    focusable='false'
   />
  </button>
 );
}

export default ScrollJump;
