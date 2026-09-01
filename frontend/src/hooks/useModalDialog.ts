// frontend/src/hooks/useModalDialog.ts

// The behaviour a modal owes its reader, in one place.
//
// Four modals already carry this effect byte for byte. It lives here rather
// than under fintrack/ or auth/ because it knows nothing about either: no
// store, no type, no constant — only React and the DOM. Both modules import it
// and neither imports the other (REMARKS R261).
//
// It declares the dialog to assistive technology, closes on Escape, and hands
// the caret in and back out again. Modality is the browser's job: `inert` on
// #root makes everything behind unreachable to pointer, caret and screen
// reader at once, so no hand-rolled Tab cycle is needed and none should be
// written.
//
// The consumer MUST render through createPortal into document.body. A dialog
// left inside #root becomes inert along with the page it is covering.

import { useEffect, useId, useRef } from 'react';

type ModalDialogOptions = {
 onClose: () => void;
 // Read on every render: a modal that must not be abandoned mid-submit lowers
 // this while the request is in flight.
 canClose?: boolean;
 // Run once, on mount. A callback and not a ref because a ref only names the
 // node and leaves the operation to this hook, and a form that prefills a
 // figure wants select() rather than focus() on the very same input.
 onInitialFocus?: () => void;
};

export function useModalDialog({
 onClose,
 canClose = true,
 onInitialFocus,
}: ModalDialogOptions) {
 const panelRef = useRef<HTMLDivElement>(null);
 const titleId = useId();

 // Held in a ref instead of a dependency: an inline arrow is a new function on
 // every render, and depending on it would re-run the mount effect and move
 // the caret while the reader is typing.
 const initialFocusRef = useRef(onInitialFocus);
 initialFocusRef.current = onInitialFocus;

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape' && canClose) onClose();
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose, canClose]);

 // The overflow is captured and restored rather than cleared: another overlay
 // may already hold the lock, and writing an empty string would hand the
 // scroll back while that one is still open.
 useEffect(() => {
  const root = document.getElementById('root');
  const previousOverflow = document.body.style.overflow;
  const previouslyFocused = document.activeElement;

  root?.setAttribute('inert', '');
  document.body.style.overflow = 'hidden';

  // The caller decides what takes the caret; the panel is the fallback for a
  // dialog with nothing better to offer, and for one whose dangerous answer
  // must not be focused already.
  if (initialFocusRef.current) initialFocusRef.current();
  else panelRef.current?.focus();

  return () => {
   root?.removeAttribute('inert');
   document.body.style.overflow = previousOverflow;
   // After the attribute is removed and never before: focusing a node still
   // inside inert content is a no-op.
   if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  };
 }, []);

 return {
  // Spread onto the panel. The id is generated rather than written down: two
  // dialogs mounted at once would otherwise share it and both point at the
  // first heading.
  titleId,
  panelRef,
  dialogProps: {
   ref: panelRef,
   role: 'dialog' as const,
   'aria-modal': true,
   'aria-labelledby': titleId,
   tabIndex: -1,
  },
 };
}
