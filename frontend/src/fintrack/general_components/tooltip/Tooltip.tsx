//frontend\src\fintrack\general_components\tooltip\Tooltip.tsx

import React, { useId, useState } from 'react';
import './styles/tooltip.css';
type TooltipPropType = {
  tipText: string;
  children: React.ReactNode;
  isActive: boolean;
  tooltipClassName?: string;
  /** Whether the trigger takes keyboard focus and names the tip as its
   * description. Off by default: most callers repeat a label that is already
   * on screen, and making every one of them a tab stop would add stops that
   * say nothing new. On for a tip that carries information available nowhere
   * else — the exchange rate chip, whose rate and date exist only here. */
  focusable?: boolean;
  /** The id the tip element takes, for a caller whose own CHILD is the focusable
   * trigger and names the tip with aria-describedby. Without it the id is
   * internal and only the wrapper can reference it, which forces the caller to
   * choose between two tab stops - the wrapper and its button - and none.
   * Defaults to the generated one, so no existing caller changes. */
  tipId?: string;
};

const Tooltip = ({
  tipText,
  children,
  isActive,
  tooltipClassName,
  focusable = false,
  tipId: tipIdFromCaller,
}: TooltipPropType) => {
  //state
  const [isVisible, setIsVisible] = useState<boolean>(!isActive);
  // Escape closes the tip without moving the pointer or the focus, which is
  // what WCAG 2.1's "dismissible" asks for. Reset the moment the pointer or
  // the focus leaves, so the next hover shows it again.
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const generatedTipId = useId();
  const tipId = tipIdFromCaller ?? generatedTipId;

  const handleMouseEnter = () => {
    setIsVisible(true); //console.log('mouseEnter', {isActive}, {isVisible})
  };
  const handleMouseLeave = () => {
    setIsVisible(false); //console.log('mouseLeave')
    setIsDismissed(false);
  };

  // Focus mounts the tip the way hover does, and this is what makes it reachable
  // on a touch screen at all: a phone has no hover, but a tap on a focusable
  // child raises focus, and the stylesheet's :focus-within rule then shows what
  // this mounts. Without it the tip existed for a pointer and for nothing else
  // after the first mouse-out unmounted it.
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => {
    setIsVisible(false);
    setIsDismissed(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') setIsDismissed(true);
  };

  return (
    <div
      className={`tooltip__wrapper ${isDismissed ? 'is-dismissed' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      /* Unconditional now: the key event bubbles from whatever holds focus, so
         a caller whose own child is the trigger gets Escape too. With no
         focusable descendant it never fires. */
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={focusable && !isActive ? tipId : undefined}
    >
      {!isActive && isVisible && (
        <div
          id={tipId}
          className={`tooltip__wrapper--text ${tooltipClassName || ''}`}
        >
          {tipText}
        </div>
      )}

      {children}
    </div>
  );
};

export default Tooltip;
