// Contract tests for the change against the prior year's December close.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeYearStartChange } from '../../src/fintrack_api/services/overview_services/core/makeYearStartChange.js';

test('the change is the reference close minus the prior December close', () => {
 assert.equal(makeYearStartChange(1650, 1200), 450);
});

test('an account opened during the year reads its full balance as the change', () => {
 // December closed at 0 because the account did not exist yet, so the change
 // is its whole current balance.
 assert.equal(makeYearStartChange(500, 0), 500);
});

test('in January, the change is January close minus December close, never null', () => {
 assert.equal(makeYearStartChange(300, 250), 50);
});

test('a null current close propagates as null', () => {
 assert.equal(makeYearStartChange(null, 1000), null);
});

test('a null prior close propagates as null', () => {
 assert.equal(makeYearStartChange(1000, null), null);
});
