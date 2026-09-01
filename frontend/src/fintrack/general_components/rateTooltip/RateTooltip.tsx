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
 // Above the trigger by default. 'anchor-left' is for a trigger that sits at
 // the right edge of a wide row, where a centred chip would overflow it.
 // 'row-centred' anchors to the trigger's ROW rather than to the trigger, and
 // sits in the blank space the row's own space-between leaves in the middle:
 // for a row so close to the top of its card that a chip placed above the
 // trigger has nowhere to go but over whatever sits above the card.
 placement?: 'above' | 'anchor-left' | 'row-centred';
 children: React.ReactNode;
};

//-----RateTooltip---------------C
const RateTooltip = ({
 tipText,
 surface,
 placement = 'above',
 children,
}: RateTooltipPropType) => {
 // Compound selector so the chip beats the base tooltip rules from another file.
 const chipClassName = [
  'rateTooltip__chip',
  `rateTooltip__chip--${surface}`,
  placement !== 'above' ? `rateTooltip__chip--${placement}` : '',
 ]
  .filter(Boolean)
  .join(' ');

 return (
  <Tooltip tipText={tipText} isActive={false} tooltipClassName={chipClassName}>
   {children}
  </Tooltip>
 );
};

export default RateTooltip;
