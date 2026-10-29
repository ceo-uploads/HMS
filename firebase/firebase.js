'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_FILES = Object.freeze({
	a: 'project-a.js',
	b: 'project-b.js',
	c: 'project-c.js',
	d: 'project-d.js'
});

const DATA_PATHS = Object.freeze({
	clinicalTests: { project: 'a', path: 'hmss/v1/clinicalTests/labOrders' },
	cabinBookings: { project: 'b', path: 'hmss/v1/cabinBookings/bookings' },
	roomClaims: { project: 'c', path: 'hmss/v1/roomBills/claims' },
	appointments: { project: 'd', path: 'hmss/v1/otherRecords/appointments' },
	doctors: { project: 'd', path: 'hmss/v1/otherRecords/doctors' },
	referrers: { project: 'd', path: 'hmss/v1/otherRecords/referrals' },
	agents: { project: 'd', path: 'hmss/v1/otherRecords/agents' }
});

function readConfigValue(source, name) {
	const match = source.match(new RegExp(`\\b${name}\\s*:\\s*(['"])(.*?)\\1`));
	return match?.[2] || '';
}

async function loadProjectConfigs(directory) {
	const entries = await Promise.all(Object.entries(PROJECT_FILES).map(async ([project, filename]) => {
		const source = await fs.readFile(path.join(directory, filename), 'utf8');
		const config = {
			apiKey: readConfigValue(source, 'apiKey'),
			databaseURL: readConfigValue(source, 'databaseURL')
		};
		if (!config.apiKey || !/^https:\/\/[^/]+\/?$/.test(config.databaseURL)) {
			throw new Error(`Firebase project ${project.toUpperCase()} needs a valid API key and HTTPS Realtime Database URL.`);
		}
		return [project, config];
	}));
	return Object.fromEntries(entries);
}

function safeErrorMessage(error, apiKey = '') {
	return String(error?.message || error || 'Unknown Firebase error')
		.replace(apiKey, '[redacted]')
		.replace(/[\r\n]/g, ' ')
		.slice(0, 300);
}

function validQueueEntry(entry) {
	const destination = DATA_PATHS[entry?.kind];
	return Boolean(destination
		&& entry.project === destination.project
		&& entry.path === destination.path
		&& entry.id === `${entry.kind}:${entry.payload?.id}`
		&& typeof entry.payload?.id === 'string'
		&& entry.payload.id.length > 0
		&& typeof entry.createdAt === 'string'
		&& Number.isInteger(entry.attempts)
		&& entry.attempts >= 0);
}

function createFirebaseSync({ file, configs, fetchImpl = globalThis.fetch, now = () => new Date() }) {
	if (typeof fetchImpl !== 'function') throw new Error('Firebase synchronization requires the Fetch API.');
	let state = null;
	let pendingWrite = Promise.resolve();
	let retryPromise = null;

	async function saveState() {
		await fs.mkdir(path.dirname(file), { recursive: true });
		const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
		await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf8');
		await fs.rename(temporary, file);
	}

	async function ensureLoaded() {
		if (state) return;
		try {
			const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
			if (parsed?.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.some(entry => !validQueueEntry(entry))) {
				throw new Error('Unsupported or invalid Firebase sync queue format.');
			}
			state = { version: 1, entries: parsed.entries, lastSuccessAt: parsed.lastSuccessAt || null, lastError: parsed.lastError || null };
		} catch (error) {
			if (error.code !== 'ENOENT') throw new Error(`Could not load Firebase sync queue: ${error.message}`);
			state = { version: 1, entries: [], lastSuccessAt: null, lastError: null };
			await saveState();
		}
	}

	function serializeWrite(work) {
		const next = pendingWrite.then(work);
		pendingWrite = next.catch(() => {});
		return next;
	}

	async function enqueue(kind, payload) {
		const destination = DATA_PATHS[kind];
		if (!destination) throw new Error(`Firebase sync does not support the "${kind}" record type.`);
		if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.id !== 'string' || !payload.id) {
			throw new Error('Firebase sync requires a record with a stable ID.');
		}
		return serializeWrite(async () => {
			await ensureLoaded();
			if (state.entries.some(entry => entry.kind === kind && entry.payload.id === payload.id)) {
				return { queued: false, duplicate: true, pending: state.entries.length };
			}
			state.entries.push({
				id: `${kind}:${payload.id}`,
				kind,
				project: destination.project,
				path: destination.path,
				payload: structuredClone(payload),
				createdAt: now().toISOString(),
				attempts: 0
			});
			state.lastError = null;
			await saveState();
			return { queued: true, duplicate: false, pending: state.entries.length };
		});
	}

	async function requestJson(url, options, apiKey) {
		let response;
		try {
			response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15000) });
		} catch (error) {
			throw new Error(`Network request failed: ${safeErrorMessage(error, apiKey)}`);
		}
		let body;
		try {
			body = await response.json();
		} catch (error) {
			throw new Error(`Firebase returned an unreadable response (HTTP ${response.status}): ${safeErrorMessage(error, apiKey)}`);
		}
		if (!response.ok) {
			const serverMessage = typeof body?.error?.message === 'string' ? body.error.message : `HTTP ${response.status}`;
			throw new Error(`Firebase rejected the request: ${safeErrorMessage(serverMessage, apiKey)}`);
		}
		return body;
	}

	async function createAnonymousToken(project) {
		const config = configs[project];
		if (!config) throw new Error(`Firebase project ${project.toUpperCase()} is not configured.`);
		const identity = await requestJson(
			`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
			{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) },
			config.apiKey
		);
		if (typeof identity.idToken !== 'string' || !identity.idToken) throw new Error(`Firebase project ${project.toUpperCase()} did not return an anonymous sign-in token.`);
		return identity.idToken;
	}

	async function pushEntry(entry, token) {
		const config = configs[entry.project];
		const endpoint = `${config.databaseURL.replace(/\/+$/, '')}/${entry.path}.json?auth=${encodeURIComponent(token)}`;
		await requestJson(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(entry.payload)
		}, config.apiKey);
	}

	async function retry() {
		if (retryPromise) return retryPromise;
		retryPromise = serializeWrite(async () => {
			await ensureLoaded();
			const errors = [];
			const tokens = new Map();
			for (const entry of [...state.entries]) {
				try {
					if (!tokens.has(entry.project)) tokens.set(entry.project, await createAnonymousToken(entry.project));
					await pushEntry(entry, tokens.get(entry.project));
					state.entries = state.entries.filter(item => item.id !== entry.id);
					state.lastSuccessAt = now().toISOString();
					state.lastError = null;
					await saveState();
				} catch (error) {
					entry.attempts += 1;
					entry.lastAttemptAt = now().toISOString();
					entry.lastError = safeErrorMessage(error, configs[entry.project]?.apiKey);
					state.lastError = `Project ${entry.project.toUpperCase()}: ${entry.lastError}`;
					errors.push(state.lastError);
					await saveState();
					tokens.delete(entry.project);
				}
			}
			if (errors.length) throw new Error(errors.join(' · '));
			return {
				pending: state.entries.length,
				byProject: Object.fromEntries(Object.keys(PROJECT_FILES).map(project => [project, state.entries.filter(entry => entry.project === project).length])),
				lastSuccessAt: state.lastSuccessAt,
				lastError: state.lastError,
				ready: Boolean(state.entries.length)
			};
		}).finally(() => { retryPromise = null; });
		return retryPromise;
	}

	async function status() {
		await ensureLoaded();
		return {
			pending: state.entries.length,
			byProject: Object.fromEntries(Object.keys(PROJECT_FILES).map(project => [project, state.entries.filter(entry => entry.project === project).length])),
			lastSuccessAt: state.lastSuccessAt,
			lastError: state.lastError,
			ready: Boolean(state.entries.length)
		};
	}

	return { enqueue, retry, status };
}

module.exports = { createFirebaseSync, loadProjectConfigs, PROJECT_FILES, DATA_PATHS };