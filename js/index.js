(() => {
	'use strict';

	const modules = {
		counter: { label: 'Counter', icon: '▤', tabs: ['Overview', 'New test', 'Checkout', 'Directory'] },
		appointment: { label: 'Appointments', icon: '◷', tabs: ['Doctors', 'Live appointment', 'Pre-booked', 'Records'] },
		booking: { label: 'Cabins', icon: '⌂', tabs: ['Cabins', 'Booking history'] },
		management: { label: 'Management', icon: '⚙', tabs: ['Tests', 'Doctors', 'Referrals', 'Cabins', 'Dev Tunnel'] },
		archive: { label: 'Archive & reports', icon: '▥', tabs: ['Live summary', 'Tests', 'Doctors', 'Bookings', 'Analytics'] }
	};
	const appRoot = document.getElementById('app');
	const toastRoot = document.getElementById('toast-region');
	const state = { data: null, user: null, route: { module: 'counter', tab: 0 }, query: '', filters: { date: 'all', status: 'all', sort: 'newest', from: '', to: '' }, updater: { appVersion: 'Loading…', supported: false, status: 'starting', percent: 0, logs: [] }, modal: null, saving: false };
	const nowISO = () => new Date().toISOString();
	const id = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
	const money = amount => `৳ ${Number(amount || 0).toLocaleString('en-BD')}`;
	const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	const dateTime = value => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not set';
	const dateOnly = value => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
	const initials = value => String(value || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
	const moneyInput = value => Math.max(0, Number(value) || 0);
	const routeHref = (module, tab = 0) => `#/${module}/${tab}`;
	const activeModule = () => modules[state.route.module];
	const allRecords = () => [...state.data.labOrders, ...state.data.appointments, ...state.data.bookings];

	async function persist(message) {
		if (state.saving) return;
		state.saving = true;
		try {
			if (window.hospital?.save) await window.hospital.save(state.data);
			else localStorage.setItem('hmss-data', JSON.stringify(state.data));
			if (message) toast(message);
		} catch (error) {
			toast(`Could not save changes: ${error.message}`, true);
		} finally { state.saving = false; }
	}

	function toast(message, isError = false) {
		const item = document.createElement('div');
		item.className = `toast${isError ? ' error' : ''}`;
		item.textContent = message;
		toastRoot.append(item);
		setTimeout(() => item.remove(), 3200);
	}

	function routeFromHash() {
		const [, module, tab] = location.hash.split('/');
		if (modules[module]) state.route = { module, tab: Math.min(Number(tab) || 0, modules[module].tabs.length - 1) };
		else state.route = { module: 'counter', tab: 0 };
		state.query = '';
		state.filters = { date: 'all', status: 'all', sort: 'newest', from: '', to: '' };
		render();
	}

	function render() {
		if (!state.data) return;
		if (!state.user) return renderLogin();
		const module = activeModule();
		appRoot.innerHTML = `${windowBar()}${applicationHeader()}<div class="app-shell"><aside class="sidebar">${sidebar()}</aside><section class="workspace"><header class="topbar"><div class="breadcrumb"><span>Workspace</span><span class="crumb-divider">/</span><b>${module.label}</b></div><div class="topbar-right"><span class="clock" id="clock"></span><button class="button button-secondary button-small" data-action="logout">↪&nbsp; Sign out</button></div></header><main class="content" id="content">${renderPage()}</main><footer class="statusbar"><span class="status-ready"><i></i>Ready</span><span>Data store&nbsp; <b>Local JSON</b></span><span>Records&nbsp; <b>${allRecords().length}</b></span><span class="status-user">${escapeHtml(state.user.name)}</span></footer></section></div>${state.modal ? renderModal() : ''}`;
		updateClock();
		if (state.route.module === 'appointment' && [1, 2].includes(state.route.tab)) updateVisitPrice();
	}

	function windowBar() {
		return `<div class="windowbar"><div class="window-brand"><span class="brand-mark">H</span> Kabirhat Private Hospital</div><div class="window-actions"><button aria-label="Minimize" data-action="minimize">−</button><button aria-label="Maximize" data-action="maximize">□</button><button class="close" aria-label="Close" data-action="close">×</button></div></div>`;
	}

	function applicationHeader() {
		return `<header class="application-header"><div class="application-nav"><div class="product-lockup"><span class="product-symbol">✚</span><span><strong>Kabirhat Private Hospital</strong><small>Clinical management system</small></span></div><nav class="module-nav">${Object.entries(modules).map(([key, item], index) => `<button class="module-link ${state.route.module === key ? 'active' : ''}" data-route="${key}"><span class="module-number">0${index + 1}</span>${item.label}</button>`).join('')}</nav><div class="department-label">Clinical Services</div></div><div class="accelerator-bar"><div class="accelerator-list"><span class="accelerator-caption">SHORTCUTS</span><span><kbd>F1</kbd> Help</span><button data-route="counter" data-route-tab="1"><kbd>F2</kbd> New test</button><button data-route="appointment" data-route-tab="1"><kbd>F3</kbd> Live visit</button><button data-route="booking" data-route-tab="0"><kbd>F5</kbd> Admit</button><span><kbd>F9</kbd> Print</span><span><kbd>F12</kbd> Lock</span></div><div class="system-health"><i></i>Local workstation <span>·</span> Ready</div></div></header>`;
	}

	function sidebar() {
		const contextItems = state.route.module === 'counter'
			? state.data.labOrders.slice().sort(byDateDesc).slice(0, 3).map(order => ({ title: order.billId, detail: `${order.patientName} · ${order.testNames}`, status: order.status }))
			: state.route.module === 'appointment'
				? state.data.appointments.slice().sort(byDateDesc).slice(0, 3).map(record => ({ title: record.patientName, detail: `${doctorName(record.doctorId)} · ${dateTime(record.visitAt)}`, status: record.status }))
				: state.route.module === 'booking'
					? state.data.bookings.filter(item => item.status === 'Occupied').slice(0, 3).map(record => ({ title: cabinName(record.cabinId), detail: `${record.patientName} · until ${dateTime(record.endAt)}`, status: record.status }))
					: state.route.module === 'management'
						? [{ title: `${state.data.tests.length} clinical tests`, detail: 'Service catalog', status: 'Active' }, { title: `${state.data.doctors.length} doctors`, detail: 'Clinician directory', status: 'Active' }, { title: `${state.data.cabins.length} cabins`, detail: 'Room inventory', status: 'Active' }]
						: allRecords().slice().sort(byDateDesc).slice(0, 3).map(record => ({ title: record.billId || record.recordId || record.bookingId, detail: `${record.patientName} · ${record.kindLabel || (record.testNames ? 'Diagnostics' : record.doctorId ? 'Appointment' : 'Cabin')}`, status: record.status }));
		const queueTitle = ['counter', 'appointment', 'booking'].includes(state.route.module) ? 'Queue & context' : 'Workspace context';
		return `<div class="context-search"><span>⌕</span><input data-global-search value="${escapeHtml(state.query)}" placeholder="Quick search (Ctrl+K)"></div><div class="context-heading">${queueTitle}<span>${contextItems.length}</span></div><div class="context-list">${contextItems.map(item => `<article class="context-item"><div class="context-item-head"><strong>${escapeHtml(item.title)}</strong><span class="badge ${item.status === 'Done' || item.status === 'Delivered' || item.status === 'Active' ? 'good' : 'warn'}">${escapeHtml(item.status)}</span></div><span>${escapeHtml(item.detail)}</span></article>`).join('') || `<div class="context-empty">No recent activity</div>`}</div><div class="context-footer"><span class="storage-dot"></span><span>Local records</span><b>${allRecords().length} total</b></div><div class="user-box"><span class="avatar">${escapeHtml(initials(state.user.name))}</span><div class="user-copy"><strong>${escapeHtml(state.user.name)}</strong><small>Administrator · Workstation</small></div><button class="icon-button" title="Sign out" data-action="logout">↪</button></div>`;
	}

	function renderLogin() {
		appRoot.innerHTML = `${windowBar()}<main class="login-screen"><section class="login-panel"><div class="login-brand"><span class="brand-mark" style="width:30px;height:30px">H</span><div><strong>Kabirhat Private Hospital</strong><small>Management system · Local workstation</small></div></div><form class="login-form" id="login-form"><h1>Operator sign in</h1><p>Enter your account details to open this workstation.</p><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><p class="error-text" id="login-error"></p><button class="button button-primary" type="submit">Sign in</button><div class="login-hint">Initial account: <b>admin</b> / <b>admin123</b></div></form></section></main>`;
	}

	function updateClock() {
		const target = document.getElementById('clock');
		if (target) target.textContent = new Date().toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
	}

	function pageHeading(title, subtitle, action = '') {
		return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(activeModule().label)}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
	}

	function tabs() {
		return `<div class="tabbar">${activeModule().tabs.map((tab, index) => `<button class="tab ${state.route.tab === index ? 'active' : ''}" data-tab="${index}">${tab}</button>`).join('')}</div>`;
	}

	function renderPage() {
		const content = state.route.module === 'counter' ? renderCounter()
			: state.route.module === 'appointment' ? renderAppointments()
				: state.route.module === 'booking' ? renderBookings()
					: state.route.module === 'management' ? renderManagement()
						: renderArchive();
		return `<section class="page">${tabs()}${content}</section>`;
	}

	function metrics(items) {
		return `<div class="metric-grid">${items.map(item => `<div class="metric"><div class="metric-label">${item.label}</div><div class="metric-value ${item.accent ? 'metric-accent' : ''}">${item.value}</div><div class="metric-foot">${item.note || ''}</div></div>`).join('')}</div>`;
	}

	function panel(title, body, subtitle = '') {
		return `<section class="panel"><header class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div></header><div class="panel-body">${body}</div></section>`;
	}

	function table(headers, rows) {
		if (!rows.length) return `<div class="empty"><strong>Nothing here yet</strong>New records will appear in this list.</div>`;
		return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
	}

	function emptyButton(action, label) {
		return `<button class="button button-primary" data-action="${action}">＋&nbsp; ${label}</button>`;
	}

	function renderCounter() {
		const tab = state.route.tab;
		if (tab === 0) {
			const today = new Date().toDateString();
			const todayOrders = state.data.labOrders.filter(order => new Date(order.createdAt).toDateString() === today);
			const received = todayOrders.reduce((sum, order) => sum + Number(order.advance || 0), 0);
			return `${pageHeading('Diagnostics counter', 'Register tests, prepare patient bills and track report handovers.', emptyButton('new-lab', 'New test bill'))}${metrics([{ label: "Today's test slips", value: todayOrders.length, note: 'Created at this counter' }, { label: 'Received today', value: money(received), note: 'Advance and full payments', accent: true }, { label: 'Awaiting handover', value: state.data.labOrders.filter(order => order.status !== 'Delivered').length, note: 'Reports not yet delivered' }, { label: 'Available tests', value: state.data.tests.length, note: 'In the test catalog' }])}<div class="two-column">${panel('Available clinical tests', table(['Code', 'Test name', 'Price'], state.data.tests.slice(0, 7).map(test => `<tr><td><strong>${escapeHtml(test.code)}</strong></td><td>${escapeHtml(test.name)}</td><td>${money(test.price)}</td></tr>`)))}${panel('Latest test bills', latestOrders(state.data.labOrders.slice().sort(byDateDesc).slice(0, 5)))}</div>`;
		}
		if (tab === 1) return renderLabForm();
		if (tab === 2) return renderLabList(true);
		return renderLabList(false);
	}

	function renderLabForm() {
		if (!state.data.tests.length) return `${pageHeading('New test bill', 'Add a clinical test in Management before registering a patient.')}${panel('No tests available', emptyButton('go-tests', 'Manage tests'))}`;
		const doctors = state.data.doctors.map(doctor => `<option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.id)} · ${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</option>`).join('');
		const referrals = state.data.referrers.map(referrer => `<option value="${escapeHtml(referrer.id)}">${escapeHtml(referrer.id)} · ${escapeHtml(referrer.name)}</option>`).join('');
		const tests = state.data.tests.map(test => `<option value="${escapeHtml(test.id)}">${escapeHtml(test.code)} · ${escapeHtml(test.name)} · ${money(test.price)}</option>`).join('');
		return `${pageHeading('New test bill', 'Patient details and selected services are saved as one local record.')}<form id="lab-form"><section class="panel"><header class="panel-head"><div><h2>Patient information</h2><p>Enter the details as they should appear on the printed slip.</p></div></header><div class="panel-body"><div class="form-grid">${field('Patient name', 'patientName', '', 'text', true)}${field('Age', 'age', '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true)}${field('Contact number', 'contact', '', 'tel', true)}${selectField('Referring doctor', 'doctorIds', [], false, true, doctors)}${selectField('Special referrer', 'referrerId', [], false, false, `<option value="">No referrer</option>${referrals}`)}${selectField('Clinical tests', 'testIds', [], true, true, tests)}${field('Report delivery date and time', 'deliveryAt', defaultDateTime(), 'datetime-local', true)}${field('Remarks', 'remarks', '', 'text')}${field('Additional note', 'note', '', 'text')}</div></div></section><div class="two-column"><section class="panel"><header class="panel-head"><div><h2>Payment</h2><p>Discount and advance are optional.</p></div></header><div class="panel-body"><div class="form-grid">${field('Discount (৳)', 'discount', '0', 'number')}${field('Advance received (৳)', 'advance', '0', 'number')}${field('Extra description', 'description', '', 'text')}</div><label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:11px"><input type="checkbox" name="fullPaid"> Mark full amount received</label></div></section><section class="panel"><header class="panel-head"><div><h2>Bill preview</h2><p>Totals update when you save.</p></div></header><div class="panel-body"><div class="notice">The bill ID is generated automatically and checked against existing records.</div><div class="summary-box"><div class="summary-row"><span>Selected tests</span><b id="bill-test-count">0</b></div><div class="summary-row"><span>Subtotal</span><b id="bill-subtotal">৳ 0</b></div><div class="summary-row total"><span>Net payable</span><b id="bill-total">৳ 0</b></div><div class="summary-row"><span>In words</span><b id="bill-words">Zero taka only</b></div></div></div></section></div><div class="form-actions"><button class="button button-secondary" type="button" data-route="counter" data-route-tab="0">Cancel</button><button class="button button-primary" type="submit">Save bill&nbsp; →</button></div></form>`;
	}

	function renderLabList(onlyPending) {
		const title = onlyPending ? 'Report checkout' : 'Test directory';
		const orders = state.data.labOrders.filter(order => !onlyPending || order.status !== 'Delivered').filter(searchRecord).sort(byDateDesc);
		const rows = orders.map(order => `<tr><td><strong>${escapeHtml(order.billId)}</strong></td><td>${escapeHtml(order.patientName)}</td><td>${dateTime(order.createdAt)}</td><td>${dateTime(order.deliveryAt)}</td><td>${money(order.net)}</td><td>${money(order.due)}</td><td><span class="badge ${order.status === 'Delivered' ? 'good' : 'warn'}">${escapeHtml(order.status)}</span></td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="labOrders" data-id="${escapeHtml(order.id)}">View</button>${onlyPending ? `<button class="button button-primary button-small" data-action="deliver-lab" data-id="${escapeHtml(order.id)}">Hand over</button>` : ''}<button class="icon-button" title="Print slip" data-action="print-record" data-kind="labOrders" data-id="${escapeHtml(order.id)}">⎙</button></div></td></tr>`);
		const extra = `<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search bill, patient, test or contact" value="${escapeHtml(state.query)}"></div><select class="control" data-sort><option value="newest" ${state.filters.sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${state.filters.sort === 'oldest' ? 'selected' : ''}>Oldest first</option></select><span class="badge">${orders.length} records</span></div>`;
		return `${pageHeading(title, onlyPending ? 'Find reports due for patient handover and close outstanding balances.' : 'Search and review every registered diagnostic test slip.', onlyPending ? '' : emptyButton('new-lab', 'New test bill'))}${panel(title, extra + table(['Bill ID', 'Patient', 'Test date', 'Report due', 'Net', 'Due', 'Status', 'Actions'], rows))}`;
	}

	function latestOrders(orders) {
		return table(['Bill', 'Patient', 'Amount', 'Status'], orders.map(order => `<tr><td><strong>${escapeHtml(order.billId)}</strong></td><td>${escapeHtml(order.patientName)}</td><td>${money(order.net)}</td><td><span class="badge ${order.status === 'Delivered' ? 'good' : 'warn'}">${escapeHtml(order.status)}</span></td></tr>`));
	}

	function renderAppointments() {
		const tab = state.route.tab;
		if (tab === 0) return renderDoctorCards();
		if (tab === 1) return renderAppointmentForm(false);
		if (tab === 2) return renderAppointmentForm(true);
		return renderAppointmentList();
	}

	function renderDoctorCards() {
		return `${pageHeading('Find a specialist', 'Choose a doctor to start a live visit or reserve a future appointment.')}<div class="doctor-grid">${state.data.doctors.map(doctor => `<article class="doctor-card"><div class="doctor-top"><img class="doctor-photo" src="${escapeHtml(doctor.photo || '')}" alt="" onerror="this.style.display='none'"><div><h3>${escapeHtml(doctor.name)}</h3><p>${escapeHtml(doctor.id)} · ${escapeHtml(doctor.title || doctor.specialty)}</p></div></div><div class="doctor-meta"><span>Specialty&nbsp; · &nbsp;${escapeHtml(doctor.specialty || 'General practice')}</span><span>Visiting&nbsp; · &nbsp;${escapeHtml(doctor.visits || 'Schedule on request')}</span><span>Contact&nbsp; · &nbsp;${escapeHtml(doctor.contact || 'Not listed')}</span></div><div class="doctor-bottom"><span class="price-pair">New&nbsp; <b>${money(doctor.newPrice)}</b><br>Returning&nbsp; <b>${money(doctor.oldPrice)}</b></span><div class="inline-actions"><button class="button button-secondary button-small" data-action="book-doctor" data-doctor="${escapeHtml(doctor.id)}" data-pre="true">Reserve</button><button class="button button-primary button-small" data-action="book-doctor" data-doctor="${escapeHtml(doctor.id)}">Start visit</button></div></div></article>`).join('') || `<div class="empty">Add doctors in Management to begin scheduling.</div>`}</div>`;
	}

	function renderAppointmentForm(isPrebooked) {
		const preferredDoctor = sessionStorage.getItem('hmss-doctor') || '';
		const doctors = state.data.doctors.map(doctor => `<option value="${escapeHtml(doctor.id)}" ${preferredDoctor === doctor.id ? 'selected' : ''}>${escapeHtml(doctor.id)} · ${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</option>`).join('');
		if (preferredDoctor) sessionStorage.removeItem('hmss-doctor');
		return `${pageHeading(isPrebooked ? 'Reserve an appointment' : 'Live appointment', 'Patient history is matched by contact number and used to set the visit fee.')}<form id="appointment-form" data-prebooked="${isPrebooked}"><section class="panel"><header class="panel-head"><div><h2>Patient and visit details</h2><p>${isPrebooked ? 'A reserved visit starts as pending.' : 'A walk-in visit is recorded as done after saving.'}</p></div></header><div class="panel-body"><div class="form-grid">${selectField('Doctor', 'doctorId', [], true, false, `<option value="">Choose a doctor</option>${doctors}`)}${field('Appointment date and time', 'visitAt', defaultTodayDateTime(), 'datetime-local', true)}${field('Patient name', 'patientName', '', 'text', true)}${field('Contact number', 'contact', '', 'tel', true)}${field('Age', 'age', '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true)}${field('From', 'fromTime', '', 'time')}${field('To', 'toTime', '', 'time')}${field('Visit fee (৳)', 'price', '', 'number', true)}<div class="field full"><div class="notice" id="patient-history">Enter the patient's contact number to check previous visits.</div></div></div></div></section><div class="form-actions"><button class="button button-secondary" type="button" data-route="appointment" data-route-tab="0">Cancel</button><button class="button button-primary" type="submit">${isPrebooked ? 'Save reservation' : 'Complete visit'}&nbsp; →</button></div></form>`;
	}

	function renderAppointmentList() {
		const records = state.data.appointments.filter(searchRecord).sort(byDateDesc);
		const rows = records.map(record => `<tr><td><strong>${escapeHtml(record.recordId)}</strong></td><td>${escapeHtml(record.patientName)}<br><small>${escapeHtml(record.contact)}</small></td><td>${escapeHtml(doctorName(record.doctorId))}</td><td>${dateTime(record.visitAt)}</td><td>${money(record.price)}</td><td><span class="badge ${record.status === 'Done' ? 'good' : 'warn'}">${escapeHtml(record.status)}</span></td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="appointments" data-id="${escapeHtml(record.id)}">View</button>${record.status === 'Pending' ? `<button class="button button-primary button-small" data-action="complete-appointment" data-id="${escapeHtml(record.id)}">Complete</button>` : `<button class="icon-button" title="Print visit slip" data-action="print-record" data-kind="appointments" data-id="${escapeHtml(record.id)}">⎙</button>`}</div></td></tr>`);
		return `${pageHeading('Appointment records', 'Review scheduled and completed doctor visits.', `<button class="button button-secondary" data-tab="0">Browse doctors</button>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient, doctor or record" value="${escapeHtml(state.query)}"></div><select class="control" data-status-filter><option value="all">All statuses</option><option>Pending</option><option>Done</option></select></div>${panel('Visit directory', table(['Record', 'Patient', 'Doctor', 'Visit time', 'Fee', 'Status', 'Actions'], rows))}`;
	}

	function renderBookings() {
		if (state.route.tab === 0) {
			const active = state.data.bookings.filter(booking => booking.status === 'Occupied' && new Date(booking.endAt) > new Date());
			return `${pageHeading('Cabin availability', 'Choose an available cabin to admit a patient. Occupied cabins show their release time.', `<button class="button button-secondary" data-tab="1">Booking history&nbsp; →</button>`)}${metrics([{ label: 'Total cabins', value: state.data.cabins.length }, { label: 'Available now', value: Math.max(0, state.data.cabins.length - active.length), accent: true }, { label: 'Occupied', value: active.length }, { label: 'Current admissions', value: active.length }])}<div class="cabin-grid">${state.data.cabins.map(cabin => { const booking = active.find(item => item.cabinId === cabin.id); return `<article class="cabin-card ${booking ? 'occupied' : 'available'}"><div class="cabin-top"><span class="cabin-number">${escapeHtml(cabin.id.split('-').at(-1))}</span><span class="cabin-status">${booking ? '● Occupied' : '● Available'}</span></div><h3>${escapeHtml(cabin.name)}</h3><p>${booking ? `${escapeHtml(booking.patientName)} · Available ${dateTime(booking.endAt)}` : `${money(cabin.price)} / day`}</p>${booking ? `<div class="inline-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="bookings" data-id="${escapeHtml(booking.id)}">Details</button><button class="button button-secondary button-small" data-action="renew-booking" data-id="${escapeHtml(booking.id)}">Renew</button></div>` : `<button class="button button-primary button-small" data-action="book-cabin" data-cabin="${escapeHtml(cabin.id)}">Admit patient</button>`}</article>`; }).join('') || `<div class="empty">Add cabins in Management to begin bookings.</div>`}</div>`;
		}
		const records = state.data.bookings.filter(searchRecord).sort(byDateDesc);
		const rows = records.map(record => `<tr><td><strong>${escapeHtml(record.bookingId)}</strong></td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(cabinName(record.cabinId))}</td><td>${dateTime(record.startAt)}</td><td>${dateTime(record.endAt)}</td><td>${money(record.net)}</td><td>${money(record.due)}</td><td><span class="badge ${record.status === 'Occupied' ? 'warn' : 'good'}">${escapeHtml(record.status)}</span></td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="bookings" data-id="${escapeHtml(record.id)}">View</button>${record.status === 'Occupied' ? `<button class="button button-danger button-small" data-action="release-booking" data-id="${escapeHtml(record.id)}">Release</button>` : ''}</td></tr>`);
		return `${pageHeading('Cabin booking history', 'Search all admissions and review their payments and duration.')}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search booking, patient or cabin" value="${escapeHtml(state.query)}"></div></div>${panel('Bookings', table(['Booking ID', 'Patient', 'Cabin', 'Admitted', 'Release', 'Net', 'Due', 'Status', ''], rows))}`;
	}

	function renderManagement() {
		const type = ['tests', 'doctors', 'referrals', 'cabins', 'dev-tunnel'][state.route.tab];
		if (type === 'dev-tunnel') return renderDevTunnel();
		if (type === 'referrals') return renderReferralManagement();
		const config = {
			tests: { title: 'Clinical tests', subtitle: 'Manage the services and prices available at the diagnostics counter.', headers: ['Code', 'Test name', 'Price', 'Actions'] },
			doctors: { title: 'Doctors', subtitle: 'Maintain clinician profiles, visit schedules and patient fees.', headers: ['Doctor', 'Specialty', 'Schedule', 'New fee', 'Returning fee', 'Actions'] },
			cabins: { title: 'Cabins', subtitle: 'Configure cabin names and daily booking rates.', headers: ['Cabin ID', 'Cabin name', 'Daily rate', 'Actions'] }
		}[type];
		const records = state.data[type].filter(item => searchRecord(item));
		let rows;
		if (type === 'tests') rows = records.map(item => `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${escapeHtml(item.name)}</td><td>${money(item.price)}</td>${manageActions(type, item)}</tr>`);
		if (type === 'doctors') rows = records.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.id)} · ${escapeHtml(item.title || '')}</small></td><td>${escapeHtml(item.specialty)}</td><td>${escapeHtml(item.visits)}</td><td>${money(item.newPrice)}</td><td>${money(item.oldPrice)}</td>${manageActions(type, item)}</tr>`);
		if (type === 'cabins') rows = records.map(item => `<tr><td><strong>${escapeHtml(item.id)}</strong></td><td>${escapeHtml(item.name)}</td><td>${money(item.price)} / day</td>${manageActions(type, item)}</tr>`);
		return `${pageHeading(config.title, config.subtitle, `<button class="button button-primary" data-action="add-item" data-kind="${type}">＋&nbsp; Add ${type === 'tests' ? 'test' : type === 'doctors' ? 'doctor' : 'cabin'}</button>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search ${type}" value="${escapeHtml(state.query)}"></div></div>${panel(config.title, table(config.headers, rows))}`;
	}

	function renderDevTunnel() {
		const update = state.updater;
		const statusLabel = {
			starting: 'Loading version information', idle: 'Ready to check for updates', unsupported: 'Available in installed releases only',
			checking: 'Checking GitHub Releases', available: `Version ${update.availableVersion || ''} is available`,
			'not-available': 'This installation is up to date', downloading: 'Downloading update', downloaded: 'Update ready to install',
			installing: 'Restarting to install', error: 'Update check needs attention'
		}[update.status] || 'Update status';
		const checkDisabled = !update.supported || ['checking', 'downloading', 'downloaded', 'installing'].includes(update.status);
		const primaryAction = update.status === 'available'
			? `<button class="button button-primary" data-action="download-update">Download update · ${escapeHtml(update.availableVersion)}</button>`
			: update.status === 'downloaded'
				? `<button class="button button-primary" data-action="install-update">Restart and install</button>`
				: `<button class="button button-primary" data-action="check-updates" ${checkDisabled ? 'disabled' : ''}>${update.status === 'checking' ? 'Checking…' : 'Check for updates'}</button>`;
		const logs = (update.logs || []).slice(-40).reverse();
		const progressVisible = ['downloading', 'downloaded'].includes(update.status);
		const progress = Math.min(100, Math.max(0, Number(update.percent) || 0));
		const message = update.status === 'unsupported'
			? 'Update checks work in an installed Windows release. Development runs do not have GitHub release metadata.'
			: update.error || statusLabel;
		return `${pageHeading('Version & updates', 'Check the published GitHub release and apply updates without replacing local hospital records.', primaryAction)}<div class="update-grid"><section class="update-panel"><header class="update-panel-head"><div><span class="update-kicker">APPLICATION</span><h2>Installed version</h2></div><span class="update-channel"><i></i> Stable release</span></header><div class="update-version-row"><span class="update-version">v${escapeHtml(update.appVersion || '—')}</span><span class="update-version-label">Current version</span></div><div class="update-divider"></div><div class="update-detail-row"><span>Update source</span><strong>GitHub Releases · ceo-uploads/HMS</strong></div><div class="update-detail-row"><span>Latest checked version</span><strong>${escapeHtml(update.latestVersion || update.availableVersion || 'Not checked')}</strong></div><div class="update-detail-row"><span>Local data</span><strong>Preserved in user profile</strong></div><div class="update-status-line status-${escapeHtml(update.status)}"><i></i>${escapeHtml(message)}</div>${progressVisible ? `<div class="update-progress-wrap"><div class="update-progress-meta"><span>${update.status === 'downloaded' ? 'Download complete' : 'Download progress'}</span><strong>${Math.round(progress)}%</strong></div><div class="update-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div></div>` : ''}${update.releaseNotes ? `<div class="update-release-notes"><strong>Release notes</strong><p>${escapeHtml(update.releaseNotes)}</p></div>` : ''}</section><section class="update-log-panel"><header class="update-panel-head"><div><span class="update-kicker">ACTIVITY</span><h2>Update log</h2></div><span class="update-log-count">${logs.length} entries</span></header><ol class="update-log-list">${logs.map(entry => `<li class="update-log-entry ${entry.level === 'error' ? 'is-error' : ''}"><time>${escapeHtml(new Date(entry.time).toLocaleString())}</time><span>${escapeHtml(entry.message)}</span></li>`).join('') || `<li class="update-log-empty">Update activity will appear here.</li>`}</ol></section></div><div class="update-footnote"><span>Updates replace application files only.</span><span>Your JSON database and local assets remain in <code>%APPDATA%\\hmss-desktop</code>.</span></div>`;
	}

	function manageActions(type, item) {
		return `<td><div class="table-actions"><button class="button button-secondary button-small" data-action="edit-item" data-kind="${type}" data-id="${escapeHtml(item.id)}">Edit</button><button class="button button-danger button-small" data-action="delete-item" data-kind="${type}" data-id="${escapeHtml(item.id)}">Delete</button></div></td>`;
	}

	function renderReferralManagement() {
		const agents = state.data.agents.filter(searchRecord).map(agent => `<tr><td><strong>${escapeHtml(agent.name)}</strong></td><td>${escapeHtml(agent.id)}</td><td>${escapeHtml(agent.contact)}</td><td>${state.data.referrers.filter(referrer => referrer.agentId === agent.id).length}</td>${manageActions('agents', agent)}</tr>`);
		const referrers = state.data.referrers.filter(searchRecord).map(referrer => `<tr><td><strong>${escapeHtml(referrer.name)}</strong></td><td>${escapeHtml(referrer.id)}</td><td>${escapeHtml(referrer.contact)}</td><td>${escapeHtml(state.data.agents.find(agent => agent.id === referrer.agentId)?.name || 'Unassigned')}</td>${manageActions('referrers', referrer)}</tr>`);
		return `${pageHeading('Referral network', 'Keep marketing partners and their special referrers organized.', `<div class="inline-actions"><button class="button button-secondary" data-action="add-item" data-kind="agents">＋&nbsp; Add agent</button><button class="button button-primary" data-action="add-item" data-kind="referrers">＋&nbsp; Add referrer</button></div>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search agent, referrer or contact" value="${escapeHtml(state.query)}"></div></div>${panel('Marketing agents', table(['Agent', 'Code', 'Contact', 'Referrers', 'Actions'], agents))}${panel('Special referrers', table(['Referrer', 'Code', 'Contact', 'Agent', 'Actions'], referrers))}`;
	}

	function renderArchive() {
		const all = allRecords().filter(searchRecord).sort(byDateDesc);
		const tab = state.route.tab;
		if (tab === 4) return renderAnalytics();
		const kind = tab === 1 ? 'labOrders' : tab === 2 ? 'appointments' : tab === 3 ? 'bookings' : '';
		const selected = kind ? state.data[kind].filter(searchRecord).sort(byDateDesc) : all;
		const collected = selected.reduce((sum, item) => sum + Number(item.advance || 0), 0);
		const due = selected.reduce((sum, item) => sum + Number(item.due || 0), 0);
		const records = selected.map(record => `<tr><td><strong>${escapeHtml(record.billId || record.recordId || record.bookingId)}</strong></td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostic test' : record.doctorId ? 'Doctor visit' : 'Cabin booking'))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net || record.price)}</td><td>${money(record.advance || 0)}</td><td>${money(record.due || 0)}</td><td><span class="badge ${record.status === 'Done' || record.status === 'Delivered' || record.status === 'Completed' ? 'good' : 'warn'}">${escapeHtml(record.status)}</span></td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="${kind || recordKind(record)}" data-id="${escapeHtml(record.id)}">View</button></td></tr>`);
		return `${pageHeading(tab === 0 ? 'Live summary' : activeModule().tabs[tab], 'Review hospital activity, payment status and patient records.', `<button class="button button-secondary" data-action="print-summary">⎙&nbsp; Print summary</button>`)}${metrics([{ label: 'Records', value: selected.length, note: 'In this view' }, { label: 'Received', value: money(collected), accent: true }, { label: 'Remaining due', value: money(due), note: 'Across listed records' }, { label: 'Patient visits', value: new Set(selected.map(item => item.contact)).size }])}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient, record or service" value="${escapeHtml(state.query)}"></div><select class="control" data-date-filter><option value="all" ${state.filters.date === 'all' ? 'selected' : ''}>Any date</option><option value="today" ${state.filters.date === 'today' ? 'selected' : ''}>Today</option><option value="7" ${state.filters.date === '7' ? 'selected' : ''}>Last 7 days</option><option value="30" ${state.filters.date === '30' ? 'selected' : ''}>Last 30 days</option><option value="custom" ${state.filters.date === 'custom' ? 'selected' : ''}>Custom range</option></select>${state.filters.date === 'custom' ? `<input class="control" aria-label="From date" type="date" data-range="from" value="${escapeHtml(state.filters.from)}"><input class="control" aria-label="To date" type="date" data-range="to" value="${escapeHtml(state.filters.to)}">` : ''}<select class="control" data-status-filter><option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>All statuses</option><option ${state.filters.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${state.filters.status === 'Done' ? 'selected' : ''}>Done</option><option ${state.filters.status === 'Delivered' ? 'selected' : ''}>Delivered</option><option ${state.filters.status === 'Occupied' ? 'selected' : ''}>Occupied</option></select></div>${panel('Activity records', table(['Reference', 'Patient', 'Service', 'Date', 'Net', 'Received', 'Due', 'Status', ''], records))}`;
	}

	function renderAnalytics() {
		const records = allRecords();
		const today = new Date().toDateString();
		const current = records.filter(item => new Date(item.createdAt || item.visitAt || item.startAt).toDateString() === today);
		const max = Math.max(1, ...Array.from({ length: 7 }, (_, index) => {
			const day = new Date(); day.setDate(day.getDate() - (6 - index));
			return records.filter(item => new Date(item.createdAt || item.visitAt || item.startAt).toDateString() === day.toDateString()).length;
		}));
		const days = Array.from({ length: 7 }, (_, index) => {
			const day = new Date(); day.setDate(day.getDate() - (6 - index));
			const count = records.filter(item => new Date(item.createdAt || item.visitAt || item.startAt).toDateString() === day.toDateString()).length;
			return `<div class="chart-bar-wrap"><span>${count}</span><i class="chart-bar" style="height:${Math.max(3, count / max * 110)}px"></i><span>${day.toLocaleDateString('en-GB', { weekday: 'short' })}</span></div>`;
		}).join('');
		const totals = records.reduce((result, record) => { result.net += Number(record.net || record.price || 0); result.received += Number(record.advance || 0); result.due += Number(record.due || 0); return result; }, { net: 0, received: 0, due: 0 });
		return `${pageHeading('Hospital analytics', 'A practical view of volume, collected payments and outstanding balances.')}${metrics([{ label: "Today's records", value: current.length }, { label: "Today's received", value: money(current.reduce((sum, item) => sum + Number(item.advance || 0), 0)), accent: true }, { label: 'All-time received', value: money(totals.received) }, { label: 'Estimated outstanding', value: money(totals.due) }])}<div class="two-column">${panel('Activity · last 7 days', `<div class="chart">${days}</div>`)}${panel('All-time overview', `<div class="summary-box"><div class="summary-row"><span>Total records</span><b>${records.length}</b></div><div class="summary-row"><span>Gross billed</span><b>${money(totals.net)}</b></div><div class="summary-row"><span>Received</span><b>${money(totals.received)}</b></div><div class="summary-row total"><span>Outstanding</span><b>${money(totals.due)}</b></div></div>`)}</div>`;
	}

	function renderModal() {
		const modal = state.modal;
		if (modal.type === 'confirm') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${escapeHtml(modal.title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body"><p style="font-size:12px;line-height:1.6;color:#65736c">${escapeHtml(modal.message)}</p></div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Cancel</button><button class="button button-danger" data-action="confirm-action">${escapeHtml(modal.confirmLabel || 'Continue')}</button></footer></section></div>`;
		if (modal.type === 'summary') return renderSummaryModal();
		if (modal.type === 'item') return renderItemModal(modal);
		if (modal.type === 'booking') return renderBookingModal(modal);
		if (modal.type === 'renew') return renderRenewModal(modal);
		if (modal.type === 'record' || modal.type === 'print') return renderRecordModal(modal);
		return '';
	}

	function renderItemModal(modal) {
		const type = modal.kind;
		const item = modal.item || {};
		const editing = Boolean(item.id);
		const fields = {
			tests: [['code', 'Code', 'text', true], ['name', 'Test name', 'text', true], ['price', 'Price (৳)', 'number', true]],
			doctors: [['name', 'Doctor name', 'text', true], ['title', 'Title / qualification', 'text'], ['specialty', 'Specialty', 'text', true], ['contact', 'Contact number', 'tel'], ['visits', 'Visiting time', 'text'], ['newPrice', 'New patient fee (৳)', 'number', true], ['oldPrice', 'Returning patient fee (৳)', 'number', true]],
			cabins: [['name', 'Cabin name', 'text', true], ['price', 'Daily rate (৳)', 'number', true]],
			agents: [['name', 'Agent name', 'text', true], ['contact', 'Contact number', 'tel']],
			referrers: [['name', 'Referrer name', 'text', true], ['contact', 'Contact number', 'tel']]
		}[type];
		const title = `${editing ? 'Edit' : 'Add'} ${type === 'tests' ? 'clinical test' : type === 'doctors' ? 'doctor' : type === 'cabins' ? 'cabin' : type === 'agents' ? 'marketing agent' : 'special referrer'}`;
		const fileButton = type === 'doctors' ? `<div class="field full"><label>Profile photo</label><div class="inline-actions"><input class="control" name="photo" value="${escapeHtml(item.photo || '')}" placeholder="Image file path or choose an image"><button class="button button-secondary button-small" type="button" data-action="choose-image">Choose image</button></div></div>` : '';
		const agentSelector = type === 'referrers' ? `<div class="field full"><label for="agentId">Marketing agent</label><select id="agentId" name="agentId" class="control">${state.data.agents.map(agent => `<option value="${escapeHtml(agent.id)}" ${item.agentId === agent.id ? 'selected' : ''}>${escapeHtml(agent.name)}</option>`).join('')}</select></div>` : '';
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="item-form" data-kind="${type}" data-id="${escapeHtml(item.id || '')}"><div class="modal-body"><div class="form-grid">${fields.map(([name, label, inputType, required]) => `<div class="field"><label for="item-${name}">${label}</label><input id="item-${name}" name="${name}" type="${inputType}" value="${escapeHtml(item[name] ?? '')}" ${required ? 'required' : ''} ${inputType === 'number' ? 'min="0" step="1"' : ''}></div>`).join('')}${fileButton}${agentSelector}</div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? 'Save changes' : 'Add record'}</button></footer></form></section></div>`;
	}

	function renderBookingModal(modal) {
		const cabin = state.data.cabins.find(item => item.id === modal.cabinId);
		const booking = modal.booking;
		const isEdit = Boolean(booking);
		const defaultStart = booking?.endAt ? toDateInput(booking.endAt) : toDateInput(nowISO());
		const defaultEnd = booking?.endAt ? toDateInput(new Date(new Date(booking.endAt).getTime() + 86400000).toISOString()) : toDateInput(new Date(Date.now() + 86400000).toISOString());
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${isEdit ? 'Renew cabin stay' : `Admit patient · ${escapeHtml(cabin?.name || '')}`}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="booking-form" data-id="${escapeHtml(booking?.id || '')}" data-cabin="${escapeHtml(booking?.cabinId || cabin?.id || '')}"><div class="modal-body"><div class="form-grid">${field('Patient name', 'patientName', booking?.patientName || '', 'text', true)}${field('Contact number', 'contact', booking?.contact || '', 'tel', true)}${field('Age', 'age', booking?.age || '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true, false, null, booking?.gender)}${field('Start date and time', 'startAt', defaultStart, 'datetime-local', true)}${field('Release date and time', 'endAt', defaultEnd, 'datetime-local', true)}${field('Additional items (name:price)', 'extras', booking?.extrasText || '', 'text')}${field('Discount (৳)', 'discount', booking?.discount || '0', 'number')}${field('Advance received (৳)', 'advance', booking?.advance || '0', 'number')}${field('Daily cabin rate (৳)', 'price', cabin?.price ?? booking?.dailyRate ?? 0, 'number', true)}${field('Notes', 'notes', booking?.notes || '', 'text')}</div><div class="summary-box"><div class="summary-row"><span>Estimate</span><b>${money((cabin?.price ?? booking?.dailyRate ?? 0) + sumExtras(booking?.extras || []))} / day</b></div><div class="summary-row"><span>Cabin</span><b>${escapeHtml(cabin?.name || cabinName(booking?.cabinId))}</b></div></div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${isEdit ? 'Save renewal' : 'Save admission'}</button></footer></form></section></div>`;
	}

	function renderRenewModal(modal) {
		const booking = state.data.bookings.find(item => item.id === modal.id);
		return booking ? renderBookingModal({ type: 'booking', cabinId: booking.cabinId, booking }) : '';
	}

	function renderSummaryModal() {
		const records = allRecords().sort(byDateDesc);
		const rows = records.map(record => `<tr><td>${escapeHtml(record.billId || record.recordId || record.bookingId)}</td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostic test' : record.doctorId ? 'Doctor visit' : 'Cabin booking'))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net || record.price)}</td><td>${money(record.advance)}</td><td>${money(record.due)}</td><td>${escapeHtml(record.status)}</td></tr>`).join('');
		const summaryTable = records.length ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Date</th><th>Net</th><th>Received</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No activity has been recorded yet.</div>`;
		const contents = `<article class="print-sheet"><header class="print-head"><div><h2>Kabirhat Private Hospital</h2><span>Daily activity summary</span></div><div style="text-align:right">Generated ${dateTime(nowISO())}<br>${records.length} records</div></header>${summaryTable}<div class="print-note">Local operational summary. Patient information is confidential.</div></article>`;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>Activity summary</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${contents}</div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-primary" data-action="print-summary-now">⎙&nbsp; Print summary</button></footer></section></div>`;
	}

	function renderRecordModal(modal) {
		const record = state.data[modal.kind]?.find(item => item.id === modal.id);
		if (!record) return '';
		const isLab = modal.kind === 'labOrders';
		const isAppointment = modal.kind === 'appointments';
		const title = record.billId || record.recordId || record.bookingId;
		const serviceRows = isLab ? (record.tests || []).map(test => `<tr><td>${escapeHtml(test.code)}</td><td>${escapeHtml(test.name)}</td><td>${money(test.price)}</td></tr>`).join('') : '';
		const details = isLab ? [['Patient', record.patientName], ['Age / gender', `${record.age} / ${record.gender}`], ['Contact', record.contact], ['Referring doctor', (record.doctors || []).map(item => item.name).join(', ') || '—'], ['Special referrer', record.referrerName || '—'], ['Registered', dateTime(record.createdAt)], ['Report delivery', dateTime(record.deliveryAt)], ['Report status', record.status], ['Full paid', record.fullPaid ? 'Yes' : 'No']]
			: isAppointment ? [['Patient', record.patientName], ['Patient ID', record.patientId || record.recordId], ['Contact', record.contact], ['Age / gender', `${record.age} / ${record.gender}`], ['Doctor', doctorName(record.doctorId)], ['Visit time', dateTime(record.visitAt)], ['Patient type', record.patientType], ['Status', record.status]]
				: [['Patient', record.patientName], ['Contact', record.contact], ['Cabin', cabinName(record.cabinId)], ['Admitted', dateTime(record.startAt)], ['Release', dateTime(record.endAt)], ['Duration', `${record.days} day(s)`], ['Status', record.status]];
		const actionButton = modal.type === 'print' ? '' : `<footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-primary" data-action="print-record" data-kind="${modal.kind}" data-id="${record.id}">⎙&nbsp; Print</button></footer>`;
		const labTable = isLab ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Test</th><th>Price</th></tr></thead><tbody>${serviceRows}</tbody></table></div>` : '';
		const payment = !isAppointment ? `<div class="summary-box"><div class="summary-row"><span>Subtotal</span><b>${money(record.subtotal ?? record.net ?? record.price)}</b></div><div class="summary-row"><span>Discount</span><b>${money(record.discount)}</b></div><div class="summary-row"><span>Received</span><b>${money(record.advance)}</b></div><div class="summary-row total"><span>Net / due</span><b>${money(record.net ?? record.price)} / ${money(record.due)}</b></div>${isLab ? `<div class="summary-row"><span>Amount in words</span><b>${amountInWords(record.net)}</b></div>` : ''}</div>` : `<div class="summary-box"><div class="summary-row total"><span>Visit fee</span><b>${money(record.price)}</b></div></div>`;
		const sheet = `<article class="print-sheet"><header class="print-head"><div><h2>Kabirhat Private Hospital</h2><span>Patient service record · Local copy</span></div><div style="text-align:right"><b>${escapeHtml(title)}</b><br>${dateTime(record.createdAt || record.visitAt || record.startAt)}</div></header><div class="form-grid" style="margin-top:16px">${details.map(([label, value]) => `<div><small style="color:#718078">${label}</small><div style="margin-top:3px;font-weight:600">${escapeHtml(value)}</div></div>`).join('')}</div>${labTable}${payment}<div class="print-note">Please retain this slip for your records. Thank you for choosing Kabirhat Private Hospital.</div></article>`;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>${modal.type === 'print' ? 'Print preview' : `Record · ${escapeHtml(title)}`}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${sheet}</div>${actionButton}</section></div>`;
	}

	function field(label, name, value = '', type = 'text', required = false) {
		return `<div class="field"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${type === 'number' ? 'min="0" step="1"' : ''}></div>`;
	}

	function selectField(label, name, options, required = false, multiple = false, htmlOptions = null, selected = '') {
		const content = htmlOptions ?? options.map(option => `<option value="${escapeHtml(option)}" ${selected === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
		return `<div class="field"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" ${required ? 'required' : ''} ${multiple ? 'multiple' : ''}>${content}</select>${multiple ? '<span class="field-hint">Use Ctrl or Shift to select more than one.</span>' : ''}</div>`;
	}

	function defaultDateTime() { const date = new Date(Date.now() + 86400000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
	function defaultTodayDateTime() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
	function toDateInput(value) { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
	function byDateDesc(left, right) { const difference = new Date(right.createdAt || right.visitAt || right.startAt) - new Date(left.createdAt || left.visitAt || left.startAt); return state.filters.sort === 'oldest' ? -difference : difference; }
	function searchRecord(item) {
		const query = state.query.trim().toLowerCase();
		const matchesQuery = !query || Object.values(item).some(value => typeof value === 'string' || typeof value === 'number' ? String(value).toLowerCase().includes(query) : Array.isArray(value) ? value.some(entry => Object.values(entry).some(part => String(part).toLowerCase().includes(query))) : false);
		if (!matchesQuery) return false;
		if (state.filters.status !== 'all' && item.status !== state.filters.status) return false;
		const recordDate = new Date(item.createdAt || item.visitAt || item.startAt);
		if (state.filters.date === 'today' && recordDate.toDateString() !== new Date().toDateString()) return false;
		if (['7', '30'].includes(state.filters.date) && Date.now() - recordDate.getTime() > Number(state.filters.date) * 86400000) return false;
		if (state.filters.date === 'custom') {
			if (state.filters.from && recordDate < new Date(`${state.filters.from}T00:00:00`)) return false;
			if (state.filters.to && recordDate > new Date(`${state.filters.to}T23:59:59`)) return false;
		}
		return true;
	}
	function doctorName(doctorId) { return state.data.doctors.find(item => item.id === doctorId)?.name || 'Doctor removed'; }
	function cabinName(cabinId) { return state.data.cabins.find(item => item.id === cabinId)?.name || cabinId || 'Cabin removed'; }
	function recordKind(record) { return state.data.labOrders.includes(record) ? 'labOrders' : state.data.appointments.includes(record) ? 'appointments' : 'bookings'; }
	function sumExtras(extras) { return (extras || []).reduce((sum, item) => sum + Number(item.price || 0), 0); }

	function go(module, tab = 0) { location.hash = routeHref(module, tab); }

	appRoot.addEventListener('click', async event => {
		const button = event.target.closest('[data-action], [data-route], [data-tab]');
		if (!button) return;
		if (button.dataset.route) { go(button.dataset.route, Number(button.dataset.routeTab || 0)); return; }
		if (button.dataset.tab !== undefined) { go(state.route.module, Number(button.dataset.tab)); return; }
		const action = button.dataset.action;
		if (button.classList.contains('modal-backdrop') && event.target !== button) return;
		if (action === 'logout') { state.user = null; state.modal = null; render(); return; }
		if (action === 'minimize') window.hospital?.minimize();
		if (action === 'maximize') window.hospital?.toggleMaximize();
		if (action === 'close') window.hospital?.close();
		if (action === 'check-updates') {
			try { await window.hospital?.checkForUpdates(); }
			catch (error) { toast(`Could not check for updates: ${error.message}`, true); }
		}
		if (action === 'download-update') {
			try { await window.hospital?.downloadUpdate(); }
			catch (error) { toast(`Could not download update: ${error.message}`, true); }
		}
		if (action === 'install-update') {
			try { await window.hospital?.installUpdate(); }
			catch (error) { toast(`Could not install update: ${error.message}`, true); }
		}
		if (action === 'new-lab') go('counter', 1);
		if (action === 'go-tests') go('management', 0);
		if (action === 'book-doctor') { sessionStorage.setItem('hmss-doctor', button.dataset.doctor); go('appointment', button.dataset.pre ? 2 : 1); }
		if (action === 'book-cabin') { state.modal = { type: 'booking', cabinId: button.dataset.cabin }; render(); }
		if (action === 'renew-booking') { state.modal = { type: 'renew', id: button.dataset.id }; render(); }
		if (action === 'view-record') { state.modal = { type: 'record', kind: button.dataset.kind, id: button.dataset.id }; render(); }
		if (action === 'print-record') { state.modal = { type: 'print', kind: button.dataset.kind, id: button.dataset.id }; render(); setTimeout(() => window.print(), 100); }
		if (action === 'print-summary') { state.modal = { type: 'summary' }; render(); }
		if (action === 'print-summary-now') { setTimeout(() => window.print(), 80); }
		if (action === 'add-item') { state.modal = { type: 'item', kind: button.dataset.kind }; render(); }
		if (action === 'edit-item') { const item = state.data[button.dataset.kind].find(entry => entry.id === button.dataset.id); state.modal = { type: 'item', kind: button.dataset.kind, item }; render(); }
		if (action === 'delete-item') {
			state.modal = { type: 'confirm', title: 'Delete this item?', message: 'This only removes it from the active catalog. Existing patient records are kept.', confirmLabel: 'Delete item', callback: async () => { state.data[button.dataset.kind] = state.data[button.dataset.kind].filter(entry => entry.id !== button.dataset.id); await persist('Item deleted.'); render(); } };
			render();
		}
		if (action === 'close-modal') { state.modal = null; render(); }
		if (action === 'confirm-action') { const callback = state.modal?.callback; state.modal = null; if (callback) await callback(); else render(); }
		if (action === 'deliver-lab') {
			const order = state.data.labOrders.find(item => item.id === button.dataset.id);
			if (order) { order.status = 'Delivered'; order.deliveredAt = nowISO(); order.due = 0; order.advance = order.net; await persist('Report marked as handed over.'); render(); }
		}
		if (action === 'complete-appointment') {
			const record = state.data.appointments.find(item => item.id === button.dataset.id);
			if (record) { record.status = 'Done'; record.completedAt = nowISO(); await persist('Appointment completed.'); render(); }
		}
		if (action === 'release-booking') {
			const booking = state.data.bookings.find(item => item.id === button.dataset.id);
			if (booking) { booking.status = 'Completed'; booking.releasedAt = nowISO(); await persist('Cabin released.'); render(); }
		}
		if (action === 'choose-image') {
			const image = await window.hospital?.chooseImage();
			const input = document.querySelector('#item-form [name="photo"]');
			if (image && input) input.value = image;
		}
	});

	appRoot.addEventListener('input', event => {
		if (event.target.matches('[data-search], [data-global-search]')) {
			state.query = event.target.value;
			const cursor = event.target.selectionStart;
			const selector = event.target.matches('[data-global-search]') ? '[data-global-search]' : '[data-search]';
			render();
			const replacement = document.querySelector(selector);
			replacement?.focus(); replacement?.setSelectionRange(cursor, cursor);
		}
		if (event.target.form?.id === 'lab-form' && ['testIds', 'discount'].includes(event.target.name)) updateBillPreview();
		if (event.target.form?.id === 'appointment-form' && ['contact', 'patientName'].includes(event.target.name)) updatePatientHistory(event.target.form.elements.contact.value, event.target.form.elements.patientName.value);
		if (event.target.form?.id === 'appointment-form' && event.target.name === 'doctorId') updateVisitPrice();
	});

	appRoot.addEventListener('change', event => {
		if (event.target.matches('[data-sort]')) {
			state.filters.sort = event.target.value;
			render();
		}
		if (event.target.matches('[data-date-filter]')) {
			state.filters.date = event.target.value;
			state.filters.from = ''; state.filters.to = '';
			render();
		}
		if (event.target.matches('[data-status-filter]')) {
			state.filters.status = event.target.value;
			render();
		}
		if (event.target.matches('[data-range]')) {
			state.filters[event.target.dataset.range] = event.target.value;
			render();
		}
		if (event.target.form?.id === 'lab-form') updateBillPreview();
	});

	appRoot.addEventListener('submit', async event => {
		event.preventDefault();
		const form = event.target;
		const values = Object.fromEntries(new FormData(form).entries());
		if (form.id === 'login-form') {
			const user = state.data.users.find(item => item.username.toLowerCase() === values.username.trim().toLowerCase() && item.password === values.password);
			if (!user) { document.getElementById('login-error').textContent = 'That username and password did not match.'; return; }
			state.user = user; sessionStorage.setItem('hmss-session', user.username); if (!location.hash) location.hash = routeHref('counter', 0); render(); return;
		}
		if (form.id === 'item-form') return saveCatalogItem(form, values);
		if (form.id === 'lab-form') return saveLabOrder(form);
		if (form.id === 'appointment-form') return saveAppointment(form, values);
		if (form.id === 'booking-form') return saveBooking(form, values);
	});

	function updateBillPreview() {
		const form = document.getElementById('lab-form'); if (!form) return;
		const selected = [...form.elements.testIds.selectedOptions].map(option => state.data.tests.find(test => test.id === option.value)).filter(Boolean);
		const subtotal = selected.reduce((sum, test) => sum + Number(test.price), 0);
		document.getElementById('bill-test-count').textContent = selected.length;
		document.getElementById('bill-subtotal').textContent = money(subtotal);
		const net = Math.max(0, subtotal - moneyInput(form.elements.discount.value));
		document.getElementById('bill-total').textContent = money(net);
		document.getElementById('bill-words').textContent = amountInWords(net);
	}

	function updatePatientHistory(contact, patientName) {
		const target = document.getElementById('patient-history'); if (!target) return;
		const history = state.data.appointments.filter(item => matchesPatient(item, contact, patientName)).sort(byDateDesc);
		if ((!contact || contact.length < 5) && (!patientName || patientName.trim().length < 3)) { target.textContent = 'Enter the patient\'s name or contact number to check previous visits.'; return; }
		const recent = history[0];
		if (!recent) { target.innerHTML = '<b>New patient</b> · No previous visit found for this number.'; return; }
		const months = (Date.now() - new Date(recent.visitAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
		const patientType = months > 3 ? 'Updated new patient' : 'Returning patient';
		target.innerHTML = `<b>${patientType}</b> · Last visit ${escapeHtml(dateOnly(recent.visitAt))} with ${escapeHtml(doctorName(recent.doctorId))}.`;
		const form = document.getElementById('appointment-form');
		if (form?.elements.doctorId.value) updateVisitPrice();
	}

	function updateVisitPrice() {
		const form = document.getElementById('appointment-form'); if (!form) return;
		const doctor = state.data.doctors.find(item => item.id === form.elements.doctorId.value);
		if (!doctor) return;
		const history = state.data.appointments.filter(item => matchesPatient(item, form.elements.contact.value, form.elements.patientName.value)).sort(byDateDesc)[0];
		const returning = history && (Date.now() - new Date(history.visitAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44) <= 3;
		form.elements.price.value = returning ? doctor.oldPrice : doctor.newPrice;
	}

	function matchesPatient(record, contact, patientName) {
		const phoneMatches = contact && contact.trim().length >= 5 && record.contact === contact.trim();
		const nameMatches = patientName && patientName.trim().length >= 3 && record.patientName.toLowerCase() === patientName.trim().toLowerCase();
		return phoneMatches || nameMatches;
	}

	async function saveCatalogItem(form, values) {
		const type = form.dataset.kind;
		const records = state.data[type];
		const existing = records.find(item => item.id === form.dataset.id);
		const item = { ...values };
		for (const key of Object.keys(item)) if (['price', 'newPrice', 'oldPrice'].includes(key)) item[key] = moneyInput(item[key]);
		if (type === 'tests') {
			if (records.some(entry => entry.code.toLowerCase() === item.code.trim().toLowerCase() && entry.id !== existing?.id)) return toast('That test code is already in use.', true);
			item.code = item.code.trim().toUpperCase();
		}
		if (type === 'doctors') item.id = existing?.id || id('D');
		else if (type === 'cabins') item.id = existing?.id || id('C');
		else if (type === 'agents') item.id = existing?.id || id('A');
		else if (type === 'referrers') item.id = existing?.id || id('R');
		else item.id = existing?.id || id('T');
		if (existing) Object.assign(existing, item);
		else records.unshift(item);
		state.modal = null; await persist(existing ? 'Changes saved.' : 'New item added.'); render();
	}

	async function saveLabOrder(form) {
		const formData = new FormData(form);
		const selectedIds = [...form.elements.testIds.selectedOptions].map(option => option.value);
		if (!selectedIds.length) return toast('Choose at least one clinical test.', true);
		const selectedTests = state.data.tests.filter(test => selectedIds.includes(test.id)).map(test => ({ code: test.code, name: test.name, price: Number(test.price) }));
		const subtotal = selectedTests.reduce((sum, test) => sum + test.price, 0);
		const discount = Math.min(subtotal, moneyInput(formData.get('discount')));
		const net = subtotal - discount;
		const advance = formData.get('fullPaid') === 'on' ? net : Math.min(net, moneyInput(formData.get('advance')));
		const doctorIds = [...form.elements.doctorIds.selectedOptions].map(option => option.value);
		const doctors = doctorIds.map(doctorId => state.data.doctors.find(doctor => doctor.id === doctorId)).filter(Boolean).map(doctor => ({ id: doctor.id, name: doctor.name, specialty: doctor.specialty }));
		const referrer = state.data.referrers.find(item => item.id === formData.get('referrerId'));
		const billId = uniqueBillId();
		const record = { id: id('LAB'), billId, patientName: String(formData.get('patientName')).trim(), age: Number(formData.get('age')), gender: formData.get('gender'), contact: String(formData.get('contact')).trim(), doctors, doctorIds, referrerId: referrer?.id || '', referrerName: referrer?.name || '', tests: selectedTests, testNames: selectedTests.map(test => test.name).join(', '), subtotal, discount, net, advance, due: net - advance, fullPaid: advance >= net, createdAt: nowISO(), deliveryAt: new Date(formData.get('deliveryAt')).toISOString(), remarks: formData.get('remarks') || '', note: formData.get('note') || '', description: formData.get('description') || '', status: 'Pending' };
		state.data.labOrders.unshift(record); await persist('Test bill saved.'); openRecord('labOrders', record.id, true);
	}

	function uniqueBillId() {
		let billId;
		do { billId = `P${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`; }
		while (state.data.labOrders.some(item => item.billId === billId));
		return billId;
	}

	async function saveAppointment(form, values) {
		const doctor = state.data.doctors.find(item => item.id === values.doctorId);
		if (!doctor) return toast('Choose a doctor before saving.', true);
		const prior = state.data.appointments.filter(item => matchesPatient(item, values.contact, values.patientName)).sort(byDateDesc)[0];
		const monthsSincePrior = prior ? (Date.now() - new Date(prior.visitAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44) : Infinity;
		const recent = prior && monthsSincePrior <= 3;
		const isPrebooked = form.dataset.prebooked === 'true';
		const record = { id: id('APT'), recordId: id('VIS'), patientId: recent ? prior.patientId : id('PAT'), patientName: String(values.patientName).trim(), contact: String(values.contact).trim(), age: Number(values.age), gender: values.gender, doctorId: doctor.id, visitAt: new Date(values.visitAt).toISOString(), fromTime: values.fromTime, toTime: values.toTime, price: moneyInput(values.price), patientType: recent ? 'Returning patient' : prior ? 'Updated new patient' : 'New patient', status: isPrebooked ? 'Pending' : 'Done', createdAt: nowISO(), historyRecordId: prior?.recordId || '' };
		state.data.appointments.unshift(record); await persist(isPrebooked ? 'Appointment reserved.' : 'Visit completed.'); openRecord('appointments', record.id, true);
	}

	async function saveBooking(form, values) {
		const existing = state.data.bookings.find(item => item.id === form.dataset.id);
		const cabinId = form.dataset.cabin;
		const cabin = state.data.cabins.find(item => item.id === cabinId);
		const days = Math.max(1, Math.ceil((new Date(values.endAt) - new Date(values.startAt)) / 86400000));
		if (new Date(values.endAt) <= new Date(values.startAt)) return toast('Release time must be after admission.', true);
		const extras = parseExtras(values.extras);
		const dailyRate = moneyInput(values.price);
		const subtotal = (dailyRate + sumExtras(extras)) * days;
		const discount = Math.min(subtotal, moneyInput(values.discount));
		const net = subtotal - discount;
		const advance = Math.min(net, moneyInput(values.advance));
		if (existing) {
			existing.endAt = new Date(values.endAt).toISOString(); existing.days += days; existing.subtotal += subtotal; existing.net += net; existing.due += net; existing.status = 'Occupied';
			existing.advance += advance; existing.due = Math.max(0, existing.net - existing.advance); existing.extras.push(...extras); existing.notes = values.notes || existing.notes;
			await persist('Cabin stay renewed.'); openRecord('bookings', existing.id, true); return;
		}
		const record = { id: id('CAB'), bookingId: id('BOOK'), cabinId: cabin?.id || cabinId, patientName: String(values.patientName).trim(), contact: String(values.contact).trim(), age: Number(values.age), gender: values.gender, startAt: new Date(values.startAt).toISOString(), endAt: new Date(values.endAt).toISOString(), days, dailyRate, extras, extrasText: values.extras, subtotal, discount, net, advance, due: net - advance, notes: values.notes || '', status: 'Occupied', createdAt: nowISO() };
		state.data.bookings.unshift(record); await persist('Cabin admission saved.'); openRecord('bookings', record.id, true);
	}

	function parseExtras(text) {
		return String(text || '').split(',').map(part => { const [name, price] = part.split(':'); return { name: name.trim(), price: moneyInput(price) }; }).filter(item => item.name);
	}

	function amountInWords(amount) {
		const small = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
		const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
		const underThousand = value => {
			const words = [];
			if (value >= 100) { words.push(`${small[Math.floor(value / 100)]} hundred`); value %= 100; }
			if (value >= 20) { words.push(tens[Math.floor(value / 10)]); value %= 10; }
			if (value) words.push(small[value]);
			return words.join(' ');
		};
		let value = Math.max(0, Math.round(Number(amount) || 0));
		if (!value) return 'Zero taka only';
		const words = [];
		for (const [size, label] of [[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand'], [100, 'hundred']]) {
			if (value >= size) { words.push(`${underThousand(Math.floor(value / size))} ${label}`); value %= size; }
		}
		if (value) words.push(underThousand(value));
		return `${words.join(' ')} taka only`;
	}

	function expireCabinStays() {
		if (!state.data) return;
		const expired = state.data.bookings.filter(booking => booking.status === 'Occupied' && new Date(booking.endAt) <= new Date());
		if (!expired.length) return;
		expired.forEach(booking => { booking.status = 'Completed'; booking.releasedAt = booking.endAt; });
		persist();
		if (state.user && state.route.module === 'booking') render();
	}

	function openRecord(kind, recordId, isPrint = false) { state.modal = { type: isPrint ? 'print' : 'record', kind, id: recordId }; go(state.route.module, state.route.tab); render(); }

	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && state.modal) { state.modal = null; render(); }
		if (event.ctrlKey && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('[data-search]')?.focus(); }
		if (event.key === 'F2' && state.user) { event.preventDefault(); go('counter', 1); }
	});
	document.addEventListener('contextmenu', event => event.preventDefault());
	window.addEventListener('hashchange', routeFromHash);

	async function start() {
		try {
			if (window.hospital?.getUpdaterState) state.updater = await window.hospital.getUpdaterState();
			else state.updater = { appVersion: 'Browser preview', supported: false, status: 'unsupported', percent: 0, logs: [] };
			if (window.hospital?.load) state.data = await window.hospital.load();
			else state.data = JSON.parse(localStorage.getItem('hmss-data') || 'null') || fallbackData();
			const username = sessionStorage.getItem('hmss-session');
			state.user = state.data.users.find(item => item.username === username) || null;
			expireCabinStays();
			routeFromHash();
		} catch (error) {
			appRoot.innerHTML = `${windowBar()}<div class="empty"><strong>Workspace could not open</strong>${escapeHtml(error.message)}</div>`;
		}
	}

	function fallbackData() {
		return { users: [{ username: 'admin', password: 'admin123', name: 'Administrator' }], tests: [], doctors: [], agents: [], referrers: [], cabins: [], labOrders: [], appointments: [], bookings: [] };
	}

	setInterval(expireCabinStays, 60000);
	window.hospital?.onUpdaterState(update => {
		state.updater = update;
		if (state.user && state.route.module === 'management' && state.route.tab === 4) render();
	});
	start();
})();
