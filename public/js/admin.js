// ── Admin Dashboard ──────────────────────────────────────────────────────────
// Talks to this server's /api/admin/* endpoints. Authentication is a signed,
// httpOnly session cookie set by the server, so no token is kept in JS.
// Every value rendered into the page is escaped: rows come from the public
// insert endpoint and must be treated as untrusted.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function api(path, options) {
    const opts = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch('/api' + path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let allRows = [];
  let emailList = [];
  let dailyChart = null;
  let typeChart = null;

  // ── Auth ──
  async function doLogin() {
    const email = $('email-input').value.trim();
    const pwd = $('pwd-input').value;
    const errEl = $('login-error');
    const btn = $('btn-login');
    errEl.style.display = 'none';
    btn.disabled = true;
    try {
      const data = await api('/admin/login', { method: 'POST', body: { email, password: pwd } });
      $('pwd-input').value = '';
      showDashboard(data.email);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  }

  async function doLogout() {
    try { await api('/admin/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.reload();
  }

  function showDashboard(email) {
    $('login-screen').style.display = 'none';
    $('dashboard').style.display = 'block';
    $('user-email').textContent = email || '';
    loadData();
  }

  async function checkSession() {
    try {
      const me = await api('/admin/me');
      showDashboard(me.email);
    } catch (e) {
      $('login-screen').style.display = 'flex';
    }
  }

  // ── Data ──
  async function loadData() {
    const tbody = $('log-tbody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">Loading…</td></tr>';
    try {
      const data = await api('/admin/generations?limit=2000');
      allRows = Array.isArray(data.rows) ? data.rows : [];
      renderStats(allRows);
      renderCharts(allRows);
      renderTable(allRows);
      renderEmailList();
    } catch (e) {
      if (e.status === 401) { location.reload(); return; }
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--red)">Failed to load data: ' +
        escapeHtml(e.message) + '</td></tr>';
    }
  }

  // ── Stats ──
  function renderStats(rows) {
    const count = (pred) => rows.filter(pred).length;
    const pdfs = count(r => r.type === 'PDF');
    const pngs = count(r => r.type === 'PNG');
    const reports = count(r => r.type === 'REPORT_PDF');
    const merges = count(r => r.type === 'MERGE' || r.type === 'REPORT_MERGE');
    const words = count(r => ['DOC', 'DOCX', 'REPORT_DOC', 'REPORT_DOCX'].includes(r.type));
    const students = new Set(rows.map(r => (r.student_name || '').trim().toLowerCase()).filter(Boolean)).size;
    const emails = new Set(rows.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)).size;
    $('stat-total').textContent = rows.length;
    $('stat-pdf').textContent = pdfs;
    $('stat-png').textContent = pngs;
    $('stat-report').textContent = reports;
    $('stat-merge').textContent = merges;
    $('stat-word').textContent = words;
    $('stat-email').textContent = emails;
    $('stat-students').textContent = students;
  }

  // ── Charts ──
  // Day keys use the viewer's local date so bars line up with the timestamps
  // shown in the table (which are also rendered in local time).
  function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') return;
    const today = new Date();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (13 - i));
      return dayKey(d);
    });
    const byDay = {};
    rows.forEach(r => {
      if (!r.created_at) return;
      const k = dayKey(new Date(r.created_at));
      const slot = byDay[k] || (byDay[k] = { fp: 0, rp: 0 });
      if (r.page === 'front-page') slot.fp++;
      else if (r.page === 'project-report') slot.rp++;
    });
    const fpCounts = days.map(d => (byDay[d] ? byDay[d].fp : 0));
    const rpCounts = days.map(d => (byDay[d] ? byDay[d].rp : 0));
    const labels = days.map(d => d.slice(5));

    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart($('chart-daily'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Front Page', data: fpCounts, backgroundColor: '#6366f1', borderRadius: 4 },
          { label: 'Project Report', data: rpCounts, backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    const types = {};
    rows.forEach(r => { const t = r.type || 'Unknown'; types[t] = (types[t] || 0) + 1; });
    const colors = { PDF: '#6d28d9', PNG: '#10b981', MERGE: '#f59e0b', REPORT_PDF: '#3b82f6', REPORT_MERGE: '#ec4899', DOC: '#2b579a', DOCX: '#41a5ee', REPORT_DOC: '#6366f1', REPORT_DOCX: '#8b5cf6', Unknown: '#94a3b8' };

    if (typeChart) typeChart.destroy();
    typeChart = new Chart($('chart-type'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(types),
        datasets: [{ data: Object.values(types), backgroundColor: Object.keys(types).map(t => colors[t] || '#94a3b8'), borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // ── Generation log ──
  function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d) ? '-' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderTable(rows) {
    const tbody = $('log-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><p>No generations logged yet.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r, i) => {
      const type = escapeHtml(r.type || '');
      const typeClass = /^[a-z_]+$/i.test(r.type || '') ? 'badge-' + String(r.type).toLowerCase() : '';
      return '<tr>' +
        '<td style="color:var(--muted)">' + (rows.length - i) + '</td>' +
        '<td style="white-space:nowrap">' + escapeHtml(fmtDate(r.created_at)) + '</td>' +
        '<td><span class="badge" style="background:#f1f5f9;color:var(--muted)">' + (escapeHtml(r.page) || '-') + '</span></td>' +
        '<td><span class="badge ' + typeClass + '">' + (type || '-') + '</span></td>' +
        '<td><strong>' + (escapeHtml(r.student_name) || '-') + '</strong></td>' +
        '<td>' + (escapeHtml(r.usn) || '-') + '</td>' +
        '<td style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(r.email) + '">' + (escapeHtml(r.email) || '-') + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(r.subject) + '">' + (escapeHtml(r.subject) || '-') + '</td>' +
        '<td>' + (escapeHtml(r.semester) || '-') + '</td>' +
        '</tr>';
    }).join('');
  }

  function filterTable() {
    const q = $('search-input').value.toLowerCase();
    const filtered = allRows.filter(r =>
      (r.student_name || '').toLowerCase().includes(q) ||
      (r.usn || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.subject || '').toLowerCase().includes(q) ||
      (r.page || '').toLowerCase().includes(q)
    );
    renderTable(filtered);
    renderStats(filtered);
  }

  // ── Email list ──
  function aggregateEmails(rows) {
    const map = new Map();
    rows.forEach(r => {
      const email = (r.email || '').trim();
      if (!email) return;
      const key = email.toLowerCase();
      let e = map.get(key);
      if (!e) { e = { email, name: r.student_name || '', count: 0, last: r.created_at || '' }; map.set(key, e); }
      e.count++;
      if (r.created_at && r.created_at > e.last) e.last = r.created_at;
      if (!e.name && r.student_name) e.name = r.student_name;
    });
    return [...map.values()].sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  }

  function renderEmailList() {
    const all = aggregateEmails(allRows);
    const q = ($('email-search').value || '').toLowerCase();
    emailList = q
      ? all.filter(e => e.email.toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q))
      : all;
    $('email-count-badge').textContent = all.length;
    const tbody = $('email-tbody');
    if (!emailList.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>' +
        (all.length ? 'No emails match your search.' : 'No emails collected yet.') + '</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = emailList.map((e, i) =>
      '<tr>' +
        '<td style="color:var(--muted)">' + (i + 1) + '</td>' +
        '<td><a href="mailto:' + escapeHtml(encodeURIComponent(e.email)) + '" style="color:var(--primary);text-decoration:none">' + escapeHtml(e.email) + '</a></td>' +
        '<td>' + (escapeHtml(e.name) || '-') + '</td>' +
        '<td>' + e.count + '</td>' +
        '<td style="white-space:nowrap">' + escapeHtml(fmtDate(e.last)) + '</td>' +
      '</tr>'
    ).join('');
  }

  function csvCell(v) {
    v = (v == null ? '' : String(v));
    // Neutralise spreadsheet formula injection, then quote as needed.
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportEmailsCSV() {
    if (!emailList.length) { alert('No emails to export.'); return; }
    const header = ['Email', 'Name', 'Exports', 'Last Activity'];
    const lines = emailList.map(e => [e.email, e.name, e.count, e.last].map(csvCell).join(','));
    const csv = '﻿' + [header.join(','), ...lines].join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `dbit-pagecraft-emails_${stamp}.csv`, 'text/csv;charset=utf-8;');
  }

  function copyEmails() {
    if (!emailList.length) { alert('No emails to copy.'); return; }
    const text = emailList.map(e => e.email).join(', ');
    const btn = $('btn-copy-emails');
    const done = () => {
      const t = btn.textContent;
      btn.textContent = 'Copied!'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = t; btn.classList.remove('copied'); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => prompt('Copy emails:', text));
    } else {
      prompt('Copy emails:', text);
    }
  }

  // ── Wire up ──
  $('btn-login').addEventListener('click', doLogin);
  $('pwd-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('email-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('pwd-input').focus(); });
  $('btn-refresh').addEventListener('click', loadData);
  $('btn-logout').addEventListener('click', doLogout);
  $('search-input').addEventListener('input', filterTable);
  $('email-search').addEventListener('input', renderEmailList);
  $('btn-copy-emails').addEventListener('click', copyEmails);
  $('btn-export-csv').addEventListener('click', exportEmailsCSV);

  checkSession();
})();
