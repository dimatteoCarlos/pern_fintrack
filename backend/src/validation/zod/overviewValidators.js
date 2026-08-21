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

// The domains this phase actually computes. Kept separate from the list above so
// the URL space matches the frozen contract while the controller can answer 501
// for a domain whose calculator is not written yet — a 400 there would tell the
// caller the domain is invalid, which is a different and false statement.
export const IMPLEMENTED_OVERVIEW_DOMAINS = ['expense', 'income', 'pnl'];

// Pagination defaults and ceiling for the transaction list.
//
// The cap exists because pageSize arrives from the client: without it a single
// request could ask for every transaction the account ever had. 20 is the page
// the list renders; 100 is the largest one the endpoint will build.
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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
}).strict();
