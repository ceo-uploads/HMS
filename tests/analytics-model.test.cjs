'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { doctorMetrics, getPeriodStart, summarizeRecords } = require('../js/analytics-model');

test('counts referred test units and distinct patients across periods', () => {
	const now = new Date(2026, 9, 25, 12);
	const today = new Date(2026, 9, 25, 9).toISOString();
	const thisWeek = new Date(2026, 9, 20, 9).toISOString();
	const thisMonth = new Date(2026, 9, 2, 9).toISOString();
	const older = new Date(2026, 8, 30, 9).toISOString();
	const doctors = [{ id: 'D1' }, { id: 'D2' }];
	const orders = [
		{ createdAt: today, doctorIds: ['D1', 'D1'], patientName: 'A', contact: '017 000', tests: [{}, {}] },
		{ createdAt: thisWeek, doctors: [{ id: 'D1' }, { id: 'D2' }], patientName: 'B', contact: '017 111', tests: [{}] },
		{ createdAt: thisMonth, doctorIds: ['D1'], patientName: 'A', contact: '017 000', tests: [{}, {}] },
		{ createdAt: older, doctorIds: ['D2'], patientName: 'C', contact: '017 222', tests: [{}] },
		{ createdAt: today, doctorIds: [], patientName: 'D', tests: [{}] }
	];

	const result = doctorMetrics(doctors, orders, now);

	assert.deepEqual(result.get('D1'), {
		today: { tests: 2, patients: 1 },
		week: { tests: 3, patients: 2 },
		month: { tests: 5, patients: 2 },
		all: { tests: 5, patients: 2 }
	});
	assert.deepEqual(result.get('D2'), {
		today: { tests: 0, patients: 0 },
		week: { tests: 1, patients: 1 },
		month: { tests: 1, patients: 1 },
		all: { tests: 2, patients: 2 }
	});
});

test('period starts use local calendar boundaries', () => {
	const now = new Date(2026, 9, 25, 12);

	assert.equal(getPeriodStart('today', now).getDate(), 25);
	assert.equal(getPeriodStart('week', now).getDate(), 19);
	assert.equal(getPeriodStart('month', now).getDate(), 1);
	assert.equal(getPeriodStart('year', now).getMonth(), 0);
	assert.equal(getPeriodStart('all', now), null);
});

test('summarizes money, workflow, repeat visits, payment status and demographics', () => {
	const result = summarizeRecords([
		{ kind: 'labOrders', patientKey: 'contact:1', age: '12', gender: 'Female', net: 1000, advance: 600, due: 400, status: 'Pending', tests: [{}] },
		{ kind: 'appointments', patientKey: 'contact:1', age: '42', gender: 'Female', price: 500, status: 'Completed', doctorId: 'D1' },
		{ kind: 'bookings', patientKey: 'contact:2', age: '68', gender: 'Male', net: 1500, advance: 1500, due: 0, status: 'Occupied', cabinId: 'C1' },
		{ kind: 'labOrders', patientKey: 'contact:3', status: 'Delivered', tests: [{}] }
	]);

	assert.equal(result.net, 3000);
	assert.equal(result.received, 2100);
	assert.equal(result.due, 900);
	assert.equal(result.collectionRate, 70);
	assert.equal(result.averageBill, 750);
	assert.equal(result.paidRecords, 2);
	assert.equal(result.outstandingRecords, 2);
	assert.equal(result.patients, 3);
	assert.equal(result.repeatPatients, 1);
	assert.deepEqual(result.workflows, { diagnostics: 2, appointments: 1, admissions: 1, roomPayments: 0 });
	assert.deepEqual(result.ageBands, { '0–17': 1, '18–35': 0, '36–59': 1, '60+': 1, 'Not recorded': 1 });
	assert.deepEqual(result.genders, { Female: 2, Male: 1, 'Not recorded': 1 });
});

test('summarizes room payment activity independently from patient services', () => {
	const result = summarizeRecords([
		{ kind: 'roomClaims', patientName: 'Room 1 · Ground floor', net: 4000, advance: 4000, due: 0, status: 'Received' },
		{ kind: 'roomClaims', patientName: 'Room 1 · Ground floor', net: 8000, advance: 8000, due: 0, status: 'Received' }
	]);

	assert.equal(result.roomPayments, 12000);
	assert.deepEqual(result.workflows, { diagnostics: 0, appointments: 0, admissions: 0, roomPayments: 2 });
	assert.equal(result.received, 12000);
	assert.equal(result.patients, 0);
});

test('empty analytics safely produce zero rates and amounts', () => {
	const result = summarizeRecords([]);

	assert.equal(result.collectionRate, 0);
	assert.equal(result.averageBill, 0);
	assert.equal(result.repeatPatients, 0);
	assert.equal(result.patients, 0);
});
