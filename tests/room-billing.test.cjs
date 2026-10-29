'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { currentBill, currentMonth, ensureCurrentBills, recordPayment } = require('../js/room-billing');

function createData() {
	return {
		floors: [{ id: 'F-1', name: 'Ground floor' }],
		rooms: [{ id: 'R-1', floorId: 'F-1', name: 'Room 1', monthlyAmount: 12000 }],
		roomBills: [],
		roomClaims: []
	};
}

test('creates one due bill per room for each local calendar month without changing history', () => {
	const data = createData();
	const january = new Date(2026, 0, 31, 12);
	const february = new Date(2026, 1, 1, 12);

	assert.equal(currentMonth(january), '2026-01');
	assert.equal(ensureCurrentBills(data, january), 1);
	assert.equal(ensureCurrentBills(data, january), 0);
	data.rooms[0].monthlyAmount = 12500;
	assert.equal(ensureCurrentBills(data, february), 1);
	assert.equal(data.roomBills.length, 2);
	assert.deepEqual(data.roomBills.map(bill => [bill.billingMonth, bill.monthlyAmount, bill.status]), [
		['2026-01', 12000, 'Due'],
		['2026-02', 12500, 'Due']
	]);
});

test('records partial payments and clears the monthly bill only when fully paid', () => {
	const data = createData();
	const now = new Date(2026, 2, 15, 9);
	ensureCurrentBills(data, now);

	const first = recordPayment(data, 'R-1', 4000, { id: 'RCPT-1', paymentMethod: 'Cash' }, now);
	assert.equal(first.amount, 4000);
	assert.equal(first.kind, 'roomClaims');
	assert.equal(first.billingMonth, '2026-03');
	assert.equal(currentBill(data, 'R-1', now).status, 'Due');
	assert.equal(currentBill(data, 'R-1', now).received, 4000);

	recordPayment(data, 'R-1', 8000, { id: 'RCPT-2', paymentMethod: 'Bank transfer' }, now);
	assert.equal(currentBill(data, 'R-1', now).status, 'Cleared');
	assert.equal(currentBill(data, 'R-1', now).received, 12000);
	assert.equal(data.roomClaims.reduce((sum, payment) => sum + payment.amount, 0), 12000);
});

test('rejects unknown rooms, non-positive payments, and amounts above the balance', () => {
	const data = createData();
	const now = new Date(2026, 3, 5);
	ensureCurrentBills(data, now);

	assert.throws(() => recordPayment(data, 'missing-room', 100, {}, now), /no longer exists/);
	assert.throws(() => recordPayment(data, 'R-1', 0, {}, now), /greater than zero/);
	assert.throws(() => recordPayment(data, 'R-1', 12001, {}, now), /cannot exceed/);
	assert.equal(data.roomClaims.length, 0);
	assert.equal(currentBill(data, 'R-1', now).received, 0);
});
