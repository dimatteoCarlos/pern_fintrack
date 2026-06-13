//frontend\src\fintrack\general_components\tooltip\Tooltip.tsx

import React, { useState } from 'react';
import './styles/tooltip.css';
type TooltipPropType = {
  tipText: string;
  children: React.ReactNode;
  isActive: boolean;
  tooltipClassName?:string;
};

const Tooltip = ({ tipText, children, isActive, tooltipClassName }: TooltipPropType) => {
  //state
  const [isVisible, setIsVisible] = useState<boolean>(!isActive);
  
  const handleMouseEnter = () => {
    setIsVisible(true); //console.log('mouseEnter', {isActive}, {isVisible})
  };
  const handleMouseLeave = () => {
    setIsVisible(false); //console.log('mouseLeave')
  };

  return (
    <div
      className='tooltip__wrapper'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!isActive && isVisible && (
        <div className={`tooltip__wrapper--text ${tooltipClassName || ''}`}>{tipText}
        </div>
      )}

      {children}
    </div>
  );
};

export default Tooltip;
