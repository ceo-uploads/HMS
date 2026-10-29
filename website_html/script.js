import {
  ALLOWED_EMAIL,
  DATASETS,
  getSessionStatus,
  initializeFirebase,
  isAuthorizedAccount,
  listenToDataset,
  signInWithGoogle,
  signOutEverywhere,
  watchPrimaryAuth,
} from "./firebase.js";

const navigation = [
  { route: "dashboard", label: "Home / Dashboard", short: "Home", icon: "⌂" },
  { route: "summary", label: "Live Summary", short: "Live", icon: "◉" },
  { route: "tests", label: "Tests", short: "Tests", icon: "✚" },
  { route: "doctors", label: "Doctors", short: "Doctors", icon: "♙" },
  { route: "bookings", label: "Bookings / Cabins", short: "Bookings", icon: "▣" },
  { route: "bills", label: "Room Bills", short: "Bills", icon: "▤" },
  { route: "referrals", label: "Referrals / Leads", short: "Referrals", icon: "↗" },
  { route: "activity", label: "Analytics / Activity", short: "Activity", icon: "◷" },
];

const routeDetails = {
  dashboard: { title: "Dashboard", subtitle: "A live overview of your connected care services.", datasets: Object.keys(DATASETS) },
  summary: { title: "Live Summary", subtitle: "Search and monitor records across connected projects.", datasets: Object.keys(DATASETS) },
  tests: { title: "Clinical Tests", subtitle: "Live lab orders from the clinical tests project.", datasets: ["labOrders"] },
  doctors: { title: "Doctors", subtitle: "Read-only directory snapshot from other records.", datasets: ["doctors"] },
  bookings: { title: "Bookings & Cabins", subtitle: "Monitor cabin bookings as they update.", datasets: ["bookings"] },
  bills: { title: "Room Bills", subtitle: "Monitor room bill claims and their latest status.", datasets: ["claims"] },
  referrals: { title: "Referrals & Leads", subtitle: "Review incoming referrals and lead records.", datasets: ["referrals"] },
  activity: { title: "Analytics & Activity", subtitle: "A live source summary and recent update activity.", datasets: Object.keys(DATASETS) },
};

const allDatasetKeys = Object.keys(DATASETS);
const datasetStates = new Map(allDatasetKeys.map((key) => [key, {
  status: "idle",
  raw: null,
  rows: [],
  updatedAt: null,
  errorCode: "",
}]));
const subscriptions = new Map();
const sortChoices = new Map();

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const signInButton = document.getElementById("sign-in-button");
const signInLabel = document.getElementById("sign-in-label");
const signOutButton = document.getElementById("sign-out-button");
const authMessage = document.getElementById("auth-message");
const content = document.getElementById("content");
const viewContainer = document.getElementById("view-container");
const sideNavigation = document.getElementById("side-navigation");
const mobileNavigation = document.getElementById("mobile-navigation");
const statusBanner = document.getElementById("status-banner");
const globalSearch = document.getElementById("global-search");
const userName = document.getElementById("user-name");
const userAvatar = document.getElementById("user-avatar");

let activeRoute = "dashboard";
let query = "";
let authFlow = false;
let initialAuthResolved = false;
let sessionGeneration = 0;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function displayLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeLeafValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 497)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isSensitiveField(key) {
  return /(?:password|token|secret|credential|authorization|api.?key|private.?key)/i.test(key);
}

function flattenRecord(record, prefix = "", depth = 0, output = {}) {
  if (!record || typeof record !== "object" || depth > 2) return output;
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveField(key)) continue;
    const field = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && depth < 2) {
      flattenRecord(value, field, depth + 1, output);
    } else if (Array.isArray(value)) {
      const items = value.slice(0, 10).map((item) => {
        if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") return String(item ?? "");
        return "";
      }).filter(Boolean);
      if (items.length) output[field] = items.join(", ");
    } else {
      const leaf = safeLeafValue(value);
      if (leaf !== "") output[field] = leaf;
    }
    if (Object.keys(output).length >= 60) break;
  }
  return output;
}

function normalizeRows(raw) {
  if (raw === null || raw === undefined) return [];
  let entries;
  if (Array.isArray(raw)) {
    entries = raw.map((value, index) => [String(index), value]);
  } else if (raw && typeof raw === "object") {
    entries = Object.entries(raw);
  } else {
    entries = [["record", raw]];
  }
  return entries.map(([key, value]) => {
    const row = flattenRecord(value);
    if (!Object.keys(row).some((field) => /^(?:id|key|reference|bookingId|orderId|claimId)$/i.test(field))) {
      row.Reference = key;
    }
    return row;
  }).filter((row) => Object.keys(row).length);
}

function sourceRows(datasetKey) {
  return datasetStates.get(datasetKey)?.rows ?? [];
}

function filteredRows(rows, search = query) {
  const normalized = search.trim().toLocaleLowerCase();
  if (!normalized) return [...rows];
  return rows.filter((row) => Object.values(row).some((value) => String(value).toLocaleLowerCase().includes(normalized)));
}

function sortedRows(route, rows) {
  const selected = sortChoices.get(route) ?? { by: "", direction: 1 };
  if (!selected.by) return rows;
  return [...rows].sort((a, b) => {
    const left = a[selected.by] ?? "";
    const right = b[selected.by] ?? "";
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric = left !== "" && right !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const comparison = bothNumeric
      ? leftNumber - rightNumber
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    return comparison * selected.direction;
  });
}

function formatTime(timestamp) {
  if (!timestamp) return "Waiting for first update";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function setStatusBanner(message = "", kind = "warning") {
  statusBanner.textContent = message;
  statusBanner.className = `status-banner${kind === "warning" ? "" : ` ${kind}`}`;
  statusBanner.hidden = !message;
}

function renderNavigation() {
  const makeItem = ({ route, label, short, icon }) => `
    <button class="nav-item${route === activeRoute ? " active" : ""}" type="button" data-route="${escapeHtml(route)}" aria-current="${route === activeRoute ? "page" : "false"}">
      <span class="nav-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <span class="nav-label">${escapeHtml(short)}</span>
    </button>`;
  sideNavigation.innerHTML = navigation.map((item) => makeItem({ ...item, short: item.label })).join("");
  mobileNavigation.innerHTML = navigation.map(makeItem).join("");
}

function userLabel(user) {
  return user?.displayName?.trim() || user?.email?.split("@")[0] || "Signed in";
}

function showAuthenticated(user) {
  if (!isAuthorizedAccount(user)) {
    void denyUnauthorizedAccount();
    return;
  }
  authScreen.hidden = true;
  appShell.hidden = false;
  const name = userLabel(user);
  userName.textContent = name;
  userAvatar.textContent = (name[0] || "H").toLocaleUpperCase();
  document.getElementById("current-date").textContent = formatDate(new Date());
  setStatusBanner("");
  setRoute(activeRoute);
}

function clearSubscriptionsAndData() {
  sessionGeneration += 1;
  query = "";
  globalSearch.value = "";
  for (const unsubscribe of subscriptions.values()) {
    try { unsubscribe(); } catch { /* Listener cleanup is best-effort. */ }
  }
  subscriptions.clear();
  for (const state of datasetStates.values()) {
    state.status = "idle";
    state.raw = null;
    state.rows = [];
    state.updatedAt = null;
    state.errorCode = "";
  }
}

function showSignedOut(message = "") {
  clearSubscriptionsAndData();
  appShell.hidden = true;
  authScreen.hidden = false;
  signInButton.disabled = false;
  signInLabel.textContent = "Continue with Google";
  setAuthMessage(message || "Sign in with your Google account to continue.", Boolean(message));
  setStatusBanner("");
}

async function denyUnauthorizedAccount() {
  authFlow = true;
  clearSubscriptionsAndData();
  appShell.hidden = true;
  authScreen.hidden = false;
  signInButton.disabled = true;
  signInLabel.textContent = "Signing out…";
  setAuthMessage(`Access denied. Only ${ALLOWED_EMAIL} is authorized. Signing out of all connected projects.`, true);
  try {
    await signOutEverywhere();
  } catch {
    // Keep monitoring data closed even if a project session cannot be cleared.
  } finally {
    authFlow = false;
    signInButton.disabled = false;
    signInLabel.textContent = "Continue with Google";
    setAuthMessage(`Access denied. Only ${ALLOWED_EMAIL} is authorized. Choose that account to continue.`, true);
  }
}

function sessionErrorText(status) {
  if (status.unauthorized?.length) {
    return `Access denied. Only ${ALLOWED_EMAIL} is authorized to view the monitoring site.`;
  }
  if (status.authErrors?.length) {
    const failure = status.authErrors[0];
    const dataset = Object.values(DATASETS).find((entry) => entry.project === failure.project);
    const projectLabel = dataset?.label ?? "Firebase";
    return `Could not establish an authenticated Firebase ID token for project ${failure.project} (${projectLabel}). No database reads were started. Check Google sign-in and the app configuration for that project's Firebase Authentication settings, then try again.`;
  }
  if (!status.signedIn) return "";
  const missing = status.missing.map((project) => `Project ${project}`).join(", ");
  return `A Google session is not active in ${missing}. Sign out of this page and sign in again to reconnect all projects. Monitoring data remains unavailable until every project is authenticated.`;
}

async function validateCurrentSession() {
  const status = await getSessionStatus();
  if (status.unauthorized?.length || (status.user && !isAuthorizedAccount(status.user))) {
    await denyUnauthorizedAccount();
    return false;
  }
  if (status.ready) {
    showAuthenticated(status.user);
    return true;
  }
  if (status.signedIn) showSignedOut(sessionErrorText(status));
  return false;
}

function projectErrorText(datasetKey) {
  const dataset = DATASETS[datasetKey];
  const state = datasetStates.get(datasetKey);
  const code = String(state?.errorCode ?? "").toLowerCase();
  const reason = code.includes("permission") || code.includes("denied")
    ? "Read access was denied."
    : "The data source could not be read.";
  return `${reason} Check the signed-in account's read rules in project ${dataset.project}; the path may also be missing or unpublished.`;
}

function ensureDatasetLoaded(datasetKey) {
  const state = datasetStates.get(datasetKey);
  if (!state || subscriptions.has(datasetKey) || state.status === "loading") return;
  const generation = sessionGeneration;
  state.status = "loading";
  state.errorCode = "";

  try {
    const unsubscribe = listenToDataset(datasetKey, (raw) => {
      if (generation !== sessionGeneration) return;
      state.raw = raw;
      state.rows = normalizeRows(raw);
      state.status = state.rows.length ? "ready" : "empty";
      state.updatedAt = Date.now();
      state.errorCode = "";
      renderCurrentRoute();
    }, (error) => {
      if (generation !== sessionGeneration) return;
      state.status = "error";
      state.errorCode = error?.code ?? "";
      renderCurrentRoute();
    });
    subscriptions.set(datasetKey, unsubscribe);
  } catch (error) {
    state.status = "error";
    state.errorCode = error?.code ?? "";
  }
}

function requestRouteData(route) {
  const details = routeDetails[route] ?? routeDetails.dashboard;
  details.datasets.forEach(ensureDatasetLoaded);
}

function setRoute(route) {
  if (!routeDetails[route]) return;
  activeRoute = route;
  renderNavigation();
  const details = routeDetails[route];
  const heading = document.querySelector(".page-heading h1");
  heading.innerHTML = `${escapeHtml(details.title)}<span class="heading-period">.</span>`;
  document.querySelector(".page-subtitle").textContent = details.subtitle;
  requestRouteData(route);
  renderCurrentRoute();
}

function renderViewIntro(title, description, status = true) {
  return `<div class="view-intro">
    <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
    ${status ? '<span class="snapshot-badge"><span class="live-dot"></span>Live snapshot</span>' : ""}
  </div>`;
}

function placeholder(title, detail, icon = "◌", retryDataset = "") {
  return `<div class="table-placeholder">
    <div class="placeholder-icon" aria-hidden="true">${escapeHtml(icon)}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(detail)}</p>
    ${retryDataset ? `<button class="retry-button" type="button" data-retry="${escapeHtml(retryDataset)}">Try again</button>` : ""}
  </div>`;
}

function datasetPlaceholder(datasetKey) {
  const dataset = DATASETS[datasetKey];
  const state = datasetStates.get(datasetKey);
  if (state.status === "loading" || state.status === "idle") {
    return placeholder("Connecting to live data", `Loading the read-only snapshot for ${dataset.label.toLocaleLowerCase()}…`);
  }
  if (state.status === "error") {
    const path = `/${dataset.path}`;
    return placeholder(
      "This data source is unavailable",
      `Project ${dataset.project} · ${path}. ${projectErrorText(datasetKey)}`,
      "!",
      datasetKey,
    );
  }
  if (state.status === "empty") {
    return placeholder(
      "No records found",
      `There are currently no records at Project ${dataset.project} · /${dataset.path}. Confirm the path and published data in Firebase Console.`,
      "⌕",
      datasetKey,
    );
  }
  return "";
}

function collectColumns(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const priority = /^(?:reference|id|bookingId|orderId|claimId|patientName|name|testName|serviceName|status|createdAt|updatedAt|date)$/i;
  return keys.sort((a, b) => {
    const aPriority = priority.test(a) ? 0 : 1;
    const bPriority = priority.test(b) ? 0 : 1;
    return aPriority - bPriority || keys.indexOf(a) - keys.indexOf(b);
  }).slice(0, 6);
}

function tableMarkup(route, rows, datasetKey, limit = 100) {
  const state = datasetStates.get(datasetKey);
  if (state.status !== "ready") return datasetPlaceholder(datasetKey);
  const matches = filteredRows(rows);
  if (!matches.length) {
    return placeholder(query ? "No matching records" : "No records found", query
      ? "Try another barcode, reference or search term. Search is applied to the latest local snapshot."
      : "This snapshot does not contain any displayable records.", "⌕");
  }

  const sorted = sortedRows(route, matches);
  const columns = collectColumns(sorted);
  if (!columns.length) return placeholder("No displayable fields", "The source has records, but no safe display fields were found.", "◌");

  const selectedSort = sortChoices.get(route) ?? { by: columns[0], direction: 1 };
  if (!columns.includes(selectedSort.by)) selectedSort.by = columns[0];
  sortChoices.set(route, selectedSort);
  const displayed = sorted.slice(0, limit);
  return `<div class="collection-card">
    <div class="collection-toolbar">
      <div class="result-count"><strong>${matches.length.toLocaleString()}</strong> ${query ? "matching" : "total"} records${matches.length > limit ? ` · showing ${limit}` : ""}</div>
      <div class="sort-control"><label for="sort-${escapeHtml(route)}">Sort by</label>
        <select id="sort-${escapeHtml(route)}" data-sort="${escapeHtml(route)}">
          ${columns.map((column) => `<option value="${escapeHtml(column)}"${column === selectedSort.by ? " selected" : ""}>${escapeHtml(displayLabel(column))}</option>`).join("")}
        </select>
        <button class="sort-direction" type="button" data-direction="${escapeHtml(route)}" aria-label="Change sort direction" title="Change sort direction">${selectedSort.direction === 1 ? "↑" : "↓"}</button>
      </div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr>${columns.map((column) => `<th scope="col">${escapeHtml(displayLabel(column))}</th>`).join("")}</tr></thead>
      <tbody>${displayed.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "—") || "—"}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
  </div>`;
}

function sourceTable(datasetKey, route, limit = 10) {
  const rows = sourceRows(datasetKey);
  const state = datasetStates.get(datasetKey);
  if (state.status === "error" || state.status === "empty" || state.status === "idle" || state.status === "loading") {
    return datasetPlaceholder(datasetKey);
  }
  const matches = filteredRows(rows);
  if (!matches.length) {
    return `<div class="table-placeholder compact-placeholder"><div class="placeholder-icon" aria-hidden="true">⌕</div>
      <h3>No matching records</h3><p>Try a different search term. Search uses only the signed-in local snapshot.</p></div>`;
  }
  const columns = collectColumns(matches);
  const shown = sortedRows(route, matches).slice(0, limit);
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>${columns.map((column) => `<th scope="col">${escapeHtml(displayLabel(column))}</th>`).join("")}</tr></thead>
    <tbody>${shown.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "—") || "—"}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function sourceRowMarkup(datasetKey) {
  const dataset = DATASETS[datasetKey];
  const state = datasetStates.get(datasetKey);
  const colorStyles = {
    mint: "--source-bg:rgba(88,224,186,.11);--source-color:#58e0ba",
    blue: "--source-bg:rgba(112,184,255,.12);--source-color:#70b8ff",
    amber: "--source-bg:rgba(255,200,121,.12);--source-color:#ffc879",
    purple: "--source-bg:rgba(188,152,255,.12);--source-color:#bc98ff",
  };
  const count = state.status === "ready" ? state.rows.length.toLocaleString() : state.status === "empty" ? "0" : state.status === "error" ? "!" : "—";
  const updated = state.updatedAt ? `Updated ${formatTime(state.updatedAt)}` : state.status === "error" ? "Unavailable" : "Waiting for data";
  return `<button class="source-row" type="button" data-route="${escapeHtml(dataset.route)}">
    <span class="source-icon" style="${colorStyles[dataset.color] ?? colorStyles.mint}" aria-hidden="true">${escapeHtml(dataset.icon)}</span>
    <span class="source-copy"><strong>${escapeHtml(dataset.label)}</strong><small>${escapeHtml(updated)}</small></span>
    <span class="source-total">${escapeHtml(count)}</span><span class="source-arrow" aria-hidden="true">›</span>
  </button>`;
}

function metricCard(label, value, note, icon, tone = "mint") {
  const styles = {
    mint: "--metric-glow:rgba(88,224,186,.1);--metric-color:#58e0ba",
    blue: "--metric-glow:rgba(112,184,255,.12);--metric-color:#70b8ff",
    amber: "--metric-glow:rgba(255,200,121,.12);--metric-color:#ffc879",
    purple: "--metric-glow:rgba(188,152,255,.12);--metric-color:#bc98ff",
  };
  return `<article class="metric-card" style="${styles[tone] ?? styles.mint}">
    <div class="metric-top"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-icon" aria-hidden="true">${escapeHtml(icon)}</span></div>
    <div class="metric-value">${escapeHtml(value)}</div><div class="metric-foot">${escapeHtml(note)}</div>
  </article>`;
}

function getTotals() {
  const loaded = allDatasetKeys.filter((key) => ["ready", "empty"].includes(datasetStates.get(key).status));
  const records = loaded.reduce((sum, key) => sum + sourceRows(key).length, 0);
  const errors = allDatasetKeys.filter((key) => datasetStates.get(key).status === "error").length;
  return { records, loaded: loaded.length, errors };
}

function renderDashboard() {
  const totals = getTotals();
  const updateCount = allDatasetKeys.filter((key) => datasetStates.get(key).updatedAt).length;
  return `<section class="metrics-grid" aria-label="Live service metrics">
    ${metricCard("Clinical test orders", sourceValue("labOrders"), "Live lab orders", "✚", "mint")}
    ${metricCard("Cabin bookings", sourceValue("bookings"), "Active booking records", "▣", "blue")}
    ${metricCard("Room bill claims", sourceValue("claims"), "Claims in snapshot", "▤", "amber")}
    ${metricCard("Connected sources", `${totals.loaded}/${allDatasetKeys.length}`, `${totals.errors ? `${totals.errors} source issue${totals.errors === 1 ? "" : "s"}` : "Listening for live updates"}`, "◉", "purple")}
  </section>
  <div class="section-heading"><div><h2>Connected services</h2><p>${totals.records.toLocaleString()} records across ${totals.loaded} loaded sources · ${updateCount} live subscriptions</p></div>
    <button class="text-link" type="button" data-route="summary">View live summary →</button></div>
  <section class="overview-grid">
    <article class="panel"><div class="panel-heading"><div><h2>Monitoring sources</h2><p>Updates stream in while you are signed in</p></div><span class="panel-count">${allDatasetKeys.length} SOURCES</span></div>
      <div class="source-list">${allDatasetKeys.map(sourceRowMarkup).join("")}</div></article>
    <article class="panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>Latest source snapshot updates</p></div><span class="panel-count">LIVE</span></div>
      ${renderActivityFeed()}</article>
  </section>
  <div class="scan-note"><span aria-hidden="true">⌕</span><div><strong>Barcode & reference search</strong> · Type or scan into the search field above, then press Enter. This uses keyboard input only; camera scanning is not connected.</div></div>`;
}

function sourceValue(datasetKey) {
  const state = datasetStates.get(datasetKey);
  if (state.status === "ready") return state.rows.length.toLocaleString();
  if (state.status === "empty") return "0";
  if (state.status === "error") return "!";
  return "—";
}

function renderActivityFeed() {
  const updated = allDatasetKeys
    .filter((key) => datasetStates.get(key).updatedAt)
    .sort((a, b) => datasetStates.get(b).updatedAt - datasetStates.get(a).updatedAt);
  if (!updated.length) return '<div class="activity-list"><div class="activity-empty">Activity will appear here after source snapshots load.</div></div>';
  return `<div class="activity-list">${updated.slice(0, 6).map((key) => {
    const dataset = DATASETS[key];
    const state = datasetStates.get(key);
    return `<div class="activity-item"><strong>${escapeHtml(dataset.label)} snapshot refreshed</strong>
      <small>${state.rows.length.toLocaleString()} record${state.rows.length === 1 ? "" : "s"} · ${escapeHtml(formatTime(state.updatedAt))}</small></div>`;
  }).join("")}</div>`;
}

function renderCollection(route, datasetKey) {
  const dataset = DATASETS[datasetKey];
  const state = datasetStates.get(datasetKey);
  const path = `/${dataset.path}`;
  return `${renderViewIntro(routeDetails[route].title, routeDetails[route].subtitle)}
    <div class="connection-card"><span class="connection-icon" aria-hidden="true">◈</span>
      <div><strong>Project ${escapeHtml(dataset.project)} · read-only live connection</strong>
        <p>Source path: <code>/${escapeHtml(dataset.path)}</code> · Last snapshot: ${escapeHtml(state.updatedAt ? formatTime(state.updatedAt) : "not yet loaded")}. This view only subscribes to data while your Google session is active.</p></div>
    </div>
    ${tableMarkup(route, state.rows, datasetKey)}`;
}

function renderSummary() {
  const count = allDatasetKeys.reduce((sum, key) => sum + filteredRows(sourceRows(key)).length, 0);
  const intro = renderViewIntro(
    query ? `Search results for “${query}”` : "All connected records",
    query ? `${count.toLocaleString()} local snapshot match${count === 1 ? "" : "es"} across your connected sources.` : "A combined view of the latest authorized snapshots from all connected projects.",
  );
  const blocks = allDatasetKeys.map((key) => {
    const dataset = DATASETS[key];
    const state = datasetStates.get(key);
    const matchingCount = filteredRows(state.rows).length;
    return `<section class="summary-source"><div class="summary-source-heading"><h3>${escapeHtml(dataset.label)}</h3>
      <span>${state.status === "error" ? "Unavailable" : state.status === "loading" || state.status === "idle" ? "Loading" : `${matchingCount.toLocaleString()} ${query ? "matches" : "records"}`}</span></div>
      ${state.status === "ready" ? sourceTable(key, routeDetails[activeRoute] ? activeRoute : "summary", 8)
      : state.status === "error" ? `<div class="source-error"><strong>Project ${escapeHtml(dataset.project)} · /${escapeHtml(dataset.path)}</strong>${escapeHtml(projectErrorText(key))}</div>`
      : state.status === "empty" ? `<div class="source-loading">No records at /${escapeHtml(dataset.path)} yet. Check the Firebase path and published data.</div>`
      : '<div class="source-loading">Loading the signed-in read-only snapshot…</div>'}</section>`;
  }).join("");
  return `${intro}<div class="summary-results">${blocks}</div>`;
}

function renderAnalytics() {
  const totals = getTotals();
  const recent = allDatasetKeys
    .filter((key) => datasetStates.get(key).updatedAt)
    .sort((a, b) => datasetStates.get(b).updatedAt - datasetStates.get(a).updatedAt);
  const freshest = recent[0] ? formatTime(datasetStates.get(recent[0]).updatedAt) : "Waiting";
  return `${renderViewIntro("Analytics & Activity", "A high-level view of live source coverage and recent refreshes.")}
    <section class="metrics-grid" aria-label="Analytics overview">
      ${metricCard("Records in snapshot", totals.records.toLocaleString(), `${totals.loaded} sources loaded`, "▦", "mint")}
      ${metricCard("Sources connected", `${totals.loaded}/${allDatasetKeys.length}`, "Live read subscriptions", "◉", "blue")}
      ${metricCard("Latest refresh", freshest, "Local device time", "◷", "purple")}
      ${metricCard("Source issues", String(totals.errors), totals.errors ? "Review unavailable source details below" : "No read errors reported", "!", totals.errors ? "amber" : "mint")}
    </section>
    <div class="section-heading"><div><h2>Source activity</h2><p>Updates are summarized without writing back to Firebase.</p></div></div>
    <section class="overview-grid">
      <article class="panel"><div class="panel-heading"><div><h2>Source coverage</h2><p>Snapshot counts by monitored area</p></div><span class="panel-count">LIVE</span></div><div class="source-list">${allDatasetKeys.map(sourceRowMarkup).join("")}</div></article>
      <article class="panel"><div class="panel-heading"><div><h2>Recent refreshes</h2><p>Updates observed in this session</p></div><span class="panel-count">${recent.length} UPDATED</span></div>${renderActivityFeed()}</article>
    </section>
    <div class="section-heading"><div><h2>Appointment activity</h2><p>Recent appointment records from the other-records project.</p></div></div>
    <section class="collection-card">${sourceTable("appointments", "activity", 12)}</section>`;
}

function renderCurrentRoute() {
  if (appShell.hidden) return;
  const errors = allDatasetKeys.filter((key) => datasetStates.get(key).status === "error");
  setStatusBanner(errors.length
    ? `${errors.length} data source${errors.length === 1 ? "" : "s"} could not be read. Each view shows the project and path; confirm Firebase read access or that the path contains data. No database changes are made.`
    : "");

  switch (activeRoute) {
    case "dashboard":
      viewContainer.innerHTML = renderDashboard();
      break;
    case "summary":
      viewContainer.innerHTML = renderSummary();
      break;
    case "activity":
      viewContainer.innerHTML = renderAnalytics();
      break;
    case "tests":
      viewContainer.innerHTML = renderCollection("tests", "labOrders");
      break;
    case "doctors":
      viewContainer.innerHTML = renderCollection("doctors", "doctors");
      break;
    case "bookings":
      viewContainer.innerHTML = renderCollection("bookings", "bookings");
      break;
    case "bills":
      viewContainer.innerHTML = renderCollection("bills", "claims");
      break;
    case "referrals":
      viewContainer.innerHTML = renderCollection("referrals", "referrals");
      break;
    default:
      viewContainer.innerHTML = renderDashboard();
  }
}

function retryDataset(datasetKey) {
  const old = subscriptions.get(datasetKey);
  if (old) {
    try { old(); } catch { /* Listener cleanup is best-effort. */ }
    subscriptions.delete(datasetKey);
  }
  const state = datasetStates.get(datasetKey);
  state.status = "idle";
  state.errorCode = "";
  ensureDatasetLoaded(datasetKey);
  renderCurrentRoute();
}

function handleSearchSubmit(event) {
  event.preventDefault();
  query = globalSearch.value.trim();
  setRoute("summary");
}

function installEventHandlers() {
  sideNavigation.addEventListener("click", handleNavigationClick);
  mobileNavigation.addEventListener("click", handleNavigationClick);
  viewContainer.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) setRoute(routeButton.dataset.route);
    const retryButton = event.target.closest("[data-retry]");
    if (retryButton) retryDataset(retryButton.dataset.retry);
  });
  viewContainer.addEventListener("change", (event) => {
    const select = event.target.closest("[data-sort]");
    if (!select) return;
    const current = sortChoices.get(select.dataset.sort) ?? { by: "", direction: 1 };
    current.by = select.value;
    sortChoices.set(select.dataset.sort, current);
    renderCurrentRoute();
  });
  viewContainer.addEventListener("click", (event) => {
    const direction = event.target.closest("[data-direction]");
    if (!direction) return;
    const current = sortChoices.get(direction.dataset.direction) ?? { by: "", direction: 1 };
    current.direction *= -1;
    sortChoices.set(direction.dataset.direction, current);
    renderCurrentRoute();
  });
  document.getElementById("search-form").addEventListener("submit", handleSearchSubmit);
  signInButton.addEventListener("click", handleSignIn);
  signOutButton.addEventListener("click", handleSignOut);
}

function handleNavigationClick(event) {
  const item = event.target.closest("[data-route]");
  if (item) setRoute(item.dataset.route);
}

async function handleSignIn() {
  if (signInButton.disabled) return;
  authFlow = true;
  signInButton.disabled = true;
  signInLabel.textContent = "Signing in securely…";
  setAuthMessage("Connecting your Google session to each project…");
  try {
    const user = await signInWithGoogle();
    const status = await getSessionStatus();
    if (status.unauthorized?.length || (status.user && !isAuthorizedAccount(status.user))) {
      await denyUnauthorizedAccount();
      return;
    }
    if (!status.ready) throw new Error(sessionErrorText(status) || "One or more projects could not be connected.");
    showAuthenticated(status.user ?? user);
  } catch (error) {
    if (error?.code === "auth/unauthorized-email") {
      await denyUnauthorizedAccount();
      return;
    }
    const message = error?.project || error?.message?.startsWith("A Google session") || error?.message?.includes("project")
      ? error.message
      : "Google sign-in could not be completed. Enable Google sign-in for every Firebase project, authorize this site's domain for project A, and try again.";
    setAuthMessage(message, true);
    signInButton.disabled = false;
    signInLabel.textContent = "Try Google sign-in again";
  } finally {
    authFlow = false;
  }
}

async function handleSignOut() {
  authFlow = true;
  clearSubscriptionsAndData();
  appShell.hidden = true;
  authScreen.hidden = false;
  signInButton.disabled = true;
  setAuthMessage("Signing out of connected projects…");
  try {
    await signOutEverywhere();
    showSignedOut("You are signed out. Sign in again to resume read-only monitoring.");
  } catch {
    showSignedOut("A project session could not be cleared. Try signing in again or clear the session in your browser.");
  } finally {
    authFlow = false;
  }
}

async function handlePrimaryAuthChange(user) {
  if (authFlow || !initialAuthResolved) return;
  if (!user) {
    showSignedOut();
    return;
  }
  if (!isAuthorizedAccount(user)) {
    await denyUnauthorizedAccount();
    return;
  }
  await validateCurrentSession();
}

async function start() {
  installEventHandlers();
  renderNavigation();
  setAuthMessage("Preparing a secure connection.");
  try {
    await initializeFirebase();
    signInButton.disabled = false;
    signInLabel.textContent = "Continue with Google";
    watchPrimaryAuth((user) => {
      handlePrimaryAuthChange(user);
    }, () => {
      if (!authFlow) showSignedOut("The sign-in session could not be checked. Try signing in again.");
    });
    const status = await getSessionStatus();
    initialAuthResolved = true;
    if (status.unauthorized?.length) {
      await denyUnauthorizedAccount();
    } else if (status.ready) {
      showAuthenticated(status.user);
    } else if (status.signedIn) {
      showSignedOut(sessionErrorText(status));
    } else {
      setAuthMessage("Sign in with your Google account to continue.");
    }
  } catch {
    signInButton.disabled = true;
    signInLabel.textContent = "Connection unavailable";
    setAuthMessage("Firebase setup could not be loaded. Serve this site from the project root so the local Firebase_sdks configuration files are reachable, then verify the Firebase Console setup.", true);
  }
}

start();
