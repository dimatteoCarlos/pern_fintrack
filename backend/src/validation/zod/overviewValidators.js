// src/validation/zod/overviewValidators.js

// Overview validators – Zod schemas for GET /overview/:domain.
//
// Same two rules as the budget module, for the same reasons. Every schema is
// strict: a retired parameter answers 400 naming the key instead of being
// stripped and computed over silently. And no schema checks whether a month is
// ALLOWED — later than the current one is a 422 the service raises, because the
// ceiling is a query on the owner's calendar and a schema cannot see it.
//
// monthBound is imported, not restated: the coercion truncates text and never
// builds a Date, and a second copy of that rule could drift from the one the
// budget endpoints use.

import { z } from 'zod';
import { monthBound } from './budgetValidators.js';
import { ANALYSIS_LEVELS } from '../../fintrack_api/services/overview_services/core/analysisLevels.js';

// The six domains of §3 of the contract. A literal list rather than a catalog
// read: a domain is a calculator this module either has or does not have, not a
// row someone can add to a table.
export const OVERVIEW_DOMAINS = [
 'income',
 'expense',
 'investment',
 'debt',
 'pocket',
 'pnl',
];

// Which of them have a calculator is not stated here. A second list saying so
// could only drift from the dispatch map that actually decides, so the
// controller asks the map, which cannot be wrong about itself. The 501 branch
// stays: it is the correct answer the day a seventh domain joins the contract
// before its calculator exists.

// Pagination defaults and ceiling for the transaction list.
//
// The cap exists because pageSize arrives from the client: without it a single
// request could ask for every transaction the account ever had. 20 is the page
// the list renders; 100 is the largest one the endpoint will build.
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Recent activity keeps its own default page, and it is the size of the teaser
// the page carries. A caller that sends no parameter at all gets exactly what
// GET /overview publishes, so the endpoint can be adopted without the list
// changing under the reader on the first request. The ceiling is the shared one:
// the reason for a cap is that pageSize arrives from the client, and that reason
// does not vary by endpoint.
const DEFAULT_ACTIVITY_PAGE_SIZE = 5;

/**
 * GET /overview/:domain
 * Params: domain (one of the six the contract defines)
 */
export const overviewDomainParamsSchema = z.object({
 domain: z.enum(OVERVIEW_DOMAINS, {
  message: `domain must be one of: ${OVERVIEW_DOMAINS.join(', ')}`,
 }),
}).strict();

/**
 * GET /overview
 * Query: month (optional, past only)
 *
 * No page and no pageSize, and the schema is strict, so sending either answers
 * 400 naming the key. That is the obligation of §11 enforced at the door: the
 * page carries no paginated list, so a caller asking for page 2 of it is asking
 * for something that does not exist and deserves to be told so.
 */
export const overviewPageQuerySchema = z.object({
 month: monthBound.optional(),
}).strict();

/**
 * GET /overview/:domain
 * Query: month (optional, past only), page, pageSize
 *
 * page and pageSize carry defaults rather than being optional: the response
 * always reports the window it served, so a caller that sent neither still gets
 * back the page it is looking at instead of having to assume one.
 */
export const overviewDomainQuerySchema = z.object({
 month: monthBound.optional(),
 page: z.coerce.number().int().positive({
  message: 'page must be a positive integer',
 }).default(DEFAULT_PAGE),
 pageSize: z.coerce.number().int().positive({
  message: 'pageSize must be a positive integer',
 }).max(MAX_PAGE_SIZE, {
  message: `pageSize must not exceed ${MAX_PAGE_SIZE}`,
 }).default(DEFAULT_PAGE_SIZE),
 // The depth of the level-2 section, and the one query parameter with no
 // default: absent means no analysis, so a client that has not been updated
 // receives exactly the payload it received before this existed. The levels are
 // imported and never restated — a second list of them here could only drift
 // from the one the builders read.
 //
 // An unrecognised value answers 400 naming the key rather than being read as
 // "no analysis". Asking for a depth this server does not have is a mistake, and
 // silently serving a shallower payload would look like an empty result.
 analysis: z.enum(ANALYSIS_LEVELS, {
  message: `analysis must be one of: ${ANALYSIS_LEVELS.join(', ')}`,
 }).optional(),
}).strict();
/**
 * GET /overview/activity
 * Query: from (optional), to (optional), page, pageSize
 *
 * The one section of the contract whose period the READER chooses. Every other
 * figure of this module is bound to the reference month; recent activity answers
 * "what do I want to read", which is a different question from "what happened in
 * the month I am studying" and cannot be derived from it.
 *
 * Both bounds are optional and the default is UNBOUNDED, which is the behaviour
 * the page's teaser already has: it answers what happened last, not what
 * happened in the month being studied. A user reading a month from last year
 * would otherwise open the section and find it empty.
 *
 * to is a month and it is INCLUSIVE — the whole of it, not its first day. Naming
 * a month as an upper bound and getting one day of it back is the trap a caller
 * cannot see, because the response looks like a real answer.
 *
 * The ordering check is a refine and not a service rule: from later than to is a
 * contradiction inside the request, which is exactly what a schema can see, and
 * it answers 400 rather than returning an empty page that looks like an owner
 * with no movements.
 */
export const overviewActivityQuerySchema = z.object({
 from: monthBound.optional(),
 to: monthBound.optional(),
 page: z.coerce.number().int().positive({
  message: 'page must be a positive integer',
 }).default(DEFAULT_PAGE),
 pageSize: z.coerce.number().int().positive({
  message: 'pageSize must be a positive integer',
 }).max(MAX_PAGE_SIZE, {
  message: `pageSize must not exceed ${MAX_PAGE_SIZE}`,
 }).default(DEFAULT_ACTIVITY_PAGE_SIZE),
}).strict().refine(
 (query) => !query.from || !query.to || query.from <= query.to,
 {
  message: 'from must not be later than to',
  path: ['from'],
 },
);
