// frontend/src/fintrack/pages/overview/components/PanelState.tsx
// The loading and error states of the two account panels, which both returned
// null on error - a screen that says nothing, offers nothing, and is
// indistinguishable from an owner who holds no account of that type.
//
// EMPTY IS NOT HERE. Three states are distinct and only two of them belong to
// this component: an owner with no account of the type is a real answer and the
// panel renders nothing for it, which is the caller's decision to make because
// only the caller can tell an empty array from a null one.
//
// The retry is what separates an error from an empty list: the reader can do
// something about it. useFetch already returns refetch, which bumps an attempt
// counter its effect keys on, so the same url is asked again without becoming a
// different request.

import { CardTitle } from '../../../general_components/CardTitle';

// How many placeholder tiles the skeleton draws. Not the real count, which is
// unknown until the answer arrives - it is enough shape to hold the space the
// panel is about to take.
const SKELETON_TILES = 3;

type PanelStateProps = {
 // The panel's own heading, drawn in both states so the block does not appear
 // to vanish and return.
 title: string;
 // What could not be loaded, named in the message rather than left as "the
 // data": a reader with three panels on screen has to know which one failed.
 subject: string;
 isLoading: boolean;
 error: string | null;
 onRetry: () => void;
};

const PanelHeading = ({ title }: { title: string }) => (
 <div className='presentation__card__title__container flx-row-sb'>
  <CardTitle>{title}</CardTitle>
 </div>
);

// Returns null when there is nothing to say, so a caller can render this ahead
// of its own content and let it decide.
function PanelState({
 title,
 subject,
 isLoading,
 error,
 onRetry,
}: PanelStateProps) {
 if (isLoading) {
  return (
   <>
    <PanelHeading title={title} />

    {/* A skeleton and not the word "Loading": the panel is a row of tiles, so
        the placeholder is a row of tiles. aria-hidden because the shape says
        nothing to a reader who cannot see it; aria-busy on the region is what
        carries the state. */}
    <div className='panelState__skeleton' aria-busy='true'>
     {Array.from({ length: SKELETON_TILES }, (unused, index) => (
      <span
       className='panelState__tile'
       key={`skeleton-${index}`}
       aria-hidden='true'
      />
     ))}
    </div>
   </>
  );
 }

 if (error) {
  return (
   <>
    <PanelHeading title={title} />

    <div className='panelState' role='alert'>
     <p className='panelState__text'>{subject} could not be loaded.</p>

     <button type='button' className='panelState__retry' onClick={onRetry}>
      Try again
     </button>
    </div>
   </>
  );
 }

 return null;
}

export default PanelState;
