// frontend/src/fintrack/general_components/rateTooltip/RateTooltip.tsx

// 💱 RATE TOOLTIP: exchange rate chip shown next to a converted amount.
// Wraps the shared Tooltip so the rate styling never leaks into it.

import React from 'react';
import Tooltip from '../tooltip/Tooltip';
import './styles/rateTooltip.css';

type RateTooltipPropType = {
 // Direction and rate, already formatted. Rendered on two lines.
 tipText: string;
 // Names the surface the chip sits on, never the colour it paints itself.
 surface: 'light' | 'dark';
 children: React.ReactNode;
};

//-----RateTooltip---------------C
const RateTooltip = ({ tipText, surface, children }: RateTooltipPropType) => {
 // Compound selector so the chip beats the base tooltip rules from another file.
 const chipClassName = `rateTooltip__chip rateTooltip__chip--${surface}`;

 return (
  <Tooltip tipText={tipText} isActive={false} tooltipClassName={chipClassName}>
   {children}
  </Tooltip>
 );
};

export default RateTooltip;
