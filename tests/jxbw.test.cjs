'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../js/jxbw');

test('finds substrings in the correct JSON records', () => {
	const records = [
		{ id: 'LAB-1', patient: 'Amina Rahman', test: 'Blood count' },
		{ id: 'APT-2', patient: 'Farhan Ahmed', test: 'Cardiology' },
		{ id: 'CAB-3', patient: 'Nusrat Jahan', test: 'Cabin booking' }
	];
	const index = build(records.map(record => [record, Object.values(record).join(' ').toLowerCase()]));

	assert.deepEqual([...index.matches('rahman')], [records[0]]);
	assert.deepEqual([...index.matches('cabin booking')], [records[2]]);
	assert.equal(index.matches('no such patient').size, 0);
});

test('supports Unicode substrings and repeated values', () => {
	const first = { id: 'A', value: 'Kabirhat private hospital' };
	const second = { id: 'B', value: 'বাংলা patient record' };
	const index = build([[first, first.value.toLowerCase()], [second, second.value.toLowerCase()]]);

	assert.deepEqual([...index.matches('private hospital')], [first]);
	assert.deepEqual([...index.matches('বাংলা')], [second]);
	assert.deepEqual(new Set(index.matches('a')), new Set([first, second]));
});