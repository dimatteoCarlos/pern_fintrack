// frontend/src/fintrack/general_components/kpiTooltip/KpiTooltip.tsx
//
// What an indicator MEANS, next to the name of the indicator.
//
// ON THE LABEL AND NOT ON THE AMOUNT, which is the decision this component
// carries rather than leaves to each caller. The tip defines the measure, and
// the measure is what the label names: hung off the figure it reads as an
// explanation of that particular number, which changes every month while the
// definition does not. The figure is also the thing the eye goes to, and making
// it a hover target puts an interaction in front of the one element on the row
// that has to stay scannable.
//
// A BUTTON AND NOT A HOVERABLE WORD. A label that reveals something on hover
// reveals it to nobody, because nothing on screen says it will: the affordance
// has to be visible. The button is also what makes the tip reachable on a phone
// - there is no hover on a touch screen, but a tap raises focus, and the shared
// tooltip shows on :focus-within.
//
// It wraps the shared Tooltip the way RateTooltip does, so the positioning and
// the Escape dismissal are held in one place and only the chip's own shape is
// decided here.

import { useId } from 'react';

import InfoSvg from '../../../assets/InfoSvg.svg?react';
import Tooltip from '../tooltip/Tooltip';

import './styles/kpiTooltip.css';

type KpiTooltipProps = {
 // The indicator's name, as it reads on screen. It is the accessible name of
 // the trigger, so a screen reader hears which of six buttons this one is
 // instead of six buttons all called "info".
 label: string;
 // One or two sentences. It is the tip's whole content and it is also what the
 // trigger points at with aria-describedby, so a reader who never hovers still
 // gets it.
 definition: string;
 // Names the surface the trigger SITS ON, never the colour it paints itself.
 // 'cream' is the data panels, 'dark' is the app ground. The chip inverts with
 // it: a cream chip on a cream card is a chip nobody can see.
 surface?: 'cream' | 'dark';
};

export const KpiTooltip = ({
 label,
 definition,
 surface = 'dark',
}: KpiTooltipProps) => {
 // Owned here and handed down, because the element that must reference it is
 // this component's own child and not the shared wrapper.
 const tipId = useId();

 return (
  <Tooltip
   tipText={definition}
   isActive={false}
   tooltipClassName={`kpiTooltip__tip kpiTooltip__tip--${surface}`}
   tipId={tipId}
  >
   <button
    type='button'
    className={`kpiTooltip__trigger kpiTooltip__trigger--${surface}`}
    aria-label={`What ${label} means`}
    aria-describedby={tipId}
   >
    <InfoSvg />
   </button>
  </Tooltip>
 );
};
