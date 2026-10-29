'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const DATABASE_GROUPS = [
	['clinic-test-db.json', ['users', 'tests', 'agents', 'referrers', 'indoorServices', 'labOrders']],
	['doctor-appointment-db.json', ['doctors', 'appointments']],
	['cabin-bookings-db.json', ['cabins', 'bookings']],
	['others.json', ['floors', 'rooms', 'roomBills', 'roomClaims']]
];

async function readJsonFile(file) {
	let contents;
	try {
		contents = await fs.readFile(file, 'utf8');
	} catch (error) {
		if (error.code === 'ENOENT') return null;
		throw error;
	}
	if (!contents.trim()) return null;
	try {
		const value = JSON.parse(contents);
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error('Expected a JSON object.');
		}
		return value;
	} catch (error) {
		throw new Error(`Invalid database file "${file}": ${error.message}`);
	}
}

function combineData(defaults, groups) {
	return Object.assign({}, defaults, ...groups);
}

async function loadDatabase({ directory, legacyFile, defaults }) {
	const initialData = typeof defaults === 'function' ? defaults() : defaults;
	const storedGroups = await Promise.all(DATABASE_GROUPS.map(([filename]) => readJsonFile(path.join(directory, filename))));
	const needsInitialization = storedGroups.some((group, index) => {
		const keys = DATABASE_GROUPS[index][1];
		if (!group) return true;
		for (const key of keys) {
			if (group[key] !== undefined && !Array.isArray(group[key])) {
				throw new Error(`Invalid database data in "${DATABASE_GROUPS[index][0]}": "${key}" must be an array.`);
			}
			if (group[key] === undefined) return true;
		}
		return false;
	});

	if (storedGroups.every(group => group === null) && legacyFile) {
		const legacyData = await readJsonFile(legacyFile);
		if (legacyData) {
			const migrated = combineData(initialData, [legacyData]);
			await saveDatabase({ directory, data: migrated });
			return migrated;
		}
	}

	const data = combineData(initialData, storedGroups.map(group => group || {}));
	if (needsInitialization) await saveDatabase({ directory, data });
	return data;
}

async function saveDatabase({ directory, data }) {
	await fs.mkdir(directory, { recursive: true });
	const writes = DATABASE_GROUPS.map(async ([filename, keys]) => {
		const group = {};
		for (const key of keys) {
			if (!Array.isArray(data[key])) throw new Error(`Cannot save database: "${key}" must be an array.`);
			group[key] = data[key];
		}
		const file = path.join(directory, filename);
		const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
		await fs.writeFile(temporary, JSON.stringify(group, null, 2), 'utf8');
		await fs.rename(temporary, file);
	});
	await Promise.all(writes);
	return true;
}

module.exports = { loadDatabase, saveDatabase };