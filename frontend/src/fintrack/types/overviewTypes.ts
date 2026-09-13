// frontend/src/fintrack/types/overviewTypes.ts
import type { PocketStatus } from './pocketTypes';

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
 // null only when there is NO prior month for this owner at all — the oldest
 // account was opened during the reference month or later, so there is no
 // baseline rather than a baseline of zero. A prior month the owner existed for
 // only part of still produces a figure; priorPeriodCoverage below is what says
 // so. An AMOUNT and not a rate: the prior month's own figure is not published,
 // so a percentage cannot be derived by any consumer without inventing it.
 // The prior month's OWN figure, and the reason it is on the wire: a change
 // stated as a percentage needs a denominator, and without this the page would
 // have to invent one. The server publishes the figure rather than the
 // percentage because what to answer when this is 0 is a presentation decision.
 // Null exactly when delta is.
 priorTotalAmount: number | null;
 delta: number | null;
 // How much of the prior month the owner held an account for, and the only way
 // to tell a full comparison from a partial one: with 'partial' the delta is a
 // number like any other. Reading meta.notices to find out instead would tie
 // this page to the wording of an English sentence the server owns.
 priorPeriodCoverage: 'complete' | 'partial' | 'none';
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
 // The share that fell on the spendable accounts. MEASURED by its own filter
 // and not totalAmount minus the line above: the card's account set is every
 // type but boundary, so that subtraction is "everything that is not an
 // investment account" and includes debtor and pocket accounts.
 //
 // The two are therefore NOT required to sum to totalAmount, and the card does
 // not present them as if they were. They do on today's data, and that is a
 // property of the data rather than of the model.
 realizedFromBank: number;
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
 //
 // COVERAGE and not the share of the headline: it is SUM(MIN(allocated,
 // target)) / SUM(target), so one pocket at 300% cannot report coverage it does
 // not provide, and it is capped at 100 by construction. totalAmount divided by
 // target is a DIFFERENT number and the two must not be worded the same way.
 progress: number;
 // Money committed past the goal it was committed to. The fourth term of the
 // board's identity - allocated - excess + remaining = target - and without it
 // the other three do not add up on screen: remaining is clamped per pocket
 // before summing, so an over-funded goal contributes 0 to the gap instead of a
 // negative.
 //
 // null on a board with no pockets, where a sum over nothing is not a sum of
 // zero. Its three siblings above are typed as numbers and can also arrive null
 // from the same builder; that inaccuracy is not this field's to inherit.
 excess: number | null;
 fundedCount: number;
 overdueCount: number;
 uncoveredCount: number;
};

// Investment shares none of the base. §6 of the contract gives it five figures
// that are not a flow, so there is no totalAmount and no window: what it reports
// is a position, and a position is not cut to a month.
//
// IT DOES NOW CARRY A COMPARISON, added 2026-09-09 at Carlos's request, and the
// three fields are named for the figure they measure rather than borrowing
// `delta` and `priorTotalAmount` from the shared base. There is no totalAmount
// on this card, so `priorTotalAmount` would name the prior of a field that does
// not exist; `ledgerBalance` is the figure the card leads with and the one the
// change is measured on.
export type OverviewInvestmentCard = {
 domain: 'investment';
 accountCount: number;
 transactionCount: number;
 capitalContributed: number;
 ledgerBalance: number;
 realizedPnl: number;
 closureAdjustment: number;
 // The same ledger balance at the close of the PRIOR month, and the change
 // between the two. Both null together, and only when the owner held no account
 // through any part of that month — a young baseline still compares.
 priorLedgerBalance: number | null;
 ledgerBalanceDelta: number | null;
 // How much of the prior month the owner existed for. 'partial' is a real
 // comparison with a caveat, not a withheld one, so the card renders the change
 // and says the baseline is short.
 priorPeriodCoverage: 'complete' | 'partial' | 'none';
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

// The same six as a union, for the level-2 screen, which is handed ONE of them
// and does not know which until it reads the domain. Discriminated on `domain`,
// so narrowing on that field gives the specific type back. Not a replacement for
// OverviewDomainCards: the page holds all six at once and addresses them by key.
export type OverviewDomainCard =
 | OverviewIncomeCard
 | OverviewExpenseCard
 | OverviewInvestmentCard
 | OverviewDebtCard
 | OverviewPocketCard
 | OverviewPnlCard;

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
 // THE TWO FLOWS, which this type omitted while makeHeroSection.js published
 // them. A type that declares fewer fields than the payload carries does not
 // make the fields absent - it makes them unreachable, and the hero rendered
 // three of its six figures for exactly that reason.
 //
 // Negative is a real answer and the most useful one the figure has: it says the
 // month went backwards.
 netMonthlyFlow: number;
 // The same movement as a share of what came in, on a 0-1 scale. null when
 // income cannot be a denominator, and never 0 - a month with no income did not
 // save nothing, it has no rate at all, and the two read identically once
 // printed as 0%.
 savingsRate: number | null;
 // The accounting currency the four stocks and the flow are in. Read from here
 // and never from a constant: a component naming its own currency can label a
 // figure with a currency the figure is not in.
 currency: string;
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
 // The plan's curve, over the SAME ranking. It is not ranked by plan: two
 // curves ranked separately would put two different categories above one x
 // position.
 cumulativeBudget: number;
 // cumulativeBudget over the plan of the rows that have one, 0-1. Not over the
 // budget the expense card publishes, which is why it always reaches 1.
 cumulativeBudgetPercentage: number;
 // Whether the running plan beside it omits a row. True from the first category
 // whose currency is mixed onwards, and the block writes the caveat only when it
 // is true rather than on every render.
 hasSkippedBudget: boolean;
};

export type OverviewCharts = {
 trend: OverviewTrend;
 expenseCategories: OverviewExpenseCategory[];
};

// One row of the activity teaser, in the server's own column names. Not
// renamed on the way in: the page service publishes the shared transaction row
// shape (transactionRowShape.js:52-83) and every other consumer of that shape
// reads it as it arrives, so a camelCase copy here would be a second name for
// the same column.
//
// The five columns the teaser draws, of the twenty the row carries. The rest
// are on the wire and typed loosely on purpose - declaring them here would put
// a second copy of that shape in the frontend, and the row is the level-2
// detail's payload as well.
export type OverviewActivityRow = {
 transaction_id: number;
 account_name: string;
 amount: number;
 description: string;
 // What the owner typed, split out of description by the server. Null when the
 // row carries none.
 note: string | null;
 transaction_actual_date: string;
 // A plain string, like every other currency in this file: the payload's codes
 // are the accounting currency's, not the narrowed union the forms validate
 // against, and narrowing here would make a new code a compile error in the
 // client rather than a value it renders.
 currency_code: string;
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
 // The five most recent movements over every domain, which the server caps at
 // five in the statement itself (overviewPageRepository.js:286). Not bounded by
 // the reference month: the teaser answers what happened last, and a month with
 // no activity would otherwise show an empty list while the account was moving.
 recentActivity: { transactions: OverviewActivityRow[] };
};

// ---------------------------------------------------------------------------
// LEVEL 2 — the domain screen, GET /overview/:domain
//
// Every type below was read off the builder that produces it, never inferred
// from a name: makeExpenseAnalysis.js, makeIncomeAnalysis.js, makePnlAnalysis.js,
// makeInvestmentAnalysis.js, makeDebtAnalysis.js and makePocketAnalysis.js, plus
// the two shared shapes makeTrendSeries.js and makeDistribution.js.
//
// AN ABSENT SECTION IS ABSENT, NOT NULL, and that is why almost every analysis
// field below is optional rather than nullable. The builders spread each section
// in conditionally, so a request that asked for the shallow depth returns an
// object with no such key at all. The two states differ: a missing key means the
// statement was never run, and a value of null would mean it ran and had no
// answer. A component that treats them alike tells the owner they have no income
// sources when nobody asked.

// The two depths the request can ask for. Omitting the parameter is a third
// state - the level-1 response, with no analysis section at all - and it has no
// member here because it is the absence of the value rather than a value.
export type OverviewAnalysisLevel = 'derived' | 'full';

// The series of a level-2 analysis is the SAME point shape the six-month card
// series uses, declared once above at OverviewTrendPoint. Only the length
// differs - thirteen months here, six on the card - and a length is not a type.

// One part of a ranked distribution, from makeDistribution.js. share is a 0-1
// ratio at four decimals, and it is NULL when the whole is zero - a share of
// nothing is not a small share.
export type OverviewDistributionPart = {
 label: string;
 amount: number;
 rank: number;
 share: number | null;
};

// One row of a domain's transaction page, in the server's own column names.
//
// THE ACCOUNT COLUMNS ARE NULLABLE AND THE JOIN IS WHY. transactionRowShape.js
// joins user_accounts LEFT because CLOSE deletes that row while the transaction
// survives, so a closed account's movement comes back with every ua.* column
// null. An INNER join dropped those rows from the page while the count beside it
// still counted them, and the paginator offered a short page.
export type OverviewTransactionRow = {
 transaction_id: number;
 user_id: string;
 description: string;
 amount: number;
 movement_type_id: number;
 transaction_type_id: number;
 currency_id: number;
 account_id: number;
 source_account_id: number | null;
 destination_account_id: number | null;
 status: string;
 transaction_actual_date: string;
 created_at: string;
 updated_at: string;
 movement_type_name: string;
 transaction_type_name: string;
 // LEFT-joined through user_accounts, so null on a closed account's movement.
 account_type_name: string | null;
 currency_code: string;
 account_name: string | null;
 account_type_id: number | null;
 account_starting_amount: number | null;
 account_balance: number | null;
 account_start_date: string | null;
 // The movement's date on the OWNER's calendar, 'YYYY-MM-DD'. Read this and not
 // transaction_actual_date wherever a day is rendered: the other is an instant.
 transaction_local_date: string;
};

export type OverviewTransactionPage = {
 rows: OverviewTransactionRow[];
 page: number;
 pageSize: number;
 totalRows: number;
};

// One row of the pocket domain's page. A pocket moves no money, so its page is the
// month's allocations, in ALLOCATIONS_PAGE_QUERY's names, and not transactions.
export type OverviewAllocationRow = {
 allocationId: string;
 pocketId: number;
 pocketName: string;
 // Numeric text: the column is serialised as ::text.
 amount: string;
 // 'YYYY-MM-DD' on the owner's calendar.
 allocationDate: string;
 sourceAccountId: number;
 // LEFT-joined through user_accounts, so null once the account's row is gone.
 sourceAccountName: string | null;
 currency: string;
};

export type OverviewAllocationPage = Omit<OverviewTransactionPage, 'rows'> & {
 rows: OverviewAllocationRow[];
};

export type OverviewAnalysisMeta = {
 notices: string[];
};

// Expense - the series, and the one decomposition level 1 refuses.
//
// categorization is absent when the server has no categorised figure at all, and
// its notice says so. When present the two terms sum back to the card's
// totalAmount by construction, which is what makes it a decomposition rather
// than a second total.
export type OverviewExpenseAnalysis = {
 domain: 'expense';
 level: OverviewAnalysisLevel;
 series: OverviewTrendPoint[];
 categorization?: {
  categorized: number;
  uncategorized: number;
 };
 meta: OverviewAnalysisMeta;
};

// Income - where the month came from, and how exposed the owner is to losing one
// source.
//
// A source row with accountId null is real income attributed to no account. It
// keeps its amount and its share and it is the one row that renders without a
// link, which is the level-3 rule for this domain.
export type OverviewIncomeSourcePart = OverviewDistributionPart & {
 accountId: number | null;
 accountName: string | null;
};

export type OverviewIncomeAnalysis = {
 domain: 'income';
 level: OverviewAnalysisLevel;
 series: OverviewTrendPoint[];
 bySource?: OverviewIncomeSourcePart[];
 // The largest source's share, read off bySource[0] and never recomputed. Null
 // exactly when the shares are.
 concentration?: number | null;
 meta: OverviewAnalysisMeta;
};

// Profit and loss - both terms always present, both able to be negative, and
// neither ever absent. A losing month is a loss, not a missing figure.
export type OverviewPnlAnalysis = {
 domain: 'pnl';
 level: OverviewAnalysisLevel;
 series: OverviewTrendPoint[];
 byAccountType: {
  investment: number;
  other: number;
 };
 meta: OverviewAnalysisMeta;
};

// Investment - the itemised reconciliation, plus two sections the deeper depth
// pays for.
//
// difference AND tolerance travel together, and the pair is the condition on
// which level 2 may publish a figure level 1 refuses. The client cannot
// reconstruct the threshold below which the server calls the difference zero, so
// a client subtracting in floating point would find a cent the server did not
// and tell the owner their books are broken.
export type OverviewReconciliation = {
 capitalContributed: number;
 realizedPnl: number;
 closureAdjustment: number;
 ledgerBalance: number;
 difference: number;
 tolerance: number;
};

export type OverviewInvestmentBalancePart = OverviewDistributionPart & {
 accountId: number;
 accountName: string;
};

// One funding event. Not a monthly series: the question is when money went in,
// and a month with no contribution is not a point on this line.
export type OverviewContributionEvent = {
 transactionId: number;
 accountId: number;
 // Null on a closed account, for the same LEFT join reason the transaction rows
 // carry.
 accountName: string | null;
 amount: number;
 // 'YYYY-MM-DD' on the owner's calendar.
 contributionDate: string;
};

export type OverviewInvestmentAnalysis = {
 domain: 'investment';
 level: OverviewAnalysisLevel;
 reconciliation: OverviewReconciliation;
 balanceByAccount?: OverviewInvestmentBalancePart[];
 // The NEWEST page of a history with no lower bound. totalRows is what says how
 // much of it is not in rows - a reader that cannot tell a page from the whole
 // would report five hundred contributions as five.
 contributionHistory?: {
  rows: OverviewContributionEvent[];
  totalRows: number;
 };
 meta: OverviewAnalysisMeta;
};

// Debt - who, and the two legs kept apart.
//
// direction is the word the sign carries, served rather than derived: above zero
// the counterparty owes the owner, below zero the owner owes them, and exactly
// zero is a counterparty with a history that came back to nothing, which stays
// in the list.
export type OverviewDebtDirection = 'receivable' | 'payable' | 'settled';

export type OverviewDebtCounterparty = {
 accountId: number;
 accountName: string;
 // Signed. Ranked by MAGNITUDE, so the largest debt and the largest credit both
 // sit at the top rather than every debt sinking under every credit.
 balance: number;
 direction: OverviewDebtDirection;
 rank: number;
};

// The two legs at each month close, never netted. A net position that has not
// moved can hide both legs doubling, which is the whole reason this is two
// series and not one.
export type OverviewDebtLegsPoint = {
 month: string;
 receivable: number;
 payable: number;
};

export type OverviewDebtAnalysis = {
 domain: 'debt';
 level: OverviewAnalysisLevel;
 byCounterparty?: OverviewDebtCounterparty[];
 legsOverTime?: OverviewDebtLegsPoint[];
 meta: OverviewAnalysisMeta;
};

// Pocket - the board's own rows, and the hero's pair stated as three terms.
//
// progressByPocket carries PocketStatus unchanged, imported rather than
// restated: the rows ARE the board's, spread through by pocketBoardService, and
// a second declaration of the same shape is the divergence this file avoids
// elsewhere. pocketId is the level-3 identity and is never derived from an
// account.
export type OverviewPocketAnalysis = {
 domain: 'pocket';
 level: OverviewAnalysisLevel;
 series: OverviewTrendPoint[];
 progressByPocket?: PocketStatus[];
 committedAgainstFree?: {
  bankBalance: number;
  committed: number;
  freeCash: number;
  // What the per-account floor cost. 0 when every account covers its own
  // commitments, and positive by exactly the shortfall the floor absorbed - the
  // one figure that explains why the three terms above do not add up.
  flooredShortfall: number;
 };
 meta: OverviewAnalysisMeta;
};

export type OverviewAnalysis =
 | OverviewExpenseAnalysis
 | OverviewIncomeAnalysis
 | OverviewPnlAnalysis
 | OverviewInvestmentAnalysis
 | OverviewDebtAnalysis
 | OverviewPocketAnalysis;

// What GET /overview/:domain answers with, under data.
//
// trend and categories are NOT the analysis. They are level-1 material the
// endpoint serves whether or not an analysis was asked for, and categories is
// the expense domain's alone. The analysis key is the only part that appears and
// disappears with the request.
export type GetOverviewDomainData = {
 window: ServedWindow;
 card: OverviewDomainCard;
 // Allocations on the pocket domain, transactions on the other five.
 transactions: OverviewTransactionPage | OverviewAllocationPage;
 trend: OverviewTrendPoint[];
 categories?: OverviewExpenseCategory[];
 analysis?: OverviewAnalysis;
};

export type GetOverviewDomainResponse = {
 status: number;
 message: string;
 data: GetOverviewDomainData;
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

// ---------------------------------------------------------------------------
// THE ACTIVITY ENDPOINT — GET /overview/activity
//
// The one section of this module whose period the READER chooses. Everything
// else on the page is bound to the reference month; this answers "what do I
// want to read", which a month cannot express.

// The movement_types catalog, whole. It is the frontend's copy of
// MOVEMENT_TYPE_NAMES and the schema is what actually enforces it: a value
// outside this list answers 400 naming the key, so a drift between the two
// fails loudly at the door rather than silently returning everything.
export const OVERVIEW_ACTIVITY_MOVEMENT_TYPES = [
 'expense',
 'income',
 'investment',
 'debt',
 'pocket',
 'transfer',
 'receive',
 'account-opening',
 'pnl',
 'account-closure',
 'balance-reversal',
] as const;

export type OverviewActivityMovementType =
 (typeof OVERVIEW_ACTIVITY_MOVEMENT_TYPES)[number];

// What a caller may ask for. Every key optional, and an omitted one is not the
// same as a null: omitted means "no narrowing", which is the endpoint's default.
export type OverviewActivityQuery = {
 // 'YYYY-MM', both inclusive, and `to` covers the WHOLE month it names.
 from?: string;
 to?: string;
 // 1..80 characters after trimming. '' is not a value the endpoint takes: the
 // way to express "no search" is to omit the key.
 search?: string;
 movementType?: OverviewActivityMovementType;
 page?: number;
 pageSize?: number;
};

export type GetOverviewActivityData = {
 transactions: {
  rows: OverviewActivityRow[];
  page: number;
  pageSize: number;
  // The size of the WHOLE set the page was cut out of, counted by its own
  // statement over the same filter. Not the length of rows.
  totalRows: number;
 };
 // Echoed, and null on an end the reader did not bound.
 range: {
  from: string | null;
  to: string | null;
 };
 // Echoed for the same reason: five rows out of two thousand is not a short
 // list, it is a filtered one, and only the server can say which of the two the
 // reader is looking at.
 filters: {
  search: string | null;
  movementType: string | null;
 };
};

export type GetOverviewActivityResponse = {
 status: number;
 message: string;
 data: GetOverviewActivityData;
};
