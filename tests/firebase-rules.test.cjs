'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../firebase/database.rules.json').rules;

const authorizedReader = "auth != null && auth.token.firebase.sign_in_provider === 'google.com' && auth.token.email_verified === true && auth.token.email === 'privatehospitalkabirhat@gmail.com'";
const anonymousAppend = "auth != null && auth.token.firebase.sign_in_provider === 'anonymous' && !data.exists()";
const readPaths = [
	['clinicalTests', 'labOrders'],
	['cabinBookings', 'bookings'],
	['roomBills', 'claims'],
	['otherRecords', 'appointments'],
	['otherRecords', 'doctors'],
	['otherRecords', 'referrals'],
	['otherRecords', 'agents']
];

test('Firebase rules deny broad access and limit reads to the authorized Google account', () => {
	assert.equal(rules['.read'], false);
	assert.equal(rules['.write'], false);
	assert.equal(rules.hmss['.read'], false);
	assert.equal(rules.hmss['.write'], false);
	assert.equal(rules.hmss.v1['.read'], false);
	assert.equal(rules.hmss.v1['.write'], false);

	for (const path of readPaths) {
		const collection = path.reduce((value, key) => value[key], rules.hmss.v1);
		assert.equal(collection['.read'], authorizedReader);
		assert.equal(collection['.write'], undefined);
		assert.equal(collection.$record['.write'], anonymousAppend);
		assert.equal(collection.$record['.validate'].includes('newData.hasChildren'), true);
	}
});
