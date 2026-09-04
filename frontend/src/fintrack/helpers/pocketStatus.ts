// frontend/src/fintrack/helpers/pocketStatus.ts
// 🚦 POCKET STATUS: how one pocket reads, decided in one place
//
// The same rule budgetStatus.ts exists to honour, for the other module: the
// criterion is written ONCE, beside whatever computes the status. A square
// lighting at one number while the border beside it paints another is a screen
// contradicting itself.
//
// It does NOT reuse budgetStatusLevel, and the reason is an inversion of
// meaning rather than a difference of taste. In a budget, approaching the
// limit is bad, so 75% of execution lights amber. In a pocket, approaching the
// target is the point: a pocket at 63% of its goal would be warned for
// succeeding.
//
// Nothing here computes a level any more. RULED 2026-09-03
// (POCKET_CONTRACT_AUDIT.md, "Contract change 2026-09-03"): the server serves
// `level` on every row, decided once in `pocketLevel.js`, so a client-side
// derivation from `funded`/`overdue`/`paceRatio` would be a second answer to a
// question the backend already answered. This file now owns only the word and
// the colour each served level maps to.

// Seven since 2026-09-04, and the order is the order they READ in — from the
// level that asks least of the owner to the one that asks most — not the order
// they were added in. `ahead` sits above `onTrack` because a pocket running in
// front of its plan asks for less than one merely keeping up with it, which is
// the same order `POCKET_LEVELS` uses on the server.
//
// The seventh level exists because `onTrack` was silently swallowing it: the
// pace ratio is at or under 1 exactly when the pocket is at or ahead of its own
// line, so every pocket ahead of plan was already reading "On track" and the
// board could not name the one state the owner had no action to take on.
export type PocketStatusLevel =
 | 'completed'
 | 'aboveTarget'
 | 'ahead'
 | 'onTrack'
 | 'behind'
 | 'atRisk'
 | 'overdue';

// The class the shared StatusSquare appends.
//
// 'behind' was named but unstyled while its colour was deferred; the deferral
// was lifted 2026-09-04, and `--color-status-behind` (violet, 5.88:1 on the
// board card) and `--color-status-ahead` (green, 8.34:1) now paint the two
// levels that had no hue.
//
// onTrack takes an explicit 'neutral' rather than the bare square it used to
// take. The bare square paints `--square`, a variable declared nowhere, so it
// fell through to its hex fallback — the ok teal — which made the same level
// read teal on the board and grey on the detail panel, where its border was
// already `--color-content-secondary`. One token now answers both.
//
// completed maps to '' and the empty string is not an oversight: it is drawn as
// a TICK and never as a square, so it has no colour class to take. Ask
// `pocketMarkIsTick` before painting a square, not this map.
const SQUARE_CLASS: Record<PocketStatusLevel, string> = {
 completed: '',
 aboveTarget: 'info',
 ahead: 'ahead',
 onTrack: 'neutral',
 behind: 'behind',
 atRisk: 'warning',
 overdue: 'alert',
};

// Which levels are marked by SHAPE instead of by hue, asked here so a card, the
// hero strip and the detail panel cannot each decide it for themselves.
//
// Only one level qualifies, and it earns the exception twice over: completed is
// the one reading that is FINISHED rather than pending, so it sits off the
// semaphore entirely — and a tick is the only mark on this scale that survives
// both simulations. Under deuteranopia the seven collapse to two families, with
// completed, aboveTarget, ahead, onTrack and behind inside 1.11:1 of one
// another; the shape is what still separates one of them.
export const pocketMarkIsTick = (level: PocketStatusLevel): boolean =>
 level === 'completed';

// The modifier on the reading's left border, from the same level, so the two
// can never disagree about the same pocket. The block name follows the readings
// themselves, which returned to the hero panel on 2026-09-02.
//
// The two levels whose colour was deferred take the same token their square
// takes, styled since 2026-09-04. onTrack no longer disagrees with itself: its
// border and its square both resolve to --color-status-neutral, where the
// border used to paint grey and the square the base teal.
//
// completed keeps the --ok border even though its mark is a tick: a border is
// a line and cannot be a shape, so the hue is all this row has to carry.
const READING_MODIFIER: Record<PocketStatusLevel, string> = {
 completed: 'summaryPocket__reading--ok',
 aboveTarget: 'summaryPocket__reading--info',
 ahead: 'summaryPocket__reading--ahead',
 onTrack: 'summaryPocket__reading--neutral',
 behind: 'summaryPocket__reading--behind',
 atRisk: 'summaryPocket__reading--warning',
 overdue: 'summaryPocket__reading--alert',
};

// The one place this vocabulary is spelled, so a card, the hero's tallies and
// the board's own filter can never name the same level three different ways.
// Every consumer reads it, casing included: the hero's strip lower-cases the
// word it gets rather than typing a sixth copy of it.
export const POCKET_STATUS_WORD: Record<PocketStatusLevel, string> = {
 // Every key states the LEVEL and no longer the mechanism that produced it.
 // "Funded" and "on plan" named how a pocket was financed and which document
 // it was measured against; the reader asks neither question of this board.
 completed: 'Completed',
 aboveTarget: 'Above target',
 // "Ahead" and not "Ahead of plan", which is the phrase the readings card uses
 // for the same state in a sentence. This map feeds a status chip, a filter
 // option and a strip where every other entry is one or two words; the longer
 // phrase would be the only one to wrap.
 ahead: 'Ahead',
 onTrack: 'On track',
 behind: 'Behind',
 atRisk: 'At risk',
 overdue: 'Overdue',
};

export const pocketSquareClass = (level: PocketStatusLevel): string =>
 SQUARE_CLASS[level];

export const pocketReadingModifier = (level: PocketStatusLevel): string =>
 READING_MODIFIER[level];
