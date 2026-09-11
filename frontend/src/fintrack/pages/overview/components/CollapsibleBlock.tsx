// frontend/src/fintrack/pages/overview/components/CollapsibleBlock.tsx
// One block the reader can fold away, and the only one on the overview page.
// Carlos, 2026-09-10: the domain cards fold one by one, the monthly snapshot
// folds whole, the trend folds whole, and the expense ranking and the donut
// beside it fold each on its own.
//
// BUILT ON details AND summary, not on a div with a click handler. The element
// already carries the open state, the keyboard (Enter and Space), the role, the
// expanded state a screen reader announces, and find-in-page opening a closed
// section on its own. A hand-built version reimplements four of those and
// usually forgets the fourth. The pocket module reached the same conclusion:
// PocketBigBoxResult.tsx and PocketFundingAccounts.tsx both fold with details.
//
// THE HEAD IS A PROP AND NOT A TITLE STRING, because the two callers do not
// share a head. A page block opens with CardTitle and its subtitle; a domain
// card opens with its own name-and-nature row. Taking a string here would have
// forced one of the two to render its head twice.

import { ReactNode, useState } from 'react';

type CollapsibleBlockProps = {
 head: ReactNode;
 children: ReactNode;
 // Open on arrival, so a reader who never touches a control sees exactly the
 // page they saw before this component existed. Folding is something the reader
 // chooses, never a state the page starts in.
 defaultOpen?: boolean;
 // 'block' is a page section under its own title; 'card' is one domain card
 // inside the grid. They differ in the head's padding and in nothing else, so
 // it is a modifier rather than a second component.
 variant?: 'block' | 'card';
 // The caller's own block class, carried onto the same element. A domain card
 // passes 'domainCard' so its box - the border, the radius, the padding - keeps
 // being declared once, where it already was. Without this the fold would have
 // to restate the box, and two rules that must agree about a border are a
 // defect waiting for one of them to be edited.
 className?: string;
};

function CollapsibleBlock({
 head,
 children,
 defaultOpen = true,
 variant = 'block',
 className,
}: CollapsibleBlockProps) {
 // CONTROLLED, and it has to be. React re-applies the open attribute on every
 // render, so passing defaultOpen straight to details would snap a section the
 // reader had just closed back open the moment anything above it re-rendered -
 // and on this page the month picker re-renders everything.
 const [isOpen, setIsOpen] = useState(defaultOpen);

 return (
  <details
   className={`collapsible collapsible--${variant}${
    className ? ` ${className}` : ''
   }`}
   open={isOpen}
   onToggle={(event) => setIsOpen(event.currentTarget.open)}
  >
   <summary className='collapsible__head'>
    <div className='collapsible__headContent'>{head}</div>

    {/* aria-hidden because summary already announces the expanded state. A
        chevron that also named it would be read twice. */}
    <span className='collapsible__chevron' aria-hidden='true' />
   </summary>

   <div className='collapsible__body'>{children}</div>
  </details>
 );
}

export default CollapsibleBlock;
