// frontend/src/fintrack/types/overviewTypes.ts
// The shapes GET /api/fintrack/overview answers with.
//
// Typed against PLAN_OVERVIEW_CONTRACT.md, which is frozen, and not against
// what the current components happen to read. Where the contract says a figure
// is never null that is written here as `number`, because a nullable type would
// make every consumer branch on a case the server does not produce.
//
// PARTIAL ON PURPOSE. The payload also carries the all card, the monthly
// snapshot, the financial goals and the recent-activity teaser. Each arrives
// here with the component that renders it, so the type never claims a field
// nobody reads yet. Adding one is additive: no existing consumer changes.

// The period the server resolved, echoed back. Its whole reason for existing is
// that the client never computes a month from the browser clock — a clock that
// is on the wrong calendar for part of every day.
export type ServedWindow = {
 // 'YYYY-MM-01'. The month actually served, which is the requested one or the
 // current one on the owner's calendar when the request named none.
 referenceMonth: string;
 // 'YYYY-MM-01'. The latest month that may be requested. It is a field of its
 // own because isCurrentMonth cannot stand in for it: the flag says whether the
 // served month IS the ceiling and never says which month that is, so a client
 // served an earlier month would have no bound for a forward step.
 currentMonth: string;
 // 'YYYY-MM-01' — the first day of the served month.
 periodStart: string;
 // 'YYYY-MM-DD' — the month's last day, or today for the month in course. A
 // running month stops at today: publishing the month end would state that a
 // flow covers days that have not happened.
 periodEnd: string;
 isCurrentMonth: boolean;
};

// Attached to every card and to the page. notices is always an array, so a
// consumer that iterates needs no null check.
export type OverviewMeta = {
 notices: string[];
 // Reserved by the contract for the day the accounting and display currencies
 // can diverge. null until then.
 provenance: null;
};

export type OverviewDomain =
 | 'income'
 | 'expense'
 | 'investment'
 | 'debt'
 | 'pocket'
 | 'pnl';

// The five fields every domain card shares, plus its own. The per-domain extra
// fields are not typed here yet — they arrive with their card component.
export type OverviewDomainCard = {
 domain: OverviewDomain;
 // Never null: 0 is real activity at zero, and a null would say the figure did
 // not arrive. Contract, §"Las cinco comparten la misma forma".
 totalAmount: number;
 transactionCount: number;
 // null when the prior month cannot be compared against — an owner whose oldest
 // account is newer than that month has no baseline, not a delta of zero.
 delta: number | null;
 currency: string;
 window: ServedWindow;
 meta: OverviewMeta;
};

// The stocks at the top of the page. Every one of them is a position, so none is
// bounded by the month the flows are bounded by.
export type OverviewHero = {
 // Bank, investment and debt. Never null — 0 is a real net worth.
 netWorth: number;
 // The same holdings with the payable leg taken out. null only when that leg did
 // not arrive, which is why it is the one nullable stock.
 liquidNetWorth: number | null;
 // What is spendable without selling a position or collecting a debt.
 cashPosition: number;
 // How much of cashPosition nothing has been promised against. It can exceed
 // cashPosition when an account is overdrawn, which the contract states rather
 // than clamps.
 freeCash: number;
};

// The slice of the payload the frontend reads today.
export type GetOverviewData = {
 window: ServedWindow;
 hero: OverviewHero;
 domainCards: Record<OverviewDomain, OverviewDomainCard>;
};

// The envelope, and it is NOT the shape /budget answers with: the budget
// controllers serialise their result flat, while every overview handler wraps it
// as { status, message, data }. The api module unwraps it so no store repeats
// that knowledge.
export type GetOverviewResponse = {
 status: number;
 message: string;
 data: GetOverviewData;
};
