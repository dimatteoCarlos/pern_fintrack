// frontend/src/fintrack/pages/overview/domains/AnalysisPanel.tsx
//
// One analysis section of a level-2 screen, on the cream panel (P5-6). It owns
// the three fetch states, so a domain draws only its ready content.

import { ReactNode, useId } from 'react';

import { useFullAnalysisTrigger } from '../hooks/useFullAnalysisTrigger';
import { FullAnalysisStatus } from '../hooks/useOverviewDomain';
import { OverviewAnalysis } from '../../../types/overviewTypes';

export type AnalysisSectionStatus = 'pending' | 'error' | 'ready';

// A full section is ready only once the full answer is held: a derived answer
// omits the same keys an empty month omits, so the level is what tells them apart.
export const fullSectionStatus = (
 analysis: OverviewAnalysis | null,
 fullStatus: FullAnalysisStatus,
): AnalysisSectionStatus => {
 if (analysis?.level === 'full') return 'ready';

 return fullStatus === 'error' ? 'error' : 'pending';
};

// For a list whose card publishes no count, income among them (P5-6).
export const SKELETON_ROWS_WITHOUT_COUNT = 3;

type AnalysisPanelProps = {
 title: string;
 status: AnalysisSectionStatus;
 // Named in the error sentence: a reader with several panels has to know which failed.
 subject: string;
 // A full section fires the screen's one full request on viewport entry; a
 // derived one never does. Either way this is what the retry calls.
 isFull: boolean;
 onRequest: () => void;
 // The figure under the title, replaced by a skeleton while pending.
 figure?: ReactNode;
 skeletonRows?: number;
 isEmpty: boolean;
 // Shown only when the server sent no notice explaining the empty section.
 emptyText: string;
 notices: string[];
 children: ReactNode;
};

function AnalysisPanel({
 title,
 status,
 subject,
 isFull,
 onRequest,
 figure,
 skeletonRows = SKELETON_ROWS_WITHOUT_COUNT,
 isEmpty,
 emptyText,
 notices,
 children,
}: AnalysisPanelProps) {
 const titleId = useId();
 const setTarget = useFullAnalysisTrigger(isFull && status === 'pending', onRequest);

 return (
  <section
   ref={setTarget}
   className='domainAnalysis'
   aria-labelledby={titleId}
   aria-busy={status === 'pending'}
  >
   {/* The title is drawn in all three states, so the section never vanishes
       and comes back. */}
   <div className='domainAnalysis__head'>
    <h3 className='domainAnalysis__title' id={titleId}>
     {title}
    </h3>

    {figure !== undefined && status === 'pending' && (
     <span
      className='domainAnalysis__skeleton domainAnalysis__skeleton--figure'
      aria-hidden='true'
     />
    )}
    {figure !== undefined && status === 'ready' && figure}
   </div>

   {status === 'pending' && (
    <div aria-hidden='true'>
     {[...Array(skeletonRows).keys()].map((index) => (
      <span
       className='domainAnalysis__skeleton domainAnalysis__skeleton--row'
       key={`skeleton-${index}`}
      />
     ))}
    </div>
   )}

   {status === 'error' && (
    <div className='domainAnalysis__state' role='alert'>
     <p className='domainAnalysis__stateText'>{subject} could not be loaded.</p>

     <button type='button' className='domainAnalysis__retry' onClick={onRequest}>
      Try again
     </button>
    </div>
   )}

   {/* Empty: the server's notice is the explanation, so it takes the body
       rather than repeating at the foot under a second sentence. */}
   {status === 'ready' && isEmpty && (
    <p className='domainAnalysis__empty'>
     {notices.length > 0 ? notices.join(' ') : emptyText}
    </p>
   )}

   {status === 'ready' && !isEmpty && (
    <>
     {children}
     {notices.map((notice) => (
      <p className='domainAnalysis__foot' key={notice}>
       {notice}
      </p>
     ))}
    </>
   )}
  </section>
 );
}

export default AnalysisPanel;
