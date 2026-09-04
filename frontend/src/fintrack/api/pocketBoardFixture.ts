// frontend/src/fintrack/api/pocketBoardFixture.ts
// 🧪 THE BOARD'S EXAMPLE PAYLOAD, standing in for the server
//
// NOTHING IMPORTS THIS AS OF 2026-09-04. usePocketBoardStore made the swap it
// was built for and calls getPocketBoard from pocketApi.ts, so this file is no
// longer on any path a screen takes. It is kept, not deleted, while the
// endpoint is still unproven on this branch — but it is now a liability rather
// than a stand-in: a payload nobody renders will drift from the contract the
// moment someone forgets it exists, and a board silently falling back to it
// would list pockets the database does not hold. Delete it once the endpoint
// has answered on screen.
//
// It is kept IN STEP with the contract for as long as it stays: the seventh
// level and the removal of the served aheadCount are both reflected below.
//
// Nothing here is computed. Every figure is written out, including the ones a
// reader could add up, because a fixture that derives its own totals stops
// being able to catch a screen that derives them too.
//
// The rows are the six cases the classification has to tell apart: a plan on
// its target, one past it, two on track (one of them with a window shorter than
// a month, which publishes no schedule), one below the line its plan implies,
// and one whose deadline has passed.
//
// Rewritten 2026-09-03 against the frozen contract (POCKET_CONTRACT_AUDIT.md,
// "Contract change 2026-09-03"): `level` is now served on every row rather than
// derived on the client, `referenceMonth` moved inside `meta` beside the new
// `evaluationDate`, and the header's movedInMonth/committedInMonth/
// releasedInMonth were renamed to totalMovedInMonth/totalCommittedInMonth/
// totalReleasedInMonth once the row gained its own figure of almost the same
// name.

import { PocketBoardPayload, PocketStatus } from '../types/pocketTypes.ts';

// The month the fixture calls "now". Every daysRemaining below is measured
// against 2026-09-03 on the owner's calendar.
const CURRENT_MONTH = '2026-09-01';
const EVALUATION_DATE = '2026-09-03';

// How long the answer pretends to take. Enough for the skeleton and the
// stepper's busy state to be seen at all, short enough not to be a wait.
const LATENCY_MS = 220;

// The evaluation date for a month that is not the current one: its own last
// day, per section 23.4. Built from parts — new Date('YYYY-MM-01') is UTC
// midnight and renders as the previous day west of UTC.
const lastDayOfMonth = (monthKey: string): string => {
 const [year, month] = monthKey.split('-').map(Number);
 const last = new Date(year, month, 0).getDate();

 return `${monthKey}-${String(last).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// The pockets, at the close of September 2026.
// ---------------------------------------------------------------------------
const SEPTEMBER_POCKETS: PocketStatus[] = [
 {
  pocketId: 1,
  name: 'Emergency fund',
  note: 'Six months of fixed costs',
  target: 6000,
  allocated: 6000,
  remaining: 0,
  progress: 100,
  desiredDate: '2026-12-31',
  planStart: '2025-01-15',
  planInstalment: 260.87,
  scheduledByNow: 4993.02,
  aheadOfPlan: 1006.98,
  // Unused once `level` decides how the pocket reads — served anyway so the
  // row's shape never depends on which level it carries.
  paceRatio: 0,
  daysRemaining: 119,
  requiredMonthly: 0,
  funded: true,
  overdue: false,
  level: 'completed',
  sourceCount: 2,
  currency: 'usd',
  uncovered: false,
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  pocketId: 2,
  name: 'New laptop',
  note: null,
  target: 1500,
  allocated: 1840,
  remaining: -340,
  progress: 122.67,
  desiredDate: '2026-11-30',
  planStart: '2026-01-10',
  planInstalment: 150,
  scheduledByNow: 1128.75,
  aheadOfPlan: 711.25,
  paceRatio: 0,
  daysRemaining: 88,
  requiredMonthly: 0,
  funded: true,
  overdue: false,
  level: 'aboveTarget',
  sourceCount: 1,
  currency: 'usd',
  uncovered: false,
  // This month's whole commitment across the board landed here.
  movedInMonth: 1200,
  committedInMonth: 1200,
  releasedInMonth: 0,
 },
 {
  pocketId: 3,
  name: 'Trip to Japan',
  note: 'Two weeks, flights included',
  target: 8000,
  allocated: 4200,
  remaining: 3800,
  progress: 52.5,
  desiredDate: '2027-12-31',
  planStart: '2026-03-01',
  planInstalment: 363.64,
  // Committed 410.00 above the line the plan implies. The ratio (0.65) is at
  // or below 1, which is what reads On track rather than Behind or At risk.
  scheduledByNow: 3790,
  aheadOfPlan: 410,
  paceRatio: 0.65,
  daysRemaining: 484,
  requiredMonthly: 237.5,
  funded: false,
  overdue: false,
  level: 'onTrack',
  sourceCount: 2,
  currency: 'usd',
  uncovered: false,
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  pocketId: 4,
  name: 'Home deposit',
  note: 'Down payment',
  target: 7000,
  allocated: 2100,
  remaining: 4900,
  progress: 30,
  desiredDate: '2027-06-30',
  planStart: '2025-10-01',
  planInstalment: 350,
  // 1,850.00 under the line, with ten months still to run. This is the case
  // the retired thirty-day rule read as "on plan" and the ratio (1.4) now
  // reads Behind rather than At risk: an ordinary month does not close it,
  // but two do.
  scheduledByNow: 3950,
  aheadOfPlan: -1850,
  paceRatio: 1.4,
  daysRemaining: 300,
  requiredMonthly: 490,
  funded: false,
  overdue: false,
  level: 'behind',
  sourceCount: 1,
  currency: 'usd',
  uncovered: true,
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  pocketId: 5,
  name: 'Car insurance',
  note: null,
  target: 1200,
  allocated: 780,
  remaining: 420,
  progress: 65,
  desiredDate: '2026-08-15',
  planStart: '2026-02-15',
  planInstalment: 200,
  // The window closed, so the whole target was due. The ratio is null and the
  // level is still Overdue: the deadline is read before the schedule.
  scheduledByNow: 1200,
  aheadOfPlan: -420,
  paceRatio: null,
  daysRemaining: -19,
  requiredMonthly: null,
  funded: false,
  overdue: true,
  level: 'overdue',
  sourceCount: 1,
  currency: 'usd',
  uncovered: false,
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  pocketId: 6,
  name: 'Course fees',
  note: 'Enrolment closes the 20th',
  target: 800,
  allocated: 400,
  remaining: 400,
  progress: 50,
  desiredDate: '2026-09-20',
  planStart: '2026-09-01',
  // Nineteen days of window, so no schedule is published and the pocket can
  // never read At risk. It falls to On track and the card says why.
  planInstalment: null,
  scheduledByNow: null,
  aheadOfPlan: null,
  paceRatio: null,
  daysRemaining: 17,
  requiredMonthly: 400,
  funded: false,
  overdue: false,
  level: 'onTrack',
  sourceCount: 1,
  currency: 'usd',
  uncovered: false,
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
];

// August closes before the enrolment plan was made, so that pocket is absent
// from the board entirely rather than present at zero: the population is bound
// on the day the plan was made.
const AUGUST_POCKETS: PocketStatus[] = [
 {
  ...SEPTEMBER_POCKETS[0],
  allocated: 5400,
  remaining: 600,
  progress: 90,
  funded: false,
  scheduledByNow: 4759.32,
  aheadOfPlan: 640.68,
  paceRatio: 0.58,
  daysRemaining: 122,
  requiredMonthly: 150,
  level: 'onTrack',
  // This month's whole commitment across the board landed here.
  movedInMonth: 900,
  committedInMonth: 900,
  releasedInMonth: 0,
 },
 {
  ...SEPTEMBER_POCKETS[1],
  allocated: 1500,
  remaining: 0,
  progress: 100,
  scheduledByNow: 1027.5,
  // Funded decides the level before the ratio is read, so it is served
  // unused, same as September's own row for this pocket.
  aheadOfPlan: 472.5,
  paceRatio: 0,
  daysRemaining: 91,
  level: 'completed',
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  ...SEPTEMBER_POCKETS[2],
  allocated: 3600,
  remaining: 4400,
  progress: 45,
  scheduledByNow: 3500,
  aheadOfPlan: 100,
  paceRatio: 0.65,
  daysRemaining: 487,
  level: 'onTrack',
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
 {
  ...SEPTEMBER_POCKETS[3],
  allocated: 2100,
  remaining: 4900,
  progress: 30,
  scheduledByNow: 3830,
  aheadOfPlan: -1730,
  paceRatio: 1.4,
  daysRemaining: 303,
  level: 'behind',
  // The month's one release: the deposit gave back part of a prior
  // over-commitment.
  movedInMonth: -180,
  committedInMonth: 0,
  releasedInMonth: 180,
 },
 {
  // Its deadline had not passed at the close of August, so the same pocket
  // that reads Overdue in September reads On track here. This is the month
  // bound working, not two answers about one pocket.
  ...SEPTEMBER_POCKETS[4],
  allocated: 780,
  remaining: 420,
  progress: 65,
  overdue: false,
  scheduledByNow: 760,
  aheadOfPlan: 20,
  paceRatio: null,
  daysRemaining: 15,
  level: 'onTrack',
  movedInMonth: 0,
  committedInMonth: 0,
  releasedInMonth: 0,
 },
];

const SEPTEMBER: PocketBoardPayload = {
 summary: {
  totalAllocated: 15320,
  totalTarget: 24500,
  // Clamped per pocket before the fold, which is why it is not the plain
  // subtraction: the 340.00 the laptop is past its target does not cancel
  // part of what the other five are short.
  totalRemaining: 9520,
  totalExcess: 340,
  overallProgress: 61.14,
  currency: 'usd',
  pocketCount: 6,
  fundedCount: 2,
  overdueCount: 1,
  uncoveredCount: 1,
  sourceAccountCount: 4,
  latestDesiredDate: '2027-12-31',
  totalMovedInMonth: 1200,
  totalCommittedInMonth: 1200,
  totalReleasedInMonth: 0,
  // Rows 1-3 hold positive slack (1,006.98 + 711.25 + 410.00); rows 4-6 are
  // short of their line or publish none, so they carry none.
  totalAheadOfPlan: 2128.23,
  levelCounts: {
   completed: 1,
   aboveTarget: 1,
   ahead: 1,
   onTrack: 1,
   behind: 1,
   atRisk: 0,
   overdue: 1,
  },
  // The schedule fold, nine fields frozen 2026-09-04. Every one counts ONLY the
  // pockets holding a plan window, and every figure below is folded from this
  // fixture's own rows rather than invented, so the board it serves cannot
  // contradict the rows beneath it.
  totalScheduledByNow: 15061.77,
  scheduledPocketsAllocated: 14920,
  totalScheduleGap: -141.77,
  totalRequiredMonthly: 727.5,
  // Unclamped and free to pass 100. This board sits just under it.
  scheduleAdherence: 99.06,
  // One of the six rows carries no plan window, which is why this reads 5
  // while pocketCount reads 6.
  scheduledPocketCount: 5,
  // They partition the scheduled population: 2 + 3 === 5, always.
  underScheduleCount: 2,
  overScheduleCount: 3,
  // Scoped to those five, so it is NOT totalMovedInMonth above.
  scheduledPocketsMovedInMonth: 1200,
 },
 pockets: SEPTEMBER_POCKETS,
 meta: {
  referenceMonth: CURRENT_MONTH.slice(0, 7),
  currentMonth: CURRENT_MONTH.slice(0, 7),
  evaluationDate: EVALUATION_DATE,
  notices: [],
 },
};

const AUGUST: PocketBoardPayload = {
 summary: {
  totalAllocated: 13380,
  totalTarget: 23700,
  totalRemaining: 10320,
  totalExcess: 0,
  overallProgress: 56.46,
  currency: 'usd',
  pocketCount: 5,
  fundedCount: 1,
  overdueCount: 0,
  uncoveredCount: 1,
  sourceAccountCount: 4,
  latestDesiredDate: '2027-12-31',
  // Both directions happened inside the month, so the net is what the tile
  // states and the two halves are what it states it from.
  totalMovedInMonth: 720,
  totalCommittedInMonth: 900,
  totalReleasedInMonth: 180,
  // Rows 0, 1, 2 and 4 hold positive slack (640.68 + 472.50 + 100.00 + 20.00);
  // row 3 is short of its line.
  totalAheadOfPlan: 1233.18,
  levelCounts: {
   completed: 1,
   aboveTarget: 0,
   ahead: 2,
   onTrack: 1,
   behind: 1,
   atRisk: 0,
   overdue: 0,
  },
  // The schedule fold, nine fields frozen 2026-09-04. Every one counts ONLY the
  // pockets holding a plan window, and every figure below is folded from this
  // fixture's own rows rather than invented, so the board it serves cannot
  // contradict the rows beneath it.
  totalScheduledByNow: 13876.82,
  scheduledPocketsAllocated: 13380,
  totalScheduleGap: -496.82,
  totalRequiredMonthly: 877.5,
  scheduleAdherence: 96.42,
  // Every row this month holds a window, so this equals pocketCount.
  scheduledPocketCount: 5,
  // 1 + 4 === 5.
  underScheduleCount: 1,
  overScheduleCount: 4,
  scheduledPocketsMovedInMonth: 720,
 },
 pockets: AUGUST_POCKETS,
 meta: {
  referenceMonth: '2026-08',
  currentMonth: CURRENT_MONTH.slice(0, 7),
  evaluationDate: lastDayOfMonth('2026-08'),
  notices: [],
 },
};

// Keyed by the month as it travels, YYYY-MM. The omitted month is the current
// one, which is the key the store sends nothing for.
const BOARDS: Record<string, PocketBoardPayload> = {
 '2026-09': SEPTEMBER,
 '2026-08': AUGUST,
};

// A month the fixture has no rows for is a real answer and not a failure: the
// owner owned no pocket then. Every amount is null, never zero, which is the
// empty-board rule the contract states — counts stay real zeros, every level
// in levelCounts included.
const emptyBoard = (month: string): PocketBoardPayload => ({
 summary: {
  totalAllocated: null,
  totalTarget: null,
  totalRemaining: null,
  totalExcess: null,
  overallProgress: null,
  currency: null,
  pocketCount: 0,
  fundedCount: 0,
  overdueCount: 0,
  uncoveredCount: 0,
  sourceAccountCount: 0,
  latestDesiredDate: null,
  totalMovedInMonth: null,
  totalCommittedInMonth: null,
  totalReleasedInMonth: null,
  totalAheadOfPlan: null,
  levelCounts: {
   completed: 0,
   aboveTarget: 0,
   ahead: 0,
   onTrack: 0,
   behind: 0,
   atRisk: 0,
   overdue: 0,
  },
  // The schedule fold on an empty board: every amount null and never zero. A
  // zero would state that nothing was required, which is a different claim from
  // there being nothing to measure. The counts stay real zeros.
  totalScheduledByNow: null,
  scheduledPocketsAllocated: null,
  totalScheduleGap: null,
  totalRequiredMonthly: null,
  scheduleAdherence: null,
  scheduledPocketCount: 0,
  underScheduleCount: 0,
  overScheduleCount: 0,
  scheduledPocketsMovedInMonth: null,
 },
 pockets: [],
 meta: {
  referenceMonth: month,
  currentMonth: CURRENT_MONTH.slice(0, 7),
  evaluationDate:
   month === CURRENT_MONTH.slice(0, 7) ? EVALUATION_DATE : lastDayOfMonth(month),
  notices: [],
 },
});

// Same signature as getPocketBoard, so the store's import is the only line that
// changes when the endpoint lands.
export const getPocketBoardFixture = (
 month?: string,
): Promise<PocketBoardPayload> =>
 new Promise((resolve) => {
  const key = month ?? CURRENT_MONTH.slice(0, 7);

  setTimeout(() => resolve(BOARDS[key] ?? emptyBoard(key)), LATENCY_MS);
 });
