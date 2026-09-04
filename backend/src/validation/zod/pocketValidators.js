// src/validation/zod/pocketValidators.js

// Pocket validators – Zod schemas for API request validation.
// Validates URL parameters and bodies before they reach the controller.

import { z } from 'zod';
// The one list of codes the FX state can price. Imported rather than repeated:
// a schema that accepted a code the converter cannot resolve would turn a typo
// into a 500 at write time.
import { SUPPORTED_CURRENCIES } from '../../fintrack_api/services/fx_services/core/fxConfig.js';
// The month coercion the budget module already owns. Imported rather than
// restated: it truncates the text to the first of the month and never builds a
// Date, which is the only reason a month parameter cannot shift a day west of
// UTC. A second copy of that regex is a second chance to get it wrong.
import { monthBound } from './budgetValidators.js';

// Every schema here is strict, for the reason budgetValidators states: Zod
// strips an unknown key silently, so a caller still sending a retired field —
// amount instead of targetAmount, a sign on a release — would get a 200 computed
// over something it never asked for. Strict turns that into a 400 naming the key.

// A calendar date with no instant in it. Parsed nowhere in this file: a Date
// built from 'YYYY-MM-DD' is UTC midnight, and reading it back through a local
// getter lands on the day before west of UTC. The column is a DATE and the text
// reaches it unchanged.
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const calendarDate = z.string().regex(DATE_PATTERN, {
 message: 'must be a date as YYYY-MM-DD',
});

// The currency the figure is typed in, which is not necessarily the one it is
// stored in. Required on every write, with no default: a default is what let the
// budget editor read every figure as the accounting currency and store 50000 cop
// as 50000 usd, the defect migration 014 documents.
const typedCurrency = z
 .string()
 .trim()
 .toLowerCase()
 .refine((code) => SUPPORTED_CURRENCIES.includes(code), {
  message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
 });

// Both write endpoints take a POSITIVE amount and the client never sends a sign.
// A contract where releasing means sending -100 is one typo away from inverting
// a financial decision, and no validator can tell an intended negative from a
// slipped one. Release writes the row negative on the server.
const positiveAmount = z.number().positive({
 message: 'amount must be greater than zero',
});

/**
 * Any route carrying /:pocketId.
 */
export const pocketParamsSchema = z
 .object({
  pocketId: z.coerce.number().int().positive({
   message: 'pocketId must be a positive integer',
  }),
 })
 .strict();

/**
 * POST /pocket
 * Body: name, note (optional), targetAmount, currency, desiredDate.
 *
 * No source account and no money: a pocket is created empty and the screen then
 * offers to allocate. targetAmount and desiredDate are both required, because a
 * savings plan with no figure to reach or no date to reach it by cannot be
 * measured against anything, and every pace figure divides by the second.
 */
export const createPocketBodySchema = z
 .object({
  name: z.string().trim().min(1, { message: 'name is required' }).max(50, {
   message: 'name must be at most 50 characters',
  }),
  note: z
   .string()
   .trim()
   .max(155, { message: 'note must be at most 155 characters' })
   .optional(),
  targetAmount: positiveAmount,
  currency: typedCurrency,
  desiredDate: calendarDate,
 })
 .strict();

/**
 * PATCH /pocket/:pocketId
 * Body: any of name, note, targetAmount, currency, desiredDate.
 *
 * currency is accepted only beside targetAmount: it names the unit the new
 * target is typed in, never a change to the unit the pocket is kept in. Changing
 * that would restate every past allocation, so it is not editable at all.
 *
 * At least one field, so an empty body is a 400 rather than a write that touches
 * nothing and answers 200.
 */
export const updatePocketBodySchema = z
 .object({
  name: z
   .string()
   .trim()
   .min(1, { message: 'name must not be empty' })
   .max(50, { message: 'name must be at most 50 characters' })
   .optional(),
  // Nullable on purpose: null clears the note, where an absent key leaves it
  // alone. Collapsing the two would make "remove this note" unexpressible.
  note: z
   .string()
   .trim()
   .max(155, { message: 'note must be at most 155 characters' })
   .nullable()
   .optional(),
  targetAmount: positiveAmount.optional(),
  currency: typedCurrency.optional(),
  desiredDate: calendarDate.optional(),
 })
 .strict()
 .refine((body) => Object.keys(body).length > 0, {
  message: 'at least one field must be sent',
 })
 .refine((body) => body.targetAmount === undefined || body.currency !== undefined, {
  message: 'currency is required when targetAmount is sent',
  path: ['currency'],
 });

/**
 * POST /pocket/:pocketId/allocations and POST /pocket/:pocketId/releases
 *
 * One schema for both: the two requests are the same decision with opposite
 * effect, and the difference is the endpoint, never a sign in the payload.
 *
 * allocationDate is optional and defaults to now. It is when the decision was
 * taken, not when the row is written, so a set-aside agreed on Friday and typed
 * on Monday can still be dated Friday.
 */
export const allocationBodySchema = z
 .object({
  sourceAccountId: z.coerce.number().int().positive({
   message: 'sourceAccountId must be a positive integer',
  }),
  amount: positiveAmount,
  currency: typedCurrency,
  allocationDate: calendarDate.optional(),
 })
 .strict();

/**
 * GET /api/fintrack/pocket/board?month=YYYY-MM
 *
 * Optional, and the omission means the current month. Present, it must not be
 * later than that — a 422 the handler raises, because a schema cannot see the
 * owner's calendar and the current month never travels from the client.
 *
 * A full date is accepted and truncated to its month, which is what monthBound
 * does for every other month parameter in the app: the board reads a month, and
 * any day inside it names the same window.
 */
export const boardQuerySchema = z
 .object({
  month: monthBound.optional(),
 })
 .strict();
