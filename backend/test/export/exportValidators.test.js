// Contract tests for export_api/validation/exportValidators.js.

import test from 'node:test';
import assert from 'node:assert/strict';

import { exportMovementsQuerySchema } from '../../src/export_api/validation/exportValidators.js';

test('format defaults to csv', () => {
 const result = exportMovementsQuerySchema.parse({});
 assert.equal(result.format, 'csv');
});

test('a single accountId (a bare string from the query) becomes a one-item array', () => {
 const result = exportMovementsQuerySchema.parse({ accountIds: '7' });
 assert.deepEqual(result.accountIds, [7]);
});

test('several accountIds (an array from the query) stay an array of numbers', () => {
 const result = exportMovementsQuerySchema.parse({ accountIds: ['7', '9'] });
 assert.deepEqual(result.accountIds, [7, 9]);
});

test('an explicit empty accountIds is rejected, distinct from omitting it', () => {
 assert.throws(() => exportMovementsQuerySchema.parse({ accountIds: [] }), { name: 'ZodError' });
});

test('from later than to is rejected', () => {
 assert.throws(
  () => exportMovementsQuerySchema.parse({ from: '2026-09', to: '2026-01' }),
  { name: 'ZodError' },
 );
});

test('an unknown format answers a validation error naming the field', () => {
 try {
  exportMovementsQuerySchema.parse({ format: 'docx' });
  assert.fail('expected a ZodError');
 } catch (error) {
  assert.equal(error.name, 'ZodError');
  assert.ok(error.issues.some((issue) => issue.path.includes('format')));
 }
});

test('a retired parameter is rejected by the strict schema', () => {
 assert.throws(() => exportMovementsQuerySchema.parse({ page: 2 }), { name: 'ZodError' });
});
