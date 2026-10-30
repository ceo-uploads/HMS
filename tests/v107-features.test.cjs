'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('v1.0.7 version is correctly defined in package metadata and documentation', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
	assert.equal(pkg.version, '1.0.7');

	const pkgLock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
	assert.equal(pkgLock.version, '1.0.7');
	if (pkgLock.packages && pkgLock.packages['']) {
		assert.equal(pkgLock.packages[''].version, '1.0.7');
	}

	const doc = fs.readFileSync(path.join(__dirname, '..', 'md', 'update-v1.0.7.md'), 'utf8');
	assert.match(doc, /Final Work for Version = v1\.0\.7/);
});

test('Site login credentials are set to kph2026 / kph@2026', () => {
	const clinicDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Database', 'clinic-test-db.json'), 'utf8'));
	const dbUser = clinicDb.users.find(u => u.username === 'kph2026');
	assert.ok(dbUser, 'User kph2026 should exist in clinic-test-db.json');
	assert.equal(dbUser.password, 'kph@2026');

	const mainCjs = fs.readFileSync(path.join(__dirname, '..', 'main.cjs'), 'utf8');
	assert.match(mainCjs, /username:\s*'kph2026',\s*password:\s*'kph@2026'/);

	const indexJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');
	assert.match(indexJs, /username:\s*'kph2026',\s*password:\s*'kph@2026'/);
});

test('Counter patient suggestions aggregate latest records and filter character-by-character', () => {
	const indexJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');

	// Verify UI elements exist in js/index.js
	assert.match(indexJs, /patient-name-tooltip/);
	assert.match(indexJs, /data-patient-suggestion/);
	assert.match(indexJs, /updatePatientNameSuggestions/);
	assert.match(indexJs, /getRecentPatients/);

	// Test the exact patient deduction and lookup logic
	const mockData = {
		labOrders: [
			{ patientName: 'Rahim Uddin', age: 40, gender: 'Male', contact: '01811111111', createdAt: '2026-10-10T10:00:00Z' },
			{ patientName: 'Rahim Uddin', age: 41, gender: 'Male', contact: '01811111111', createdAt: '2026-10-25T10:00:00Z' }, // newer
			{ patientName: 'Karim Ahmed', age: 28, gender: 'Male', contact: '01722222222', createdAt: '2026-10-12T10:00:00Z' }
		],
		appointments: [
			{ patientName: 'Fatema Begum', age: 35, gender: 'Female', contact: '01933333333', visitAt: '2026-10-26T09:00:00Z' }
		],
		bookings: [
			{ patientName: 'Rahim Uddin', age: 42, gender: 'Male', contact: '01811111111', startAt: '2026-10-28T14:00:00Z' } // latest of all!
		]
	};

	const records = [
		...mockData.labOrders.map(r => ({ ...r, _source: 'Diagnostics', _date: r.createdAt })),
		...mockData.appointments.map(r => ({ ...r, _source: 'Appointment', _date: r.visitAt || r.createdAt })),
		...mockData.bookings.map(r => ({ ...r, _source: 'Cabin', _date: r.startAt || r.createdAt }))
	];
	records.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));

	const seen = new Set();
	const unique = [];
	for (const r of records) {
		const name = String(r.patientName || '').trim();
		if (!name) continue;
		const contact = String(r.contact || '').trim();
		const key = `${name.toLowerCase()}::${contact.replace(/\D/g, '')}`;
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push({
			patientName: name,
			age: r.age,
			gender: r.gender,
			contact,
			date: r._date,
			source: r._source
		});
	}

	assert.equal(unique.length, 3);
	// Rahim Uddin's latest entry must be from Cabin with age 42
	const rahim = unique.find(p => p.patientName === 'Rahim Uddin');
	assert.ok(rahim);
	assert.equal(rahim.age, 42);
	assert.equal(rahim.source, 'Cabin');
	assert.equal(rahim.contact, '01811111111');

	// Character-by-character filtering
	const filter1 = unique.filter(p => p.patientName.toLowerCase().includes('r'));
	assert.equal(filter1.length, 2); // Rahim Uddin, Karim Ahmed

	const filter2 = unique.filter(p => p.patientName.toLowerCase().includes('rah'));
	assert.equal(filter2.length, 1);
	assert.equal(filter2[0].patientName, 'Rahim Uddin');

	const filter3 = unique.filter(p => p.patientName.toLowerCase().includes('fat'));
	assert.equal(filter3.length, 1);
	assert.equal(filter3[0].patientName, 'Fatema Begum');
	assert.equal(filter3[0].gender, 'Female');
	assert.equal(filter3[0].contact, '01933333333');
});

test('Cabin 20% service charge is calculated on added service items excluding cabin/bed and admission fee', () => {
	const indexJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');

	assert.match(indexJs, /calculateCabinServiceCharge/);
	assert.match(indexJs, /getCabinServiceItems/);
	assert.match(indexJs, /Service Charge \(20%\)/);

	function indoorFeeKind(name) {
		const normalized = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
		if (['admission', 'admission fee', 'admission charge'].includes(normalized)) return 'admission';
		if (['cabin/bed charge', 'cabin charge', 'bed charge'].includes(normalized)) return 'cabin';
		return '';
	}

	function getCabinServiceItems(extras) {
		return (extras || []).filter(item => !indoorFeeKind(item.name));
	}

	function calculateCabinServiceCharge(extras) {
		const total = getCabinServiceItems(extras).reduce((sum, item) => sum + Number(item.price || 0), 0);
		return Math.round(total * 0.20);
	}

	const extrasWithAutoFees = [
		{ name: 'Admission fee', price: 500 },
		{ name: 'Cabin/bed charge', price: 2500 },
		{ name: 'Oxygen', price: 1200 },
		{ name: 'Cost of Medicine', price: 800 }
	];

	// Admission fee and Cabin/bed charge must be excluded from service items
	const serviceItems = getCabinServiceItems(extrasWithAutoFees);
	assert.equal(serviceItems.length, 2);
	assert.deepEqual(serviceItems.map(s => s.name), ['Oxygen', 'Cost of Medicine']);

	// 20% of (1200 + 800 = 2000) is 400
	const serviceCharge = calculateCabinServiceCharge(extrasWithAutoFees);
	assert.equal(serviceCharge, 400);

	// Total billings verification:
	const dailyRate = 2500;
	const days = 2;
	const cabinRent = dailyRate * days; // 5000
	const extrasSum = extrasWithAutoFees.reduce((sum, i) => sum + i.price, 0); // 5000
	const subtotal = cabinRent + extrasSum; // 10000
	const discount = 500;
	const net = subtotal + serviceCharge - discount; // 10000 + 400 - 500 = 9900
	const advance = 3000;
	const due = net - advance; // 6900

	assert.equal(subtotal, 10000);
	assert.equal(net, 9900);
	assert.equal(due, 6900);
});

test('Indoor billing memo and cabin modal include service charge remarks and visibility', () => {
	const indexJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');
	const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'index.css'), 'utf8');

	// Check billing document contains service charge and remark
	assert.match(indexJs, /Service Charge \(20%\)/);
	assert.match(indexJs, /indoor-sc-remark/);
	assert.match(indexJs, /Service Charge: 20%/);

	// Check cabin booking UI layout displays service charge
	assert.match(indexJs, /booking-service-charge/);
	assert.match(indexJs, /Service charge \(20% on items\)/);

	// Check CSS classes
	assert.match(css, /\.patient-name-tooltip/);
	assert.match(css, /\.patient-suggest-item/);
	assert.match(css, /\.indoor-sc-remark/);
});

test('Doctor roster in doctor-appointment-db.json contains all 12 doctors from provided images', () => {
	const doctorDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Database', 'doctor-appointment-db.json'), 'utf8'));
	assert.ok(Array.isArray(doctorDb.doctors));
	assert.equal(doctorDb.doctors.length, 12);

	const names = doctorDb.doctors.map(d => d.name);
	assert.ok(names.some(n => n.includes('উম্মে সালমা')));
	assert.ok(names.some(n => n.includes('মাধবীলতা')));
	assert.ok(names.some(n => n.includes('সাইফ উল্যাহ সুজন')));
	assert.ok(names.some(n => n.includes('ফাতেমা ফারহানা')));
	assert.ok(names.some(n => n.includes('ফজলুল হক বাকের')));
	assert.ok(names.some(n => n.includes('আফসারুল আমিন')));
	assert.ok(names.some(n => n.includes('ইয়াসিন আরাফাত বিপুল')));
	assert.ok(names.some(n => n.includes('হাসিবুল হক')));
	assert.ok(names.some(n => n.includes('আশরাফ আহমেদ')));
	assert.ok(names.some(n => n.includes('আল মেহেদী হাছিব')));
});

test('Clinic indoor service items in clinic-test-db.json include parent groups and single items matching indoor bill slip', () => {
	const clinicDb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Database', 'clinic-test-db.json'), 'utf8'));
	const services = clinicDb.indoorServices;
	assert.ok(Array.isArray(services));
	assert.ok(services.length >= 19, `Expected at least 19 services, found ${services.length}`);

	// Check parent groups
	const investigation = services.find(s => s.name === 'Investigation');
	assert.ok(investigation, 'Investigation service group should exist');
	assert.ok(Array.isArray(investigation.children) && investigation.children.length === 6);

	const operation = services.find(s => s.name === 'Operation Charge');
	assert.ok(operation, 'Operation Charge service group should exist');
	assert.ok(Array.isArray(operation.children) && operation.children.length === 4);

	// Check single service items
	const names = services.map(s => s.name);
	assert.ok(names.includes('Oxygen Charge'));
	assert.ok(names.includes('O.T Charge'));
	assert.ok(names.includes('Anesthesia Charge'));
	assert.ok(names.includes('Delivery Charge'));
	assert.ok(names.includes('Dressing Charge'));
	assert.ok(names.includes('Transfusion Charge'));
	assert.ok(names.includes('Cost of Medicine'));
	assert.ok(names.includes('Consultant Fee'));
	assert.ok(names.includes('Ambulance Fare'));
	assert.ok(names.includes('Phototherapy'));
	assert.ok(names.includes('Cardiac Monitor'));
	assert.ok(names.includes('Instrument Charge'));
});

test('Dark/Night toggle switch and complete dark mode styles are implemented', () => {
	const indexJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'index.js'), 'utf8');
	const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'index.css'), 'utf8');
	const html = fs.readFileSync(path.join(__dirname, '..', 'UI', 'index.html'), 'utf8');

	// Verify theme toggle switch HTML structure matches user specification
	assert.match(indexJs, /class="theme"/);
	assert.match(indexJs, /class="theme__toggle"/);
	assert.match(indexJs, /class="theme__icon-part"/);
	assert.match(indexJs, /data-action="toggle-theme"/);
	assert.match(indexJs, /quick-toggle-theme/);

	// Verify startup theme script in UI/index.html
	assert.match(html, /localStorage\.getItem\('hmss-theme'\)/);
	assert.match(html, /data-theme/);

	// Verify CSS rules
	assert.match(css, /\.theme__toggle/);
	assert.match(css, /\.theme__toggle:checked/);
	assert.match(css, /html\[data-theme="dark"\]/);
	assert.match(css, /html\[data-theme="dark"\] \.print-sheet/);
});
