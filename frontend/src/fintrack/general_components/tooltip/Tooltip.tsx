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
};

const Tooltip = ({
  tipText,
  children,
  isActive,
  tooltipClassName,
  focusable = false,
}: TooltipPropType) => {
  //state
  const [isVisible, setIsVisible] = useState<boolean>(!isActive);
  // Escape closes the tip without moving the pointer or the focus, which is
  // what WCAG 2.1's "dismissible" asks for. Reset the moment the pointer or
  // the focus leaves, so the next hover shows it again.
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const tipId = useId();

  const handleMouseEnter = () => {
    setIsVisible(true); //console.log('mouseEnter', {isActive}, {isVisible})
  };
  const handleMouseLeave = () => {
    setIsVisible(false); //console.log('mouseLeave')
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
      onKeyDown={focusable ? handleKeyDown : undefined}
      onBlur={focusable ? () => setIsDismissed(false) : undefined}
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
