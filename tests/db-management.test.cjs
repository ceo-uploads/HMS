'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadDatabase, saveDatabase } = require('../js/db-management');

const filenames = [
	'clinic-test-db.json',
	'doctor-appointment-db.json',
	'cabin-bookings-db.json'
];

function createData() {
	return {
		users: [{ username: 'admin' }],
		tests: [{ id: 'TEST-1' }],
		agents: [{ id: 'AGENT-1' }],
		referrers: [{ id: 'REF-1' }],
		indoorServices: [{ id: 'SERVICE-1' }],
		labOrders: [{ id: 'LAB-1' }],
		doctors: [{ id: 'DOCTOR-1' }],
		appointments: [{ id: 'APPOINTMENT-1' }],
		cabins: [{ id: 'CABIN-1' }],
		bookings: [{ id: 'BOOKING-1' }]
	};
}

async function temporaryDirectory(t) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hmss-database-'));
	t.after(() => fs.rm(directory, { recursive: true, force: true }));
	return directory;
}

test('initializes the three JSON stores and saves records by workflow', async t => {
	const directory = await temporaryDirectory(t);
	const data = createData();
	const loaded = await loadDatabase({ directory, defaults: createData });

	assert.deepEqual(loaded, createData());
	for (const filename of filenames) {
		assert.ok((await fs.stat(path.join(directory, filename))).isFile());
	}

	await saveDatabase({ directory, data });
	assert.deepEqual(await loadDatabase({ directory, defaults: () => ({}) }), data);
	assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, filenames[0]), 'utf8')), {
		users: data.users,
		tests: data.tests,
		agents: data.agents,
		referrers: data.referrers,
		indoorServices: data.indoorServices,
		labOrders: data.labOrders
	});
});

test('migrates the existing single-file database without losing records', async t => {
	const directory = await temporaryDirectory(t);
	const legacyFile = path.join(directory, 'hospital-data.json');
	const existingData = createData();
	existingData.labOrders.push({ id: 'LAB-2' });
	await fs.writeFile(legacyFile, JSON.stringify(existingData), 'utf8');

	const loaded = await loadDatabase({
		directory: path.join(directory, 'Database'),
		legacyFile,
		defaults: () => ({ users: [], tests: [], agents: [], referrers: [], indoorServices: [], labOrders: [], doctors: [], appointments: [], cabins: [], bookings: [] })
	});

	assert.deepEqual(loaded, existingData);
	assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'Database', filenames[0]), 'utf8')).labOrders, existingData.labOrders);
});

test('reports malformed JSON instead of silently replacing the database', async t => {
	const directory = await temporaryDirectory(t);
	await fs.writeFile(path.join(directory, filenames[0]), '{invalid', 'utf8');

	await assert.rejects(
		loadDatabase({ directory, defaults: createData }),
		/Invalid database file/
	);
});
