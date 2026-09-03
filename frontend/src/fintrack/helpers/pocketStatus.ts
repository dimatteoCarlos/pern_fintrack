// frontend/src/fintrack/helpers/pocketStatus.ts
// 🚦 POCKET STATUS: how one pocket reads, decided in one place
//
// The same rule budgetStatus.ts exists to honour, for the other module: the
// threshold is written ONCE, beside whatever computes the status. A square
// lighting at one number while the border beside it paints another is a screen
// contradicting itself.
//
// It does NOT reuse budgetStatusLevel, and the reason is an inversion of
// meaning rather than a difference of taste. In a budget, approaching the
// limit is bad, so 75% of execution lights amber. In a pocket, approaching the
// target is the point: a pocket at 63% of its goal would be warned for
// succeeding. The scarce resource here is not the money, it is the time left
// to commit it, so the threshold is measured in days.
//
// Nothing here recomputes a figure. `funded`, `overdue` and `daysRemaining`
// are all served by makePocketStatus.js; what this applies is a presentation
// threshold over served numbers.

// Fixed by the developer on 2026-08-30, the same way BUDGET_NEAR_LIMIT_PERCENT
// was: it is a business rule and there is nothing in the model to read it from.
// One income cycle — when the square turns amber there is still one salary left
// to close the gap.
export const POCKET_AT_RISK_DAYS = 30;

export type PocketStatusLevel =
 | 'funded'
 | 'overFunded'
 | 'onPlan'
 | 'atRisk'
 | 'offPlan';

// The class the shared StatusSquare appends. The scale carries three colours
// and the levels are four, so a covered pocket and one with slack share the
// bare square: neither has anything to flag. The word beside them differs.
const SQUARE_CLASS: Record<PocketStatusLevel, string> = {
 funded: '',
 overFunded: 'info',
 onPlan: '',
 atRisk: 'warning',
 offPlan: 'alert',
};

// The modifier on the reading's left border, from the same level, so the two
// can never disagree about the same pocket. The block name follows the readings
// themselves, which returned to the hero panel on 2026-09-02.
const READING_MODIFIER: Record<PocketStatusLevel, string> = {
 funded: 'summaryPocket__reading--ok',
 overFunded: 'summaryPocket__reading--info',
 onPlan: 'summaryPocket__reading--neutral',
 atRisk: 'summaryPocket__reading--warning',
 offPlan: 'summaryPocket__reading--alert',
};

// The one place this vocabulary is spelled, so a card, the hero's tallies and
// the board's own filter can never name the same level three different ways.
// It replaces a private three-word scheme that painted AMBER on everything
// neither funded nor overdue and called it "Active" — a word that appeared on
// the filter and nowhere else on the screen it was filtering.
export const POCKET_STATUS_WORD: Record<PocketStatusLevel, string> = {
 // "At target" and no longer "Funded". Funded named the mechanism; the four
 // words beside it all name an outcome, and this one now has a sibling — a
 // pocket ABOVE its target — that it has to read as a pair with. It also stops
 // the level from colliding with the board's own grouping, where "target
 // reached" is the heading that holds both this level and the one above it.
 funded: 'At target',
 overFunded: 'Above target',
 onPlan: 'On plan',
 atRisk: 'At risk',
 offPlan: 'Overdue',
};

export const pocketSquareClass = (level: PocketStatusLevel): string =>
 SQUARE_CLASS[level];

export const pocketReadingModifier = (level: PocketStatusLevel): string =>
 READING_MODIFIER[level];

/**
 * Where a pocket stands against its own deadline.
 *
 * Coverage is deliberately absent: whether the funding accounts still hold what
 * was committed says nothing about the date, and folding the two would let one
 * state hide the other. The coverage reading carries its own level.
 *
 * `funded` and `overdue` are mutually exclusive by construction — the server
 * builds overdue as `daysRemaining < 0 && allocated < target` — so the first
 * two branches cannot both be true.
 */
export const pocketDateLevel = ({
 funded,
 overdue,
 daysRemaining,
 remaining,
}: {
 funded: boolean;
 overdue: boolean;
 daysRemaining: number;
 remaining: number;
}): PocketStatusLevel =>
 funded
  ? // Split inside the served flag, not against it: the server sets funded at
    // committed >= target, and a negative shortfall is the same payload saying
    // by how much it passed. The two differ in what the owner can do — the
    // excess of an over-funded pocket is the only committed money that can be
    // released without setting a plan back — so they cannot share one reading.
    remaining < 0
    ? 'overFunded'
    : 'funded'
  : overdue
    ? 'offPlan'
    : daysRemaining <= POCKET_AT_RISK_DAYS
      ? 'atRisk'
      : 'onPlan';
