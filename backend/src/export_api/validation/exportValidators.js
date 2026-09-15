// backend/src/export_api/validation/exportValidators.js
//
// GET /api/export/movements — Zod schema, strict like every other schema in
// this codebase: a retired parameter answers 400 naming the key.
//
// monthBound is imported, not restated, for the same reason overviewValidators.js
// imports it: a second copy of the coercion could drift from the one every
// other date-bounded endpoint uses.

import { z } from 'zod';
import { monthBound } from '../../validation/zod/budgetValidators.js';
import { MOVEMENT_TYPE_NAMES } from '../../utils/fintrackUtils/transactionManagement/activityFilters.js';

const DEFAULT_FORMAT = 'csv';
const FORMATS = ['csv', 'xlsx'];

// Same ceilings overviewActivityQuerySchema applies to the same fields, for
// the same reasons: a term or a category name longer than this cannot match
// anything stored, so it is refused at the door.
const MAX_SEARCH_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 50;

// A GET query sends one accountId as a bare string and several as repeated
// keys, which qs turns into an array only when there is more than one. This
// normalises both shapes to an array before validation runs, so the schema
// below does not have to know which one arrived.
const toArray = (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

export const exportMovementsQuerySchema = z.object({
 from: monthBound.optional(),
 to: monthBound.optional(),
 search: z.string()
  .trim()
  .min(1, { message: 'search must not be empty' })
  .max(MAX_SEARCH_LENGTH, {
   message: `search must not exceed ${MAX_SEARCH_LENGTH} characters`,
  })
  .optional(),
 movementType: z.enum(MOVEMENT_TYPE_NAMES, {
  message: `movementType must be one of: ${MOVEMENT_TYPE_NAMES.join(', ')}`,
 }).optional(),
 category: z.string()
  .trim()
  .min(1, { message: 'category must not be empty' })
  .max(MAX_CATEGORY_LENGTH, {
   message: `category must not exceed ${MAX_CATEGORY_LENGTH} characters`,
  })
  .optional(),
 // Omitted asks for every account the caller owns; an explicit empty value
 // asks for none, and stays a 400, the same distinction budgetValidators.js
 // draws for the same field (budgetValidators.js:84-95).
 accountIds: z.preprocess(
  toArray,
  z.array(
   z.coerce.number().positive({
    message: 'each accountId must be a positive number',
   }),
  ).min(1, {
   message: 'accountIds must contain at least one account',
  }),
 ).optional(),
 format: z.enum(FORMATS, {
  message: `format must be one of: ${FORMATS.join(', ')}`,
 }).default(DEFAULT_FORMAT),
}).strict().refine(
 (query) => !query.from || !query.to || query.from <= query.to,
 {
  message: 'from must not be later than to',
  path: ['from'],
 },
);
