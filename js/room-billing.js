'use strict';

(function (root, factory) {
	const roomBilling = factory();
	if (typeof module === 'object' && module.exports) module.exports = roomBilling;
	else root.HospitalRoomBilling = roomBilling;
})(typeof globalThis === 'object' ? globalThis : this, function () {
	function currentMonth(date = new Date()) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}

	function ensureCurrentBills(data, date = new Date()) {
		const billingMonth = currentMonth(date);
		let created = 0;
		for (const room of data.rooms) {
			if (data.roomBills.some(bill => bill.roomId === room.id && bill.billingMonth === billingMonth)) continue;
			data.roomBills.push({
				id: `RB-${room.id}-${billingMonth}`,
				roomId: room.id,
				billingMonth,
				monthlyAmount: Number(room.monthlyAmount) || 0,
				received: 0,
				status: 'Due',
				createdAt: date.toISOString()
			});
			created += 1;
		}
		return created;
	}

	function currentBill(data, roomId, date = new Date()) {
		return data.roomBills.find(bill => bill.roomId === roomId && bill.billingMonth === currentMonth(date)) || null;
	}

	function recordPayment(data, roomId, amount, options = {}, date = new Date()) {
		const room = data.rooms.find(item => item.id === roomId);
		if (!room) throw new Error('The selected room no longer exists.');
		const bill = currentBill(data, roomId, date);
		if (!bill) throw new Error('The current monthly room bill has not been initialized.');
		const remaining = Math.max(0, bill.monthlyAmount - bill.received);
		const paymentAmount = Number(amount);
		if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Enter a payment amount greater than zero.');
		if (paymentAmount > remaining) throw new Error('The payment cannot exceed the remaining room balance.');

		const floor = data.floors.find(item => item.id === room.floorId);
		const claimId = options.id || `RCP-${Date.now().toString(36).toUpperCase()}`;
		const payment = {
			id: claimId,
			claimId,
			roomId: room.id,
			roomName: room.name,
			floorId: room.floorId,
			floorName: floor?.name || 'Unknown floor',
			billingMonth: bill.billingMonth,
			kind: 'roomClaims',
			kindLabel: 'Room payment',
			patientName: `${room.name} · ${floor?.name || 'Unknown floor'}`,
			amount: paymentAmount,
			net: paymentAmount,
			advance: paymentAmount,
			due: 0,
			status: 'Received',
			paymentMethod: String(options.paymentMethod || 'Cash'),
			notes: String(options.notes || '').trim(),
			createdAt: date.toISOString()
		};
		bill.received += paymentAmount;
		if (bill.monthlyAmount - bill.received <= Number.EPSILON * Math.max(1, bill.monthlyAmount)) {
			bill.received = bill.monthlyAmount;
			bill.status = 'Cleared';
		}
		data.roomClaims.unshift(payment);
		return payment;
	}

	return { currentBill, currentMonth, ensureCurrentBills, recordPayment };
});
