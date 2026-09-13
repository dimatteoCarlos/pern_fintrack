// frontend/src/fintrack/pages/overview/hooks/useFullAnalysisTrigger.ts
//
// Arms one full section of a level-2 screen: when its box reaches the viewport,
// the screen's single full request goes out (OVERVIEW_DECISIONS.md, P5-3, P5-6).
// Every full section of the five domain screens calls it; useOverviewDomain
// dedupes, so the first section to arrive fires and the others do nothing.

import { useEffect, useState } from 'react';

export const useFullAnalysisTrigger = (
 isArmed: boolean,
 requestFullAnalysis: () => void,
) => {
 // State and not a ref, so the observer is rebuilt when the box mounts again.
 const [target, setTarget] = useState<HTMLElement | null>(null);

 useEffect(() => {
  if (!isArmed || target === null) return undefined;

  // A browser without the observer gets the data at once rather than never.
  if (typeof IntersectionObserver === 'undefined') {
   requestFullAnalysis();
   return undefined;
  }

  const observer = new IntersectionObserver((entries) => {
   if (!entries.some((entry) => entry.isIntersecting)) return;

   observer.disconnect();
   requestFullAnalysis();
  });

  observer.observe(target);

  return () => observer.disconnect();
 }, [isArmed, target, requestFullAnalysis]);

 return setTarget;
};
