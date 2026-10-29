'use strict';

(function (root, factory) {
	const analytics = factory();
	if (typeof module === 'object' && module.exports) module.exports = analytics;
	else root.HospitalAnalytics = analytics;
})(typeof globalThis === 'object' ? globalThis : this, function () {
	function startOfDay(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function getPeriodStart(period, now = new Date()) {
		const start = startOfDay(now);
		if (period === 'today') return start;
		if (period === 'week') {
			start.setDate(start.getDate() - (start.getDay() + 6) % 7);
			return start;
		}
		if (period === 'month') return new Date(start.getFullYear(), start.getMonth(), 1);
		if (period === 'year') return new Date(start.getFullYear(), 0, 1);
		return null;
	}

	function doctorMetrics(doctors, labOrders, now = new Date()) {
		const periods = ['today', 'week', 'month', 'all'];
		const metrics = new Map(doctors.map(doctor => [
			doctor.id,
			Object.fromEntries(periods.map(period => [period, { tests: 0, patients: new Set() }]))
		]));
		const starts = new Map(periods.map(period => [period, getPeriodStart(period, now)]));

		for (const order of labOrders) {
			const timestamp = new Date(order.createdAt).getTime();
			if (!Number.isFinite(timestamp)) continue;
			const doctorIds = new Set([
				...(Array.isArray(order.doctorIds) ? order.doctorIds : []),
				...(Array.isArray(order.doctors) ? order.doctors.map(doctor => doctor.id).filter(Boolean) : [])
			]);
			if (!doctorIds.size) continue;
			const testCount = Array.isArray(order.tests) ? order.tests.length : 0;
			const patient = order.contact?.trim()
				? `contact:${order.contact.trim().replace(/\D/g, '')}`
				: `name:${String(order.patientName || '').trim().toLowerCase()}:${order.age || ''}:${order.gender || ''}`;

			for (const doctorId of doctorIds) {
				const doctorPeriods = metrics.get(doctorId);
				if (!doctorPeriods) continue;
				for (const period of periods) {
					const start = starts.get(period);
					if (!start || timestamp >= start.getTime()) {
						const result = doctorPeriods[period];
						result.tests += testCount;
						result.patients.add(patient);
					}
				}
			}
		}

		return new Map([...metrics].map(([doctorId, doctorPeriods]) => [
			doctorId,
			Object.fromEntries(periods.map(period => {
				const value = doctorPeriods[period];
				return [period, { tests: value.tests, patients: value.patients.size }];
			}))
		]));
	}

	function summarizeRecords(records) {
		const summary = {
			net: 0,
			received: 0,
			due: 0,
			paidRecords: 0,
			outstandingRecords: 0,
			repeatPatients: 0,
			averageBill: 0,
			collectionRate: 0,
			workflows: { diagnostics: 0, appointments: 0, admissions: 0, roomPayments: 0 },
			roomPayments: 0,
			statuses: {},
			ageBands: { '0–17': 0, '18–35': 0, '36–59': 0, '60+': 0, 'Not recorded': 0 },
			genders: {},
			patients: new Set()
		};
		const patientVisits = new Map();

		for (const record of records) {
			const net = Math.max(0, Number(record.net ?? record.price ?? record.subtotal ?? 0) || 0);
			const received = Math.max(0, Number(record.advance || 0) || 0);
			const due = Math.max(0, Number(record.due ?? net - received) || 0);
			const isRoomPayment = record.kind === 'roomClaims';
			const patient = String(record.patientKey || record.contact || record.patientName || '').trim().toLowerCase();
			summary.net += net;
			summary.received += received;
			summary.due += due;
			summary.paidRecords += due === 0 ? 1 : 0;
			summary.outstandingRecords += due > 0 ? 1 : 0;
			summary.statuses[record.status || 'Unspecified'] = (summary.statuses[record.status || 'Unspecified'] || 0) + 1;
			if (patient && !isRoomPayment) {
				summary.patients.add(patient);
				patientVisits.set(patient, (patientVisits.get(patient) || 0) + 1);
			}

			if (record.kind === 'labOrders' || Array.isArray(record.tests) || record.testNames) summary.workflows.diagnostics += 1;
			else if (record.kind === 'appointments' || record.doctorId) summary.workflows.appointments += 1;
			else if (record.kind === 'bookings' || record.cabinId) summary.workflows.admissions += 1;
			else if (record.kind === 'roomClaims') {
				summary.workflows.roomPayments += 1;
				summary.roomPayments += net;
			}

			if (!isRoomPayment) {
				const age = Number.parseInt(record.age, 10);
				const ageBand = !Number.isFinite(age) || age < 0 ? 'Not recorded'
					: age < 18 ? '0–17'
						: age < 36 ? '18–35'
							: age < 60 ? '36–59' : '60+';
				summary.ageBands[ageBand] += 1;
				const gender = String(record.gender || 'Not recorded').trim() || 'Not recorded';
				summary.genders[gender] = (summary.genders[gender] || 0) + 1;
			}
		}

		summary.averageBill = records.length ? summary.net / records.length : 0;
		summary.collectionRate = summary.net ? Math.min(100, Math.round(summary.received / summary.net * 100)) : 0;
		summary.repeatPatients = [...patientVisits.values()].filter(visits => visits > 1).length;
		summary.patients = summary.patients.size;
		return summary;
	}

	return { doctorMetrics, getPeriodStart, startOfDay, summarizeRecords };
});
