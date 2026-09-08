// src/fintrack_api/services/overview_services/core/analysisLevels.js

// The two depths a level-2 request can ask for.
//
// Level 2 is one response per domain and not one per analysis, which is the
// one-payload rule the module already follows. That rule has a cost the level-2
// specification names: the analyses of a domain differ enormously in price, and
// a single response makes the expensive one everybody's cost. The parameter is
// how both hold at once — one request, and the caller says how much of it to
// build.
//
// derived is everything the level-1 request ALREADY fetched, reshaped. It adds
// no statement to the round trip: the long series is the same monthly query over
// a wider bound, the pocket rows are the board's own, the reconciliation is
// arithmetic on four figures the card publishes. A caller asking for it pays the
// level-1 price.
//
// full adds the statements that have to be run for the first time — income by
// source, the contribution history, the per-account distributions, the two debt
// legs month by month.
//
// Absent is neither, and that is the default. A request that names no analysis
// gets exactly the level-1 response it got before this parameter existed, so
// nothing already deployed changes shape.
export const ANALYSIS_DERIVED = 'derived';
export const ANALYSIS_FULL = 'full';

// Declared once and read by the validator, so the schema and the services cannot
// hold two different ideas of what a level is — the same argument that keeps the
// six domain names in one list.
export const ANALYSIS_LEVELS = [ANALYSIS_DERIVED, ANALYSIS_FULL];

/**
 * Whether this request asked for the analyses that need their own statements.
 *
 * @param {string|undefined} analysis - the requested level, or undefined
 * @returns {boolean}
 */
export const isFullAnalysis = (analysis) => analysis === ANALYSIS_FULL;

/**
 * Whether this request asked for an analysis section at all.
 *
 * @param {string|undefined} analysis - the requested level, or undefined
 * @returns {boolean}
 */
export const wantsAnalysis = (analysis) => ANALYSIS_LEVELS.includes(analysis);
