// Contract tests for the Overview request schemas.
//
// Every schema in this module is strict on purpose: a retired parameter answers
// 400 naming the key instead of being stripped and computed over silently. That
// property is invisible in a response and is exactly what a test can hold.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
 overviewActivityQuerySchema,
 overviewDomainParamsSchema,
 overviewDomainQuerySchema,
 overviewPageQuerySchema,
} from '../../src/validation/zod/overviewValidators.js';

test('the page takes a month and nothing else', () => {
 assert.deepEqual(overviewPageQuerySchema.parse({}), {});
 assert.deepEqual(overviewPageQuerySchema.parse({ month: '2026-08' }), { month: '2026-08-01' });

 // The page carries no paginated list, so a caller asking for page 2 of it is
 // asking for something that does not exist and is told so.
 assert.throws(() => overviewPageQuerySchema.parse({ page: 2 }));
 assert.throws(() => overviewPageQuerySchema.parse({ pageSize: 20 }));
});

test('a month is truncated to the first of the month', () => {
 assert.equal(overviewDomainQuerySchema.parse({ month: '2026-08-17' }).month, '2026-08-01');
});

test('the domain list defaults to the first page of twenty', () => {
 const query = overviewDomainQuerySchema.parse({});

 assert.equal(query.page, 1);
 assert.equal(query.pageSize, 20);
});

test('the domain page size is capped', () => {
 assert.equal(overviewDomainQuerySchema.parse({ pageSize: '100' }).pageSize, 100);
 assert.throws(() => overviewDomainQuerySchema.parse({ pageSize: '101' }));
 assert.throws(() => overviewDomainQuerySchema.parse({ pageSize: '0' }));
});

test('only the six domains of the contract are routed to a calculator', () => {
 for (const domain of ['income', 'expense', 'investment', 'debt', 'pocket', 'pnl']) {
  assert.equal(overviewDomainParamsSchema.parse({ domain }).domain, domain);
 }

 // The activity section is not a domain, and the schema is where that is
 // enforced rather than in the router alone.
 assert.throws(() => overviewDomainParamsSchema.parse({ domain: 'activity' }));
 assert.throws(() => overviewDomainParamsSchema.parse({ domain: 'bank' }));
});

test('activity defaults to an unbounded range and the size of the teaser', () => {
 const query = overviewActivityQuerySchema.parse({});

 assert.equal(query.from, undefined);
 assert.equal(query.to, undefined);
 assert.equal(query.page, 1);
 // The teaser the page publishes is five rows, so a caller that sends nothing
 // gets what GET /overview already shows.
 assert.equal(query.pageSize, 5);
});

test('activity takes either bound on its own', () => {
 assert.equal(overviewActivityQuerySchema.parse({ from: '2026-01' }).from, '2026-01-01');
 assert.equal(overviewActivityQuerySchema.parse({ to: '2026-01' }).to, '2026-01-01');
});

test('activity refuses a range that runs backwards', () => {
 assert.throws(
  () => overviewActivityQuerySchema.parse({ from: '2026-09', to: '2026-08' }),
  /from must not be later than to/,
 );

 // The same month on both ends is a range of one month, not an error.
 const single = overviewActivityQuerySchema.parse({ from: '2026-08', to: '2026-08' });
 assert.equal(single.from, '2026-08-01');
 assert.equal(single.to, '2026-08-01');
});

test('activity shares the page-size ceiling and rejects an unknown parameter', () => {
 assert.equal(overviewActivityQuerySchema.parse({ pageSize: '100' }).pageSize, 100);
 assert.throws(() => overviewActivityQuerySchema.parse({ pageSize: '101' }));

 // limit is the name this endpoint did NOT take. It has to fail loudly, or a
 // caller sending it would silently receive the default five and read that as
 // the whole answer.
 assert.throws(() => overviewActivityQuerySchema.parse({ limit: 20 }));
 assert.throws(() => overviewActivityQuerySchema.parse({ month: '2026-08' }));
});

test('the analysis level is opt-in and absent by default', () => {
 // Absent means no level-2 section, which is what keeps a client that has not
 // been updated receiving exactly the payload it received before.
 assert.equal(overviewDomainQuerySchema.parse({}).analysis, undefined);
 assert.equal(overviewDomainQuerySchema.parse({ analysis: 'derived' }).analysis, 'derived');
 assert.equal(overviewDomainQuerySchema.parse({ analysis: 'full' }).analysis, 'full');
});

test('an unknown analysis level answers 400 naming the key', () => {
 // Served as "no analysis" instead, a typo would return a shallower payload
 // that looks like a domain with nothing to decompose.
 assert.throws(
  () => overviewDomainQuerySchema.parse({ analysis: 'deep' }),
  /analysis must be one of: derived, full/,
 );
 assert.throws(() => overviewDomainQuerySchema.parse({ analysis: '' }));
});

test('the page endpoint takes no analysis level', () => {
 // §11 gives the page no paginated list and no level-2 section: it is the
 // overview of every domain, and a depth parameter there would be a request for
 // six analyses at once.
 assert.throws(() => overviewPageQuerySchema.parse({ analysis: 'derived' }));
});
