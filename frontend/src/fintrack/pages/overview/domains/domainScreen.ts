// frontend/src/fintrack/pages/overview/domains/domainScreen.ts
//
// The contract between the level-2 shell and one domain's composition. The
// shell owns the heading, the fetch states and the movement list; a domain owns
// only what sits between the heading and the list (OVERVIEW_DECISIONS.md, P5-1).

import { ComponentType } from 'react';

import {
 GetOverviewDomainData,
 OverviewAnalysis,
 OverviewDomain,
 OverviewDomainCard,
} from '../../../types/overviewTypes';

export type CardOf<D extends OverviewDomain> = Extract<
 OverviewDomainCard,
 { domain: D }
>;

export type AnalysisOf<D extends OverviewDomain> = Extract<
 OverviewAnalysis,
 { domain: D }
>;

// A flow is summed over the month; a position is read at the month's close.
export type HeadlineNature = 'this month' | 'at month end';

export type DomainCompositionProps<D extends OverviewDomain> = {
 card: CardOf<D>;
 // Null until an answer for this domain and month carries one.
 analysis: AnalysisOf<D> | null;
 answer: GetOverviewDomainData;
 // True while any request of the screen is on the wire, the first one included.
 isLoading: boolean;
 onRetry: () => void;
 selectedCategory: string | null;
 onSelectCategory: (next: string | null) => void;
};

export type DomainScreen<D extends OverviewDomain> = {
 label: string;
 headline: {
  nature: HeadlineNature;
  amountOf: (card: CardOf<D>) => number;
 };
 Composition: ComponentType<DomainCompositionProps<D>>;
};

// Keyed by domain so the registry cannot hand one domain another's card type.
export type DomainScreens = { [D in OverviewDomain]: DomainScreen<D> };

export const isCardOf = <D extends OverviewDomain>(
 card: OverviewDomainCard,
 domain: D,
): card is CardOf<D> => card.domain === domain;

export const isAnalysisOf = <D extends OverviewDomain>(
 analysis: OverviewAnalysis | null,
 domain: D,
): analysis is AnalysisOf<D> => analysis?.domain === domain;
