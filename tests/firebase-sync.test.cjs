'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createFirebaseSync, DATA_PATHS, loadProjectConfigs } = require('../firebase/firebase');

async function temporaryFile(t) {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hmss-firebase-'));
	t.after(() => fs.rm(directory, { recursive: true, force: true }));
	return path.join(directory, 'queue.json');
}

function testConfigs() {
	return Object.fromEntries(['a', 'b', 'c', 'd'].map(project => [project, {
		apiKey: `private-test-key-${project}`,
		databaseURL: `https://${project}.example.test`
	}]));
}

function response(body, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('routes each new record category to its assigned Firebase project and path', () => {
	assert.deepEqual(DATA_PATHS, {
		clinicalTests: { project: 'a', path: 'hmss/v1/clinicalTests/labOrders' },
		cabinBookings: { project: 'b', path: 'hmss/v1/cabinBookings/bookings' },
		roomClaims: { project: 'c', path: 'hmss/v1/roomBills/claims' },
		appointments: { project: 'd', path: 'hmss/v1/otherRecords/appointments' },
		doctors: { project: 'd', path: 'hmss/v1/otherRecords/doctors' },
		referrers: { project: 'd', path: 'hmss/v1/otherRecords/referrals' },
		agents: { project: 'd', path: 'hmss/v1/otherRecords/agents' }
	});
});

test('persists offline records, deduplicates them, then retries authenticated append requests', async t => {
	const file = await temporaryFile(t);
	const requests = [];
	let online = false;
	const sync = createFirebaseSync({
		file,
		configs: testConfigs(),
		now: () => new Date('2026-03-15T12:00:00.000Z'),
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			if (url.startsWith('https://identitytoolkit.googleapis.com/')) return response({ idToken: 'test-token' });
			if (!online) throw new TypeError('offline');
			return response({ name: '-remote-record' });
		}
	});
	const record = { id: 'LAB-1', billId: 'P1234', patientName: 'Patient', createdAt: '2026-03-15T12:00:00.000Z' };

	assert.deepEqual(await sync.enqueue('clinicalTests', record), { queued: true, duplicate: false, pending: 1 });
	assert.deepEqual(await sync.enqueue('clinicalTests', record), { queued: false, duplicate: true, pending: 1 });
	assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).entries[0].payload, record);
	await assert.rejects(sync.retry(), /Network request failed: offline/);
	assert.equal((await sync.status()).pending, 1);
	assert.equal((await sync.status()).byProject.a, 1);

	online = true;
	const restartedSync = createFirebaseSync({
		file,
		configs: testConfigs(),
		now: () => new Date('2026-03-15T12:00:00.000Z'),
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return url.startsWith('https://identitytoolkit.googleapis.com/')
				? response({ idToken: 'test-token' })
				: response({ name: '-remote-record' });
		}
	});
	assert.equal((await restartedSync.status()).pending, 1);
	assert.equal((await restartedSync.retry()).pending, 0);
	assert.deepEqual(requests.map(item => item.options.method), ['POST', 'POST', 'POST', 'POST']);
	assert.ok(requests[3].url.startsWith('https://a.example.test/hmss/v1/clinicalTests/labOrders.json?auth='));
	assert.equal(JSON.parse(requests[3].options.body).id, 'LAB-1');
	assert.ok(requests.every(item => item.options.method !== 'GET'));
	assert.equal((await restartedSync.status()).lastSuccessAt, '2026-03-15T12:00:00.000Z');
});

test('keeps denied writes queued and reports the Firebase error without exposing API keys', async t => {
	const file = await temporaryFile(t);
	const configs = testConfigs();
	const sync = createFirebaseSync({
		file,
		configs,
		fetchImpl: async url => url.startsWith('https://identitytoolkit.googleapis.com/')
			? response({ idToken: 'token' })
			: response({ error: { message: 'Permission denied' } }, 401)
	});
	await sync.enqueue('roomClaims', { id: 'RCPT-1', claimId: 'RCPT-1', roomId: 'R-1', amount: 100, billingMonth: '2026-03', createdAt: '2026-03-15T12:00:00.000Z' });

	await assert.rejects(sync.retry(), /Permission denied/);
	const status = await sync.status();
	assert.equal(status.pending, 1);
	assert.match(status.lastError, /Project C/);
	assert.doesNotMatch(status.lastError, /private-test-key/);
});

test('loads only Firebase API keys and RTDB URLs from the four SDK config files', async t => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hmss-sdk-config-'));
	t.after(() => fs.rm(directory, { recursive: true, force: true }));
	for (const [project, suffix] of [['a', 'one'], ['b', 'two'], ['c', 'three'], ['d', 'four']]) {
		await fs.writeFile(path.join(directory, `project-${project}.js`),
			`const firebaseConfig = { apiKey: "test-${suffix}", databaseURL: "https://${suffix}.example.test" };`);
	}

	const configs = await loadProjectConfigs(directory);
	assert.deepEqual(Object.keys(configs), ['a', 'b', 'c', 'd']);
	assert.deepEqual(configs.a, { apiKey: 'test-one', databaseURL: 'https://one.example.test' });
});
