(() => {
	'use strict';

	const modules = {
		counter: { label: 'Counter', icon: '▤', tabs: ['Overview', 'New test', 'Checkout', 'Directory'] },
		booking: { label: 'Cabins', icon: '⌂', tabs: ['Cabins', 'Booking history'] },
		appointment: { label: 'Appointment', icon: '◷', tabs: ['Doctors', 'Live appointment', 'Pre-booked', 'Records'] },
		management: { label: 'Management', icon: '⚙', tabs: ['Tests', 'Doctors', 'Referrals', 'Cabins', 'Room bills', 'Dev Tunnel'] },
		archive: { label: 'Archive & reports', icon: '▥', tabs: ['Live summary', 'Tests', 'Doctors', 'Bookings', 'Analytics', 'Leads', 'Room payments'] }
	};
	const appRoot = document.getElementById('app');
	const toastRoot = document.getElementById('toast-region');
	const HOSPITAL_NAME = 'Kabirhat Private Hospital & Normal Delivery Center';
	const HOSPITAL_LOGO = '../site_assets/Hospital_Logo.svg';
	const state = { data: null, user: null, route: { module: 'counter', tab: 0 }, query: '', filters: { date: 'all', status: 'all', sort: 'newest', from: '', to: '' }, analytics: { period: 'month', page: 0, pageSize: 25, doctorPage: 0, doctorPageSize: 12, doctorSearch: '', testPage: 0, testPageSize: 10, testSearch: '', chartMode: 'revenue', chartZoom: 1, chartMotion: true, chartRotate: true, destroyVisualization: null }, updater: { appVersion: 'Loading…', supported: false, status: 'starting', percent: 0, logs: [] }, firebaseSync: null, terminalLogs: [], searchIndex: null, searchResults: null, modal: null, saving: false };
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
	const allRecords = () => [...state.data.labOrders, ...state.data.appointments, ...state.data.bookings, ...state.data.roomClaims];

	async function persist(message) {
		if (state.saving) return;
		state.saving = true;
		state.searchIndex = null;
		state.searchResults = null;
		try {
			if (window.hospital?.save) await window.hospital.save(state.data);
			else localStorage.setItem('hmss-data', JSON.stringify(state.data));
			if (message) logTerminal('info', message);
			if (message) toast(message);
			return true;
		} catch (error) {
			logTerminal('error', error.message);
			toast(`Could not save changes: ${error.message}`, true);
			return false;
		} finally { state.saving = false; }
	}

	async function queueFirebaseRecord(kind, record) {
		if (!window.hospital?.queueFirebaseRecord) return;
		try {
			await window.hospital.queueFirebaseRecord(kind, record);
			logTerminal('info', `New ${kind} record added to the Firebase upload queue.`);
		} catch (error) {
			logTerminal('error', `Firebase upload queue error: ${error.message}`);
			toast(`Saved locally, but the Firebase upload queue could not be updated: ${error.message}`, true);
		}
	}

	function logTerminal(level, message) {
		state.terminalLogs.push({ time: new Date().toLocaleTimeString('en-GB', { hour12: false }), level, message: String(message) });
		state.terminalLogs = state.terminalLogs.slice(-100);
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
		state.analytics.destroyVisualization?.();
		state.analytics.destroyVisualization = null;
		if (!state.user) return renderLogin();
		const module = activeModule();
		appRoot.innerHTML = `${windowBar()}${applicationHeader()}<div class="app-shell"><aside class="sidebar">${sidebar()}</aside><section class="workspace"><header class="topbar"><div class="breadcrumb"><span>Workspace</span><span class="crumb-divider">/</span><b>${module.label}</b></div><div class="topbar-right"><span class="clock" id="clock"></span><button class="button button-secondary button-small" data-action="logout">↪&nbsp; Sign out</button></div></header><main class="content" id="content">${renderPage()}</main><footer class="statusbar"><span class="status-ready"><i></i>Ready</span><span>Data store&nbsp; <b>Local JSON</b></span><span>Records&nbsp; <b>${allRecords().length}</b></span><span class="status-user">${escapeHtml(state.user.name)}</span></footer></section></div>${state.modal ? renderModal() : ''}`;
		mountTerminalPanel();
		mountSearchScanners();
		mountReferralSource();
		mountProfileEditor();
		if (state.route.module === 'archive' && state.route.tab === 4) {
			const chart = appRoot.querySelector('[data-analytics-3d]');
			if (chart) {
				state.analytics.destroyVisualization = window.HospitalAnalyticsVisuals.mountRevenueChart(chart, state.analytics.monthlyTrend || [], {
					mode: state.analytics.chartMode,
					zoom: state.analytics.chartZoom,
					motion: state.analytics.chartMotion,
					rotate: state.analytics.chartRotate
				});
				mountAnalyticsControls(chart);
			}
			mountRoomAnalyticsPanel();
		}
		if (window.JsBarcode) document.querySelectorAll('[data-barcode]').forEach(barcode => window.JsBarcode(barcode, barcode.dataset.barcode, { format: 'CODE128', displayValue: true, font: 'Courier New', fontSize: 12, width: 2.4, height: 42, margin: 6, textMargin: 2 }));
		updateClock();
		if (state.route.module === 'appointment' && [1, 2].includes(state.route.tab)) { updateVisitPrice(); fillDoctorSchedule(); }
	}

	function mountAnalyticsControls(chart) {
		const wrapper = chart.parentElement;
		const controls = document.createElement('div');
		controls.className = 'analytics-3d-controls';
		controls.innerHTML = `<label>3D view<select class="control" data-analytics-chart-mode><option value="revenue" ${state.analytics.chartMode === 'revenue' ? 'selected' : ''}>Billed vs collected</option><option value="rooms" ${state.analytics.chartMode === 'rooms' ? 'selected' : ''}>Room payments vs due</option><option value="activity" ${state.analytics.chartMode === 'activity' ? 'selected' : ''}>Records vs appointments</option></select></label><label>Zoom <input type="range" min="75" max="150" step="25" value="${Math.round(state.analytics.chartZoom * 100)}" data-analytics-3d-zoom><output>${Math.round(state.analytics.chartZoom * 100)}%</output></label><button class="button button-secondary button-small" data-action="toggle-analytics-motion" aria-pressed="${state.analytics.chartMotion}">${state.analytics.chartMotion ? 'Pause animation' : 'Play animation'}</button><button class="button button-secondary button-small" data-action="toggle-analytics-rotation" aria-pressed="${state.analytics.chartRotate}">${state.analytics.chartRotate ? 'Stop rotation' : 'Rotate chart'}</button>`;
		wrapper.prepend(controls);
		const title = chart.closest('.panel')?.querySelector('.panel-head h2');
		if (title) title.textContent = ({ revenue: '12-month revenue & collection', rooms: '12-month room payments & balances', activity: '12-month records & appointments' })[state.analytics.chartMode] || '12-month revenue & collection';
		const labels = state.analytics.chartMode === 'rooms' ? ['Room collected', 'Room due']
			: state.analytics.chartMode === 'activity' ? ['All records', 'Appointments']
				: ['Billed', 'Collected'];
		chart.parentElement.parentElement.querySelectorAll('.analytics-3d-legend span').forEach((item, index) => {
			item.lastChild.textContent = labels[index];
		});
	}

	function mountRoomAnalyticsPanel() {
		const anchor = appRoot.querySelector('.analytics-breakdown-grid');
		if (!anchor) return;
		const month = HospitalRoomBilling.currentMonth();
		const currentBills = state.data.roomBills.filter(bill => bill.billingMonth === month);
		const openBalance = currentBills.reduce((sum, bill) => sum + Math.max(0, bill.monthlyAmount - bill.received), 0);
		const roomPayments = allRecords().filter(record => record.kind === 'roomClaims' && isInAnalyticsPeriod(record, state.analytics.period));
		const roomCollected = roomPayments.reduce((sum, claim) => sum + Number(claim.amount || 0), 0);
		const occupiedCabins = state.data.bookings.filter(booking => booking.status === 'Occupied').length;
		const floorRevenue = new Map(state.data.floors.map(floor => [floor.id, { name: floor.name, received: 0, claims: 0 }]));
		for (const claim of roomPayments) {
			const entry = floorRevenue.get(claim.floorId);
			if (!entry) continue;
			entry.received += Number(claim.amount || 0);
			entry.claims += 1;
		}
		const rows = [...floorRevenue.values()].sort((left, right) => right.received - left.received).map(item =>
			`<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${item.claims.toLocaleString()}</td><td>${money(item.received)}</td></tr>`
		);
		const section = document.createElement('section');
		section.className = 'analytics-section room-analytics-section';
		section.innerHTML = `<div class="analytics-section-heading"><div><span class="analytics-kicker">ROOMS &amp; ADMISSIONS</span><h2>Room billing and cabin utilization</h2><p>Monthly room dues, collections in the selected reporting period, and current cabin occupancy.</p></div><button class="button button-secondary button-small" data-route="archive" data-route-tab="6">Open room payment archive</button></div><div class="room-analytics-grid">${metrics([{ label: 'Rooms tracked', value: state.data.rooms.length, note: `${state.data.floors.length} floors` }, { label: 'Current room balance', value: money(openBalance), note: month }, { label: 'Room payments in period', value: money(roomCollected), note: `${roomPayments.length} receipts`, accent: true }, { label: 'Cabins occupied', value: `${occupiedCabins} / ${state.data.cabins.length}`, note: 'Current occupancy' }])}<div class="room-analytics-floor">${panel('Room collections by floor', table(['Floor', 'Receipts', 'Collected'], rows))}</div></div>`;
		anchor.before(section);
	}

	function hospitalLogo(className, alt = '') {
		return `<img class="${className}" src="${HOSPITAL_LOGO}" alt="${escapeHtml(alt)}">`;
	}

	function windowBar() {
		return `<div class="windowbar"><div class="window-brand">${hospitalLogo('brand-mark')} ${escapeHtml(HOSPITAL_NAME)}</div><div class="window-actions"><button aria-label="Minimize" data-action="minimize">−</button><button aria-label="Maximize" data-action="maximize">□</button><button class="close" aria-label="Close" data-action="close">×</button></div></div>`;
	}

	function applicationHeader() {
		return `<header class="application-header"><div class="application-nav"><div class="product-lockup">${hospitalLogo('product-symbol')}<span><strong>${escapeHtml(HOSPITAL_NAME)}</strong><small>Clinical management system</small></span></div><nav class="module-nav">${Object.entries(modules).map(([key, item], index) => `<button class="module-link ${state.route.module === key ? 'active' : ''}" data-route="${key}"><span class="module-number">0${index + 1}</span>${item.label}</button>`).join('')}</nav><div class="department-label">Clinical Services</div></div><div class="accelerator-bar"><div class="accelerator-list"><span class="accelerator-caption">SHORTCUTS</span><span><kbd>F1</kbd> Help</span><button data-route="counter" data-route-tab="1"><kbd>F2</kbd> New test</button><button data-route="appointment" data-route-tab="1"><kbd>F3</kbd> Live visit</button><button data-route="booking" data-route-tab="0"><kbd>F5</kbd> Admit</button><span><kbd>F9</kbd> Print</span><span><kbd>F12</kbd> Lock</span></div><div class="system-health"><i></i>Local workstation <span>·</span> Ready</div></div></header>`;
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
		appRoot.innerHTML = `${windowBar()}<main class="login-screen"><section class="login-art"><div class="login-brand">${hospitalLogo('login-logo')}<div><strong>${escapeHtml(HOSPITAL_NAME)}</strong><small>LOCAL CARE · CONNECTED TEAM</small></div></div><div class="login-hero-copy"><span class="login-kicker">HOSPITAL MANAGEMENT SYSTEM</span><h1>Care, coordinated with confidence.</h1><p>A calmer workspace for the people who keep every visit, report and room moving.</p><div class="login-pill-row"><span>●&nbsp; Private workspace</span><span>◈&nbsp; Local-first records</span></div></div><div class="login-art-footer"><span>Clinical operations, thoughtfully connected.</span><span class="login-art-orbit" aria-hidden="true"></span></div></section><section class="login-form-side"><form class="login-panel" id="login-form"><span class="login-form-kicker">SECURE WORKSTATION ACCESS</span><h2>Welcome back</h2><p>Sign in to continue to your hospital workspace.</p><div class="field"><label for="username">Username</label><div class="login-input-wrap"><span aria-hidden="true">◎</span><input id="username" name="username" autocomplete="username" placeholder="Enter your username" required></div></div><div class="field"><label for="password">Password</label><div class="login-input-wrap"><span aria-hidden="true">⌑</span><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">◉</button></div></div><p class="error-text" id="login-error" role="alert"></p><button class="button button-primary login-submit" type="submit"><span>Sign in securely</span><span aria-hidden="true">→</span></button><div class="login-assurance"><span>◆</span><span>Your session is protected on this workstation.</span></div></form></section></main>`;
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

	function scanControl() {
		return `<button class="button button-secondary button-small scan-button" data-action="focus-scanner" title="Focus barcode scanner">▦&nbsp; Scan</button><input class="scan-capture" data-scan-input aria-label="Barcode scanner input" autocomplete="off" tabindex="-1">`;
	}

	function mountSearchScanners() {
		appRoot.querySelectorAll('#content .search-field').forEach(searchField => {
			if (searchField.nextElementSibling?.matches('.scan-button, .scan-control')) return;
			const control = document.createElement('span');
			control.className = 'scan-control';
			control.innerHTML = scanControl();
			searchField.after(control);
		});
	}

	function mountReferralSource() {
		const form = appRoot.querySelector('#lab-form');
		if (!form || form.querySelector('[name="agentId"]')) return;
		const field = document.createElement('div');
		field.innerHTML = imageChoiceField('Marketing agent', 'agentId', state.data.agents, false, 'No agent');
		form.querySelector('.form-grid').insertBefore(field, form.querySelector('[data-choice-name="referrerId"]').closest('.field'));
	}

	function imageChoiceField(label, name, items, multiple, emptyLabel = '', selectedIds = []) {
		const choices = [...(emptyLabel ? [{ id: '', name: emptyLabel, photo: '' }] : []), ...items];
		const options = choices.map(item => `<button class="profile-choice ${selectedIds.includes(item.id) ? 'selected' : ''}" type="button" data-action="select-profile-choice" data-choice-id="${escapeHtml(item.id)}" aria-pressed="${selectedIds.includes(item.id)}"><span class="profile-choice-image">${item.photo ? profileImage(item) : `<span class="profile-choice-initials">${escapeHtml(initials(item.name))}</span>`}</span><span class="profile-choice-name">${escapeHtml(item.name)}</span>${item.specialty ? `<small>${escapeHtml(item.specialty)}</small>` : ''}</button>`).join('');
		const hidden = selectedIds.map(value => `<input type="hidden" name="${escapeHtml(name)}" data-choice-value="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join('');
		return `<div class="field profile-choice-field"><label>${escapeHtml(label)}</label><div class="profile-choice-list ${multiple ? 'profile-choice-multiple' : ''}" data-choice-name="${escapeHtml(name)}" data-choice-multiple="${multiple}">${options || '<span class="field-hint">No profiles have been added.</span>'}</div>${hidden}</div>`;
	}

	function profileImage(item) {
		return `<img class="profile-thumb" src="${escapeHtml(item.photo || '../UI/profile-placeholder.svg')}" alt="${escapeHtml(item.name)}" onerror="this.src='../UI/profile-placeholder.svg'">`;
	}

	function mountProfileEditor() {
		const form = appRoot.querySelector('#item-form');
		if (!form || !['doctors', 'agents', 'referrers'].includes(form.dataset.kind)) return;
		const record = state.data[form.dataset.kind].find(item => item.id === form.dataset.id) || {};
		const category = form.dataset.kind;
		const editor = document.createElement('div');
		editor.className = 'field full profile-editor';
		editor.innerHTML = `<label>Profile photo · Optional</label><div class="profile-dropzone" data-profile-drop><img class="profile-preview" src="${escapeHtml(record.photo || 'profile-placeholder.svg')}" alt="Profile preview"><div><strong>Drop an image here</strong><span>PNG, JPG or WebP · Saved in local assets/${category}</span><button class="button button-secondary button-small" type="button" data-action="choose-image">Choose image</button></div></div><input type="hidden" name="photo" value="${escapeHtml(record.photo || '')}">`;
		form.querySelector('.form-grid').append(editor);
	}

	function mountTerminalPanel() {
		if (state.route.module !== 'management' || state.route.tab !== 5) return;
		const content = appRoot.querySelector('#content');
		if (!content || content.querySelector('.terminal-panel')) return;
		const panel = document.createElement('section');
		panel.className = 'terminal-panel';
		panel.innerHTML = `<header><strong>System &amp; terminal logs</strong><span>LOCAL SESSION</span></header><pre>${state.terminalLogs.map(entry => `<span class="terminal-${entry.level}">[${escapeHtml(entry.time)}] ${escapeHtml(entry.level.toUpperCase())} ${escapeHtml(entry.message)}</span>`).join('\n') || '[SYSTEM] Ready.'}</pre>`;
		content.append(panel);
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

	function typeSelectHtml(label, name, items, multiple, placeholder, required = false) {
		const optionsHtml = items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('');
		const hiddenSelect = `<select name="${escapeHtml(name)}" id="field-${escapeHtml(name)}" ${multiple ? 'multiple' : ''} ${required ? 'required' : ''} style="display:none !important;" data-type-select-hidden="${escapeHtml(name)}">${optionsHtml}</select>`;
		const tagsArea = multiple ? `<div class="type-select-tags" data-type-select-tags="${escapeHtml(name)}"></div>` : '';

		return `<div class="field ${multiple ? 'full' : ''} type-select-field" data-type-select-container="${escapeHtml(name)}" data-multiple="${multiple}">
			<label>${escapeHtml(label)}</label>
			${hiddenSelect}
			${tagsArea}
			<div class="type-select-input-wrap">
				<input type="text" class="control type-select-input" placeholder="${escapeHtml(placeholder)}" autocomplete="off" data-type-select-input="${escapeHtml(name)}">
				<span class="type-select-icon">▾</span>
			</div>
			<div class="type-select-dropdown" data-type-select-dropdown="${escapeHtml(name)}" style="display:none;"></div>
		</div>`;
	}

	function syncTypeSelectUI(container) {
		if (!container) return;
		const name = container.dataset.typeSelectContainer;
		const multiple = container.dataset.multiple === 'true';
		const hiddenSelect = container.querySelector(`[data-type-select-hidden="${name}"]`);
		const tagsContainer = container.querySelector(`[data-type-select-tags="${name}"]`);
		const dropdown = container.querySelector(`[data-type-select-dropdown="${name}"]`);
		const input = container.querySelector(`[data-type-select-input="${name}"]`);
		if (!hiddenSelect) return;

		const selectedOptions = [...hiddenSelect.options].filter(opt => opt.selected);

		if (multiple && tagsContainer) {
			tagsContainer.innerHTML = selectedOptions.map(opt =>
				`<span class="type-tag" data-remove-id="${escapeHtml(opt.value)}">${escapeHtml(opt.text)} <button type="button" class="type-tag-remove">×</button></span>`
			).join('') || `<span class="field-hint">No items selected. Type to search.</span>`;
		} else if (!multiple && input) {
			const selectedOpt = selectedOptions[0];
			if (selectedOpt && !input.matches(':focus')) {
				input.value = selectedOpt.text;
			}
		}

		const query = (input ? input.value : '').trim().toLowerCase();
		const allOpts = [...hiddenSelect.options];
		const filtered = allOpts.filter(opt => {
			if (!opt.value) return false;
			if (multiple && opt.selected) return false;
			return opt.text.toLowerCase().includes(query);
		});

		dropdown.innerHTML = filtered.length ? filtered.map(opt =>
			`<div class="type-select-item" data-select-id="${escapeHtml(opt.value)}">${escapeHtml(opt.text)}</div>`
		).join('') : `<div class="type-select-empty">No matching records found</div>`;
	}

	function renderLabForm() {
		if (!state.data.tests.length) return `${pageHeading('New test bill', 'Add a clinical test in Management before registering a patient.')}${panel('No tests available', emptyButton('go-tests', 'Manage tests'))}`;
		const doctorItems = state.data.doctors.map(doctor => ({ id: doctor.id, label: `${doctor.id} · ${doctor.name} · ${doctor.specialty}` }));
		const referrerItems = state.data.referrers.map(referrer => ({ id: referrer.id, label: `${referrer.id} · ${referrer.name}` }));
		const agentItems = state.data.agents.map(agent => ({ id: agent.id, label: `${agent.id} · ${agent.name}` }));
		const testItems = state.data.tests.map(test => ({ id: test.id, label: `${test.code} · ${test.name} · ${money(test.price)}` }));

		setTimeout(() => {
			appRoot.querySelectorAll('[data-type-select-container]').forEach(container => syncTypeSelectUI(container));
		}, 0);

		return `<style>
.type-select-field { position: relative; }
.type-select-input-wrap { position: relative; display: flex; align-items: center; }
.type-select-icon { position: absolute; right: 10px; color: #718078; pointer-events: none; font-size: 11px; }
.type-select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 100;
    margin-top: 4px;
}
.type-select-item {
    padding: 8px 12px;
    font-size: 12px;
    color: #1e293b;
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
}
.type-select-item:hover { background: #f8fafc; color: #0284c7; }
.type-select-empty {
    padding: 10px 12px;
    font-size: 12px;
    color: #64748b;
    text-align: center;
}
.type-select-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
}
.type-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #e0f2fe;
    color: #0369a1;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
}
.type-tag-remove {
    background: none;
    border: none;
    color: #0369a1;
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
    padding: 0;
    line-height: 1;
}
.type-tag-remove:hover { color: #015282; }
</style>
${pageHeading('New test bill', 'Patient details and selected services are saved as one local record.')}<form id="lab-form"><section class="panel"><header class="panel-head"><div><h2>Patient information</h2><p>Enter the details as they should appear on the printed slip.</p></div></header><div class="panel-body"><div class="form-grid">${field('Patient name', 'patientName', '', 'text', true)}${field('Age', 'age', '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true)}${field('Contact number', 'contact', '', 'tel', true)}${typeSelectHtml('Referring doctor · Optional', 'doctorIds', doctorItems, true, 'Search referring doctor...')}${typeSelectHtml('Special referrer', 'referrerId', referrerItems, false, 'Search special referrer...')}${typeSelectHtml('Marketing agent', 'agentId', agentItems, false, 'Search marketing agent...')}${typeSelectHtml('Clinical tests', 'testIds', testItems, true, 'Search clinical tests...', true)}${field('Report delivery date and time', 'deliveryAt', defaultDateTime(), 'datetime-local', true)}${field('Remarks', 'remarks', '', 'text')}${field('Additional note', 'note', '', 'text')}</div></div></section><div class="two-column"><section class="panel"><header class="panel-head"><div><h2>Payment</h2><p>Discount and advance are optional.</p></div></header><div class="panel-body"><div class="form-grid">${field('Discount (৳)', 'discount', '0', 'number')}${field('Advance received (৳)', 'advance', '0', 'number')}${field('Extra description', 'description', '', 'text')}</div><label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:11px"><input type="checkbox" name="fullPaid"> Mark full amount received</label></div></section><section class="panel"><header class="panel-head"><div><h2>Bill preview</h2><p>Totals update when you save.</p></div></header><div class="panel-body"><div class="notice">The bill ID is generated automatically and checked against existing records.</div><div class="summary-box"><div class="summary-row"><span>Selected tests</span><b id="bill-test-count">0</b></div><div class="summary-row"><span>Subtotal</span><b id="bill-subtotal">৳ 0</b></div><div class="summary-row total"><span>Net payable</span><b id="bill-total">৳ 0</b></div><div class="summary-row"><span>In words</span><b id="bill-words">Zero taka only</b></div></div></div></section></div><div class="form-actions"><button class="button button-secondary" type="button" data-route="counter" data-route-tab="0">Cancel</button><button class="button button-primary" type="submit">Save bill&nbsp; →</button></div></form>`;
	}

	function renderLabList(onlyPending) {
		const title = onlyPending ? 'Report checkout' : 'Test directory';
		const orders = state.data.labOrders.filter(order => !onlyPending || order.status !== 'Delivered').filter(searchRecord).sort(byDateDesc);
		const rows = orders.map(order => `<tr><td><strong>${escapeHtml(order.billId)}</strong></td><td>${escapeHtml(order.patientName)}</td><td>${dateTime(order.createdAt)}</td><td>${dateTime(order.deliveryAt)}</td><td>${money(order.net)}</td><td>${money(order.due)}</td><td><span class="badge ${order.status === 'Delivered' ? 'good' : 'warn'}">${escapeHtml(order.status)}</span></td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="labOrders" data-id="${escapeHtml(order.id)}">View</button>${onlyPending ? `<button class="button button-primary button-small" data-action="deliver-lab" data-id="${escapeHtml(order.id)}">Hand over</button>` : ''}<button class="icon-button" title="Print slip" data-action="print-record" data-kind="labOrders" data-id="${escapeHtml(order.id)}">⎙</button></div></td></tr>`);
		const extra = `<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search bill, patient, test or contact" value="${escapeHtml(state.query)}"></div>${scanControl()}<select class="control" data-sort><option value="oldest" ${state.filters.sort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="newest" ${state.filters.sort === 'newest' ? 'selected' : ''}>Newest first</option></select><span class="badge">${orders.length} records</span></div>`;
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
		const doctors = sortedDoctorsBySchedule();
		return `${pageHeading('Find a specialist', 'Choose a doctor to start a live visit or reserve a future appointment.')}<div class="doctor-grid">${doctors.map(doctor => {
			const status = doctorScheduleStatus(doctor);
			const photo = `<img class="doctor-photo" src="${escapeHtml(doctor.photo || 'profile-placeholder.svg')}" alt="${escapeHtml(doctor.name)}" onerror="this.src='profile-placeholder.svg'">`;
			return `<article class="doctor-card"><div class="doctor-top">${photo}<div><h3>${escapeHtml(doctor.name)}</h3><p>${escapeHtml(doctor.id)} · ${escapeHtml(doctor.title || doctor.specialty)}</p></div></div><div class="doctor-meta"><span class="doctor-specialty">${escapeHtml(doctor.specialty || 'General practice')}</span><span class="doctor-chamber ${status.state}">${escapeHtml(status.label)}</span><span>Contact · ${escapeHtml(doctor.contact || 'Not listed')}</span></div><div class="doctor-bottom"><span class="price-pair">New&nbsp; <b>${money(doctor.newPrice)}</b><br>Returning&nbsp; <b>${money(doctor.oldPrice)}</b></span><div class="inline-actions"><button class="button button-secondary button-small" data-action="book-doctor" data-doctor="${escapeHtml(doctor.id)}" data-pre="true">Reserve</button><button class="button button-primary button-small" data-action="book-doctor" data-doctor="${escapeHtml(doctor.id)}" ${status.state === 'closed' ? 'disabled' : ''}>Start visit</button></div></div></article>`;
		}).join('') || `<div class="empty">Add doctors in Management to begin scheduling.</div>`}</div>`;
	}

	function chamberRange(doctor) {
		const matches = [...String(doctor.visits || '').matchAll(/(\d{1,2}):(\d{2})/g)];
		if (matches.length < 2) return null;
		return matches.slice(0, 2).map(match => Number(match[1]) * 60 + Number(match[2]));
	}

	function doctorScheduleStatus(doctor, now = new Date()) {
		const range = chamberRange(doctor);
		if (!range) return { state: 'closed', label: doctor.visits || 'Schedule on request', start: Infinity };
		const current = now.getHours() * 60 + now.getMinutes();
		const [start, end] = range;
		if (current >= start && current <= end) return { state: 'live', label: `In chamber · ${doctor.visits}`, start };
		const remaining = (start - current + 1440) % 1440;
		if (remaining <= 60) return { state: 'upcoming', label: `Starts in ${remaining} min · ${doctor.visits}`, start };
		return { state: 'closed', label: doctor.visits || 'Schedule on request', start };
	}

	function sortedDoctorsBySchedule() {
		const rank = { live: 0, upcoming: 1, closed: 2 };
		return state.data.doctors.slice().sort((left, right) => {
			const leftStatus = doctorScheduleStatus(left);
			const rightStatus = doctorScheduleStatus(right);
			const timeOrder = leftStatus.state === 'closed' && rightStatus.state === 'closed' ? rightStatus.start - leftStatus.start : leftStatus.start - rightStatus.start;
			return rank[leftStatus.state] - rank[rightStatus.state] || timeOrder || String(left.name).localeCompare(String(right.name));
		});
	}

	function renderAppointmentForm(isPrebooked) {
		const preferredDoctor = sessionStorage.getItem('hmss-doctor') || '';
		const availableDoctors = isPrebooked ? state.data.doctors : state.data.doctors.filter(doctor => ['live', 'upcoming'].includes(doctorScheduleStatus(doctor).state));
		const doctors = availableDoctors.map(doctor => `<option value="${escapeHtml(doctor.id)}" ${preferredDoctor === doctor.id ? 'selected' : ''}>${escapeHtml(doctor.id)} · ${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</option>`).join('');
		if (preferredDoctor) sessionStorage.removeItem('hmss-doctor');
		return `${pageHeading(isPrebooked ? 'Reserve an appointment' : 'Live appointment', 'Patient history is matched by contact number and used to set the visit fee.')}<form id="appointment-form" data-prebooked="${isPrebooked}"><section class="panel"><header class="panel-head"><div><h2>Patient and visit details</h2><p>${isPrebooked ? 'A reserved visit starts as pending.' : 'A walk-in visit is recorded as done after saving.'}</p></div></header><div class="panel-body"><div class="form-grid">${selectField('Doctor', 'doctorId', [], true, false, `<option value="">Choose a doctor</option>${doctors}`)}${field('Appointment date and time', 'visitAt', defaultTodayDateTime(), 'datetime-local', true)}${field('Patient name', 'patientName', '', 'text', true)}${field('Contact number', 'contact', '', 'tel', true)}${field('Age', 'age', '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true)}${field('From', 'fromTime', '', 'time')}${field('To', 'toTime', '', 'time')}${field('Visit fee (৳)', 'price', '', 'number', true)}<div class="field full"><div class="notice" id="patient-history">Enter the patient's contact number to check previous visits.</div></div></div></div></section><div class="form-actions"><button class="button button-secondary" type="button" data-route="appointment" data-route-tab="0">Cancel</button><button class="button button-primary" type="submit">${isPrebooked ? 'Save reservation' : 'Complete visit'}&nbsp; →</button></div></form>`;
	}

	function renderAppointmentList() {
		const records = state.data.appointments.filter(searchRecord).sort(byDateDesc);
		const rows = records.map(record => `<tr><td><strong>${escapeHtml(record.recordId)}</strong></td><td>${escapeHtml(record.patientName)}<br><small>${escapeHtml(record.contact)}</small></td><td>${escapeHtml(doctorName(record.doctorId))}</td><td>${dateTime(record.visitAt)}</td><td>${money(record.price)}</td><td><span class="badge ${record.status === 'Done' ? 'good' : 'warn'}">${escapeHtml(record.status)}</span></td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="appointments" data-id="${escapeHtml(record.id)}">View</button>${record.status === 'Pending' ? `<button class="button button-primary button-small" data-action="complete-appointment" data-id="${escapeHtml(record.id)}">Complete</button>` : `<button class="icon-button" title="Print visit slip" data-action="print-record" data-kind="appointments" data-id="${escapeHtml(record.id)}">⎙</button>`}</div></td></tr>`);
		return `${pageHeading('Appointment records', 'Review scheduled and completed doctor visits.', `<button class="button button-secondary" data-tab="0">Browse doctors</button>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient, doctor or record" value="${escapeHtml(state.query)}"></div>${scanControl()}<select class="control" data-status-filter><option value="all">All statuses</option><option>Pending</option><option>Done</option></select></div>${panel('Visit directory', table(['Record', 'Patient', 'Doctor', 'Visit time', 'Fee', 'Status', 'Actions'], rows))}`;
	}

	function renderBookings() {
		if (state.route.tab === 0) {
			const active = state.data.bookings.filter(booking => booking.status === 'Occupied' && new Date(booking.endAt) > new Date());
			return `${pageHeading('Cabin availability', 'Choose an available cabin to admit a patient. Occupied cabins show their release time.', `<button class="button button-secondary" data-tab="1">Booking history&nbsp; →</button>`)}${metrics([{ label: 'Total cabins', value: state.data.cabins.length }, { label: 'Available now', value: Math.max(0, state.data.cabins.length - active.length), accent: true }, { label: 'Occupied', value: active.length }, { label: 'Current admissions', value: active.length }])}<div class="cabin-grid">${state.data.cabins.map(cabin => { const booking = active.find(item => item.cabinId === cabin.id); return `<article class="cabin-card ${booking ? 'occupied' : 'available'}"><div class="cabin-top"><span class="cabin-number">${escapeHtml(cabin.id.split('-').at(-1))}</span><span class="cabin-status">${booking ? '● Occupied' : '● Available'}</span></div><h3>${escapeHtml(cabin.name)}</h3><p>${booking ? `${escapeHtml(booking.patientName)} · Available ${dateTime(booking.endAt)}` : `${money(cabin.price)} / day`}</p>${booking ? `<div class="inline-actions"><button class="button button-secondary button-small" data-action="view-record" data-kind="bookings" data-id="${escapeHtml(booking.id)}">Details</button><button class="button button-secondary button-small" data-action="add-cabin-service" data-id="${escapeHtml(booking.id)}">Add service</button><button class="button button-secondary button-small" data-action="renew-booking" data-id="${escapeHtml(booking.id)}">Renew</button></div>` : `<button class="button button-primary button-small" data-action="book-cabin" data-cabin="${escapeHtml(cabin.id)}">Admit patient</button>`}</article>`; }).join('') || `<div class="empty">Add cabins in Management to begin bookings.</div>`}</div>`;
		}
		const records = state.data.bookings.filter(searchRecord).sort(byDateDesc);
		const rows = records.map(record => `<tr><td><strong>${escapeHtml(record.bookingId)}</strong></td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(cabinName(record.cabinId))}</td><td>${dateTime(record.startAt)}</td><td>${dateTime(record.endAt)}</td><td>${money(record.net)}</td><td>${money(record.due)}</td><td><span class="badge ${record.status === 'Occupied' ? 'warn' : 'good'}">${escapeHtml(record.status)}</span></td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="bookings" data-id="${escapeHtml(record.id)}">View</button>${record.status === 'Occupied' ? `<button class="button button-danger button-small" data-action="release-booking" data-id="${escapeHtml(record.id)}">Release</button>` : ''}</td></tr>`);
		return `${pageHeading('Cabin booking history', 'Search all admissions and review their payments and duration.')}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search booking, patient or cabin" value="${escapeHtml(state.query)}"></div>${scanControl()}</div>${panel('Bookings', table(['Booking ID', 'Patient', 'Cabin', 'Admitted', 'Release', 'Net', 'Due', 'Status', ''], rows))}`;
	}

	function renderManagement() {
		const type = ['tests', 'doctors', 'referrals', 'cabins', 'room-bills', 'dev-tunnel'][state.route.tab];
		if (type === 'dev-tunnel') return renderDevTunnel();
		if (type === 'room-bills') return renderRoomBills();
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
		const serviceRows = type === 'cabins' ? state.data.indoorServices.filter(searchRecord).map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong>${item.children?.length ? `<br><small>${item.children.map(child => `${escapeHtml(child.name)} · ${money(child.price)}`).join(' · ')}</small>` : ''}</td><td>${Number(item.price) ? money(item.price) : item.children?.length ? 'Parent group' : money(item.price)}</td>${manageActions('indoorServices', item)}</tr>`) : [];
		const servicePanel = type === 'cabins' ? panel('Indoor service items', `<div class="toolbar"><span class="field-hint">Additional priced services available on cabin bills.</span><button class="button button-secondary button-small" data-action="add-item" data-kind="indoorServices">＋ Add service item</button></div>${table(['Service item', 'Price', 'Actions'], serviceRows)}`) : '';
		return `${pageHeading(config.title, config.subtitle, `<button class="button button-primary" data-action="add-item" data-kind="${type}">＋&nbsp; Add ${type === 'tests' ? 'test' : type === 'doctors' ? 'doctor' : 'cabin'}</button>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search ${type}" value="${escapeHtml(state.query)}"></div></div>${panel(config.title, table(config.headers, rows))}${servicePanel}`;
	}

	function renderRoomBills() {
		const month = HospitalRoomBilling.currentMonth();
		const bills = state.data.roomBills.filter(bill => bill.billingMonth === month);
		const received = state.data.roomClaims.filter(claim => claim.billingMonth === month).reduce((sum, claim) => sum + Number(claim.amount || 0), 0);
		const remaining = bills.reduce((sum, bill) => sum + Math.max(0, bill.monthlyAmount - bill.received), 0);
		const floors = state.data.floors.map(floor => {
			const rooms = state.data.rooms.filter(room => room.floorId === floor.id);
			const cards = rooms.map(room => {
				const bill = HospitalRoomBilling.currentBill(state.data, room.id);
				const due = bill ? Math.max(0, bill.monthlyAmount - bill.received) : Number(room.monthlyAmount) || 0;
				const status = due > 0 ? 'Due' : 'Cleared';
				return `<article class="room-tile ${status === 'Due' ? 'room-tile-due' : 'room-tile-cleared'}"><div class="room-tile-top"><span class="room-door" aria-hidden="true">⌂</span><span class="badge ${status === 'Due' ? 'warn' : 'good'}">${status}</span></div><h3>${escapeHtml(room.name)}</h3><span class="room-location">${escapeHtml(floor.name)} · ${month}</span><div class="room-amount-row"><span>Monthly bill</span><strong>${money(bill?.monthlyAmount ?? room.monthlyAmount)}</strong></div><div class="room-amount-row"><span>${due > 0 ? 'Remaining due' : 'Status'}</span><strong class="${due > 0 ? 'room-due-amount' : 'room-cleared-label'}">${due > 0 ? money(due) : 'Paid in full'}</strong></div><div class="room-card-actions">${due > 0 ? `<button class="button button-primary button-small" data-action="claim-room" data-id="${escapeHtml(room.id)}">＋ Receive payment</button>` : '<span class="room-paid-note">Monthly bill settled</span>'}<button class="icon-button" data-action="edit-room" data-id="${escapeHtml(room.id)}" aria-label="Edit room ${escapeHtml(room.name)}">✎</button></div></article>`;
			}).join('') || '<div class="empty room-floor-empty">No rooms on this floor yet. Add a room to start tracking its monthly bill.</div>';
			const canDelete = rooms.length === 0;
			return `<section class="room-floor-card"><header class="room-floor-head"><div><span class="analytics-kicker">FLOOR DIRECTORY</span><h2>${escapeHtml(floor.name)}</h2><p>${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} · Monthly charges are recorded separately for each billing period.</p></div><div class="inline-actions"><button class="button button-secondary button-small" data-action="edit-floor" data-id="${escapeHtml(floor.id)}">Edit floor</button>${canDelete ? `<button class="button button-danger button-small" data-action="delete-floor" data-id="${escapeHtml(floor.id)}">Delete floor</button>` : ''}</div></header><div class="room-grid">${cards}</div></section>`;
		}).join('') || '<div class="empty">Create a floor to begin building the room directory.</div>';
		const claims = state.data.roomClaims.slice().sort(byDateDesc).slice(0, 8).map(claim => `<tr><td><strong>${escapeHtml(claim.claimId)}</strong></td><td>${escapeHtml(claim.roomName)}</td><td>${escapeHtml(claim.billingMonth)}</td><td>${dateTime(claim.createdAt)}</td><td>${money(claim.amount)}</td><td>${escapeHtml(claim.paymentMethod || 'Cash')}</td><td><button class="icon-button" title="Print payment slip" data-action="print-room-claim" data-id="${escapeHtml(claim.id)}">⎙</button></td></tr>`);
		const roomRows = state.data.rooms.map(room => {
			const bill = HospitalRoomBilling.currentBill(state.data, room.id);
			const due = bill ? Math.max(0, bill.monthlyAmount - bill.received) : Number(room.monthlyAmount) || 0;
			const canDelete = !state.data.roomClaims.some(claim => claim.roomId === room.id);
			const actions = `<div class="table-actions"><button class="button button-secondary button-small" data-action="edit-room" data-id="${escapeHtml(room.id)}">Edit</button>${canDelete ? `<button class="button button-danger button-small" data-action="delete-room" data-id="${escapeHtml(room.id)}">Delete</button>` : ''}</div>`;
			return `<tr><td><strong>${escapeHtml(room.name)}</strong></td><td>${escapeHtml(state.data.floors.find(floor => floor.id === room.floorId)?.name || 'Unknown floor')}</td><td>${money(room.monthlyAmount)}</td><td><span class="badge ${due ? 'warn' : 'good'}">${due ? 'Due' : 'Cleared'}</span></td><td>${money(due)}</td><td>${actions}</td></tr>`;
		});
		const managePanel = panel('Manage floors and rooms', `<div class="toolbar"><span class="field-hint">Update a room’s monthly charge or add a new floor. Changes to a monthly charge take effect at the next billing period.</span></div>${table(['Room', 'Floor', 'Monthly charge', 'Current status', 'Balance', 'Actions'], roomRows)}`);
		return `${pageHeading('Room bills', 'Manage floors and monthly room charges. Each month is recorded locally and starts with a fresh due balance.', `<div class="inline-actions"><button class="button button-secondary" data-action="add-floor">＋&nbsp; Add floor</button><button class="button button-primary" data-action="add-room">＋&nbsp; Add room</button></div>`)}${metrics([{ label: 'Rooms', value: state.data.rooms.length, note: `${state.data.floors.length} floors` }, { label: 'Current month collected', value: money(received), note: month, accent: true }, { label: 'Current month due', value: money(remaining), note: 'Open room balances' }, { label: 'Payments recorded', value: state.data.roomClaims.length, note: 'All billing periods' }])}<div class="room-month-note"><span class="room-month-icon">▦</span><span><strong>Billing period · ${escapeHtml(month)}</strong><small>New monthly balances are created automatically when the app opens in a new month. Previous bills and payments remain in the archive.</small></span></div><div class="room-floor-list">${floors}</div>${managePanel}${panel('Recent room payments', table(['Receipt', 'Room', 'Period', 'Received at', 'Amount', 'Method', ''], claims))}`;
	}

	function renderRoomPayments() {
		const claims = state.data.roomClaims.filter(searchRecord).sort(byDateDesc);
		const collected = claims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0);
		const rows = claims.map(claim => `<tr><td><strong>${escapeHtml(claim.claimId)}</strong></td><td>${escapeHtml(claim.roomName)}</td><td>${escapeHtml(claim.floorName)}</td><td>${escapeHtml(claim.billingMonth)}</td><td>${dateTime(claim.createdAt)}</td><td>${money(claim.amount)}</td><td>${escapeHtml(claim.paymentMethod || 'Cash')}</td><td><button class="button button-secondary button-small" data-action="print-room-claim" data-id="${escapeHtml(claim.id)}">View slip</button></td></tr>`);
		return `${pageHeading('Room payment archive', 'Search and print every room payment receipt recorded on this workstation.')} ${metrics([{ label: 'Payments', value: claims.length, note: 'Matching records' }, { label: 'Total received', value: money(collected), note: 'All matching payments', accent: true }, { label: 'Current month', value: HospitalRoomBilling.currentMonth(), note: 'Billing period' }])}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search receipt, room, floor or month" value="${escapeHtml(state.query)}"></div>${scanControl()}</div>${panel('Room payment receipts', table(['Receipt', 'Room', 'Floor', 'Period', 'Date', 'Received', 'Method', ''], rows))}`;
	}

	function renderDevTunnel() {
		const update = state.updater;
		const sync = state.firebaseSync || { available: Boolean(window.hospital?.getFirebaseSyncState), pending: 0, byProject: {}, lastSuccessAt: null, lastError: null };
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
		const firebaseStatus = !sync.available ? 'Firebase sync is unavailable; local JSON records remain available.' : sync.lastError || (sync.pending ? `${sync.pending} record${sync.pending === 1 ? '' : 's'} waiting to upload.` : 'Upload queue is clear.');
		const projects = [['A', 'Clinical tests'], ['B', 'Cabin bookings'], ['C', 'Room payments'], ['D', 'Other records']];
		const projectStatuses = projects.map(([key, label]) => `<div class="sync-project-row"><span><i>${key}</i>${label}</span><strong>${Number(sync.byProject?.[key.toLowerCase()] || 0)} queued</strong></div>`).join('');
		const syncPanel = `<section class="sync-panel"><header class="update-panel-head"><div><span class="update-kicker">WRITE-ONLY FIREBASE RTDB</span><h2>Local upload queue</h2></div><span class="sync-state ${sync.pending ? 'sync-pending' : 'sync-clear'}"><i></i>${sync.pending ? `${sync.pending} pending` : 'Queue clear'}</span></header><p>Hospital records are read from local JSON only. New entries are appended to their assigned Firebase project and retried after connectivity returns. This workstation never downloads RTDB data.</p><div class="sync-project-list">${projectStatuses}</div><div class="update-status-line ${sync.lastError ? 'status-error' : 'status-not-available'}"><i></i>${escapeHtml(firebaseStatus)}</div><div class="sync-footer"><span>${sync.lastSuccessAt ? `Last successful upload · ${dateTime(sync.lastSuccessAt)}` : 'No successful upload recorded yet'}</span><button class="button button-secondary button-small" data-action="retry-firebase-sync" ${!sync.available || !sync.pending ? 'disabled' : ''}>Retry upload queue</button></div><p class="sync-security-note">Anonymous Firebase Auth is used solely for appends. Database rules deny anonymous reads, prohibit overwriting existing entries, and limit website reads to the authorized Google account. Remote Google Analytics reporting is not configured; no Analytics API data is fetched.</p></section>`;
		return `${pageHeading('Version & updates', 'Check the published GitHub release and apply updates without replacing local hospital records.', primaryAction)}<div class="update-grid"><section class="update-panel"><header class="update-panel-head"><div><span class="update-kicker">APPLICATION</span><h2>Installed version</h2></div><span class="update-channel"><i></i> Stable release</span></header><div class="update-version-row"><span class="update-version">v${escapeHtml(update.appVersion || '—')}</span><span class="update-version-label">Current version</span></div><div class="update-divider"></div><div class="update-detail-row"><span>Update source</span><strong>GitHub Releases · ceo-uploads/HMS</strong></div><div class="update-detail-row"><span>Latest checked version</span><strong>${escapeHtml(update.latestVersion || update.availableVersion || 'Not checked')}</strong></div><div class="update-detail-row"><span>Local data</span><strong>Preserved in user profile</strong></div><div class="update-status-line status-${escapeHtml(update.status)}"><i></i>${escapeHtml(message)}</div>${progressVisible ? `<div class="update-progress-wrap"><div class="update-progress-meta"><span>${update.status === 'downloaded' ? 'Download complete' : 'Download progress'}</span><strong>${Math.round(progress)}%</strong></div><div class="update-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div></div>` : ''}${update.releaseNotes ? `<div class="update-release-notes"><strong>Release notes</strong><p>${escapeHtml(update.releaseNotes)}</p></div>` : ''}</section><section class="update-log-panel"><header class="update-panel-head"><div><span class="update-kicker">ACTIVITY</span><h2>Update log</h2></div><span class="update-log-count">${logs.length} entries</span></header><ol class="update-log-list">${logs.map(entry => `<li class="update-log-entry ${entry.level === 'error' ? 'is-error' : ''}"><time>${escapeHtml(new Date(entry.time).toLocaleString())}</time><span>${escapeHtml(entry.message)}</span></li>`).join('') || `<li class="update-log-empty">Update activity will appear here.</li>`}</ol></section></div>${syncPanel}<div class="update-footnote"><span>Updates replace application files only.</span><span>Your JSON database and local assets remain in <code>%APPDATA%\\hmss-desktop</code>.</span></div>`;
	}

	function manageActions(type, item) {
		return `<td><div class="table-actions"><button class="button button-secondary button-small" data-action="edit-item" data-kind="${type}" data-id="${escapeHtml(item.id)}">Edit</button><button class="button button-danger button-small" data-action="delete-item" data-kind="${type}" data-id="${escapeHtml(item.id)}">Delete</button></div></td>`;
	}

	function renderReferralManagement() {
		const agents = state.data.agents.filter(searchRecord).map(agent => `<tr><td><div class="profile-cell">${profileImage(agent)}<strong>${escapeHtml(agent.name)}</strong></div></td><td>${escapeHtml(agent.id)}</td><td>${escapeHtml(agent.contact)}</td><td>${state.data.referrers.filter(referrer => referrer.agentId === agent.id).length}</td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="see-referrers" data-id="${escapeHtml(agent.id)}">See referrers</button><button class="button button-secondary button-small" data-action="agent-dashboard" data-id="${escapeHtml(agent.id)}">Dashboard</button></div></td>${manageActions('agents', agent)}</tr>`);
		const referrers = state.data.referrers.filter(searchRecord).map(referrer => `<tr><td><div class="profile-cell">${profileImage(referrer)}<strong>${escapeHtml(referrer.name)}</strong></div></td><td>${escapeHtml(referrer.id)}</td><td>${escapeHtml(referrer.contact)}</td><td>${escapeHtml(state.data.agents.find(agent => agent.id === referrer.agentId)?.name || 'Unassigned')}</td><td><div class="table-actions"><button class="button button-secondary button-small" data-action="view-referrer" data-id="${escapeHtml(referrer.id)}">Biodata</button><button class="button button-secondary button-small" data-action="referrer-dashboard" data-id="${escapeHtml(referrer.id)}">Dashboard</button></div></td>${manageActions('referrers', referrer)}</tr>`);
		return `${pageHeading('Referral network', 'Keep marketing partners and their special referrers organized.', `<div class="inline-actions"><button class="button button-secondary" data-action="add-item" data-kind="agents">＋&nbsp; Add agent</button><button class="button button-primary" data-action="add-item" data-kind="referrers">＋&nbsp; Add referrer</button></div>`)}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search agent, referrer or contact" value="${escapeHtml(state.query)}"></div>${scanControl()}</div>${panel('Marketing agents', table(['Agent', 'Code', 'Contact', 'Referrers', '', 'Actions'], agents))}${panel('Special referrers', table(['Referrer', 'Code', 'Contact', 'Agent', '', 'Actions'], referrers))}`;
	}

	function renderArchive() {
		const all = allRecords().filter(searchRecord).sort(byDateDesc);
		const tab = state.route.tab;
		if (tab === 4) return renderAnalytics();
		if (tab === 5) return renderLeads();
		if (tab === 6) return renderRoomPayments();
		const kind = tab === 1 ? 'labOrders' : tab === 2 ? 'appointments' : tab === 3 ? 'bookings' : '';
		const selected = kind ? state.data[kind].filter(searchRecord).sort(byDateDesc) : all;
		const collected = selected.reduce((sum, item) => sum + Number(item.advance || 0), 0);
		const due = selected.reduce((sum, item) => sum + Number(item.due || 0), 0);
		const records = selected.map(record => `<tr><td><strong>${escapeHtml(record.billId || record.recordId || record.bookingId || record.claimId)}</strong></td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostic test' : record.doctorId ? 'Doctor visit' : record.kind === 'roomClaims' ? 'Room payment' : 'Cabin booking'))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net || record.price || record.amount)}</td><td>${money(record.advance || 0)}</td><td>${money(record.due || 0)}</td><td><span class="badge ${['Done', 'Delivered', 'Completed', 'Received', 'Cleared'].includes(record.status) ? 'good' : 'warn'}">${escapeHtml(record.status)}</span></td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="${kind || recordKind(record)}" data-id="${escapeHtml(record.id)}">View</button></td></tr>`);
		const archiveActions = `<div class="inline-actions"><button class="button button-secondary" data-route="archive" data-route-tab="4">View analytics</button><button class="button button-secondary" data-action="print-summary">⎙&nbsp; Print summary</button></div>`;
		return `${pageHeading(tab === 0 ? 'Live summary' : activeModule().tabs[tab], 'Review hospital activity, payment status and patient records.', archiveActions)}${metrics([{ label: 'Records', value: selected.length, note: 'In this view' }, { label: 'Received', value: money(collected), accent: true }, { label: 'Remaining due', value: money(due), note: 'Across listed records' }, { label: 'Patient visits', value: new Set(selected.map(item => item.contact).filter(Boolean)).size }])}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient, record or service" value="${escapeHtml(state.query)}"></div><select class="control" data-date-filter><option value="all" ${state.filters.date === 'all' ? 'selected' : ''}>Any date</option><option value="today" ${state.filters.date === 'today' ? 'selected' : ''}>Today</option><option value="7" ${state.filters.date === '7' ? 'selected' : ''}>Last 7 days</option><option value="30" ${state.filters.date === '30' ? 'selected' : ''}>Last 30 days</option><option value="custom" ${state.filters.date === 'custom' ? 'selected' : ''}>Custom range</option></select>${state.filters.date === 'custom' ? `<input class="control" aria-label="From date" type="date" data-range="from" value="${escapeHtml(state.filters.from)}"><input class="control" aria-label="To date" type="date" data-range="to" value="${escapeHtml(state.filters.to)}">` : ''}<select class="control" data-status-filter><option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>All statuses</option><option ${state.filters.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${state.filters.status === 'Done' ? 'selected' : ''}>Done</option><option ${state.filters.status === 'Delivered' ? 'selected' : ''}>Delivered</option><option ${state.filters.status === 'Occupied' ? 'selected' : ''}>Occupied</option></select></div>${panel('Activity records', table(['Reference', 'Patient', 'Service', 'Date', 'Net', 'Received', 'Due', 'Status', ''], records))}`;
	}

	function renderAnalytics() {
		const period = state.analytics.period;
		const filtered = allRecords().filter(record => isInAnalyticsPeriod(record, period) && matchesAnalyticsSearch(record));
		const sortedRecords = filtered.sort((left, right) => new Date(right.createdAt || right.visitAt || right.startAt) - new Date(left.createdAt || left.visitAt || left.startAt));
		const totals = sortedRecords.reduce((result, record) => {
			const net = Number(record.net ?? record.price ?? record.subtotal ?? 0);
			const received = Number(record.advance || 0);
			result.net += net;
			result.received += received;
			result.due += Number(record.due ?? Math.max(0, net - received));
			result.patients.add(patientKey(record));
			result.tests += Array.isArray(record.tests) ? record.tests.length : 0;
			return result;
		}, { net: 0, received: 0, due: 0, tests: 0, patients: new Set() });
		const advanced = window.HospitalAnalytics.summarizeRecords(sortedRecords.map(record => ({
			...record,
			kind: recordKind(record),
			patientKey: patientKey(record)
		})));
		const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
			const month = new Date();
			month.setDate(1);
			month.setHours(0, 0, 0, 0);
			month.setMonth(month.getMonth() - (11 - index));
			return { month, billed: 0, received: 0, roomCollected: 0, roomDue: 0, records: 0, appointments: 0 };
		});
		const monthlyByKey = new Map(monthlyTrend.map(item => [`${item.month.getFullYear()}-${item.month.getMonth()}`, item]));
		for (const record of allRecords()) {
			const timestamp = new Date(record.createdAt || record.visitAt || record.startAt);
			if (!Number.isFinite(timestamp.getTime())) continue;
			const month = monthlyByKey.get(`${timestamp.getFullYear()}-${timestamp.getMonth()}`);
			if (!month) continue;
			month.billed += Number(record.net ?? record.price ?? 0);
			month.received += Number(record.advance || 0);
			month.records += 1;
			if (record.kind === 'roomClaims') month.roomCollected += Number(record.amount || record.net || 0);
			if (record.kind === 'appointments' || state.data.appointments.includes(record)) month.appointments += 1;
		}
		for (const bill of state.data.roomBills) {
			const [year, monthNumber] = bill.billingMonth.split('-').map(Number);
			const month = monthlyByKey.get(`${year}-${monthNumber - 1}`);
			if (month) month.roomDue += Math.max(0, bill.monthlyAmount - bill.received);
		}
		state.analytics.monthlyTrend = monthlyTrend.map(item => ({
			label: item.month.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
			billed: Math.max(0, item.billed),
			received: Math.max(0, item.received),
			roomCollected: Math.max(0, item.roomCollected),
			roomDue: Math.max(0, item.roomDue),
			records: item.records,
			appointments: item.appointments
		}));
		const daily = Array.from({ length: 14 }, (_, index) => {
			const day = new Date();
			day.setHours(0, 0, 0, 0);
			day.setDate(day.getDate() - (13 - index));
			return { day, count: 0, received: 0 };
		});
		const dailyByKey = new Map(daily.map(item => [item.day.toDateString(), item]));
		for (const record of allRecords()) {
			const timestamp = new Date(record.createdAt || record.visitAt || record.startAt);
			if (!Number.isFinite(timestamp.getTime())) continue;
			const day = dailyByKey.get(timestamp.toDateString());
			if (day) {
				day.count += 1;
				day.received += Number(record.advance || 0);
			}
		}
		const trendMax = Math.max(1, ...daily.map(item => item.count));
		const points = daily.map((item, index) => `${index * (700 / (daily.length - 1))},${135 - item.count / trendMax * 112}`).join(' ');
		const chart = `<svg class="analytics-trend" viewBox="0 0 700 160" role="img" aria-label="Patient record activity over the last 14 days"><path class="analytics-trend-grid" d="M0 23H700 M0 79H700 M0 135H700"/><polyline class="analytics-trend-line" points="${points}"/>${daily.map((item, index) => `<circle cx="${index * (700 / (daily.length - 1))}" cy="${135 - item.count / trendMax * 112}" r="3"><title>${item.day.toLocaleDateString('en-GB')} · ${item.count} records · ${money(item.received)}</title></circle>`).join('')}</svg><div class="analytics-trend-labels"><span>${daily[0].day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>Last 14 days · records per day</span><span>${daily[13].day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>`;
		const doctorMetrics = window.HospitalAnalytics.doctorMetrics(state.data.doctors, state.data.labOrders);
		const doctorQuery = state.analytics.doctorSearch.trim().toLowerCase();
		const filteredDoctors = state.data.doctors.filter(doctor => !doctorQuery || `${doctor.name} ${doctor.specialty || ''}`.toLowerCase().includes(doctorQuery));
		const doctorPageCount = Math.ceil(filteredDoctors.length / state.analytics.doctorPageSize);
		state.analytics.doctorPage = Math.min(state.analytics.doctorPage, Math.max(0, doctorPageCount - 1));
		const doctorCards = filteredDoctors.slice(state.analytics.doctorPage * state.analytics.doctorPageSize, (state.analytics.doctorPage + 1) * state.analytics.doctorPageSize).map(doctor => {
			const values = doctorMetrics.get(doctor.id);
			const periodValues = [['Today', values.today], ['This week', values.week], ['This month', values.month], ['Total forever', values.all]];
			return `<article class="doctor-analytics-card"><header><div><span class="analytics-kicker">REFERRING DOCTOR</span><h3>${escapeHtml(doctor.name)}</h3><small>${escapeHtml(doctor.specialty || 'Specialty not listed')}</small></div><span class="doctor-analytics-mark">↗</span></header><div class="doctor-analytics-periods">${periodValues.map(([label, stats]) => `<div class="doctor-analytics-period"><span>${label}</span><strong>${stats.tests.toLocaleString()}</strong><small>tests · ${stats.patients.toLocaleString()} patients</small></div>`).join('')}</div></article>`;
		}).join('') || `<div class="empty">${state.data.doctors.length ? 'No doctors match this search.' : 'Add doctors to see referral analytics.'}</div>`;
		const doctorPagination = filteredDoctors.length > state.analytics.doctorPageSize ? `<div class="analytics-pagination"><span>${(state.analytics.doctorPage * state.analytics.doctorPageSize + 1).toLocaleString()}–${Math.min((state.analytics.doctorPage + 1) * state.analytics.doctorPageSize, filteredDoctors.length).toLocaleString()} of ${filteredDoctors.length.toLocaleString()} doctors</span><div class="inline-actions"><button class="button button-secondary button-small" data-action="analytics-doctor-page" data-step="-1" ${state.analytics.doctorPage <= 0 ? 'disabled' : ''}>Previous</button><span>Page ${state.analytics.doctorPage + 1} / ${doctorPageCount}</span><button class="button button-secondary button-small" data-action="analytics-doctor-page" data-step="1" ${state.analytics.doctorPage + 1 >= doctorPageCount ? 'disabled' : ''}>Next</button></div></div>` : '';
		const topTests = new Map();
		for (const order of state.data.labOrders) {
			if (!isInAnalyticsPeriod(order, period)) continue;
			for (const test of order.tests || []) {
				const key = test.name || test.code || 'Unspecified test';
				const item = topTests.get(key) || { count: 0, revenue: 0 };
				item.count += 1;
				item.revenue += Number(test.price || 0);
				topTests.set(key, item);
			}
		}
		const testQuery = state.analytics.testSearch.trim().toLowerCase();
		const testRanking = [...topTests.entries()].filter(([name]) => !testQuery || name.toLowerCase().includes(testQuery)).sort((left, right) => right[1].count - left[1].count);
		const testPageCount = Math.ceil(testRanking.length / state.analytics.testPageSize);
		state.analytics.testPage = Math.min(state.analytics.testPage, Math.max(0, testPageCount - 1));
		state.analytics.testCount = testRanking.length;
		const maxTests = Math.max(1, testRanking[0]?.[1].count || 0);
		const pageTests = testRanking.slice(state.analytics.testPage * state.analytics.testPageSize, (state.analytics.testPage + 1) * state.analytics.testPageSize);
		const testMix = pageTests.map(([name, item]) => `<div class="analytics-rank-row"><div><strong>${escapeHtml(name)}</strong><span>${item.count.toLocaleString()} tests · ${money(item.revenue)}</span></div><i><b style="width:${Math.max(3, item.count / maxTests * 100)}%"></b></i></div>`).join('') || '<div class="empty">No diagnostic tests in this period.</div>';
		const testPagination = testRanking.length > state.analytics.testPageSize ? `<div class="analytics-pagination"><span>${(state.analytics.testPage * state.analytics.testPageSize + 1).toLocaleString()}–${Math.min((state.analytics.testPage + 1) * state.analytics.testPageSize, testRanking.length).toLocaleString()} of ${testRanking.length.toLocaleString()} tests</span><div class="inline-actions"><button class="button button-secondary button-small" data-action="analytics-test-page" data-step="-1" ${state.analytics.testPage <= 0 ? 'disabled' : ''}>Previous</button><span>Page ${state.analytics.testPage + 1} / ${testPageCount}</span><button class="button button-secondary button-small" data-action="analytics-test-page" data-step="1" ${state.analytics.testPage + 1 >= testPageCount ? 'disabled' : ''}>Next</button></div></div>` : '';
		const cabinUsage = new Map();
		for (const booking of state.data.bookings) {
			if (!isInAnalyticsPeriod(booking, period)) continue;
			const item = cabinUsage.get(booking.cabinId) || { bookings: 0, days: 0, billed: 0 };
			item.bookings += 1;
			item.days += Number(booking.days || 0);
			item.billed += Number(booking.net || 0);
			cabinUsage.set(booking.cabinId, item);
		}
		const cabins = [...cabinUsage.entries()].sort((left, right) => right[1].days - left[1].days);
		const cabinRows = cabins.map(([cabinId, item]) => `<tr><td><strong>${escapeHtml(cabinName(cabinId))}</strong></td><td>${item.bookings.toLocaleString()}</td><td>${item.days.toLocaleString()}</td><td>${money(item.billed)}</td></tr>`);
		const indoorUsage = new Map();
		for (const booking of state.data.bookings) {
			if (!isInAnalyticsPeriod(booking, period)) continue;
			for (const service of booking.extras || []) {
				if (indoorFeeKind(service.name)) continue;
				const key = service.id || `${service.parentName || ''}/${service.name}`;
				const item = indoorUsage.get(key) || { name: service.name, parentName: service.parentName || '', count: 0, revenue: 0 };
				item.count += 1;
				item.revenue += Number(service.price || 0);
				indoorUsage.set(key, item);
			}
		}
		const indoorRows = [...indoorUsage.values()].sort((left, right) => right.count - left.count).map(item => `<tr><td><strong>${escapeHtml(item.parentName ? `${item.parentName} / ${item.name}` : item.name)}</strong></td><td>${item.count.toLocaleString()}</td><td>${money(item.revenue)}</td></tr>`);
		const pageSize = state.analytics.pageSize;
		const pageCount = Math.ceil(sortedRecords.length / pageSize);
		state.analytics.page = Math.min(state.analytics.page, Math.max(0, pageCount - 1));
		const start = state.analytics.page * pageSize;
		const rows = sortedRecords.slice(start, start + pageSize).map(record => `<tr><td><strong>${escapeHtml(record.billId || record.recordId || record.bookingId || record.claimId)}</strong></td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostics' : record.doctorId ? 'Doctor visit' : record.kind === 'roomClaims' ? 'Room payment' : 'Cabin booking'))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net ?? record.price ?? record.amount ?? 0)}</td><td>${money(record.advance || 0)}</td><td>${money(record.due || 0)}</td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="${recordKind(record)}" data-id="${escapeHtml(record.id)}">View</button></td></tr>`);
		const customDates = period === 'custom' ? `<input class="control" aria-label="Analytics from date" type="date" data-analytics-date="from" value="${escapeHtml(state.analytics.from || '')}"><input class="control" aria-label="Analytics to date" type="date" data-analytics-date="to" value="${escapeHtml(state.analytics.to || '')}">` : '';
		const receivedPercent = totals.net ? Math.round(totals.received / totals.net * 100) : 0;
		const workflowRows = Object.entries(advanced.workflows).map(([kind, count]) => {
			const label = ({ diagnostics: 'Diagnostics', appointments: 'Appointments', admissions: 'Cabin admissions', roomPayments: 'Room payments' })[kind];
			const percent = sortedRecords.length ? Math.round(count / sortedRecords.length * 100) : 0;
			return `<div class="analytics-breakdown-row"><span>${label}</span><strong>${count.toLocaleString()} <small>${percent}%</small></strong><i><b style="width:${percent}%"></b></i></div>`;
		}).join('');
		const ageRows = Object.entries(advanced.ageBands).map(([label, count]) => {
			const percent = sortedRecords.length ? Math.round(count / sortedRecords.length * 100) : 0;
			return `<div class="analytics-breakdown-row"><span>${label}</span><strong>${count.toLocaleString()} <small>${percent}%</small></strong><i><b style="width:${percent}%"></b></i></div>`;
		}).join('');
		const statusRows = Object.entries(advanced.statuses).sort((left, right) => right[1] - left[1]).map(([label, count]) =>
			`<div class="analytics-status-row"><span>${escapeHtml(label)}</span><strong>${count.toLocaleString()}</strong></div>`
		).join('') || '<div class="empty">No activity in this period.</div>';
		const monthlyLabels = state.analytics.monthlyTrend.map(month => `<span>${escapeHtml(month.label)}</span>`).join('');
		const monthlyAccessible = state.analytics.monthlyTrend.map(month => `<li>${escapeHtml(month.label)}: ${money(month.billed)} billed, ${money(month.received)} collected, ${month.records} records</li>`).join('');
		const monthlyEmpty = state.analytics.monthlyTrend.every(month => !month.billed && !month.received);
		const pagination = `<div class="analytics-pagination"><span>${sortedRecords.length ? `Showing ${start + 1}–${Math.min(start + pageSize, sortedRecords.length)} of ${sortedRecords.length.toLocaleString()} records` : 'No records in this period'}</span><div class="inline-actions"><label class="field-hint">Rows <select class="control analytics-page-size" data-analytics-page-size><option ${pageSize === 25 ? 'selected' : ''}>25</option><option ${pageSize === 50 ? 'selected' : ''}>50</option><option ${pageSize === 100 ? 'selected' : ''}>100</option></select></label><button class="button button-secondary button-small" data-action="analytics-page" data-step="-1" ${state.analytics.page <= 0 ? 'disabled' : ''}>Previous</button><span>Page ${sortedRecords.length ? state.analytics.page + 1 : 0} / ${pageCount}</span><button class="button button-secondary button-small" data-action="analytics-page" data-step="1" ${state.analytics.page + 1 >= pageCount ? 'disabled' : ''}>Next</button></div></div>`;
		return `${pageHeading('Hospital analytics', 'Explore activity, financial health, patient trends and service utilization across flexible date ranges.')}<div class="toolbar analytics-toolbar"><label class="field-hint">Reporting period <select class="control" data-analytics-period><option value="today" ${period === 'today' ? 'selected' : ''}>Today</option><option value="week" ${period === 'week' ? 'selected' : ''}>This week</option><option value="month" ${period === 'month' ? 'selected' : ''}>This month</option><option value="year" ${period === 'year' ? 'selected' : ''}>This year</option><option value="30" ${period === '30' ? 'selected' : ''}>Last 30 days</option><option value="custom" ${period === 'custom' ? 'selected' : ''}>Custom range</option><option value="all" ${period === 'all' ? 'selected' : ''}>All time</option></select></label>${customDates}</div>${metrics([{ label: 'Patient records', value: sortedRecords.length.toLocaleString(), note: 'In selected period' }, { label: 'Unique patients', value: advanced.patients.toLocaleString(), note: `${advanced.repeatPatients.toLocaleString()} returning patients` }, { label: 'Diagnostic tests', value: totals.tests.toLocaleString(), note: 'Units registered' }, { label: 'Billed / received', value: `${money(totals.net)} / ${money(totals.received)}`, note: `${receivedPercent}% collected`, accent: true }, { label: 'Outstanding balance', value: money(totals.due), note: `${advanced.outstandingRecords.toLocaleString()} records with a balance` }, { label: 'Average bill', value: money(advanced.averageBill), note: 'Per patient record' }, { label: 'Paid records', value: advanced.paidRecords.toLocaleString(), note: 'No amount due' }, { label: 'Average collection', value: `${advanced.collectionRate}%`, note: 'Received against billed' }])}<div class="analytics-overview-grid analytics-overview-grid--visual">${panel('12-month revenue & collection', `<div class="analytics-3d-wrap"><div class="analytics-3d-chart" data-analytics-3d></div>${monthlyEmpty ? '<p class="analytics-3d-empty">No billing activity in the last 12 months.</p>' : ''}<div class="analytics-3d-tooltip" hidden></div></div><div class="analytics-3d-labels" aria-hidden="true">${monthlyLabels}</div><div class="analytics-3d-legend"><span><i></i>Billed</span><span><i></i>Collected</span></div><ul class="visually-hidden">${monthlyAccessible}</ul>`)}${panel('Patient activity · last 14 days', chart)}${panel(`Payment position · ${analyticsPeriodLabel(period)}`, `<div class="analytics-payment-ring" style="--collection:${receivedPercent}%"><strong>${receivedPercent}%</strong><span>collected</span></div><div class="summary-box"><div class="summary-row"><span>Billed</span><b>${money(totals.net)}</b></div><div class="summary-row"><span>Received</span><b>${money(totals.received)}</b></div><div class="summary-row total"><span>Outstanding</span><b>${money(totals.due)}</b></div></div>`)}</div><div class="analytics-breakdown-grid">${panel('Care workflow mix', `<div class="analytics-breakdown-list">${workflowRows}</div>`)}${panel('Patient age profile', `<div class="analytics-breakdown-list">${ageRows}</div>`)}${panel('Record status & repeat visits', `<div class="analytics-status-list">${statusRows}</div><div class="analytics-repeat-note"><strong>${advanced.repeatPatients.toLocaleString()}</strong><span>patients with repeat records in this period</span></div>`)}</div><section class="analytics-section"><div class="analytics-section-heading"><div><span class="analytics-kicker">REFERRAL PERFORMANCE</span><h2>Doctor test referrals</h2><p>Billable tests and unique patients credited to each referring doctor.</p></div></div><div class="toolbar analytics-doctor-toolbar"><div class="search-field"><span>⌕</span><input data-analytics-doctor-search placeholder="Search doctors or specialties" value="${escapeHtml(state.analytics.doctorSearch)}"></div><span class="field-hint">${filteredDoctors.length.toLocaleString()} doctors</span></div><div class="doctor-analytics-grid">${doctorCards}</div>${doctorPagination}</section><div class="analytics-overview-grid">${panel(`Most requested tests · ${analyticsPeriodLabel(period)}`, `<div class="toolbar analytics-doctor-toolbar"><div class="search-field"><span>⌕</span><input data-analytics-test-search placeholder="Search tests in this period" value="${escapeHtml(state.analytics.testSearch)}"></div><span class="field-hint">${testRanking.length.toLocaleString()} tests</span></div><div class="analytics-ranking">${testMix}</div>${testPagination}`)}${panel(`Cabin utilization · ${analyticsPeriodLabel(period)}`, table(['Cabin', 'Admissions', 'Booked days', 'Net billed'], cabinRows))}${panel(`Cabin services · ${analyticsPeriodLabel(period)}`, table(['Service item', 'Selected', 'Billed'], indoorRows))}</div><section class="analytics-section analytics-records"><div class="analytics-section-heading"><div><span class="analytics-kicker">RECORD EXPLORER</span><h2>Activity detail</h2><p>Search and page through records in the selected date range.</p></div></div><div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient, record or service" value="${escapeHtml(state.query)}"></div>${scanControl()}</div>${panel('Filtered records', `${table(['Record', 'Patient', 'Service', 'Date', 'Net', 'Received', 'Due', ''], rows)}${pagination}`)}</section>`;
	}

	function analyticsPeriodLabel(period) {
		return ({ today: 'today', week: 'this week', month: 'this month', year: 'this year', '30': 'last 30 days', custom: 'custom range', all: 'all time' })[period] || 'selected period';
	}

	function isInAnalyticsPeriod(record, period, now = new Date()) {
		const timestamp = new Date(record.createdAt || record.visitAt || record.startAt);
		if (!Number.isFinite(timestamp.getTime())) return false;
		if (period === 'all') return true;
		if (period === 'custom') {
			if (state.analytics.from && timestamp < new Date(`${state.analytics.from}T00:00:00`)) return false;
			if (state.analytics.to && timestamp > new Date(`${state.analytics.to}T23:59:59.999`)) return false;
			return true;
		}
		if (period === '30') return timestamp >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
		const start = window.HospitalAnalytics.getPeriodStart(period, now);
		return !start || timestamp >= start;
	}

	function matchesAnalyticsSearch(record) {
		const query = state.query.trim().toLowerCase();
		if (!query) return true;
		if (!state.searchResults || state.searchResults.query !== query) {
			state.searchResults = { query, items: getSearchIndex().matches(query) };
		}
		return state.searchResults.items.has(record);
	}

	function renderLeads() {
		const records = allRecords().filter(searchRecord).sort(byDateDesc);
		const patients = new Map();
		for (const record of records) {
			const key = patientKey(record);
			if (!patients.has(key)) patients.set(key, []);
			patients.get(key).push(record);
		}
		const rows = [...patients.entries()].map(([key, history]) => {
			const patient = history[0];
			return `<tr><td><strong>${escapeHtml(patient.patientName)}</strong><br><small>${escapeHtml(patient.contact || 'No contact')}</small></td><td>${history.length}</td><td>${dateTime(history[0].createdAt || history[0].visitAt || history[0].startAt)}</td><td>${money(history.reduce((total, record) => total + Number(record.net || record.price || 0), 0))}</td><td>${money(history.reduce((total, record) => total + Number(record.due || 0), 0))}</td><td><button class="button button-secondary button-small" data-action="patient-history" data-key="${escapeHtml(key)}">View history</button></td></tr>`;
		});
		return `${pageHeading('Patient leads', 'All registered patient records across diagnostics, appointments and cabin admissions.')}${metrics([{ label: 'Unique patients', value: patients.size }, { label: 'Patient records', value: records.length }, { label: 'Billed total', value: money(records.reduce((total, record) => total + Number(record.net || record.price || 0), 0)), accent: true }, { label: 'Outstanding', value: money(records.reduce((total, record) => total + Number(record.due || 0), 0)) }])}<div class="toolbar"><div class="search-field"><span>⌕</span><input data-search placeholder="Search patient or any record detail" value="${escapeHtml(state.query)}"></div>${scanControl()}</div>${panel('All-time patient register', table(['Patient', 'Records', 'Latest activity', 'Billed', 'Due', ''], rows))}`;
	}

	function patientKey(record) {
		if (record.kind === 'roomClaims' || state.data.roomClaims.includes(record)) return `room:${record.roomId || record.id}`;
		return record.contact?.trim() ? `contact:${record.contact.trim().replace(/\D/g, '')}` : `name:${String(record.patientName || '').trim().toLowerCase()}:${record.age || ''}:${record.gender || ''}`;
	}

	function renderPatientHistory(modal) {
		const records = allRecords().filter(record => patientKey(record) === modal.key).sort(byDateDesc);
		if (!records.length) return '';
		const patient = records[0];
		const rows = records.map(record => `<tr><td>${escapeHtml(record.billId || record.recordId || record.bookingId)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostics' : record.doctorId ? 'Doctor visit' : 'Cabin booking'))}</td><td>${escapeHtml(record.testNames || (record.doctorId ? doctorName(record.doctorId) : cabinName(record.cabinId)))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net || record.price || 0)}</td><td>${money(record.advance || 0)}</td><td>${money(record.due || 0)}</td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="${recordKind(record)}" data-id="${escapeHtml(record.id)}">View slip</button></td></tr>`);
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>Patient history · ${escapeHtml(patient.patientName)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body"><div class="patient-history-summary"><span>Contact<strong>${escapeHtml(patient.contact || '—')}</strong></span><span>Age / gender<strong>${escapeHtml(`${patient.age || '—'} / ${patient.gender || '—'}`)}</strong></span><span>Record count<strong>${records.length}</strong></span><span>Total billed<strong>${money(records.reduce((sum, record) => sum + Number(record.net || record.price || 0), 0))}</strong></span><span>Total due<strong>${money(records.reduce((sum, record) => sum + Number(record.due || 0), 0))}</strong></span></div>${table(['Record', 'Service', 'Details', 'Date', 'Net', 'Received', 'Due', ''], rows)}</div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button></footer></section></div>`;
	}

	function renderModal() {
		const modal = state.modal;
		if (modal.type === 'confirm') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${escapeHtml(modal.title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body"><p style="font-size:12px;line-height:1.6;color:#65736c">${escapeHtml(modal.message)}</p></div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Cancel</button><button class="button button-danger" data-action="confirm-action">${escapeHtml(modal.confirmLabel || 'Continue')}</button></footer></section></div>`;
		if (modal.type === 'floor') return renderRoomFloorModal(modal);
		if (modal.type === 'room') return renderRoomModal(modal);
		if (modal.type === 'room-payment') return renderRoomPaymentModal(modal);
		if (modal.type === 'room-claim-receipt') {
			const claim = state.data.roomClaims.find(item => item.id === modal.id);
			return claim ? renderRoomClaimModal(claim, 'receipt') : '';
		}
		if (modal.type === 'summary') return renderSummaryModal();
		if (modal.type === 'referrers') return renderAgentReferrers(modal);
		if (modal.type === 'profile') return renderReferrerProfile(modal);
		if (modal.type === 'referral-dashboard') return renderReferralDashboard(modal);
		if (modal.type === 'patient-history') return renderPatientHistory(modal);
		if (modal.type === 'item') return renderItemModal(modal);
		if (modal.type === 'booking') return renderBookingModal(modal);
		if (modal.type === 'renew') return renderRenewModal(modal);
		if (modal.type === 'record' || modal.type === 'print') return renderRecordModal(modal);
		return '';
	}

	function renderRoomFloorModal(modal) {
		const floor = modal.item || {};
		const editing = Boolean(floor.id);
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${editing ? 'Edit floor' : 'Add floor'}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="room-floor-form" data-id="${escapeHtml(floor.id || '')}"><div class="modal-body"><div class="form-grid">${field('Floor name', 'name', floor.name || '', 'text', true)}${field('Floor label · Optional', 'label', floor.label || '', 'text')}</div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? 'Save floor' : 'Add floor'}</button></footer></form></section></div>`;
	}

	function renderRoomModal(modal) {
		const room = modal.item || {};
		const editing = Boolean(room.id);
		const floorOptions = state.data.floors.map(floor => `<option value="${escapeHtml(floor.id)}" ${floor.id === room.floorId ? 'selected' : ''}>${escapeHtml(floor.name)}</option>`).join('');
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${editing ? 'Edit room' : 'Add room'}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="room-form" data-id="${escapeHtml(room.id || '')}"><div class="modal-body"><div class="form-grid"><div class="field"><label for="field-room-name">Room name</label><input id="field-room-name" name="name" value="${escapeHtml(room.name || '')}" required></div><div class="field"><label for="field-room-floor">Floor</label><select id="field-room-floor" name="floorId" required>${floorOptions}</select></div>${field('Monthly bill (৳)', 'monthlyAmount', room.monthlyAmount ?? '', 'number', true)}</div><p class="field-hint">The current billing period keeps its original charge. This amount is applied when the next month begins.</p></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? 'Save room' : 'Add room'}</button></footer></form></section></div>`;
	}

	function renderRoomPaymentModal(modal) {
		const room = state.data.rooms.find(item => item.id === modal.id);
		const bill = room && HospitalRoomBilling.currentBill(state.data, room.id);
		if (!room || !bill) return '';
		const remaining = Math.max(0, bill.monthlyAmount - bill.received);
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Receive room payment</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="room-payment-form" data-room-id="${escapeHtml(room.id)}"><div class="modal-body"><div class="notice">${escapeHtml(room.name)} · ${escapeHtml(state.data.floors.find(floor => floor.id === room.floorId)?.name || 'Unknown floor')} · ${escapeHtml(bill.billingMonth)}</div><div class="summary-box"><div class="summary-row"><span>Monthly bill</span><b>${money(bill.monthlyAmount)}</b></div><div class="summary-row"><span>Previously received</span><b>${money(bill.received)}</b></div><div class="summary-row total"><span>Remaining due</span><b>${money(remaining)}</b></div></div><div class="form-grid">${field('Amount received (৳)', 'amount', remaining, 'number', true)}${selectField('Payment method', 'paymentMethod', ['Cash', 'Bank transfer', 'Mobile payment', 'Other'], true)}${field('Note · Optional', 'notes', '', 'text')}</div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save payment &amp; create slip</button></footer></form></section></div>`;
	}

	function renderRoomClaimModal(claim, displayType) {
		const contents = `<article class="print-sheet room-receipt"><header class="print-head"><div class="print-brand-head">${hospitalLogo('print-hospital-logo')}<div><h2>${escapeHtml(HOSPITAL_NAME)}</h2><span>Room payment receipt</span></div></div><div class="room-receipt-no">RECEIPT<br><strong>${escapeHtml(claim.claimId)}</strong></div></header><div class="room-receipt-grid"><span>Room<strong>${escapeHtml(claim.roomName)}</strong></span><span>Floor<strong>${escapeHtml(claim.floorName)}</strong></span><span>Billing period<strong>${escapeHtml(claim.billingMonth)}</strong></span><span>Date received<strong>${dateTime(claim.createdAt)}</strong></span><span>Payment method<strong>${escapeHtml(claim.paymentMethod || 'Cash')}</strong></span><span>Amount received<strong>${money(claim.amount)}</strong></span></div><div class="room-receipt-total"><span>RECEIVED</span><strong>${money(claim.amount)}</strong></div><div class="room-receipt-words">In words: ${escapeHtml(amountInWords(claim.amount))}</div>${claim.notes ? `<p class="room-receipt-note">Note: ${escapeHtml(claim.notes)}</p>` : ''}<div class="room-receipt-signature"><span>Received by</span><span>Authorized signature</span></div><footer class="room-receipt-footer">Thank you · Keep this slip for your records</footer></article>`;
		const actions = displayType === 'print' ? '' : `<footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-secondary" data-action="print-now">Print</button><button class="button button-primary" data-action="save-pdf" data-page-size="A5">Save A5 slip</button></footer>`;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide room-receipt-modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Room payment · ${escapeHtml(claim.claimId)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${contents}</div>${actions}</section></div>`;
	}

	function renderItemModal(modal) {
		const type = modal.kind;
		const item = modal.item || {};
		const editing = Boolean(item.id);
		const fields = {
			tests: [['code', 'Code', 'text', true], ['name', 'Test name', 'text', true], ['price', 'Price (৳)', 'number', true]],
			doctors: [['name', 'Doctor name', 'text', true], ['title', 'Title / qualification', 'text'], ['specialty', 'Specialty', 'text', true], ['contact', 'Contact number', 'tel'], ['visits', 'Visiting time', 'text'], ['newPrice', 'New patient fee (৳)', 'number', true], ['oldPrice', 'Returning patient fee (৳)', 'number', true]],
			cabins: [['name', 'Cabin name', 'text', true], ['price', 'Daily rate (৳)', 'number', true]],
			indoorServices: [['name', 'Service item name', 'text', true], ['price', 'Parent item price (৳)', 'number', false]],
			agents: [['name', 'Agent name', 'text', true], ['contact', 'Contact number', 'tel']],
			referrers: [['name', 'Referrer name', 'text', true], ['contact', 'Contact number', 'tel']]
		}[type];
		const title = `${editing ? 'Edit' : 'Add'} ${type === 'tests' ? 'clinical test' : type === 'doctors' ? 'doctor' : type === 'cabins' ? 'cabin' : type === 'indoorServices' ? 'indoor service item' : type === 'agents' ? 'marketing agent' : 'special referrer'}`;
		const fileButton = type === 'indoorServices'
			? `<div class="field full service-children-editor"><div class="service-children-heading"><div><label>Multiple items · Optional</label><span class="field-hint">Add child items with their own name and price.</span></div><button class="button button-secondary button-small" type="button" data-action="add-service-child">＋ Add child item</button></div><div class="service-child-list">${(item.children || []).map(child => serviceChildEditor(child)).join('')}</div></div>`
			: '';
		const agentSelector = type === 'referrers' ? `<div class="field full"><label for="agentId">Marketing agent</label><select id="agentId" name="agentId" class="control">${state.data.agents.map(agent => `<option value="${escapeHtml(agent.id)}" ${item.agentId === agent.id ? 'selected' : ''}>${escapeHtml(agent.name)}</option>`).join('')}</select></div>` : '';
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="item-form" data-kind="${type}" data-id="${escapeHtml(item.id || '')}"><div class="modal-body"><div class="form-grid">${fields.map(([name, label, inputType, required]) => `<div class="field"><label for="item-${name}">${label}</label><input id="item-${name}" name="${name}" type="${inputType}" value="${escapeHtml(item[name] ?? '')}" ${required ? 'required' : ''} ${inputType === 'number' ? 'min="0" step="1"' : ''}></div>`).join('')}${fileButton}${agentSelector}</div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${editing ? 'Save changes' : 'Add record'}</button></footer></form></section></div>`;
	}

	function serviceChildEditor(child = {}) {
		return `<div class="service-child-row"><input class="control" name="childName" value="${escapeHtml(child.name || '')}" placeholder="Child item name" aria-label="Child item name"><input class="control" name="childPrice" type="number" min="0" step="1" value="${escapeHtml(child.price ?? '')}" placeholder="Price" aria-label="Child item price"><button class="icon-button" type="button" data-action="remove-service-child" aria-label="Remove child item">×</button><input type="hidden" name="childId" value="${escapeHtml(child.id || '')}"></div>`;
	}

	function renderBookingModal(modal) {
		const cabin = state.data.cabins.find(item => item.id === modal.cabinId);
		const booking = modal.booking;
		const isEdit = Boolean(booking);
		const defaultStart = booking?.endAt ? toDateInput(booking.endAt) : toDateInput(nowISO());
		const defaultEnd = booking?.endAt ? toDateInput(new Date(new Date(booking.endAt).getTime() + 86400000).toISOString()) : toDateInput(new Date(Date.now() + 86400000).toISOString());
		const selectedCounts = (booking?.extras || []).reduce((counts, service) => { if (service.id) counts[service.id] = (counts[service.id] || 0) + 1; return counts; }, {});
		const serviceOptions = state.data.indoorServices.map(service => {
			const kind = indoorFeeKind(service.name);
			const automatic = kind !== '';
			const parentItem = service.children?.length && Number(service.price) > 0
				? serviceOption(service.id, service.name, service.price, selectedCounts[service.id], false)
				: !service.children?.length && !automatic
					? serviceOption(service.id, service.name, service.price, selectedCounts[service.id], false)
					: '';
			const childItems = (service.children || []).map(child => serviceOption(
				`child::${service.id}::${child.id}`,
				child.name,
				child.price,
				selectedCounts[child.id],
				false,
				service.name
			)).join('');
			const autoItem = automatic
				? serviceOption('', service.name, service.price, 0, true)
				: '';
			if (!parentItem && !childItems && !autoItem) return '';
			return `<section class="service-option-group">${service.children?.length ? `<strong class="service-group-title">${escapeHtml(service.name)}</strong>` : ''}${autoItem}${parentItem}${childItems}</section>`;
		}).join('') || '<span class="field-hint">Add service items in Management → Cabins.</span>';
		const builtInFees = modal.addServices ? 0 : automaticIndoorServices(!isEdit).reduce((sum, item) => sum + item.price, 0);
		const defaultEstimate = (modal.addServices ? 0 : (cabin?.price ?? booking?.dailyRate ?? 0)) + builtInFees;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>${modal.addServices ? 'Add cabin service items' : isEdit ? 'Renew cabin stay' : `Admit patient · ${escapeHtml(cabin?.name || '')}`}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><form id="booking-form" data-id="${escapeHtml(booking?.id || '')}" data-add-services="${Boolean(modal.addServices)}" data-cabin="${escapeHtml(booking?.cabinId || cabin?.id || '')}"><div class="modal-body"><div class="form-grid">${field('Patient name', 'patientName', booking?.patientName || '', 'text', true)}${field('Contact number', 'contact', booking?.contact || '', 'tel', true)}${field('Age', 'age', booking?.age || '', 'number', true)}${selectField('Gender', 'gender', ['Male', 'Female', 'Other'], true, false, null, booking?.gender)}${field('Start date and time', 'startAt', defaultStart, 'datetime-local', true)}${field('Duration (days)', 'durationDays', 1, 'number', true)}${field('Release date and time', 'endAt', defaultEnd, 'datetime-local', true)}<div class="field full"><label>Indoor service items</label><input class="control service-search" type="search" data-service-search placeholder="Find a parent or child service"><div class="service-options">${serviceOptions}</div></div>${field('Discount (৳)', 'discount', booking?.discount || '0', 'number')}${field('Advance received (৳)', 'advance', booking?.advance || '0', 'number')}${field('Daily cabin rate (৳)', 'price', cabin?.price ?? booking?.dailyRate ?? 0, 'number', true)}${field('Notes', 'notes', booking?.notes || '', 'text')}</div><div class="summary-box"><div class="summary-row"><span>Estimated bill</span><b id="booking-estimate">${money(defaultEstimate)}</b></div><div class="summary-row"><span>Cabin</span><b>${escapeHtml(cabin?.name || cabinName(booking?.cabinId))}</b></div><div class="field-hint">Cabin/bed and admission charges are included automatically. Select any additional parent or child services above.</div></div></div><footer class="modal-foot"><button class="button button-secondary" type="button" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${modal.addServices ? 'Add selected items' : isEdit ? 'Save renewal' : 'Save admission'}</button></footer></form></section></div>`;
	}

	function serviceOption(value, name, price, alreadyAdded, automatic = false, parentName = '') {
		return `<label class="service-option ${automatic ? 'service-option-automatic' : ''}"><input type="checkbox" name="${automatic ? '' : 'serviceIds'}" value="${escapeHtml(value)}" ${automatic ? 'checked disabled' : ''}><span><strong>${escapeHtml(name)}</strong><small>${parentName ? `${escapeHtml(parentName)} · ` : ''}${money(price)}${automatic ? ' · Included automatically' : alreadyAdded ? ` · Already added ×${alreadyAdded}` : ''}</small></span></label>`;
	}

	function indoorFeeKind(name) {
		const normalized = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
		if (['admission', 'admission fee', 'admission charge'].includes(normalized)) return 'admission';
		if (['cabin/bed charge', 'cabin charge', 'bed charge'].includes(normalized)) return 'cabin';
		return '';
	}

	function renderRenewModal(modal) {
		const booking = state.data.bookings.find(item => item.id === modal.id);
		return booking ? renderBookingModal({ type: 'booking', cabinId: booking.cabinId, booking }) : '';
	}

	function renderSummaryModal() {
		const records = allRecords().sort(byDateDesc);
		const rows = records.map(record => `<tr><td>${escapeHtml(record.billId || record.recordId || record.bookingId || record.claimId)}</td><td>${escapeHtml(record.patientName)}</td><td>${escapeHtml(record.kindLabel || (record.testNames ? 'Diagnostic test' : record.doctorId ? 'Doctor visit' : record.kind === 'roomClaims' ? 'Room payment' : 'Cabin booking'))}</td><td>${dateTime(record.createdAt || record.visitAt || record.startAt)}</td><td>${money(record.net || record.price || record.amount)}</td><td>${money(record.advance)}</td><td>${money(record.due)}</td><td>${escapeHtml(record.status)}</td></tr>`).join('');
		const summaryTable = records.length ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Patient</th><th>Service</th><th>Date</th><th>Net</th><th>Received</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No activity has been recorded yet.</div>`;
		const contents = `<article class="print-sheet"><header class="print-head"><div class="print-brand-head">${hospitalLogo('print-hospital-logo')}<div><h2>${escapeHtml(HOSPITAL_NAME)}</h2><span>Daily activity summary</span></div></div><div style="text-align:right">Generated ${dateTime(nowISO())}<br>${records.length} records</div></header>${summaryTable}<div class="print-note">Local operational summary. Patient information is confidential.</div></article>`;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>Activity summary</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${contents}</div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-secondary" data-action="print-summary-now">Print summary</button><button class="button button-primary" data-action="save-pdf" data-page-size="A4">Save PDF</button></footer></section></div>`;
	}

	function renderAgentReferrers(modal) {
		const agent = state.data.agents.find(item => item.id === modal.agentId);
		if (!agent) return '';
		const children = state.data.referrers.filter(item => item.agentId === agent.id);
		const rows = children.map(item => `<tr><td><div class="profile-cell">${profileImage(item)}<strong>${escapeHtml(item.name)}</strong></div></td><td>${escapeHtml(item.contact || '—')}</td><td><button class="button button-secondary button-small" data-action="view-referrer" data-id="${escapeHtml(item.id)}">Biodata</button></td></tr>`);
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>Special referrers · ${escapeHtml(agent.name)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${table(['Referrer', 'Contact', ''], rows)}</div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button></footer></section></div>`;
	}

	function renderReferrerProfile(modal) {
		const referrer = state.data.referrers.find(item => item.id === modal.id);
		if (!referrer) return '';
		const agent = state.data.agents.find(item => item.id === referrer.agentId);
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><h2>Special referrer profile</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body profile-bio">${profileImage(referrer)}<h3>${escapeHtml(referrer.name)}</h3><p>${escapeHtml(referrer.contact || 'No contact listed')}</p><p>Marketing agent · ${escapeHtml(agent?.name || 'Unassigned')}</p></div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-secondary" data-action="edit-item" data-kind="referrers" data-id="${escapeHtml(referrer.id)}">Edit profile</button></footer></section></div>`;
	}

	function renderReferralDashboard(modal) {
		const isAgent = modal.scope === 'agent';
		const person = (isAgent ? state.data.agents : state.data.referrers).find(item => item.id === modal.id);
		if (!person) return '';
		const referrerIds = new Set(state.data.referrers.filter(item => item.agentId === person.id).map(item => item.id));
		const directOrders = isAgent ? state.data.labOrders.filter(order => order.agentId === person.id && order.referralType !== 'special-referrer') : [];
		const childOrders = isAgent ? state.data.labOrders.filter(order => referrerIds.has(order.referrerId)) : [];
		const orders = isAgent ? [...directOrders, ...childOrders] : state.data.labOrders.filter(order => order.referrerId === person.id);
		const timestamp = record => new Date(record.createdAt || record.visitAt || record.startAt).getTime();
		const now = new Date();
		const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const weekStart = dayStart - ((now.getDay() + 6) % 7) * 86400000;
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
		const countSince = start => orders.filter(record => timestamp(record) >= start).length;
		const net = orders.reduce((sum, record) => sum + Number(record.net || 0), 0);
		const due = orders.reduce((sum, record) => sum + Number(record.due || 0), 0);
		const date = new Date(); date.setDate(date.getDate() + Number(modal.dayOffset || 0));
		const dateLabel = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
		const query = String(modal.query || '').toLowerCase();
		const attributed = modal.source === 'direct' ? directOrders : modal.source === 'child' ? childOrders : orders;
		const daily = attributed.filter(record => new Date(timestamp(record)).toDateString() === date.toDateString()).filter(record => !query || `${record.patientName} ${record.contact} ${record.billId} ${record.testNames}`.toLowerCase().includes(query)).sort((left, right) => timestamp(right) - timestamp(left));
		const page = Math.max(0, Number(modal.page) || 0);
		const pageSize = 10;
		const rows = daily.slice(page * pageSize, (page + 1) * pageSize).map(record => `<tr><td><strong>${escapeHtml(record.patientName)}</strong><br><small>${escapeHtml(record.contact)}</small></td><td>${escapeHtml(record.billId)}</td><td>${escapeHtml(record.testNames)}</td><td>${money(record.net)}</td><td>${money(record.due)}</td><td><button class="button button-secondary button-small" data-action="view-record" data-kind="labOrders" data-id="${escapeHtml(record.id)}">View slip</button></td></tr>`);
		const directEarned = directOrders.reduce((sum, record) => sum + Number(record.net || 0), 0);
		const childEarned = childOrders.reduce((sum, record) => sum + Number(record.net || 0), 0);
		const directDue = directOrders.reduce((sum, record) => sum + Number(record.due || 0), 0);
		const childDue = childOrders.reduce((sum, record) => sum + Number(record.due || 0), 0);
		const childMetric = isAgent ? [{ label: 'Special referrers', value: referrerIds.size }, { label: 'Direct agent visits', value: directOrders.length }, { label: 'Direct earned / due', value: `${money(directEarned)} / ${money(directDue)}` }, { label: 'Child earned / due', value: `${money(childEarned)} / ${money(childDue)}` }] : [{ label: 'Parent agent', value: state.data.agents.find(agent => agent.id === person.agentId)?.name || 'Unassigned' }, { label: 'Referrer visits', value: orders.length }];
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide referral-dashboard" role="dialog" aria-modal="true"><header class="modal-head"><h2>${isAgent ? 'Agent analytics' : 'Special referrer analytics'} · ${escapeHtml(person.name)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${metrics([{ label: 'Today', value: countSince(dayStart) }, { label: 'This week', value: countSince(weekStart) }, { label: 'This month', value: countSince(monthStart) }, { label: 'All-time patients', value: orders.length }, ...childMetric, { label: 'Total earned', value: money(net), accent: true }, { label: 'Dues remaining', value: money(due) }])}${isAgent ? `<div class="segmented-control"><button data-action="referral-source" data-source="all" class="${!modal.source || modal.source === 'all' ? 'active' : ''}">All</button><button data-action="referral-source" data-source="direct" class="${modal.source === 'direct' ? 'active' : ''}">Direct agent</button><button data-action="referral-source" data-source="child" class="${modal.source === 'child' ? 'active' : ''}">Special referrers</button></div>` : ''}<div class="referral-record-toolbar"><input class="control" data-referral-search aria-label="Search referred patients" placeholder="Search patients and bills" value="${escapeHtml(modal.query || '')}"><button class="button button-secondary button-small" data-action="focus-referral-scanner">▦ Scan</button><input class="scan-capture" data-referral-scan aria-label="Referral barcode scanner" autocomplete="off" tabindex="-1"></div><div class="referral-date-pager"><button class="icon-button" data-action="referral-day-prev" aria-label="Previous day">←</button><strong>${dateLabel}</strong><button class="icon-button" data-action="referral-day-next" aria-label="Next day">→</button></div>${table(['Patient', 'Bill', 'Services', 'Net', 'Due', ''], rows)}<div class="referral-pagination"><button class="button button-secondary button-small" data-action="referral-page-prev" ${page === 0 ? 'disabled' : ''}>Previous</button><span>${daily.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, daily.length)} of ${daily.length}` : 'No patients on this date'}</span><button class="button button-secondary button-small" data-action="referral-page-next" ${((page + 1) * pageSize >= daily.length) ? 'disabled' : ''}>Next</button></div></div><footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button></footer></section></div>`;
	}

	function renderRecordModal(modal) {
		const record = state.data[modal.kind]?.find(item => item.id === modal.id);
		if (!record) return '';
		if (modal.kind === 'roomClaims') return renderRoomClaimModal(record, modal.type);
		const isLab = modal.kind === 'labOrders';
		const isAppointment = modal.kind === 'appointments';
		const title = record.billId || record.recordId || record.bookingId;
		const serviceRows = isLab ? (record.tests || []).map(test => `<tr><td>${escapeHtml(test.code)}</td><td>${escapeHtml(test.name)}</td><td>${money(test.price)}</td></tr>`).join('') : '';
		const details = isLab ? [['Patient', record.patientName], ['Age / gender', `${record.age} / ${record.gender}`], ['Contact', record.contact], ['Referring doctor', (record.doctors || []).map(item => item.name).join(', ') || '—'], ['Referral source', record.agentName || 'No referral'], ['Special referrer', record.referrerName || '—'], ['Remarks', record.remarks || '—'], ['Additional note', record.note || '—'], ['Extra description', record.description || '—'], ['Registered', dateTime(record.createdAt)], ['Report delivery', dateTime(record.deliveryAt)], ['Report status', record.status], ['Full paid', record.fullPaid ? 'Yes' : 'No']]
			: isAppointment ? [['Patient', record.patientName], ['Patient ID', record.patientId || record.recordId], ['Contact', record.contact], ['Age / gender', `${record.age} / ${record.gender}`], ['Doctor', doctorName(record.doctorId)], ['Visit time', dateTime(record.visitAt)], ['Chamber time', `${record.fromTime || '—'} to ${record.toTime || '—'}`], ['Patient type', record.patientType], ['History record', record.historyRecordId || '—'], ['Status', record.status]]
				: [['Patient', record.patientName], ['Slip No.', record.slipNo || '—'], ['Contact', record.contact], ['Age / gender', `${record.age || '—'} / ${record.gender || '—'}`], ['Cabin', cabinName(record.cabinId)], ['Admitted', dateTime(record.startAt)], ['Release', dateTime(record.endAt)], ['Duration', `${record.days} day(s)`], ['Daily rate', money(record.dailyRate)], ['Services', (record.extras || []).map(item => `${item.name} (${money(item.price)})`).join(', ') || '—'], ['Notes', record.notes || '—'], ['Status', record.status]];
		const pageSize = isLab || isAppointment ? 'A5' : 'A4';
		const actionButton = modal.type === 'print' ? '' : `<footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-secondary" data-action="print-record" data-kind="${modal.kind}" data-id="${record.id}">Print</button><button class="button button-primary" data-action="save-pdf" data-page-size="${pageSize}">Save PDF</button></footer>`;
		const labTable = isLab ? `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Test</th><th>Price</th></tr></thead><tbody>${serviceRows}</tbody></table></div>` : '';
		const payment = !isAppointment ? `<div class="summary-box"><div class="summary-row"><span>Subtotal</span><b>${money(record.subtotal ?? record.net ?? record.price)}</b></div><div class="summary-row"><span>Discount</span><b>${money(record.discount)}</b></div><div class="summary-row"><span>Received</span><b>${money(record.advance)}</b></div><div class="summary-row total"><span>Net / due</span><b>${money(record.net ?? record.price)} / ${money(record.due)}</b></div>${isLab ? `<div class="summary-row"><span>Amount in words</span><b>${amountInWords(record.net)}</b></div>` : ''}</div>` : `<div class="summary-box"><div class="summary-row total"><span>Visit fee</span><b>${money(record.price)}</b></div></div>`;
		const sheet = isLab ? renderTestCashMemo(record) : modal.kind === 'bookings' ? renderIndoorBill(record) : `<article class="print-sheet ${isAppointment ? 'print-sheet--visit' : ''}"><header class="print-head"><div class="print-brand-head">${hospitalLogo('print-hospital-logo')}<div><h2>${escapeHtml(HOSPITAL_NAME)}</h2><span>Patient service record · Local copy</span></div></div><div style="text-align:right"><b>${escapeHtml(title)}</b><br>${dateTime(record.createdAt || record.visitAt || record.startAt)}</div></header><svg class="record-barcode" data-barcode="${escapeHtml(title)}"></svg><div class="form-grid" style="margin-top:16px">${details.map(([label, value]) => `<div><small style="color:#718078">${label}</small><div style="margin-top:3px;font-weight:600">${escapeHtml(value)}</div></div>`).join('')}</div>${labTable}${payment}<div class="print-note">Please retain this slip for your records. Thank you for choosing ${escapeHtml(HOSPITAL_NAME)}.</div></article>`;
		const printActions = modal.type === 'print' ? `<footer class="modal-foot"><button class="button button-secondary" data-action="close-modal">Close</button><button class="button button-secondary" data-action="print-now">Print</button><button class="button button-primary" data-action="save-pdf" data-page-size="${pageSize}">Save PDF</button></footer>` : actionButton;
		const recordInspector = `<details class="record-inspector"><summary>Full saved record</summary><pre>${escapeHtml(JSON.stringify(record, null, 2))}</pre></details>`;
		return `<div class="modal-backdrop" data-action="close-modal"><section class="modal wide" role="dialog" aria-modal="true"><header class="modal-head"><h2>${modal.type === 'print' ? 'Print preview' : `Record · ${escapeHtml(title)}`}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">×</button></header><div class="modal-body">${sheet}${recordInspector}</div>${printActions}</section></div>`;
	}

	function renderTestCashMemo(record) {
		const tests = (record.tests || []).map((test, index) => `<tr><td>${String(index + 1).padStart(2, '0')}</td><td>[${escapeHtml(test.code)}] ${escapeHtml(test.name)}</td><td>${money(test.price)}</td></tr>`).join('');
		return `<article class="print-sheet print-sheet--cashmemo"><section class="cash-memo">
			<header class="memo-header">${hospitalLogo('memo-mark')}<div><h2>${escapeHtml(HOSPITAL_NAME)}</h2><strong>Diagnostic Cash Memo</strong><small>Kabirhat, Noakhali · Reception: 01868-551839 · Office: 01762-913773</small></div><span class="memo-tag">CASH MEMO</span></header>
			<div class="memo-meta"><b>Memo No: ${escapeHtml(record.billId)}</b><span>Date: ${dateOnly(record.createdAt)}</span></div>
			<div class="memo-patient">
				<div><span>Patient's Name</span><b>${escapeHtml(record.patientName)}</b></div>
				<div><span>Mobile No.</span><b>${escapeHtml(record.contact)}</b></div>
				<div class="memo-demographic"><span>Age</span><b>${escapeHtml(record.age)}</b></div>
				<div class="memo-demographic"><span>Gender</span><b>${escapeHtml(record.gender)}</b></div>
				<div><span>ID / Reg No.</span><b>${escapeHtml(record.billId)}</b></div>
				<div class="memo-referrer"><span>Referring doctor</span><b>${escapeHtml((record.doctors || []).map(doctor => doctor.name).join(', ') || '—')}</b></div>
			</div>
			<table class="memo-table"><thead><tr><th>Sl. No.</th><th>Particular</th><th>Amount</th></tr></thead><tbody>${tests || '<tr><td colspan="3">No tests listed</td></tr>'}</tbody></table>
			<div class="memo-bottom"><div class="memo-words"><span>Taka in Words</span><b>${escapeHtml(amountInWords(record.net))}</b><div class="memo-sign">Payment by: ____________________<br><br>____________________<br>Receiver's Signature</div></div><div class="memo-totals"><div><span>Total Taka</span><b>${money(record.subtotal)}</b></div><div><span>Discount</span><b>${money(record.discount)}</b></div><div><span>Advance</span><b>${money(record.advance)}</b></div><div><span>Due</span><b>${money(record.due)}</b></div></div></div>
			<div class="memo-barcode"><svg data-barcode="${escapeHtml(record.billId)}"></svg></div>
			<footer class="print-credit"><span class="print-motto">বিশ্বমানের সর্বাধুনিক চিকিৎসা সেবা প্রদানের মাধ্যমে, রোগীকে সুস্থ করে পরিবারের মুখে হাসি ফুটানই আমাদের অঙ্গীকার।</span><span class="developer-credit">Developed By : <img class="developer-logo" src="../site_assets/unreal_studio_icon.svg" alt=""> - Unreal Studio ©</span></footer>
		</section></article>`;
	}

	function renderIndoorBill(record) {
		const extras = record.extras || [];
		const admissionTotal = extras.filter(item => indoorFeeKind(item.name) === 'admission').reduce((sum, item) => sum + Number(item.price || 0), 0);
		const cabinTotal = extras.filter(item => indoorFeeKind(item.name) === 'cabin').reduce((sum, item) => sum + Number(item.price || 0), 0);
		const rows = [
			{ number: '01', label: 'Admission Fee', value: admissionTotal },
			{ number: '02', label: 'Cabin/Bed Charge', value: Number(record.dailyRate || 0) * Number(record.days || 1) + cabinTotal },
			{ number: '03', label: 'Investigation' },
			{ label: 'a) Pathology', subcharge: true },
			{ label: 'b) X-Ray', subcharge: true },
			{ label: 'c) E.C.G', subcharge: true },
			{ label: 'd) Ultrasonography', subcharge: true },
			{ label: 'e) Endoscopy', subcharge: true },
			{ label: 'f) Echocardiography', subcharge: true },
			{ number: '04', label: 'Oxygen Charge' },
			{ number: '05', label: 'O.T Charge' },
			{ number: '06', label: 'Operation Charge' },
			{ label: 'a) Surgeon Fee', subcharge: true },
			{ label: 'b) 1st Asstt Fee', subcharge: true },
			{ label: 'c) 2nd Asstt Fee', subcharge: true },
			{ label: 'd) 3rd Asstt Fee', subcharge: true },
			{ number: '07', label: 'Anesthesia Charge' },
			{ number: '08', label: 'Delivery Charge' },
			{ number: '09', label: 'Dressing Charge' },
			{ number: '10', label: 'Transfusion Charge' },
			{ number: '11', label: 'Cost of Medicine' },
			{ number: '12', label: 'Consultant Fee' },
			{ number: '13', label: 'Medical Board (Doctors)' },
			{ number: '14', label: 'Medical Board (Clinic)' },
			{ number: '15', label: 'Stitch of Charge' },
			{ number: '16', label: 'Ambulance Fare' },
			{ number: '17', label: 'Ryles-Tub, Enema, Catheterization / IV Cannula Charge' },
			{ number: '18', label: 'Nabulization' },
			{ number: '19', label: 'Phototherapy' },
			{ number: '20', label: 'Cardiac Monitor' },
			{ number: '21', label: 'Instrument Charge' }
		];
		extras.filter(service => !indoorFeeKind(service.name)).forEach(service => rows.push({
			number: String(rows.filter(row => row.number).length + 1).padStart(2, '0'),
			label: service.parentName ? `${service.parentName} / ${service.name}` : service.name,
			value: Number(service.price || 0)
		}));
		const half = Math.ceil(rows.length / 2);
		const copyTable = () => `<div class="indoor-tables">${[rows.slice(0, half), rows.slice(half)].map(items => `<table class="indoor-table"><tbody>${items.map(row => `<tr${row.subcharge ? ' class="indoor-subcharge"' : ''}><td>${row.number || ''}</td><td>${escapeHtml(row.label)}</td><td>${row.value ? money(row.value) : ''}</td></tr>`).join('')}</tbody></table>`).join('')}</div>`;
		const copy = label => `<section class="indoor-copy">
			<header class="indoor-head">${hospitalLogo('indoor-mark')}<div><h2>${escapeHtml(HOSPITAL_NAME)}</h2><span>Kabirhat, Noakhali · Reception: 01868-551839 · Office: 01762-913773</span></div><strong>INDOOR BILL<br><small>${label}</small></strong></header>
			<div class="indoor-meta"><b>No. ${escapeHtml(record.slipNo || record.bookingId)}</b><svg data-barcode="${escapeHtml(record.bookingId)}"></svg></div>
			<div class="indoor-patient"><div><span>Name</span><b>${escapeHtml(record.patientName)}</b></div><div><span>Reg No.</span><b>${escapeHtml(record.bookingId)}</b></div><div><span>Address / Contact</span><b>${escapeHtml(record.contact || '—')}</b></div><div><span>Cabin / Bed No.</span><b>${escapeHtml(cabinName(record.cabinId))}</b></div><div class="indoor-demographic"><span>Age</span><b>${escapeHtml(record.age || '—')}</b></div><div class="indoor-demographic"><span>Gender</span><b>${escapeHtml(record.gender || '—')}</b></div><div><span>Admission Date</span><b>${dateOnly(record.startAt)}</b></div><div><span>Release Date</span><b>${dateOnly(record.endAt)}</b></div></div>
			${copyTable()}
			<div class="indoor-totals"><div class="indoor-words"><b>Tk. (In Word):</b> ${escapeHtml(amountInWords(record.net))}</div><div class="indoor-sums"><div><span>Sub Total</span><b>${money(record.subtotal)}</b></div><div><span>Service Charge</span><b>${money(0)}</b></div><div><span>Vat</span><b>${money(0)}</b></div><div><span>Net Total</span><b>${money(record.net)}</b></div><div><span>Advance</span><b>${money(record.advance)}</b></div><div><span>Balance</span><b>${money(record.due)}</b></div></div></div>
			<footer class="indoor-signatures"><span>Signature of Recipient</span><span>Checked by</span><span>Accountant</span></footer>
			<footer class="print-credit"><span class="print-motto">বিশ্বমানের সর্বাধুনিক চিকিৎসা সেবা প্রদানের মাধ্যমে, রোগীকে সুস্থ করে পরিবারের মুখে হাসি ফুটানই আমাদের অঙ্গীকার।</span><span class="developer-credit">Developed By : <img class="developer-logo" src="../site_assets/unreal_studio_icon.svg" alt=""> - Unreal Studio ©</span></footer>
		</section>`;
		return `<article class="print-sheet print-sheet--indoor">${copy('Client Copy')}${copy('Office Copy')}</article>`;
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
		if (!query) return matchesRecordFilters(item);
		if (!state.searchResults || state.searchResults.query !== query) state.searchResults = { query, items: getSearchIndex().matches(query) };
		if (!state.searchResults.items.has(item)) return false;
		return matchesRecordFilters(item);
	}

	function matchesRecordFilters(item) {
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

	function getSearchIndex() {
		if (state.searchIndex) return state.searchIndex;
		const collections = Object.values(state.data).filter(Array.isArray);
		const entries = [];
		const collectValues = value => {
			if (value === null || value === undefined) return [];
			if (['string', 'number', 'boolean'].includes(typeof value)) return [String(value)];
			if (Array.isArray(value)) return value.flatMap(collectValues);
			if (typeof value === 'object') return Object.values(value).flatMap(collectValues);
			return [];
		};
		for (const item of collections.flat()) {
			if (!item || typeof item !== 'object') continue;
			entries.push([item, collectValues(item).join(' ').toLowerCase()]);
		}
		state.searchIndex = window.JXBW.build(entries);
		return state.searchIndex;
	}
	function doctorName(doctorId) { return state.data.doctors.find(item => item.id === doctorId)?.name || 'Doctor removed'; }
	function cabinName(cabinId) { return state.data.cabins.find(item => item.id === cabinId)?.name || cabinId || 'Cabin removed'; }
	function recordKind(record) { return record.kind === 'roomClaims' || state.data.roomClaims.includes(record) ? 'roomClaims' : state.data.labOrders.includes(record) ? 'labOrders' : state.data.appointments.includes(record) ? 'appointments' : 'bookings'; }
	function sumExtras(extras) { return (extras || []).reduce((sum, item) => sum + Number(item.price || 0), 0); }
	function indoorServiceExtra(service, child = null) {
		return {
			id: child?.id || service.id,
			parentId: service.id,
			...(child ? { childId: child.id, parentName: service.name } : {}),
			name: child?.name || service.name,
			price: moneyInput(child?.price ?? service.price)
		};
	}

	function selectedIndoorServices(form) {
		const selected = new Set(new FormData(form).getAll('serviceIds'));
		const extras = [];
		for (const service of state.data.indoorServices) {
			if (selected.has(service.id)) extras.push(indoorServiceExtra(service));
			for (const child of service.children || []) {
				if (selected.has(`child::${service.id}::${child.id}`)) extras.push(indoorServiceExtra(service, child));
			}
		}
		return extras;
	}

	function automaticIndoorServices(includeAdmission) {
		return state.data.indoorServices
			.filter(service => !service.children?.length)
			.filter(service => {
				const kind = indoorFeeKind(service.name);
				return kind === 'cabin' || (includeAdmission && kind === 'admission');
			})
			.map(service => indoorServiceExtra(service));
	}

	function updateBookingEstimate(form) {
		const output = form.querySelector('#booking-estimate');
		if (!output) return;
		const days = Math.max(1, Number(form.elements.durationDays.value) || 1);
		const addServices = form.dataset.addServices === 'true';
		const cabinCharge = addServices ? 0 : moneyInput(form.elements.price.value) * days;
		const automaticFees = addServices ? 0 : automaticIndoorServices(!form.dataset.id).reduce((sum, item) => sum + item.price, 0);
		const selectedServices = selectedIndoorServices(form).reduce((sum, item) => sum + item.price, 0);
		output.textContent = money(cabinCharge + automaticFees + selectedServices);
	}

	function go(module, tab = 0) { location.hash = routeHref(module, tab); }

	function selectProfileChoice(group, value) {
		const choice = [...group.querySelectorAll('.profile-choice')].find(item => item.dataset.choiceId === value);
		choice?.click();
	}

	appRoot.addEventListener('click', async event => {
		const button = event.target.closest('[data-action], [data-route], [data-tab]');
		const selectItem = event.target.closest('[data-select-id]');
		if (selectItem) {
			const container = selectItem.closest('[data-type-select-container]');
			const name = container?.dataset.typeSelectContainer;
			const multiple = container?.dataset.multiple === 'true';
			const hiddenSelect = container?.querySelector(`[data-type-select-hidden="${name}"]`);
			const input = container?.querySelector(`[data-type-select-input="${name}"]`);
			const dropdown = container?.querySelector(`[data-type-select-dropdown="${name}"]`);
			if (hiddenSelect && input) {
				const id = selectItem.dataset.selectId;
				const option = [...hiddenSelect.options].find(opt => opt.value === id);
				if (option) {
					if (multiple) {
						option.selected = true;
						input.value = '';
						syncTypeSelectUI(container);
						if (dropdown) dropdown.style.display = 'block';
						input.focus();
					} else {
						[...hiddenSelect.options].forEach(opt => opt.selected = (opt.value === id));
						input.value = option.text;
						if (dropdown) dropdown.style.display = 'none';
					}
					const form = container.closest('form');
					if (form) {
						form.dispatchEvent(new Event('input', { bubbles: true }));
						form.dispatchEvent(new Event('change', { bubbles: true }));
					}
				}
			}
			return;
		}

		const removeBtn = event.target.closest('[data-remove-id], .type-tag-remove');
		if (removeBtn) {
			const tag = removeBtn.closest('[data-remove-id]');
			const id = tag?.dataset.removeId;
			const container = tag?.closest('[data-type-select-container]');
			const name = container?.dataset.typeSelectContainer;
			const hiddenSelect = container?.querySelector(`[data-type-select-hidden="${name}"]`);
			if (hiddenSelect && id) {
				const option = [...hiddenSelect.options].find(opt => opt.value === id);
				if (option) {
					option.selected = false;
					syncTypeSelectUI(container);
					const form = container.closest('form');
					if (form) {
						form.dispatchEvent(new Event('input', { bubbles: true }));
						form.dispatchEvent(new Event('change', { bubbles: true }));
					}
				}
			}
			return;
		}

		if (!event.target.closest('[data-type-select-container]')) {
			appRoot.querySelectorAll('.type-select-dropdown').forEach(d => d.style.display = 'none');
		}
		if (!button) return;
		if (button.dataset.route) { go(button.dataset.route, Number(button.dataset.routeTab || 0)); return; }
		if (button.dataset.tab !== undefined) { go(state.route.module, Number(button.dataset.tab)); return; }
		const action = button.dataset.action;
		if (button.classList.contains('modal-backdrop') && event.target !== button) return;
		if (action === 'toggle-password') {
			const password = appRoot.querySelector('#password');
			if (!password) return;
			const visible = password.type === 'password';
			password.type = visible ? 'text' : 'password';
			button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
			button.setAttribute('aria-pressed', String(visible));
			button.textContent = visible ? '◎' : '◉';
			password.focus();
			return;
		}
		if (action === 'toggle-analytics-motion') {
			state.analytics.chartMotion = !state.analytics.chartMotion;
			render();
			return;
		}
		if (action === 'toggle-analytics-rotation') {
			state.analytics.chartRotate = !state.analytics.chartRotate;
			render();
			return;
		}
		if (action === 'select-profile-choice') {
			const group = button.closest('[data-choice-name]');
			if (!group) return;
			const name = group.dataset.choiceName;
			const choiceId = button.dataset.choiceId;
			if (group.dataset.choiceMultiple === 'true') {
				button.classList.toggle('selected');
				button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
			} else {
				group.querySelectorAll('.profile-choice').forEach(item => {
					const selected = item === button;
					item.classList.toggle('selected', selected);
					item.setAttribute('aria-pressed', String(selected));
				});
			}
			const values = group.dataset.choiceMultiple === 'true'
				? [...group.querySelectorAll('.profile-choice.selected')].map(item => item.dataset.choiceId).filter(Boolean)
				: choiceId ? [choiceId] : [];
			group.closest('.field').querySelectorAll(`[data-choice-value="${name}"]`).forEach(input => input.remove());
			for (const value of values) {
				const input = document.createElement('input');
				input.type = 'hidden';
				input.name = name;
				input.dataset.choiceValue = name;
				input.value = value;
				group.closest('.field').append(input);
			}
			if (name === 'referrerId') {
				const referrer = state.data.referrers.find(item => item.id === choiceId);
				const agentGroup = appRoot.querySelector('[data-choice-name="agentId"]');
				if (agentGroup) {
					agentGroup.dataset.keepReferral = 'true';
					selectProfileChoice(agentGroup, referrer?.agentId || '');
					delete agentGroup.dataset.keepReferral;
				}
			}
			if (name === 'agentId' && choiceId && group.dataset.keepReferral !== 'true') {
				const referrerGroup = appRoot.querySelector('[data-choice-name="referrerId"]');
				if (referrerGroup) selectProfileChoice(referrerGroup, '');
			}
			return;
		}
		if (action === 'logout') { state.user = null; state.modal = null; render(); return; }
		if (action === 'focus-scanner') { const scanner = appRoot.querySelector('[data-scan-input]'); if (scanner) { scanner.value = ''; scanner.focus(); toast('Scan the document barcode.'); } }
		if (action === 'minimize') window.hospital?.minimize();
		if (action === 'maximize') window.hospital?.toggleMaximize();
		if (action === 'close') window.hospital?.close();
		if (action === 'see-referrers') { state.modal = { type: 'referrers', agentId: button.dataset.id }; render(); }
		if (action === 'view-referrer') { state.modal = { type: 'profile', id: button.dataset.id }; render(); }
		if (action === 'agent-dashboard') { state.modal = { type: 'referral-dashboard', scope: 'agent', id: button.dataset.id, dayOffset: 0, page: 0, query: '' }; render(); }
		if (action === 'referrer-dashboard') { state.modal = { type: 'referral-dashboard', scope: 'referrer', id: button.dataset.id, dayOffset: 0, page: 0, query: '' }; render(); }
		if (action === 'referral-day-prev') { state.modal.dayOffset = Number(state.modal.dayOffset || 0) - 1; state.modal.page = 0; render(); }
		if (action === 'referral-day-next') { state.modal.dayOffset = Number(state.modal.dayOffset || 0) + 1; state.modal.page = 0; render(); }
		if (action === 'referral-source') { state.modal.source = button.dataset.source; state.modal.page = 0; render(); }
		if (action === 'referral-page-prev') { state.modal.page = Math.max(0, Number(state.modal.page || 0) - 1); render(); }
		if (action === 'referral-page-next') { state.modal.page = Number(state.modal.page || 0) + 1; render(); }
		if (action === 'analytics-page') {
			const pageCount = Math.ceil(allRecords().filter(record => isInAnalyticsPeriod(record, state.analytics.period) && matchesAnalyticsSearch(record)).length / state.analytics.pageSize);
			state.analytics.page = Math.min(Math.max(0, state.analytics.page + Number(button.dataset.step)), Math.max(0, pageCount - 1));
			render();
		}
		if (action === 'analytics-doctor-page') {
			const doctorCount = state.data.doctors.filter(doctor => !state.analytics.doctorSearch.trim() || `${doctor.name} ${doctor.specialty || ''}`.toLowerCase().includes(state.analytics.doctorSearch.trim().toLowerCase())).length;
			const pageCount = Math.ceil(doctorCount / state.analytics.doctorPageSize);
			state.analytics.doctorPage = Math.min(Math.max(0, state.analytics.doctorPage + Number(button.dataset.step)), Math.max(0, pageCount - 1));
			render();
		}
		if (action === 'analytics-test-page') {
			const pageCount = Math.ceil(state.analytics.testCount / state.analytics.testPageSize);
			state.analytics.testPage = Math.min(Math.max(0, state.analytics.testPage + Number(button.dataset.step)), Math.max(0, pageCount - 1));
			render();
		}
		if (action === 'add-service-child') {
			appRoot.querySelector('#item-form .service-child-list')?.insertAdjacentHTML('beforeend', serviceChildEditor());
		}
		if (action === 'remove-service-child') button.closest('.service-child-row')?.remove();
		if (action === 'focus-referral-scanner') { const scanner = appRoot.querySelector('[data-referral-scan]'); if (scanner) { scanner.value = ''; scanner.focus(); } }
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
		if (action === 'retry-firebase-sync') {
			try {
				state.firebaseSync = await window.hospital?.retryFirebaseSync();
				if (state.firebaseSync?.lastError) toast(`Firebase retry needs attention: ${state.firebaseSync.lastError}`, true);
				else toast('Firebase upload queue is up to date.');
				render();
			} catch (error) { toast(`Could not retry Firebase uploads: ${error.message}`, true); }
		}
		if (action === 'add-floor') { state.modal = { type: 'floor' }; render(); }
		if (action === 'edit-floor') {
			const floor = state.data.floors.find(item => item.id === button.dataset.id);
			if (floor) { state.modal = { type: 'floor', item: floor }; render(); }
		}
		if (action === 'delete-floor') {
			const floor = state.data.floors.find(item => item.id === button.dataset.id);
			if (!floor) return;
			if (state.data.rooms.some(room => room.floorId === floor.id)) return toast('Move or remove this floor’s rooms before deleting the floor.', true);
			state.modal = { type: 'confirm', title: 'Delete this floor?', message: 'The floor has no rooms and can be safely removed.', confirmLabel: 'Delete floor', callback: async () => { state.data.floors = state.data.floors.filter(item => item.id !== floor.id); await persist('Floor deleted.'); render(); } };
			render();
		}
		if (action === 'add-room') {
			if (!state.data.floors.length) return toast('Add a floor before adding a room.', true);
			state.modal = { type: 'room' }; render();
		}
		if (action === 'edit-room') {
			const room = state.data.rooms.find(item => item.id === button.dataset.id);
			if (room) { state.modal = { type: 'room', item: room }; render(); }
		}
		if (action === 'delete-room') {
			const room = state.data.rooms.find(item => item.id === button.dataset.id);
			if (!room) return;
			if (state.data.roomClaims.some(claim => claim.roomId === room.id)) return toast('This room has payment history and cannot be deleted.', true);
			state.modal = { type: 'confirm', title: 'Delete this room?', message: 'The room has no payment history. Its unpaid monthly bill records will also be removed.', confirmLabel: 'Delete room', callback: async () => { state.data.rooms = state.data.rooms.filter(item => item.id !== room.id); state.data.roomBills = state.data.roomBills.filter(item => item.roomId !== room.id); await persist('Room deleted.'); render(); } };
			render();
		}
		if (action === 'claim-room') {
			const room = state.data.rooms.find(item => item.id === button.dataset.id);
			const bill = room && HospitalRoomBilling.currentBill(state.data, room.id);
			if (!bill || bill.monthlyAmount <= bill.received) return toast('This room has no remaining balance for the current month.', true);
			state.modal = { type: 'room-payment', id: room.id }; render();
		}
		if (action === 'print-room-claim') {
			state.modal = { type: 'print', kind: 'roomClaims', id: button.dataset.id };
			render();
		}
		if (action === 'new-lab') go('counter', 1);
		if (action === 'go-tests') go('management', 0);
		if (action === 'book-doctor') { sessionStorage.setItem('hmss-doctor', button.dataset.doctor); go('appointment', button.dataset.pre ? 2 : 1); }
		if (action === 'book-cabin') { state.modal = { type: 'booking', cabinId: button.dataset.cabin }; render(); }
		if (action === 'renew-booking') { state.modal = { type: 'renew', id: button.dataset.id }; render(); }
		if (action === 'add-cabin-service') {
			const booking = state.data.bookings.find(item => item.id === button.dataset.id);
			if (booking) { state.modal = { type: 'booking', cabinId: booking.cabinId, booking, addServices: true }; render(); }
		}
		if (action === 'view-record') { state.modal = { type: 'record', kind: button.dataset.kind, id: button.dataset.id }; render(); }
		if (action === 'patient-history') { state.modal = { type: 'patient-history', key: button.dataset.key }; render(); }
		if (action === 'print-record') { state.modal = { type: 'print', kind: button.dataset.kind, id: button.dataset.id }; render(); }
		if (action === 'print-now') window.print();
		if (action === 'save-pdf') {
			try {
				const saved = await window.hospital?.savePdf(button.dataset.pageSize);
				if (saved) toast(`PDF saved to Downloads: ${saved.split(/[\\/]/).at(-1)}`);
			} catch (error) { toast(`Could not save PDF: ${error.message}`, true); }
		}
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
			const form = document.querySelector('#item-form');
			try {
				const image = await window.hospital?.chooseImage(form?.dataset.kind);
				const input = form?.querySelector('[name="photo"]');
				if (image && input) { input.value = image; const preview = form.querySelector('.profile-preview'); if (preview) preview.src = image; }
			} catch (error) { toast(`Could not store image: ${error.message}`, true); }
		}
	});

	appRoot.addEventListener('dragover', event => {
		if (event.target.closest('[data-profile-drop]')) event.preventDefault();
	});
	appRoot.addEventListener('drop', async event => {
		const dropzone = event.target.closest('[data-profile-drop]');
		if (!dropzone) return;
		event.preventDefault();
		const file = event.dataTransfer.files[0];
		const category = dropzone.closest('#item-form')?.dataset.kind;
		let sourcePath;
		try { sourcePath = file && window.hospital?.getImagePath(file); }
		catch { return toast('Drop a local image file.', true); }
		if (!sourcePath) return toast('Drop a local image file.', true);
		try {
			const image = await window.hospital?.storeImage(sourcePath, category);
			if (image) { document.querySelector('#item-form [name="photo"]').value = image; dropzone.querySelector('img').src = image; }
		} catch (error) { toast(`Could not store image: ${error.message}`, true); }
	});

	appRoot.addEventListener('input', event => {
		const input = event.target.closest('[data-type-select-input]');
		if (input) {
			const container = input.closest('[data-type-select-container]');
			const dropdown = container?.querySelector('.type-select-dropdown');
			if (dropdown) {
				dropdown.style.display = 'block';
				syncTypeSelectUI(container);
			}
			return;
		}
		if (event.target.matches('[data-analytics-test-search]')) {
			state.analytics.testSearch = event.target.value;
			state.analytics.testPage = 0;
			const cursor = event.target.selectionStart;
			render();
			const replacement = appRoot.querySelector('[data-analytics-test-search]');
			replacement?.focus(); replacement?.setSelectionRange(cursor, cursor);
			return;
		}
		if (event.target.matches('[data-analytics-doctor-search]')) {
			state.analytics.doctorSearch = event.target.value;
			state.analytics.doctorPage = 0;
			const cursor = event.target.selectionStart;
			render();
			const replacement = appRoot.querySelector('[data-analytics-doctor-search]');
			replacement?.focus(); replacement?.setSelectionRange(cursor, cursor);
			return;
		}
		if (event.target.matches('[data-service-search]')) {
			const query = event.target.value.trim().toLowerCase();
			event.target.form.querySelectorAll('.service-option-group').forEach(group => {
				const title = group.querySelector('.service-group-title')?.textContent.toLowerCase() || '';
				let visible = false;
				group.querySelectorAll('.service-option').forEach(option => {
					const matches = title.includes(query) || option.textContent.toLowerCase().includes(query);
					option.hidden = !matches;
					visible ||= matches;
				});
				group.hidden = !visible;
			});
			return;
		}
		if (event.target.matches('[data-referral-search]')) {
			state.modal.query = event.target.value;
			state.modal.page = 0;
			const position = event.target.selectionStart;
			render();
			const replacement = appRoot.querySelector('[data-referral-search]');
			replacement?.focus(); replacement?.setSelectionRange(position, position);
			return;
		}
		if (event.target.form?.id === 'booking-form' && ['durationDays', 'startAt', 'endAt'].includes(event.target.name)) {
			const form = event.target.form;
			const start = new Date(form.elements.startAt.value);
			if (Number.isFinite(start.getTime())) {
				if (event.target.name === 'endAt') form.elements.durationDays.value = Math.max(1, Math.ceil((new Date(form.elements.endAt.value) - start) / 86400000));
				else form.elements.endAt.value = toDateInput(new Date(start.getTime() + Math.max(1, Number(form.elements.durationDays.value) || 1) * 86400000).toISOString());
			}
		}
		if (event.target.form?.id === 'booking-form' && ['price', 'discount', 'durationDays'].includes(event.target.name)) updateBookingEstimate(event.target.form);
		if (event.target.matches('#booking-form [name="serviceIds"]')) updateBookingEstimate(event.target.form);
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
		if (event.target.form?.id === 'appointment-form' && event.target.name === 'doctorId') { updateVisitPrice(); fillDoctorSchedule(); }
	});

	appRoot.addEventListener('focusin', event => {
		const input = event.target.closest('[data-type-select-input]');
		if (input) {
			const container = input.closest('[data-type-select-container]');
			const dropdown = container?.querySelector('.type-select-dropdown');
			if (dropdown) {
				dropdown.style.display = 'block';
				syncTypeSelectUI(container);
			}
		}
	});

	appRoot.addEventListener('change', event => {
		if (event.target.matches('[data-analytics-chart-mode]')) {
			state.analytics.chartMode = event.target.value;
			render();
		}
		if (event.target.matches('[data-analytics-3d-zoom]')) {
			state.analytics.chartZoom = Number(event.target.value) / 100;
			render();
		}
		if (event.target.matches('[data-analytics-period]')) {
			state.analytics.period = event.target.value;
			state.analytics.page = 0;
			state.analytics.doctorPage = 0;
			state.analytics.testPage = 0;
			if (event.target.value !== 'custom') { state.analytics.from = ''; state.analytics.to = ''; }
			render();
		}
		if (event.target.matches('[data-analytics-date]')) {
			state.analytics[event.target.dataset.analyticsDate] = event.target.value;
			state.analytics.page = 0;
			state.analytics.testPage = 0;
			render();
		}
		if (event.target.matches('[data-analytics-page-size]')) {
			state.analytics.pageSize = Number(event.target.value);
			state.analytics.page = 0;
			render();
		}
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
		if (event.target.form?.id === 'booking-form' && event.target.matches('[name="serviceIds"]')) updateBookingEstimate(event.target.form);
	});

	appRoot.addEventListener('keydown', event => {
		if (event.target.matches('[data-referral-scan]') && event.key === 'Enter') {
			event.preventDefault();
			state.modal.query = event.target.value.trim();
			state.modal.page = 0;
			render();
			return;
		}
		if (!event.target.matches('[data-scan-input]') || event.key !== 'Enter') return;
		event.preventDefault();
		state.query = event.target.value.trim();
		render();
		document.querySelector('[data-search]')?.focus();
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
		if (form.id === 'room-floor-form') return saveRoomFloor(form, values);
		if (form.id === 'room-form') return saveRoom(form, values);
		if (form.id === 'room-payment-form') return saveRoomPayment(form, values);
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

	function fillDoctorSchedule() {
		const form = document.getElementById('appointment-form');
		const doctor = form && state.data.doctors.find(item => item.id === form.elements.doctorId.value);
		const range = doctor && chamberRange(doctor);
		if (!range) return;
		form.elements.fromTime.value = `${String(Math.floor(range[0] / 60) % 24).padStart(2, '0')}:${String(range[0] % 60).padStart(2, '0')}`;
		form.elements.toTime.value = `${String(Math.floor(range[1] / 60) % 24).padStart(2, '0')}:${String(range[1] % 60).padStart(2, '0')}`;
	}

	function matchesPatient(record, contact, patientName) {
		const phoneMatches = contact && contact.trim().length >= 5 && record.contact === contact.trim();
		const nameMatches = patientName && patientName.trim().length >= 3 && record.patientName.toLowerCase() === patientName.trim().toLowerCase();
		return phoneMatches || nameMatches;
	}

	async function saveRoomFloor(form, values) {
		const existing = state.data.floors.find(item => item.id === form.dataset.id);
		const previous = existing ? { ...existing } : null;
		const name = String(values.name || '').trim();
		if (!name) return toast('Enter a floor name.', true);
		if (state.data.floors.some(item => item.id !== existing?.id && item.name.toLowerCase() === name.toLowerCase())) return toast('A floor with that name already exists.', true);
		const floor = { id: existing?.id || id('FLOOR'), name, label: String(values.label || '').trim() };
		if (existing) Object.assign(existing, floor);
		else state.data.floors.unshift(floor);
		state.modal = null;
		if (!await persist(existing ? 'Floor updated.' : 'Floor added.')) {
			if (existing) Object.assign(existing, previous);
			else state.data.floors = state.data.floors.filter(item => item.id !== floor.id);
			return;
		}
		render();
	}

	async function saveRoom(form, values) {
		const existing = state.data.rooms.find(item => item.id === form.dataset.id);
		const previous = existing ? { ...existing } : null;
		const name = String(values.name || '').trim();
		const floor = state.data.floors.find(item => item.id === values.floorId);
		const monthlyAmount = Number(values.monthlyAmount);
		if (!name || !floor) return toast('Enter a room name and select a valid floor.', true);
		if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return toast('The monthly bill must be greater than zero.', true);
		if (state.data.rooms.some(item => item.id !== existing?.id && item.floorId === floor.id && item.name.toLowerCase() === name.toLowerCase())) return toast('That room name is already in use on this floor.', true);
		const room = { id: existing?.id || id('ROOM'), floorId: floor.id, name, monthlyAmount };
		if (existing) Object.assign(existing, room);
		else state.data.rooms.unshift(room);
		const createdBills = HospitalRoomBilling.ensureCurrentBills(state.data);
		state.modal = null;
		if (!await persist(existing ? 'Room updated.' : 'Room added.')) {
			if (existing) Object.assign(existing, previous);
			else {
				state.data.rooms = state.data.rooms.filter(item => item.id !== room.id);
				state.data.roomBills = state.data.roomBills.filter(bill => bill.roomId !== room.id);
			}
			return;
		}
		if (createdBills) logTerminal('info', `${createdBills} current monthly room bill(s) initialized.`);
		render();
	}

	async function saveRoomPayment(form, values) {
		const roomId = form.dataset.roomId;
		const bill = HospitalRoomBilling.currentBill(state.data, roomId);
		if (!bill) return toast('The current monthly room bill is unavailable.', true);
		const previousBill = { ...bill };
		let claim;
		try {
			claim = HospitalRoomBilling.recordPayment(state.data, roomId, values.amount, {
				id: id('RCPT'),
				paymentMethod: values.paymentMethod,
				notes: values.notes
			});
		} catch (error) {
			return toast(error.message, true);
		}
		state.modal = null;
		if (!await persist('Room payment saved.')) {
			Object.assign(bill, previousBill);
			state.data.roomClaims = state.data.roomClaims.filter(item => item.id !== claim.id);
			return;
		}
		await queueFirebaseRecord('roomClaims', claim);
		state.modal = { type: 'room-claim-receipt', id: claim.id };
		render();
	}

	async function saveCatalogItem(form, values) {
		const type = form.dataset.kind;
		const records = state.data[type];
		const existing = records.find(item => item.id === form.dataset.id);
		const item = { ...values };
		for (const key of Object.keys(item)) if (['price', 'newPrice', 'oldPrice'].includes(key)) item[key] = moneyInput(item[key]);
		if (type === 'indoorServices') {
			const formData = new FormData(form);
			const names = formData.getAll('childName').map(value => String(value).trim());
			const prices = formData.getAll('childPrice');
			const childIds = formData.getAll('childId');
			const children = [];
			for (let index = 0; index < names.length; index += 1) {
				if (!names[index] && !String(prices[index] || '').trim()) continue;
				if (!names[index] || !String(prices[index] || '').trim()) return toast('Enter both a child item name and price.', true);
				children.push({ id: childIds[index] || id('SVC'), name: names[index], price: moneyInput(prices[index]) });
			}
			if (!children.length && !String(formData.get('price') || '').trim()) return toast('Enter a parent price or add at least one child item.', true);
			const childNames = children.map(child => child.name.toLowerCase());
			if (new Set(childNames).size !== childNames.length) return toast('Child item names must be unique within a parent item.', true);
			const feeKind = indoorFeeKind(item.name);
			if (feeKind && records.some(entry => entry.id !== existing?.id && indoorFeeKind(entry.name) === feeKind)) {
				return toast('An automatic admission or cabin charge with that name already exists.', true);
			}
			item.children = children;
			delete item.childName;
			delete item.childPrice;
			delete item.childId;
		}
		if (type === 'tests') {
			if (records.some(entry => entry.code.toLowerCase() === item.code.trim().toLowerCase() && entry.id !== existing?.id)) return toast('That test code is already in use.', true);
			item.code = item.code.trim().toUpperCase();
		}
		if (type === 'doctors') item.id = existing?.id || id('D');
		else if (type === 'cabins') item.id = existing?.id || id('C');
		else if (type === 'indoorServices') item.id = existing?.id || id('SVC');
		else if (type === 'agents') item.id = existing?.id || id('A');
		else if (type === 'referrers') item.id = existing?.id || id('R');
		else item.id = existing?.id || id('T');
		if (existing) Object.assign(existing, item);
		else records.unshift(item);
		state.modal = null;
		const saved = await persist(existing ? 'Changes saved.' : 'New item added.');
		const firebaseKind = !existing ? ({ doctors: 'doctors', agents: 'agents', referrers: 'referrers' })[type] : '';
		if (saved && firebaseKind) {
			const { photo, ...remoteRecord } = item;
			await queueFirebaseRecord(firebaseKind, remoteRecord);
		}
		render();
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
		const doctorIds = formData.getAll('doctorIds');
		const doctors = doctorIds.map(doctorId => state.data.doctors.find(doctor => doctor.id === doctorId)).filter(Boolean).map(doctor => ({ id: doctor.id, name: doctor.name, specialty: doctor.specialty }));
		const referrer = state.data.referrers.find(item => item.id === formData.get('referrerId'));
		const directAgent = state.data.agents.find(item => item.id === formData.get('agentId'));
		const parentAgent = referrer && state.data.agents.find(item => item.id === referrer.agentId);
		const billId = uniqueBillId();
		const record = { id: id('LAB'), billId, patientName: String(formData.get('patientName')).trim(), age: Number(formData.get('age')), gender: formData.get('gender'), contact: String(formData.get('contact')).trim(), doctors, doctorIds, referrerId: referrer?.id || '', referrerName: referrer?.name || '', tests: selectedTests, testNames: selectedTests.map(test => test.name).join(', '), subtotal, discount, net, advance, due: net - advance, fullPaid: advance >= net, createdAt: nowISO(), deliveryAt: new Date(formData.get('deliveryAt')).toISOString(), remarks: formData.get('remarks') || '', note: formData.get('note') || '', description: formData.get('description') || '', status: 'Pending' };
		record.agentId = directAgent?.id || parentAgent?.id || '';
		record.agentName = directAgent?.name || parentAgent?.name || '';
		record.referralType = referrer ? 'special-referrer' : directAgent ? 'marketing-agent' : 'none';
		state.data.labOrders.unshift(record);
		if (await persist('Test bill saved.')) await queueFirebaseRecord('clinicalTests', record);
		openRecord('labOrders', record.id, true);
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
		state.data.appointments.unshift(record);
		if (await persist(isPrebooked ? 'Appointment reserved.' : 'Visit completed.')) await queueFirebaseRecord('appointments', record);
		openRecord('appointments', record.id, true);
	}

	async function saveBooking(form, values) {
		const existing = state.data.bookings.find(item => item.id === form.dataset.id);
		const cabinId = form.dataset.cabin;
		const cabin = state.data.cabins.find(item => item.id === cabinId);
		const days = Math.max(1, Number(values.durationDays) || Math.ceil((new Date(values.endAt) - new Date(values.startAt)) / 86400000));
		if (new Date(values.endAt) <= new Date(values.startAt)) return toast('Release time must be after admission.', true);
		const selectedExtras = selectedIndoorServices(form);
		const addingServices = form.dataset.addServices === 'true';
		const extras = addingServices
			? selectedExtras
			: [...automaticIndoorServices(!existing), ...selectedExtras];
		const dailyRate = moneyInput(values.price);
		const subtotal = dailyRate * days + sumExtras(extras);
		const discount = Math.min(subtotal, moneyInput(values.discount));
		const net = subtotal - discount;
		const advance = Math.min(net, moneyInput(values.advance));
		if (addingServices && existing) {
			if (!extras.length) return toast('Select at least one service item.', true);
			existing.extras ||= [];
			existing.extras.push(...extras);
			existing.subtotal += sumExtras(extras);
			existing.net += sumExtras(extras);
			existing.due = Math.max(0, existing.net - existing.advance);
			await persist('Cabin service items added.'); openRecord('bookings', existing.id, true); return;
		}
		if (existing) {
			existing.endAt = new Date(values.endAt).toISOString(); existing.days += days; existing.subtotal += subtotal; existing.net += net; existing.due += net; existing.status = 'Occupied';
			existing.advance += advance; existing.due = Math.max(0, existing.net - existing.advance); existing.extras.push(...extras); existing.notes = values.notes || existing.notes;
			await persist('Cabin stay renewed.'); openRecord('bookings', existing.id, true); return;
		}
		const slipNo = Math.max(0, ...state.data.bookings.map(item => Number(item.slipNo) || 0)) + 1;
		const record = { id: id('CAB'), bookingId: id('BOOK'), slipNo, cabinId: cabin?.id || cabinId, patientName: String(values.patientName).trim(), contact: String(values.contact).trim(), age: Number(values.age), gender: values.gender, startAt: new Date(values.startAt).toISOString(), endAt: new Date(values.endAt).toISOString(), days, dailyRate, extras, subtotal, discount, net, advance, due: net - advance, notes: values.notes || '', status: 'Occupied', createdAt: nowISO() };
		state.data.bookings.unshift(record);
		if (await persist('Cabin admission saved.')) await queueFirebaseRecord('cabinBookings', record);
		openRecord('bookings', record.id, true);
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
		if (event.ctrlKey && event.key.toLowerCase() === 'n' && state.user && state.route.module === 'counter') { event.preventDefault(); go('counter', 1); }
	});
	document.addEventListener('contextmenu', event => event.preventDefault());
	window.addEventListener('hashchange', routeFromHash);

	async function start() {
		try {
			if (window.hospital?.getUpdaterState) state.updater = await window.hospital.getUpdaterState();
			else state.updater = { appVersion: 'Browser preview', supported: false, status: 'unsupported', percent: 0, logs: [] };
			if (window.hospital?.load) state.data = await window.hospital.load();
			else state.data = JSON.parse(localStorage.getItem('hmss-data') || 'null') || fallbackData();
			state.data.indoorServices ||= [];
			state.data.floors ||= [];
			state.data.rooms ||= [];
			state.data.roomBills ||= [];
			state.data.roomClaims ||= [];
			const newMonthlyBills = HospitalRoomBilling.ensureCurrentBills(state.data);
			if (newMonthlyBills) {
				if (await persist()) logTerminal('info', `${newMonthlyBills} current monthly room bill(s) initialized.`);
			}
			if (window.hospital?.getFirebaseSyncState) {
				try { state.firebaseSync = await window.hospital.getFirebaseSyncState(); }
				catch (error) { logTerminal('error', `Could not read Firebase sync status: ${error.message}`); }
			}
			logTerminal('info', `Workspace opened with ${allRecords().length} patient records.`);
			const username = sessionStorage.getItem('hmss-session');
			state.user = state.data.users.find(item => item.username === username) || null;
			expireCabinStays();
			routeFromHash();
		} catch (error) {
			logTerminal('error', error.message);
			appRoot.innerHTML = `${windowBar()}<div class="empty"><strong>Workspace could not open</strong>${escapeHtml(error.message)}</div>`;
		}
	}

	function fallbackData() {
		return { users: [{ username: 'admin', password: 'admin123', name: 'Administrator' }], tests: [], doctors: [], agents: [], referrers: [], cabins: [], labOrders: [], appointments: [], bookings: [], floors: [], rooms: [], roomBills: [], roomClaims: [] };
	}

	setInterval(expireCabinStays, 60000);
	setInterval(() => {
		if (!state.data) return;
		const created = HospitalRoomBilling.ensureCurrentBills(state.data);
		if (created) {
			persist().then(saved => {
				if (saved) {
					logTerminal('info', `${created} monthly room bill(s) started for ${HospitalRoomBilling.currentMonth()}.`);
					if (state.user && state.route.module === 'management' && state.route.tab === 4) render();
				}
			});
		}
	}, 60000);
	window.hospital?.onUpdaterState(update => {
		state.updater = update;
		if (state.user && state.route.module === 'management' && state.route.tab === 5) render();
	});
	window.hospital?.onFirebaseSyncState(sync => {
		state.firebaseSync = sync;
		if (state.user && state.route.module === 'management' && state.route.tab === 5) render();
	});
	start();
})();
