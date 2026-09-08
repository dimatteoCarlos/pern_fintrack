// frontend/src/fintrack/types/overviewTypes.ts
// The shapes GET /api/fintrack/overview answers with.
//
// Typed against PLAN_OVERVIEW_CONTRACT.md, which is frozen, and not against
// what the current components happen to read. Where the contract says a figure
// is never null that is written here as `number`, because a nullable type would
// make every consumer branch on a case the server does not produce.
//
// PARTIAL ON PURPOSE. The payload also carries the all card, the financial
// goals, the recent-activity teaser and the charts. Each arrives here with the
// component that renders it, so the type never claims a field nobody reads yet.
// Adding one is additive: no existing consumer changes.

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

// The period ONE CARD was measured over, and deliberately not ServedWindow. A
// card carries these two dates and nothing else: which month is on screen and
// which month is the ceiling are facts about the page, published once at the
// top of the payload, and repeating them per card would be six places for the
// same answer to drift.
export type OverviewCardWindow = {
 // 'YYYY-MM-01'.
 periodStart: string;
 // 'YYYY-MM-DD' — the month's last day, or today for the month in course.
 periodEnd: string;
};

// The shape FIVE of the six cards share. Investment is not one of them: its
// figures are not a total, a count and a delta, so it has a type of its own
// below rather than this one with fields that would never be filled.
export type OverviewDomainCardBase = {
 domain: OverviewDomain;
 // Never null: 0 is real activity at zero, and a null would say the figure did
 // not arrive. Contract, §"Las cinco comparten la misma forma".
 totalAmount: number;
 transactionCount: number;
 // null when the prior month cannot be compared against — an owner whose oldest
 // account is newer than that month has no baseline, not a delta of zero. An
 // AMOUNT and not a rate: the prior month's own figure is not published, so a
 // percentage cannot be derived by any consumer without inventing it.
 delta: number | null;
 currency: string;
 window: OverviewCardWindow;
 meta: OverviewMeta;
};

export type OverviewIncomeCard = OverviewDomainCardBase & { domain: 'income' };

export type OverviewExpenseCard = OverviewDomainCardBase & {
 domain: 'expense';
 // null when no budget is in force for the month, or when the category accounts
 // span currencies — two situations the card's notices tell apart.
 budgetAmount: number | null;
 // Reported whether or not a budget exists: spending and the decision to budget
 // it are different questions, and blanking one with the other would hide real
 // spending.
 categorizedExpense: number;
 budgetVariance: number | null;
 // A flag and never a monetary figure. The amount is totalAmount minus
 // categorizedExpense, a subtraction over two fields already published.
 hasUncategorizedExpense: boolean;
};

export type OverviewPnlCard = OverviewDomainCardBase & {
 domain: 'pnl';
 // The share of the month's realised result that fell on investment accounts.
 // A subordinate line under the total, never a figure of the same weight.
 realizedFromInvestment: number;
};

export type OverviewDebtCard = OverviewDomainCardBase & {
 domain: 'debt';
 // Both legs as POSITIVE MAGNITUDES: the direction is carried by the field
 // name, so a negative payable would be a double negative. totalAmount is the
 // net, and receivable - payable reproduces it as an auditable check.
 payable: number;
 receivable: number;
 // How many counterparties each leg is made of, on the same sign boundary the
 // two sums use. A card that says "You owe $27.96" cannot tell one lender from
 // nine without them, and the amount alone reads as a single obligation.
 //
 // The vocabulary is the debts module's, not the sign's: a balance BELOW zero
 // is money the user owes, so its counterparty is a LENDER and it is counted in
 // payableCount. A balance above zero is a DEBTOR. ListOfDebtors.tsx:216 makes
 // the same call from the same sign.
 //
 // An account sitting at exactly zero is in neither count, which is the same
 // rule that keeps it out of both legs.
 payableCount: number;
 receivableCount: number;
 // Debtors who reached zero at the month's close, counting only those with a
 // movement of their own. The row that OPENS the account does not count.
 //
 // Published and no longer drawn on the level-1 card: "0 debts settled at
 // close" is a sentence a reader cannot decode without the activity clause
 // beside it, and the two counterparty counts above answer the question that
 // reader was actually asking.
 settledCount: number;
};

export type OverviewPocketCard = OverviewDomainCardBase & {
 domain: 'pocket';
 // What is COMMITTED, not a balance the pocket holds: under the plan model no
 // allocation moves money, so the hero neither adds it to net worth nor takes
 // it out of cash.
 target: number;
 remaining: number;
 // A rate OVER 100 and not a ratio in 0-1. Multiplying it as if it were one
 // prints a hundred times the figure.
 progress: number;
 fundedCount: number;
 overdueCount: number;
 uncoveredCount: number;
};

// Investment shares none of the base. §6 of the contract gives it five figures
// that are not a flow, so there is no totalAmount, no delta and no window: what
// it reports is a position, and a position is not cut to a month.
export type OverviewInvestmentCard = {
 domain: 'investment';
 accountCount: number;
 transactionCount: number;
 capitalContributed: number;
 ledgerBalance: number;
 realizedPnl: number;
 closureAdjustment: number;
 // The largest account's share of the whole, as a ratio in 0-1 — the opposite
 // scale to pocket's progress, which is why neither is named 'percentage'.
 concentration: number;
 // null when no contribution was ever recorded, which is not a gap of zero days.
 daysSinceLastContribution: number | null;
 currency: string;
 meta: OverviewMeta;
};

// The six, each under its own key. NOT a Record over OverviewDomain: five of
// them share a shape and investment does not, and a Record would have to widen
// to the one type that fits all six, which is the base with every specific
// field lost.
export type OverviewDomainCards = {
 income: OverviewIncomeCard;
 expense: OverviewExpenseCard;
 investment: OverviewInvestmentCard;
 debt: OverviewDebtCard;
 pocket: OverviewPocketCard;
 pnl: OverviewPnlCard;
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

// The three domains the monthly widget is defined for, and not every
// OverviewDomain: debt, investment and pnl have no snapshot at all. A Record
// over the six would claim they do and force a consumer to branch on three
// entries the server never sends.
export type MonthlySnapshotDomain = 'income' | 'expense' | 'pocket';

// One movement measured against its own history. Contract, §8.
export type MonthlySnapshot = {
 domain: MonthlySnapshotDomain;
 // The reference month's own figure, the same statement over the same accounts
 // that produced the domain card, so the two cannot disagree.
 domainMonthlyActual: number;
 // The mean of the months that had activity in each window, excluding the
 // reference month. null and not 0 when no month in the window had any: a 0
 // would state the owner typically moves nothing.
 activeMonthAverage3m: number | null;
 activeMonthAverage12m: number | null;
 // How many months each mean was divided by. Never null, because zero active
 // months is the answer and not a withheld figure. An average over three active
 // months and one over three months of which one was active are the same number
 // carrying different weight, and the card has to be able to say which.
 activeMonths3m: number;
 activeMonths12m: number;
 // domainMonthlyActual minus activeMonthAverage12m, against the twelve and not
 // the three: a month measured against a mean that already moves fast cannot
 // say whether the month is unusual. null when that mean is null.
 varianceVsAverage: number | null;
 // The reference month's calendar year, every month of it counted whether it
 // had activity or not. Opposite rule to the two averages on purpose: a total
 // has no denominator to protect and an empty month contributes 0 honestly.
 // Never null, since the reference month is always inside its own year.
 yearToDate: number;
 currency: string;
 meta: OverviewMeta;
};

// The three figures of block 05, and there is no fourth. No percentage is
// published: a rate would have to be divided in the browser, which means the
// browser deciding what a target of null or zero means, and the server already
// answers that by withholding the target.
export type OverviewFinancialGoals = {
 // Always a number. It counts EVERY pocket, including the ones with no target:
 // money set aside is set aside whether or not it was promised to a goal.
 goalsTotalBalance: number;
 // null and never 0 when no pocket carries a target. An absent target is not a
 // target of zero, which would state that a goal was set and reached.
 goalsTotalTarget: number | null;
 // The plain subtraction, NOT floored: an owner who saved past the goal reads a
 // negative remainder, and clamping it would report the goal as exactly met.
 // null whenever the target is.
 goalsTotalRemaining: number | null;
 currency: string;
 meta: OverviewMeta;
};

// One month of a series. Month-precision, unlike a card's window, because a
// trend point is a month and not a period with two ends.
export type OverviewTrendPoint = {
 // 'YYYY-MM'.
 month: string;
 value: number;
};

// The six-month series, and ONLY for the three domains §12 gives one to. Each
// key is optional and its ABSENCE is the statement: the domain has no series.
// An empty array would say it has one and the months came back blank, which is
// a different answer and one the server never gives.
export type OverviewTrend = {
 income?: OverviewTrendPoint[];
 expense?: OverviewTrendPoint[];
 pocket?: OverviewTrendPoint[];
};

// One category's share of the month's spending, ranked. cumulative* are the
// running totals the Pareto reading needs, computed by the server so the chart
// and any figure beside it cannot disagree.
export type OverviewExpenseCategory = {
 categoryName: string;
 currency: string;
 accountCount: number;
 budgetAmount: number;
 actualSpent: number;
 remainingBudget: number;
 // A rate OVER 100, the same scale as pocket's progress and the opposite of
 // investment's concentration.
 executionPercentage: number;
 isOverBudget: boolean;
 // 1-based, assigned by the server. The order is the server's ranking, never
 // recomputed here.
 rank: number;
 cumulativeActual: number;
 cumulativePercentage: number;
};

export type OverviewCharts = {
 trend: OverviewTrend;
 expenseCategories: OverviewExpenseCategory[];
};

// The slice of the payload the frontend reads today.
export type GetOverviewData = {
 window: ServedWindow;
 hero: OverviewHero;
 domainCards: OverviewDomainCards;
 financialGoals: OverviewFinancialGoals;
 charts: OverviewCharts;
 // An array and not a map, which is how the server sends it. Three entries, in
 // the order income, expense, pocket.
 monthlySnapshot: MonthlySnapshot[];
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
