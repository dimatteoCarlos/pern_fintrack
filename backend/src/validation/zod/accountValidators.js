// src/validation/zod/accountValidators.js

// Account validators - Zod schemas for API request validation.
// One schema today: the closed-account registry download, which is the only
// endpoint of this module that answers a file instead of JSON.

import { z } from 'zod';
// The one list of writers every export endpoint shares, so none of them can
// offer a format the converters cannot produce.
import {
 EXPORT_FORMATS,
 DEFAULT_EXPORT_FORMAT,
} from '../../utils/fintrackUtils/exportUtils.js';

/**
 * GET /api/fintrack/account/closed/export?format=csv|xlsx&search=&type=&sort=&order=
 *
 * The four filter keys are the ones the list endpoint behind the same screen
 * reads, so the file carries the rows the reader is looking at. They are plain
 * strings and not enums on purpose: getClosedAccountRegistry resolves an
 * unrecognised sort key and an unrecognised order to its defaults rather than
 * raising, and a schema that refused them here would answer 400 where the list
 * answers 200 on the same query string.
 *
 * NO page AND NO limit, and strict is what enforces it. The list caps a page at
 * 20 and a request at 100; this file carries every closure the filter matches,
 * so a caller sending either key gets a 400 naming it rather than a file that
 * silently holds a fifth of the registry.
 *
 * format defaults to csv, the same default the budget, pocket and debt exports
 * carry, and anything outside the two writers is a 400 naming the field.
 */
export const closedAccountExportQuerySchema = z
 .object({
  search: z.string().optional(),
  type: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  format: z
   .enum(EXPORT_FORMATS, {
    message: `format must be one of: ${EXPORT_FORMATS.join(', ')}`,
   })
   .default(DEFAULT_EXPORT_FORMAT),
 })
 .strict();
