/* captain-dashboard.js - Barangay Captain console (api/captain_console.php)
 * Pairs with captain_dashboard.php, captain-geo.js (heatmap) and sidebar.js.
 * It injects captain-analytics.css itself, so no PHP edit is needed. */
(() => {
'use strict';

const API = 'api/captain_console.php';
const REFRESH_MS = 30000;
const PAGE_SIZE = 15;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = MONTHS.map(m => m.slice(0, 3));
const VIEW_TITLES = {
    overview: 'Executive Overview',
    registry: 'Master Blotter Registry',
    endorsements: 'Awaiting Captain Endorsement',
    lupon: 'Lupon / Mediation Registry',
    heatmap: 'Purok Incident Heatmaps',
    analytics: 'Analytics & Official Reports',
    settings: 'Profile & Settings'
};
const GROUPS = {
    pending: ['PENDING', 'UNDER_REVIEW', 'CRITICAL'],
    ongoing: ['IN_PROGRESS', 'DISPATCHED', 'FOR_RESOLUTION', 'LUPON'],
    resolved: ['RESOLVED', 'CLOSED']
};
const NOT_OPEN = [...GROUPS.resolved, 'REJECTED', 'DISMISSED'];

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const arr = v => (Array.isArray(v) ? v : []);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pick = (o, ...keys) => {
    if (!o || typeof o !== 'object') return '';
    for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
    return '';
};
const up = v => String(v || '').toUpperCase().replace(/[\s-]+/g, '_');
const titleCase = v => String(v || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const statusLabel = s => (s ? titleCase(s) : '—');
const groupOf = s => {
    const k = up(s);
    if (GROUPS.pending.includes(k)) return 'pending';
    if (GROUPS.ongoing.includes(k)) return 'ongoing';
    if (GROUPS.resolved.includes(k)) return 'resolved';
    return 'other';
};
const isOpen = s => !NOT_OPEN.includes(up(s));
const isHigh = p => ['HIGH', 'CRITICAL'].includes(up(p));
const toDate = v => {
    if (!v) return null;
    const d = new Date(String(v).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = v => {
    const d = toDate(v);
    return d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
};
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* field readers: the API's exact key names are tried in order */
const F = {
    ref: r => pick(r, 'case_no', 'reference_number', 'case_reference'),
    type: r => pick(r, 'category', 'title', 'incident_type'),
    purok: r => pick(r, 'purok', 'purok_name'),
    priority: r => pick(r, 'priority', 'severity', 'priority_level'),
    status: r => pick(r, 'status', 'case_status'),
    date: r => pick(r, 'reported_at', 'incident_datetime', 'created_at')
};

/* ---------- state ---------- */
const state = { captain: {}, overview: {}, cases: [], endorsements: [], lupon: [], puroks: [], loadedOnce: false };
const an = { rows: [], total: 0, pendingEnd: null, yearly: null, options: null, coverage: '', card: '', loaded: false };
const rt = { type: 'monthly', sort: null, search: '', page: 1 };
let lastReport = null;
let currentView = 'overview';

/* ---------- css link ---------- */
if (!document.querySelector('link[href*="captain-analytics.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'captain-analytics.css?v=' + Date.now();
    document.head.appendChild(l);
}

/* ---------- notice + api ---------- */
function notice(msg, isError = false) {
    const el = $('pageNotice');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    clearTimeout(notice.t);
    notice.t = setTimeout(() => { el.hidden = true; }, 4500);
}

async function api(action, payload = {}, formData = null) {
    const headers = { Accept: 'application/json', 'X-CSRF-Token': (document.querySelector('meta[name="csrf-token"]') || {}).content || '' };
    const opts = { credentials: 'same-origin', headers };
    if (action) {
        opts.method = 'POST';
        if (formData) {
            formData.set('action', action);
            opts.body = formData;
        } else {
            headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify({ action, ...payload });
        }
    }
    const res = await fetch(API, opts);
    let data;
    try { data = await res.json(); } catch { throw new Error(res.status === 401 || res.status === 403 ? 'Your session expired. Please log in again.' : 'The server returned an unreadable response.'); }
    if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed.');
    return data;
}

/* ---------- theme ---------- */
function applyTheme(t) {
    const dark = t === 'dark';
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('balangay_theme', dark ? 'dark' : 'light'); } catch { /* private mode */ }
    const label = $('themeToggleLabel');
    if (label) label.textContent = dark ? 'Light Mode' : 'Dark Mode';
}

/* ---------- navigation ---------- */
const navLinks = $$('.admin-nav-link[data-view]');
function setView(name, updateHash = true) {
    if (!VIEW_TITLES[name]) name = 'overview';
    currentView = name;
    $$('.admin-view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    navLinks.forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
    const t = $('viewTitle');
    if (t) t.textContent = VIEW_TITLES[name];
    document.title = VIEW_TITLES[name] + ' | BalangayLog';
    if (updateHash && location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    if (name === 'analytics') ensureAnalytics();
}

/* ---------- dialogs ---------- */
document.addEventListener('click', e => {
    const close = e.target.closest('[data-close-dialog]');
    if (close) { close.closest('dialog')?.close(); return; }
    if (e.target.matches('#advisoryDialog, #endorseDialog, #caseDialog')) e.target.close();
});

/* ---------- charts ---------- */
function lineChart(el, labels, values) {
    if (!el) return;
    const W = 560, H = 240, L = 36, R = 16, T = 16, B = 30;
    const max = Math.max(2, Math.ceil(Math.max(0, ...values) / 2) * 2);
    const n = labels.length;
    const x = i => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
    const y = v => T + (H - T - B) * (1 - v / max);
    const pts = values.map((v, i) => [x(i), y(v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z` : '';
    const ticks = [0, max / 2, max];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Incident trend chart">
        ${ticks.map(t => `<line class="chart-grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
        ${labels.map((lb, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`).join('')}
        <path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>
        ${pts.map((p, i) => `<circle class="chart-dot" cx="${p[0]}" cy="${p[1]}" r="4"><title>${esc(labels[i])}: ${values[i]}</title></circle>`).join('')}
    </svg>`;
}

function barList(el, items, emptyEl, emptyText = 'No data for this period.') {
    if (!el) return;
    const max = Math.max(1, ...items.map(i => i.value));
    el.innerHTML = items.length
        ? items.map(i => `<div class="bar-row"><span class="bar-label" title="${esc(i.label)}">${esc(i.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${(i.value / max) * 100}%"></span></span><span class="bar-value">${i.value}</span></div>`).join('')
        : (emptyEl ? '' : `<p class="chart-empty">${esc(emptyText)}</p>`);
    if (emptyEl) emptyEl.hidden = items.length > 0;
}

function ring(el, pct, sub) {
    if (!el) return;
    const r = 52, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, pct));
    el.innerHTML = `<svg viewBox="0 0 140 140" width="160" height="160" role="img" aria-label="Resolution rate ${p}%">
        <circle class="ring-bg" cx="70" cy="70" r="${r}" fill="none" stroke-width="12"/>
        <circle class="ring-fg" cx="70" cy="70" r="${r}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(1)}" transform="rotate(-90 70 70)"/>
        <text class="ring-pct" x="70" y="76" text-anchor="middle">${p}%</text>
        <text class="ring-sub" x="70" y="96" text-anchor="middle">${esc(sub)}</text></svg>`;
}

const tally = (rows, keyFn) => {
    const m = new Map();
    rows.forEach(r => { const k = keyFn(r) || 'Unspecified'; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label)));
};
const counts = rows => {
    const c = { total: rows.length, pending: 0, ongoing: 0, resolved: 0, high: 0 };
    rows.forEach(r => {
        const g = groupOf(F.status(r));
        if (c[g] !== undefined) c[g]++;
        if (isOpen(F.status(r)) && isHigh(F.priority(r))) c.high++;
    });
    return c;
};

/* ======================================================================
 * DATA LOAD
 * ==================================================================== */
async function load(silent = false) {
    try {
        const r = await api();
        const d = r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r;
        state.captain = d.captain || {};
        state.overview = d.overview || {};
        state.cases = arr(d.cases);
        state.endorsements = arr(d.endorsements);
        state.lupon = arr(d.lupon);
        state.puroks = arr(d.puroks);
        if (!state.loadedOnce) {
            console.debug('[captain] API keys:', Object.keys(d));
            if (state.cases[0]) console.debug('[captain] case keys:', Object.keys(state.cases[0]));
            if (state.endorsements[0]) console.debug('[captain] endorsement keys:', Object.keys(state.endorsements[0]));
            if (state.lupon[0]) console.debug('[captain] lupon keys:', Object.keys(state.lupon[0]));
        }
        state.loadedOnce = true;
        renderAll();
    } catch (err) {
        if (!silent) notice(err.message, true);
        else console.warn('[captain] silent refresh failed:', err.message);
    }
}

function renderAll() {
    renderCaptain();
    renderOverview();
    renderStatusFilter();
    renderRegistry();
    renderEndorsements();
    renderLupon();
    renderBanner();
    fillPurokSelect();
    fillFilterOptions();
}

function renderCaptain() {
    const c = state.captain;
    const name = pick(c, 'full_name', 'name');
    if (name) {
        ['captainName', 'captainSideName', 'settingsProfileName'].forEach(id => { if ($(id)) $(id).textContent = 'Capt. ' + name; });
    }
    setPicture(pick(c, 'profile_picture', 'picture', 'profile_picture_url', 'avatar'));
}

function setPicture(src) {
    if (!src) return;
    const a = $('captainPicture'), b = $('settingsAvatarPreview');
    if (a) { a.src = src; a.hidden = false; }
    if (b) { b.src = src; b.style.display = 'block'; }
    if ($('settingsAvatarInitials')) $('settingsAvatarInitials').style.display = 'none';
}

/* ======================================================================
 * OVERVIEW
 * ==================================================================== */
function renderOverview() {
    const now = new Date();
    const inMonth = r => { const d = toDate(F.date(r)); return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
    const month = state.cases.filter(inMonth);
    const resolved = month.filter(r => groupOf(F.status(r)) === 'resolved').length;
    const rate = month.length ? Math.round((resolved / month.length) * 100) : 0;
    const mediation = state.overview.mediation ?? state.overview.under_mediation ?? state.cases.filter(r => up(F.status(r)) === 'LUPON').length;

    $('metricIncidents').textContent = month.length;
    $('metricMediation').textContent = num(mediation);
    $('metricEndorse').textContent = state.endorsements.length;
    $('metricRate').textContent = rate + '%';
    ring($('rateRing'), rate, month.length ? `${resolved} of ${month.length}` : 'No cases yet');

    /* trend: last 6 months, computed from cases (does not depend on the API trend) */
    const labels = [], values = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(MON3[d.getMonth()]);
        values.push(state.cases.filter(r => { const x = toDate(F.date(r)); return x && x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth(); }).length);
    }
    lineChart($('trendChart'), labels, values);
    barList($('purokBars'), tally(month, F.purok).slice(0, 8), null, 'No incidents recorded this month.');

    const nav = $('navEndorseCount');
    if (nav) { nav.textContent = state.endorsements.length; nav.hidden = state.endorsements.length === 0; }
    renderEndorseRows($('overviewEndorseRows'), $('overviewEndorseEmpty'), state.endorsements.slice(0, 5));
}

function renderBanner() {
    const server = state.overview.critical_incidents;
    const n = server !== undefined && server !== null
        ? num(server)
        : state.cases.filter(r => isOpen(F.status(r)) && (up(F.priority(r)) === 'CRITICAL' || up(F.status(r)) === 'CRITICAL')).length;
    $('criticalCount').textContent = n;
    $('criticalBanner').hidden = n === 0;
}

/* ======================================================================
 * REGISTRY
 * ==================================================================== */
function renderStatusFilter() {
    const sel = $('caseStatusFilter');
    if (!sel) return;
    const keep = sel.value;
    const statuses = [...new Set(state.cases.map(r => up(F.status(r))).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All statuses</option>' + statuses.map(s => `<option value="${esc(s)}">${esc(statusLabel(s))}</option>`).join('');
    if (statuses.includes(keep)) sel.value = keep;
}

/* bordered priority pill (classes live in admin-dashboard.css) */
const priorityPill = p => {
    const k = up(p).toLowerCase();
    return k ? `<span class="pill pill-priority-${esc(k)}">${esc(titleCase(p))}</span>` : '—';
};

/* bordered status badge: same mapping as the Officer dashboard (classes live in admin-dashboard.css) */
const STATUS_BADGES = {
    PENDING: ['pending', 'Pending Triage'],
    UNDER_REVIEW: ['pending', 'Pending Triage'],
    CRITICAL: ['pending', 'Pending Triage'],
    IN_PROGRESS: ['in-progress', 'In Progress'],
    DISPATCHED: ['dispatched', 'Dispatched'],
    FOR_RESOLUTION: ['resolution', 'Awaiting Resolution'],
    LUPON: ['resolution', 'Awaiting Resolution'],
    RESOLVED: ['resolved', 'Resolved'],
    CLOSED: ['resolved', 'Resolved'],
    REJECTED: ['rejected', 'Report Rejected']
};
const statusPill = s => {
    const k = up(s);
    const [cls, label] = STATUS_BADGES[k] || ['unknown', titleCase(k) || 'Unknown'];
    return `<span class="status-badge status-badge--${esc(cls)}">${esc(label)}</span>`;
};

/* "Assigned To": the desk officer who encoded or accepted the case. The dispatched Tanod unit is shown in the case details, not here. */
const assignedCell = r => {
    const officer = pick(r, 'assigned_officer_name', 'handling_officer', 'desk_officer_name', 'assigned_officer');
    return `<td class="assigned-cell"><strong>${esc(officer || 'Unassigned')}</strong></td>`;
};

function renderRegistry() {
    const q = ($('caseSearch').value || '').trim().toLowerCase();
    const st = $('caseStatusFilter').value;
    const rows = state.cases.filter(r => {
        if (st && up(F.status(r)) !== st) return false;
        if (!q) return true;
        return [F.ref(r), F.type(r), F.purok(r), F.priority(r), statusLabel(F.status(r)), pick(r, 'complainant')].join(' ').toLowerCase().includes(q);
    });
    $('caseRows').innerHTML = rows.map(r => `<tr>
        <td><strong>${esc(F.ref(r))}</strong></td><td>${esc(F.type(r))}</td><td>${esc(F.purok(r))}</td>
        <td>${priorityPill(F.priority(r))}</td><td>${statusPill(F.status(r))}</td>${assignedCell(r)}<td>${fmtDate(F.date(r))}</td>
        <td><button type="button" class="small-button" data-case-ref="${esc(F.ref(r))}">View</button></td></tr>`).join('');
    $('caseEmpty').hidden = rows.length > 0;
}

function openCase(ref) {
    const r = state.cases.find(c => String(F.ref(c)) === String(ref));
    if (!r) return;
    $('caseDialogTitle').textContent = 'Case ' + F.ref(r);
    const line = (k, v) => `<p><strong>${esc(k)}:</strong> ${v ? esc(v) : '—'}</p>`;
    $('caseDetails').innerHTML = line('Incident type', F.type(r)) + line('Status', statusLabel(F.status(r))) +
        line('Priority', titleCase(F.priority(r))) + line('Purok', F.purok(r)) + line('Complainant', pick(r, 'complainant')) +
        line('Reported', fmtDate(F.date(r))) +
        `<p><strong>Narrative:</strong></p><p>${esc(pick(r, 'narrative')) || '—'}</p>`;
    $('caseDialog').showModal();
}

/* ======================================================================
 * ENDORSEMENTS
 * ==================================================================== */
const eKey = e => String(pick(e, 'id', 'endorsement_id', 'case_id') || F.ref(e));
const eFields = e => ({
    ref: F.ref(e) || pick(e, 'case_id', 'id'),
    type: pick(e, 'endorsement_type', 'referral_type', 'type', 'incident_type'),
    purok: F.purok(e),
    by: pick(e, 'referred_by_name', 'referred_by', 'submitted_by_name', 'officer_name'),
    date: pick(e, 'referred_at', 'date_referred', 'created_at')
});

function renderEndorseRows(tbody, emptyEl, list) {
    if (!tbody) return;
    tbody.innerHTML = list.map(e => {
        const f = eFields(e);
        return `<tr><td><strong>${esc(f.ref)}</strong></td><td><span class="pill">${esc(titleCase(f.type) || '—')}</span></td><td>${esc(f.purok)}</td>
            <td>${esc(f.by || '—')}</td><td>${fmtDate(f.date)}</td>
            <td><button type="button" class="small-button" data-endorse-key="${esc(eKey(e))}">Review &amp; sign</button></td></tr>`;
    }).join('');
    if (emptyEl) emptyEl.hidden = list.length > 0;
}
function renderEndorsements() { renderEndorseRows($('endorseRows'), $('endorseEmpty'), state.endorsements); }

function openEndorse(key) {
    const e = state.endorsements.find(x => eKey(x) === key);
    if (!e) return;
    const f = eFields(e);
    $('endorseTitle').textContent = 'Endorse case ' + f.ref;
    $('endorseDetails').innerHTML = [['Type', titleCase(f.type)], ['Purok', f.purok], ['Referred by', f.by], ['Date referred', fmtDate(f.date)]]
        .map(([k, v]) => `<p><strong>${k}:</strong> ${esc(v) || '—'}</p>`).join('');
    const form = $('endorseForm');
    form.elements.id.value = pick(e, 'id', 'endorsement_id', 'case_id');
    form.dataset.ref = F.ref(e);
    form.elements.remarks.value = '';
    $('endorseDialog').showModal();
}

async function submitEndorse(ev) {
    ev.preventDefault();
    const form = ev.currentTarget, btn = $('endorseSubmit');
    btn.disabled = true;
    try {
        const r = await api('case_endorse', { id: form.elements.id.value, reference_number: form.dataset.ref || '', remarks: form.elements.remarks.value.trim() });
        $('endorseDialog').close();
        notice(r.message || 'Case endorsed.');
        await load(true);
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = false; }
}

/* ======================================================================
 * LUPON
 * ==================================================================== */
function renderLupon() {
    $('luponRows').innerHTML = state.lupon.map(l => {
        const parties = pick(l, 'parties');
        return `<tr><td><strong>${esc(F.ref(l))}</strong></td><td>${esc(parties || '—')}</td><td>${esc(F.purok(l))}</td>
            <td>${esc(titleCase(pick(l, 'stage', 'mediation_stage')) || '—')}</td>
            <td>${fmtDate(pick(l, 'next_hearing', 'next_hearing_at', 'hearing_date'))}</td><td>${esc(statusLabel(F.status(l)))}</td></tr>`;
    }).join('');
    $('luponEmpty').hidden = state.lupon.length > 0;
}

/* ======================================================================
 * ADVISORY
 * ==================================================================== */
function fillPurokSelect() {
    const sel = $('advisoryPurok');
    if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = '<option value="">Whole barangay</option>' + state.puroks.map(p => `<option value="${esc(pick(p, 'id', 'purok_id'))}">${esc(pick(p, 'name', 'purok_name'))}</option>`).join('');
    sel.value = keep;
}
function openAdvisory() { $('advisoryForm').reset(); $('advisoryDialog').showModal(); }
async function submitAdvisory(ev) {
    ev.preventDefault();
    const f = ev.currentTarget, btn = f.querySelector('[type="submit"]');
    const title = f.elements.title.value.trim(), body = f.elements.body.value.trim();
    if (!title || !body) { notice('Enter a title and a message.', true); return; }
    btn.disabled = true;
    try {
        const r = await api('advisory_create', { title, body, purok_id: f.elements.purok_id.value });
        $('advisoryDialog').close();
        notice(r.message || 'Advisory published.');
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = false; }
}

/* ======================================================================
 * SETTINGS
 * ==================================================================== */
async function submitProfile(ev) {
    ev.preventDefault();
    const form = ev.currentTarget, btn = $('saveProfileBtn');
    if (!form.elements.full_name.value.trim()) { notice('Full name is required.', true); return; }
    btn.disabled = true;
    try {
        const r = await api('profile_update', {}, new FormData(form));
        const c = r.captain || r.user || r.data || {};
        const name = pick(c, 'full_name') || form.elements.full_name.value.trim();
        ['captainName', 'captainSideName', 'settingsProfileName'].forEach(id => { if ($(id)) $(id).textContent = 'Capt. ' + name; });
        setPicture(pick(c, 'profile_picture', 'picture', 'profile_picture_url'));
        notice(r.message || 'Profile updated.');
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = false; }
}

async function submitPassword(ev) {
    ev.preventDefault();
    const f = ev.currentTarget;
    const cur = f.elements.current_password.value, nw = f.elements.new_password.value, cf = f.elements.confirm_password.value;
    if (nw.length < 8) { notice('The new password must be at least 8 characters.', true); return; }
    if (nw !== cf) { notice('The new passwords do not match.', true); return; }
    const btn = f.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
        const r = await api('password_update', { current_password: cur, new_password: nw, confirm_password: cf });
        f.reset();
        notice(r.message || 'Password updated.');
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = false; }
}

/* ======================================================================
 * FILTER OPTIONS (analytics + report forms share the same lists)
 * ==================================================================== */
const AF = { year: 'analyticsYear', month: 'analyticsMonth', from: 'analyticsFrom', to: 'analyticsTo', category: 'analyticsCategory', purok: 'analyticsPurok', status: 'analyticsStatus' };
const RF = { year: 'reportYear', month: 'reportMonth', from: 'reportFrom', to: 'reportTo', category: 'reportCategory', purok: 'reportPurok', status: 'reportStatus' };
const readFilters = map => Object.fromEntries(Object.entries(map).map(([k, id]) => [k, $(id) ? $(id).value : '']));
const opt = x => (x && typeof x === 'object')
    ? { value: String(pick(x, 'value', 'id', 'name', 'year')), label: String(pick(x, 'label', 'name', 'value', 'year')) }
    : { value: String(x), label: String(x) };

function fillSelect(ids, items, labelFn) {
    ids.forEach(id => {
        const sel = $(id);
        if (!sel) return;
        const sig = items.map(i => i.value + '|' + i.label).join('~');
        if (sel.dataset.sig === sig) return;
        const keep = sel.value;
        const first = sel.options[0] ? sel.options[0].outerHTML : '';
        sel.innerHTML = first + items.map(i => `<option value="${esc(i.value)}">${esc(labelFn ? labelFn(i) : i.label)}</option>`).join('');
        sel.dataset.sig = sig;
        if (items.some(i => i.value === keep)) sel.value = keep;
    });
}

function fillFilterOptions() {
    const o = an.options || {};
    const thisYear = new Date().getFullYear();
    const caseYears = state.cases.map(r => toDate(F.date(r))?.getFullYear()).filter(Boolean);
    const years = (arr(o.years || o.year).length ? arr(o.years || o.year).map(opt) : [...new Set([thisYear, ...caseYears])].sort((a, b) => b - a).map(opt));
    if (!years.some(y => y.value === String(thisYear))) years.unshift(opt(thisYear));
    const cats = arr(o.categories || o.category).length ? arr(o.categories || o.category).map(opt) : [...new Set(state.cases.map(F.type).filter(Boolean))].sort().map(opt);
    const puroks = arr(o.puroks || o.purok).length ? arr(o.puroks || o.purok).map(opt)
        : (state.puroks.length ? state.puroks.map(p => opt({ value: pick(p, 'name', 'purok_name'), label: pick(p, 'name', 'purok_name') })) : [...new Set(state.cases.map(F.purok).filter(Boolean))].sort().map(opt));
    const stats = arr(o.statuses || o.status).length ? arr(o.statuses || o.status).map(opt) : [...new Set(state.cases.map(r => up(F.status(r))).filter(Boolean))].sort().map(opt);
    fillSelect(['analyticsYear', 'reportYear'], years);
    fillSelect(['analyticsCategory', 'reportCategory'], cats);
    fillSelect(['analyticsPurok', 'reportPurok'], puroks);
    fillSelect(['analyticsStatus', 'reportStatus'], stats, i => (i.label === i.label.toUpperCase() ? statusLabel(i.label) : i.label));
}

/* ======================================================================
 * ANALYTICS
 * ==================================================================== */
async function fetchAnalytics(filters) {
    const r = await api('analytics_data', { filters });
    return r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : r;
}

async function loadAnalytics() {
    const f = readFilters(AF);
    if ((f.from && !f.to) || (!f.from && f.to)) { notice('Choose both a start date and an end date.', true); return; }
    if (f.from && f.to && f.from > f.to) { notice('The start date must not be after the end date.', true); return; }
    const loading = $('analyticsLoading');
    loading.hidden = false;
    try {
        const d = await fetchAnalytics(f);
        an.rows = arr(d.records);
        an.total = num(d.total);
        an.pendingEnd = d.pending_endorsements ?? null;
        an.yearly = d.yearly_comparison ?? null;
        an.options = d.options && typeof d.options === 'object' ? d.options : an.options;
        an.coverage = d.coverage_note || '';
        an.loaded = true;
        if (!an.logged) { an.logged = true; console.debug('[captain] analytics keys:', Object.keys(d)); if (an.rows[0]) console.debug('[captain] record keys:', Object.keys(an.rows[0])); }
        fillFilterOptions();
        renderAnalytics();
    } catch (err) {
        notice(err.message, true);
    } finally {
        loading.hidden = true;
    }
}
function ensureAnalytics() { if (!an.loaded) loadAnalytics(); }

function viewRows() {
    return an.rows.filter(r => {
        switch (an.card) {
            case 'pending': case 'ongoing': case 'resolved': return groupOf(F.status(r)) === an.card;
            case 'priority': return isOpen(F.status(r)) && isHigh(F.priority(r));
            default: return true;
        }
    });
}

function yearInView() {
    const f = readFilters(AF);
    if (f.year) return Number(f.year);
    if (f.from) return Number(f.from.slice(0, 4));
    const ys = an.rows.map(r => toDate(F.date(r))?.getFullYear()).filter(Boolean);
    return ys.length ? Math.max(...ys) : new Date().getFullYear();
}

function yearItems() {
    const y = an.yearly;
    let list = [];
    if (Array.isArray(y)) list = y.map(x => ({ label: String(pick(x, 'year', 'label', 'period')), value: num(pick(x, 'total', 'count', 'incidents', 'value')) }));
    else if (y && typeof y === 'object') list = Object.entries(y).map(([k, v]) => ({ label: k, value: num(typeof v === 'object' ? pick(v, 'total', 'count', 'incidents') : v) }));
    if (!list.length) list = tally(an.rows, r => String(toDate(F.date(r))?.getFullYear() || '')).filter(i => i.label !== 'Unspecified');
    return list.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function renderAnalytics() {
    const c = counts(an.rows);
    $('analyticsTotal').textContent = Math.max(an.total, c.total);
    $('analyticsPending').textContent = c.pending;
    $('analyticsOngoing').textContent = c.ongoing;
    $('analyticsResolved').textContent = c.resolved;
    $('analyticsCritical').textContent = c.high;
    $$('.summary-card').forEach(b => {
        const on = !!an.card && b.dataset.summaryFilter === an.card;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('coverageNote').textContent = an.coverage;

    const rows = viewRows();
    const Y = yearInView();
    const vals = MONTHS.map((_, i) => rows.filter(r => { const d = toDate(F.date(r)); return d && d.getFullYear() === Y && d.getMonth() === i; }).length);
    if (rows.length) lineChart($('trendChart2'), MON3, vals); else $('trendChart2').innerHTML = '';
    $('trendEmpty').hidden = rows.length > 0;
    barList($('categoryBars'), tally(rows, F.type).slice(0, 10), $('categoryEmpty'));
    barList($('statusBars'), tally(rows, r => statusLabel(F.status(r))), $('statusEmpty'));
    barList($('analyticsPurokBars'), tally(rows, F.purok).slice(0, 12), $('purokEmpty'));
    barList($('yearComparison'), yearItems(), $('yearComparisonEmpty'));
    renderRecords();
}

/* ---------- Incident Records tab ---------- */
function tableModel(type, rows) {
    const Y = yearInView();
    const sum = list => { const c = counts(list); return { total: c.total, pending: c.pending, ongoing: c.ongoing, resolved: c.resolved, high: c.high }; };
    const N = (key, label) => ({ key, label, num: true });
    switch (type) {
        case 'yearly': {
            const ys = [...new Set(rows.map(r => toDate(F.date(r))?.getFullYear()).filter(Boolean))].sort((a, b) => b - a);
            return { cols: [N('year', 'Year'), N('total', 'Total'), N('pending', 'Pending'), N('ongoing', 'Ongoing'), N('resolved', 'Resolved'), N('high', 'High-priority')],
                data: ys.map(y => ({ year: y, ...sum(rows.filter(r => toDate(F.date(r))?.getFullYear() === y)) })) };
        }
        case 'purok': {
            const names = [...new Set(rows.map(r => F.purok(r) || 'Unspecified'))].sort();
            return { cols: [{ key: 'purok', label: 'Purok' }, N('total', 'Total'), N('pending', 'Pending'), N('ongoing', 'Ongoing'), N('resolved', 'Resolved'), N('rate', 'Resolution rate')],
                data: names.map(p => { const s = sum(rows.filter(r => (F.purok(r) || 'Unspecified') === p)); return { purok: p, ...s, rate: s.total ? Math.round((s.resolved / s.total) * 100) + '%' : '0%', _rate: s.total ? s.resolved / s.total : 0 }; }) };
        }
        case 'register':
            return { cols: [{ key: 'ref', label: 'Case no.' }, { key: 'date', label: 'Reported', sortKey: '_ts' }, { key: 'type', label: 'Category' }, { key: 'purok', label: 'Purok' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }],
                data: rows.map(r => ({ ref: F.ref(r), date: fmtDate(F.date(r)), _ts: toDate(F.date(r))?.getTime() || 0, type: F.type(r), purok: F.purok(r), priority: titleCase(F.priority(r)), status: statusLabel(F.status(r)) })) };
        case 'resolution':
            return { cols: [{ key: 'ref', label: 'Case no.' }, { key: 'type', label: 'Category' }, { key: 'purok', label: 'Purok' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Reported', sortKey: '_ts' }, { key: 'resolved', label: 'Resolved on', sortKey: '_rs' }, { key: 'endorse', label: 'Endorsement' }],
                data: rows.map(r => ({ ref: F.ref(r), type: F.type(r), purok: F.purok(r), status: statusLabel(F.status(r)), date: fmtDate(F.date(r)), _ts: toDate(F.date(r))?.getTime() || 0,
                    resolved: fmtDate(r.resolved_at), _rs: toDate(r.resolved_at)?.getTime() || 0,
                    endorse: r.endorsed_at ? `Endorsed ${fmtDate(r.endorsed_at)}` : '—' })) };
        default:
            return { cols: [{ key: 'month', label: 'Month', sortKey: '_ord' }, N('total', 'Total'), N('pending', 'Pending'), N('ongoing', 'Ongoing'), N('resolved', 'Resolved'), N('high', 'High-priority')],
                data: MONTHS.map((m, i) => ({ month: m, _ord: i, ...sum(rows.filter(r => { const d = toDate(F.date(r)); return d && d.getFullYear() === Y && d.getMonth() === i; })) })) };
    }
}

function renderRecords() {
    const sel = $('tableReportType');
    rt.type = sel.value;
    $('tableReportTitle').textContent = sel.options[sel.selectedIndex].text;
    const src = viewRows();
    const model = tableModel(rt.type, src);
    let data = src.length ? model.data : [];
    const q = rt.search.trim().toLowerCase();
    if (q) data = data.filter(r => model.cols.map(c => r[c.key]).join(' ').toLowerCase().includes(q));
    if (rt.sort) {
        const col = model.cols.find(c => c.key === rt.sort.key);
        if (col) {
            const k = col.sortKey || (rt.type === 'purok' && col.key === 'rate' ? '_rate' : col.key), dir = rt.sort.dir === 'desc' ? -1 : 1;
            data = [...data].sort((a, b) => {
                const x = a[k], y = b[k];
                return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
            });
        }
    }
    const pages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
    rt.page = Math.min(Math.max(1, rt.page), pages);
    const slice = data.slice((rt.page - 1) * PAGE_SIZE, rt.page * PAGE_SIZE);
    const arrow = c => (rt.sort && rt.sort.key === c.key ? (rt.sort.dir === 'asc' ? '▲' : '▼') : '↕');
    const table = $('reportTable');
    table.tHead.innerHTML = '<tr>' + model.cols.map(c => `<th aria-sort="${rt.sort && rt.sort.key === c.key ? (rt.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-sort" data-sort="${c.key}">${esc(c.label)}<i aria-hidden="true">${arrow(c)}</i></button></th>`).join('') + '</tr>';
    table.tBodies[0].innerHTML = slice.map(r => '<tr>' + model.cols.map(c => `<td>${esc(r[c.key])}</td>`).join('') + '</tr>').join('');
    $('reportTableEmpty').hidden = data.length > 0;
    $('reportResultCount').textContent = src.length ? `${data.length} row${data.length === 1 ? '' : 's'}${rt.type === 'monthly' ? ' · ' + yearInView() : ''}` : '';
    $('reportPageLabel').textContent = `Page ${rt.page} of ${pages}`;
    $('reportPrev').disabled = rt.page <= 1;
    $('reportNext').disabled = rt.page >= pages;
}

function switchTab(name) {
    const map = { analytics: ['analyticsTab', 'analyticsPanel'], records: ['recordsTab', 'recordsPanel'], reports: ['reportsTab', 'reportsPanel'] };
    Object.entries(map).forEach(([k, [t, p]]) => {
        const on = k === name;
        $(t).setAttribute('aria-selected', on ? 'true' : 'false');
        $(t).tabIndex = on ? 0 : -1;
        $(p).hidden = !on;
    });
}

/* ======================================================================
 * REPORTS
 * ==================================================================== */
const REPORT_TITLES = {
    monthly: 'Monthly Incident Report', annual: 'Annual Incident Report', category: 'Incident Summary by Category',
    purok: 'Incident Summary by Purok', resolution: 'Case Resolution Report', endorsement: 'Case Endorsement Report',
    custom: 'Custom Date Range Report', dilg: 'Monthly DILG Report (system-generated data)'
};
const PRINT_CSS = `body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#172b35;margin:24px}
h3{margin:4px 0;font-size:22px}h4{margin:20px 0 8px;font-size:14px}p{margin:3px 0}
.report-agency{margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#52676f}
.report-doc-head{border-bottom:2px solid #19766c;padding-bottom:10px;margin-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cfd9da;padding:6px 9px;text-align:left}th{background:#eef3f3}
.report-note{color:#52676f;font-size:12px}.report-doc-foot{margin-top:24px;padding-top:10px;border-top:1px solid #cfd9da;font-size:11px;color:#52676f}
tr{page-break-inside:avoid}`;

const tbl = (heads, rows) => `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">No records for this period.</td></tr>`}</tbody></table>`;
const section = (title, inner) => `<h4>${esc(title)}</h4>${inner}`;

function breakdown(label, rows, keyFn) {
    const keys = [...new Set(rows.map(r => keyFn(r) || 'Unspecified'))];
    const out = keys.map(k => { const c = counts(rows.filter(r => (keyFn(r) || 'Unspecified') === k)); return [k, c.total, c.pending, c.ongoing, c.resolved]; }).sort((a, b) => b[1] - a[1]);
    return tbl([label, 'Total', 'Pending', 'Ongoing', 'Resolved'], out);
}
function summaryTable(rows) {
    const c = counts(rows);
    const rate = c.total ? Math.round((c.resolved / c.total) * 100) + '%' : '0%';
    return tbl(['Measure', 'Count'], [['Total incidents', c.total], ['Pending / open', c.pending], ['Ongoing', c.ongoing], ['Resolved', c.resolved], ['Open high-priority', c.high], ['Resolution rate', rate]]);
}
function caseList(rows, limit = 200) {
    const sorted = [...rows].sort((a, b) => (toDate(F.date(a))?.getTime() || 0) - (toDate(F.date(b))?.getTime() || 0));
    const note = sorted.length > limit ? `<p class="report-note">Showing the first ${limit} of ${sorted.length} cases.</p>` : '';
    return tbl(['Case no.', 'Reported', 'Category', 'Purok', 'Priority', 'Status'],
        sorted.slice(0, limit).map(r => [F.ref(r), fmtDate(F.date(r)), F.type(r), F.purok(r), titleCase(F.priority(r)), statusLabel(F.status(r))])) + note;
}

function validateReport(f, type) {
    const range = f.from && f.to;
    if ((f.from && !f.to) || (!f.from && f.to)) return 'Choose both a start date and an end date.';
    if (range && f.from > f.to) return 'The start date must not be after the end date.';
    if (type === 'custom' && !range) return 'Choose a start and end date for the custom report.';
    if ((type === 'monthly' || type === 'dilg') && !(f.year && f.month)) return 'Choose a year and a month for this report.';
    if (type === 'annual' && !f.year) return 'Choose a year for the annual report.';
    if (f.month && !f.year) return 'Choose a year together with the month.';
    if (!f.year && !range) return 'Choose a year or a date range.';
    return '';
}
function normalizeFilters(f, type) {
    const o = { ...f };
    if (type === 'custom') { o.year = ''; o.month = ''; }
    if (type === 'monthly' || type === 'dilg') { o.from = ''; o.to = ''; }
    if (type === 'annual') { o.month = ''; o.from = ''; o.to = ''; }
    return o;
}
function periodLabel(f) {
    if (f.from && f.to) return `${fmtDate(f.from)} – ${fmtDate(f.to)}`;
    if (f.year && f.month) return `${MONTHS[Number(f.month) - 1]} ${f.year}`;
    return f.year ? `Year ${f.year}` : 'All records';
}
function inPeriod(v, f) {
    const d = toDate(v);
    if (!d) return false;
    if (f.from && f.to) return ymd(d) >= f.from && ymd(d) <= f.to;
    if (f.year && d.getFullYear() !== Number(f.year)) return false;
    if (f.month && d.getMonth() + 1 !== Number(f.month)) return false;
    return true;
}

async function buildReport(type, f) {
    const title = REPORT_TITLES[type];
    let body = '';
    if (type === 'endorsement') {
        const d = await fetchAnalytics(f);
        const rows = arr(d.records);
        const done = rows.filter(r => r.endorsed_at);
        const waiting = state.endorsements.filter(e => inPeriod(eFields(e).date, f));
        body = section('Summary', tbl(['Measure', 'Count'], [['Cases in this period', rows.length], ['Endorsed by the Punong Barangay', done.length], ['Cases with an endorsement still pending', num(d.pending_endorsements)]])) +
            section('Endorsed cases', tbl(['Case no.', 'Category', 'Purok', 'Endorsement type', 'Date endorsed', 'Receiving office'],
                done.map(r => [F.ref(r), F.type(r), F.purok(r), titleCase(r.endorsement_type) || '—', fmtDate(r.endorsed_at), r.receiving_office || '—']))) +
            section('Awaiting endorsement (referred in this period)', tbl(['Case', 'Type', 'Purok', 'Referred by', 'Date referred'],
                waiting.map(e => { const x = eFields(e); return [x.ref, titleCase(x.type), x.purok, x.by, fmtDate(x.date)]; })));
    } else {
        const d = await fetchAnalytics(f);
        const rows = arr(d.records);
        if (d.coverage_note) body += `<p class="report-note">${esc(d.coverage_note)}</p>`;
        if (type === 'annual') {
            const Y = Number(f.year);
            body += section('Summary', summaryTable(rows)) +
                section('Month by month', tbl(['Month', 'Total', 'Pending', 'Ongoing', 'Resolved'], MONTHS.map((m, i) => { const c = counts(rows.filter(r => { const x = toDate(F.date(r)); return x && x.getFullYear() === Y && x.getMonth() === i; })); return [m, c.total, c.pending, c.ongoing, c.resolved]; }))) +
                section('By category', breakdown('Category', rows, F.type)) + section('By purok', breakdown('Purok', rows, F.purok));
        } else if (type === 'category') {
            body += section('Summary', summaryTable(rows)) + section('Incidents by category', breakdown('Category', rows, F.type));
        } else if (type === 'purok') {
            body += section('Summary', summaryTable(rows)) + section('Incidents by purok', breakdown('Purok', rows, F.purok));
        } else if (type === 'resolution') {
            const done = rows.filter(r => groupOf(F.status(r)) === 'resolved');
            body += section('Summary', summaryTable(rows)) + section('Status distribution', tbl(['Status', 'Cases'], tally(rows, r => statusLabel(F.status(r))).map(i => [i.label, i.value]))) +
                section('Resolution by purok', breakdown('Purok', rows, F.purok)) + section('Resolved and closed cases', caseList(done));
        } else if (type === 'dilg') {
            body += section('Peace and order summary', summaryTable(rows)) + section('Incidents by category', breakdown('Category', rows, F.type)) +
                section('Incidents by purok', breakdown('Purok', rows, F.purok)) +
                section('Endorsements', tbl(['Measure', 'Count'], [['Cases with an endorsement pending (this period)', num(d.pending_endorsements)], ['Cases in Lupon mediation (current)', state.lupon.length]])) +
                '<p class="report-note">Figures are generated from BalangayLog records. They support, but do not replace, the official DILG reporting form.</p>';
        } else {
            body += section('Summary', summaryTable(rows)) + section('By category', breakdown('Category', rows, F.type)) +
                section('By purok', breakdown('Purok', rows, F.purok)) + section('Case list', caseList(rows));
        }
    }
    const html = `<div class="report-doc"><div class="report-doc-head">
        <p class="report-agency">Republic of the Philippines · Province of Bataan · Municipality of Limay</p>
        <p class="report-agency"><strong>Barangay Duale</strong> · Office of the Punong Barangay</p>
        <h3>${esc(title)}</h3><p>Reporting period: <strong>${esc(periodLabel(f))}</strong></p>
        <p>Generated: ${esc(new Date().toLocaleString('en-PH'))}</p></div>${body}
        <div class="report-doc-foot">System-generated from BalangayLog case records. Prepared for the Punong Barangay.</div></div>`;
    return { title, html };
}

async function previewReport(ev) {
    if (ev) ev.preventDefault();
    const type = $('reportType').value;
    const raw = readFilters(RF);
    const err = validateReport(raw, type);
    if (err) { notice(err, true); return; }
    const f = normalizeFilters(raw, type);
    const btn = $('reportForm').querySelector('[type="submit"]');
    btn.disabled = true;
    try {
        lastReport = await buildReport(type, f);
        const box = $('reportPreview');
        box.innerHTML = lastReport.html;
        box.hidden = false;
        $('printReport').disabled = false;
        box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        notice(e.message, true);
    } finally {
        btn.disabled = false;
    }
}

function printReport() {
    if (!lastReport) { notice('Preview a report first.', true); return; }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(lastReport.title)}</title><style>${PRINT_CSS}</style></head><body>${lastReport.html}</body></html>`;
    const cleanup = () => setTimeout(() => frame.remove(), 500);
    frame.onload = () => {
        try {
            frame.contentWindow.onafterprint = cleanup;
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch (e) { notice('Printing is blocked by the browser.', true); cleanup(); }
        setTimeout(() => frame.remove(), 120000);
    };
    document.body.appendChild(frame);
}

function quickReport(type) {
    setView('analytics');
    switchTab('reports');
    $('reportType').value = type;
    if (type === 'dilg') {
        const now = new Date();
        const y = $('reportYear');
        if (![...y.options].some(o => o.value === String(now.getFullYear()))) y.add(new Option(now.getFullYear(), now.getFullYear()));
        y.value = String(now.getFullYear());
        $('reportMonth').value = String(now.getMonth() + 1);
        $('reportFrom').value = '';
        $('reportTo').value = '';
        previewReport();
    }
}

/* ======================================================================
 * EVENTS
 * ==================================================================== */
document.addEventListener('click', e => {
    const t = e.target;
    let el;
    if ((el = t.closest('[data-case-ref]'))) return openCase(el.dataset.caseRef);
    if ((el = t.closest('[data-endorse-key]'))) return openEndorse(el.dataset.endorseKey);
    if (t.closest('[data-open-advisory]')) return openAdvisory();
    if ((el = t.closest('[data-open-view]'))) return setView(el.dataset.openView);
    if (t.closest('[data-refresh]')) { load(); notice('Data refreshed.'); return; }
    if ((el = t.closest('[data-generate-report]'))) return quickReport(el.closest('.quick-actions') ? 'dilg' : $('reportType').value);
    if ((el = t.closest('[data-summary-filter]'))) {
        an.card = an.card === el.dataset.summaryFilter ? '' : el.dataset.summaryFilter;
        rt.page = 1;
        return renderAnalytics();
    }
    if ((el = t.closest('[data-report-tab]'))) return switchTab(el.dataset.reportTab);
    if ((el = t.closest('.th-sort'))) {
        const k = el.dataset.sort;
        rt.sort = rt.sort && rt.sort.key === k ? (rt.sort.dir === 'asc' ? { key: k, dir: 'desc' } : null) : { key: k, dir: 'asc' };
        return renderRecords();
    }
});

navLinks.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));

$('criticalReview')?.addEventListener('click', () => {
    setView('registry');
    $('caseStatusFilter').value = '';
    $('caseSearch').value = 'critical';
    renderRegistry();
});
$('caseSearch')?.addEventListener('input', renderRegistry);
$('caseStatusFilter')?.addEventListener('change', renderRegistry);

$('endorseForm')?.addEventListener('submit', submitEndorse);
$('advisoryForm')?.addEventListener('submit', submitAdvisory);
$('profileForm')?.addEventListener('submit', submitProfile);
$('passwordForm')?.addEventListener('submit', submitPassword);
$('settingsPhotoInput')?.addEventListener('change', ev => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { notice('Choose a photo under 3 MB.', true); ev.target.value = ''; return; }
    setPicture(URL.createObjectURL(file));
});

$('analyticsFilters')?.addEventListener('submit', ev => { ev.preventDefault(); an.card = ''; rt.page = 1; loadAnalytics(); });
$('resetAnalyticsFilters')?.addEventListener('click', () => {
    Object.values(AF).forEach(id => { if ($(id)) $(id).value = ''; });
    an.card = ''; rt.page = 1; loadAnalytics();
});
$('tableReportType')?.addEventListener('change', () => { rt.sort = null; rt.page = 1; renderRecords(); });
$('reportTableSearch')?.addEventListener('input', ev => { rt.search = ev.target.value; rt.page = 1; renderRecords(); });
$('reportPrev')?.addEventListener('click', () => { rt.page--; renderRecords(); });
$('reportNext')?.addEventListener('click', () => { rt.page++; renderRecords(); });
$('reportForm')?.addEventListener('submit', previewReport);
$('printReport')?.addEventListener('click', printReport);
$('reportForm')?.addEventListener('change', () => { $('printReport').disabled = true; lastReport = null; $('reportPreview').hidden = true; });

document.querySelector('.analytics-tabs')?.addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const tabs = $$('[role="tab"]', ev.currentTarget);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    switchTab(next.dataset.reportTab);
});

$('themeToggleBtn')?.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
$('logoutBtn')?.addEventListener('click', async () => {
    try { await fetch('api/logout.php', { method: 'POST', credentials: 'same-origin' }); } catch { /* leave anyway */ }
    sessionStorage.clear();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    window.location.replace('index.html');
});

/* ---------- start ---------- */
let savedTheme = 'light';
try { savedTheme = localStorage.getItem('balangay_theme') === 'dark' ? 'dark' : 'light'; } catch { /* ignore */ }
applyTheme(savedTheme);
setView(VIEW_TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'overview', false);
fillFilterOptions();
load();
setInterval(() => {
    if (document.hidden || $$('dialog[open]').length) return;
    load(true);
}, REFRESH_MS);

window.CaptainConsole = { state, an, reload: load };
})();