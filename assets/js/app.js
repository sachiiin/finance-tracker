'use strict';

/* ════════════════════════════ Setup ════════════════════════════ */

if (!window.APP_CONFIG) {
  document.getElementById('loadingView').innerHTML =
    '<div class="alert alert-danger m-4">Missing <code>assets/js/config.js</code>. On Vercel, set SUPABASE_URL and SUPABASE_ANON_KEY in Environment Variables and redeploy. Locally, copy <code>config.example.js</code> to <code>config.js</code>.</div>';
  throw new Error('APP_CONFIG missing');
}
const sb = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

const DEFAULT_JOBS = [
  { title: 'QA Analyst',          employer: 'Signifi Solutions Inc.',   location: 'Mississauga ON', job_type: 'Full-time', is_current: true },
  { title: 'Delivery Driver',     employer: 'OPDI Amazon Delivery',     location: null,             job_type: 'Full-time' },
  { title: 'Delivery Driver',     employer: 'GOLO Amazon Delivery',     location: null,             job_type: 'Full-time' },
  { title: 'Barista',             employer: 'Starbucks (Metro Inc.)',   location: null,             job_type: 'Part-time' },
  { title: 'General Labour',      employer: 'Talent Surplus Inc.',      location: null,             job_type: 'Part-time' },
  { title: 'Graphic Designer',    employer: 'Pizza Depot Head Office',  location: 'Brampton ON',    job_type: 'Part-time' },
  { title: 'Cashier',             employer: '#DESI Restaurant',         location: 'Toronto ON',     job_type: 'Part-time' },
  { title: 'Pit Crew Member',     employer: "Dickey's BBQ Pit",         location: 'Edmonton AB',    job_type: 'Part-time' },
  { title: 'Cashier',             employer: 'A&W',                      location: 'Edmonton AB',    job_type: 'Full-time' },
  { title: 'E-Commerce Clerk',    employer: 'Metro Inc.',               location: 'Toronto ON',     job_type: 'Part-time' },
].map((j, i) => ({ is_current: false, ...j, sort_order: i + 1 }));

// Table → default sort column (newest first unless asc)
const TABLES = {
  jobs:            { order: 'sort_order', asc: true },
  paystubs:        { order: 'pay_date' },
  other_income:    { order: 'date_received' },
  donations:       { order: 'donation_date' },
  india_payments:  { order: 'payment_date' },
  loans:           { order: 'created_at' },
  loan_repayments: { order: 'repaid_date' },
};

const state = {
  user: null,
  year: 'all',
  jobFilter: 'all',
  loanSel: null,
  charts: [],
  ...Object.fromEntries(Object.keys(TABLES).map(t => [t, []])),
};

const PALETTE = ['#1F2937', '#f0bc74', '#31316A', '#10B981', '#2361ce', '#EF4683', '#7C3AED', '#FBA918', '#63b1bd', '#b9a084', '#E11D48'];

/* ════════════════════════════ Helpers ════════════════════════════ */

const $ = sel => document.querySelector(sel);
const num = v => Number(v) || 0;
const round2 = v => Math.round(v * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cadFmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const cad = v => cadFmt.format(num(v));
const inr = v => inrFmt.format(num(v));
const pct = v => `${+num(v).toFixed(2)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
const monthKey = d => (d || '').slice(0, 7);
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const inYear = d => state.year === 'all' || (d || '').startsWith(state.year);
const sum = (rows, f) => round2(rows.reduce((a, r) => a + num(typeof f === 'function' ? f(r) : r[f]), 0));
const byDateDesc = key => (a, b) => (b[key] || '').localeCompare(a[key] || '') || b.id - a.id;

const jobById = id => state.jobs.find(j => j.id === id);
const jobLabel = j => j ? `${j.title} – ${j.employer}` : 'Unknown job';

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast-msg ${type === 'error' ? 'error' : ''}`;
  el.textContent = msg;
  $('#toastArea').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 2500);
}

const ICON = {
  edit: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
  del:  '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
  plus: '<svg class="icon icon-xs me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>',
  cash: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>',
  brief: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clip-rule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>',
  bank: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
  heart: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>',
  plane: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>',
  user: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>',
  clock: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>',
  check: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
  alert: '<svg class="icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
};

/* ════════════════════════════ Data ════════════════════════════ */

async function load(table) {
  const { data, error } = await sb.from(table).select('*')
    .order(TABLES[table].order, { ascending: !!TABLES[table].asc })
    .order('id', { ascending: !!TABLES[table].asc });
  if (error) throw error;
  state[table] = data || [];
}
const loadAll = () => Promise.all(Object.keys(TABLES).map(load));

async function seedJobsIfEmpty() {
  if (state.jobs.length) return;
  const { error } = await sb.from('jobs').insert(DEFAULT_JOBS);
  if (error) throw error;
  await load('jobs');
}

/* Income rows used by Dashboard and Bhaag */
function incomeRows() {
  const jobs = state.paystubs.map(p => ({
    kind: 'job', table: 'paystubs', id: p.id, date: p.pay_date, amount: num(p.net_pay),
    percent: num(p.bhaag_percent), source: jobLabel(jobById(p.job_id)), jobId: p.job_id,
  }));
  const other = state.other_income.map(o => ({
    kind: 'other', table: 'other_income', id: o.id, date: o.date_received, amount: num(o.amount),
    percent: num(o.bhaag_percent), source: o.description,
  }));
  return [...jobs, ...other];
}

function loanSummary(loan) {
  const reps = state.loan_repayments.filter(r => r.loan_id === loan.id);
  const returned = sum(reps, 'amount');
  const balance = round2(num(loan.amount) - returned);
  let status = 'Pending';
  if (balance <= 0) status = 'Returned';
  else if (returned > 0) status = 'Partial';
  const overdue = balance > 0 && loan.due_date && loan.due_date < todayISO();
  return { reps, returned, balance, status, overdue };
}

/* ════════════════════════════ Forms ════════════════════════════ */

const moneyField = (k, label, req = true) => ({ k, label, type: 'number', step: '0.01', min: '0', req });
const pctField = { k: 'bhaag_percent', label: 'Bhaag %', type: 'number', step: '0.01', min: '0', max: '100', req: true, def: 10, help: 'Usually 10 (dasmo) or 20 (visamo).' };

const FORMS = {
  jobs: {
    title: 'Job',
    fields: [
      { k: 'title', label: 'Job title', type: 'text', req: true },
      { k: 'employer', label: 'Employer', type: 'text', req: true },
      { k: 'location', label: 'Location', type: 'text' },
      { k: 'job_type', label: 'Type', type: 'select', options: () => ['Full-time', 'Part-time'].map(v => [v, v]), req: true },
      { k: 'is_current', label: 'Current job', type: 'checkbox' },
      { k: 'sort_order', label: 'Display order', type: 'number', step: '1', def: () => state.jobs.length + 1 },
    ],
  },
  paystubs: {
    title: 'Pay Stub',
    fields: [
      { k: 'job_id', label: 'Job', type: 'select', req: true, numeric: true, options: () => state.jobs.map(j => [j.id, jobLabel(j)]) },
      { k: 'period_start', label: 'Pay period start', type: 'date', half: true },
      { k: 'period_end', label: 'Pay period end', type: 'date', half: true },
      { k: 'pay_date', label: 'Pay date', type: 'date', req: true, def: todayISO },
      { k: 'hours', label: 'Hours', type: 'number', step: '0.01', min: '0', half: true },
      { ...moneyField('net_pay', 'Net pay (CAD)'), half: true },
      pctField,
    ],
    validate: v => (v.period_start && v.period_end && v.period_end < v.period_start) ? 'Pay period end is before the start.' : null,
  },
  other_income: {
    title: 'CRA / Other Income',
    fields: [
      { k: 'description', label: 'Description', type: 'text', req: true, placeholder: 'e.g. CRA GST/HST credit', list: () => [...new Set(state.other_income.map(o => o.description))] },
      { k: 'date_received', label: 'Date received', type: 'date', req: true, def: todayISO, half: true },
      { ...moneyField('amount', 'Amount (CAD)'), half: true },
      pctField,
    ],
  },
  donations: {
    title: 'Donation',
    fields: [
      { k: 'donation_date', label: 'Date', type: 'date', req: true, def: todayISO, half: true },
      { ...moneyField('amount', 'Amount (CAD)'), half: true },
      { k: 'description', label: 'Description', type: 'text', placeholder: 'e.g. Mandir – October bhaag' },
    ],
  },
  india_payments: {
    title: 'India Payment',
    fields: [
      { k: 'payment_date', label: 'Date', type: 'date', req: true, def: todayISO },
      { ...moneyField('cad_amount', 'CAD amount'), half: true },
      { ...moneyField('inr_amount', 'INR amount'), half: true },
      { k: 'rate', label: 'Rate (INR per CAD)', type: 'number', readonly: true, help: 'Calculated as INR ÷ CAD.' },
      { k: 'ca_account', label: 'CA account', type: 'text', placeholder: 'Account sent from', list: () => [...new Set(state.india_payments.map(p => p.ca_account).filter(Boolean))] },
      { k: 'comments', label: 'Comments', type: 'textarea' },
    ],
    onInput(form, changed) {
      if (changed !== 'cad_amount' && changed !== 'inr_amount') return;
      const c = num(form.cad_amount.value), i = num(form.inr_amount.value);
      form.rate.value = c > 0 && i > 0 ? (i / c).toFixed(4) : '';
    },
    validate(v) {
      if (!(v.cad_amount > 0) || !(v.inr_amount > 0)) return 'CAD and INR amounts must both be more than 0.';
      v.rate = Math.round(v.inr_amount / v.cad_amount * 10000) / 10000;
      return null;
    },
  },
  loans: {
    title: 'Money Lent',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true, list: () => [...new Set(state.loans.map(l => l.name))] },
      { k: 'description', label: 'Description', type: 'text' },
      { ...moneyField('amount', 'Amount (CAD)'), half: true },
      { k: 'due_date', label: 'Due date', type: 'date', half: true },
    ],
  },
  loan_repayments: {
    title: 'Repayment',
    fields: [
      { k: 'repaid_date', label: 'Date returned', type: 'date', req: true, def: todayISO, half: true },
      { ...moneyField('amount', 'Amount (CAD)'), half: true },
      { k: 'note', label: 'Note', type: 'text' },
    ],
  },
  bhaag_percent: {
    title: 'Bhaag %',
    fields: [{ ...pctField, help: 'Applies to every income entry in this row.' }],
  },
};

let formCtx = null;
const formModal = () => bootstrap.Modal.getOrCreateInstance($('#formModal'));

function fieldHTML(f, value) {
  const id = `f_${f.k}`;
  const req = f.req ? 'required' : '';
  const v = value ?? '';
  let input;
  if (f.type === 'select') {
    input = `<select class="form-select" id="${id}" name="${f.k}" ${req}>
      <option value="">Select…</option>
      ${f.options().map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}
    </select>`;
  } else if (f.type === 'checkbox') {
    return `<div class="${f.half ? 'col-6' : 'col-12'}"><div class="form-check">
      <input class="form-check-input" type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''}>
      <label class="form-check-label" for="${id}">${esc(f.label)}</label></div></div>`;
  } else if (f.type === 'textarea') {
    input = `<textarea class="form-control" id="${id}" name="${f.k}" rows="2">${esc(v)}</textarea>`;
  } else {
    const list = f.list ? `list="${id}_list"` : '';
    const extra = [f.step && `step="${f.step}"`, f.min && `min="${f.min}"`, f.max && `max="${f.max}"`,
      f.type === 'number' && 'inputmode="decimal"', f.placeholder && `placeholder="${esc(f.placeholder)}"`,
      f.readonly && 'readonly tabindex="-1"'].filter(Boolean).join(' ');
    input = `<input class="form-control${f.readonly ? ' bg-gray-100' : ''}" type="${f.type}" id="${id}" name="${f.k}" value="${esc(v)}" ${extra} ${list} ${req}>`;
    if (f.list) input += `<datalist id="${id}_list">${f.list().map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<div class="${f.half ? 'col-6' : 'col-12'}">
    <label class="form-label" for="${id}">${esc(f.label)}${f.req ? ' <span class="text-danger">*</span>' : ''}</label>
    ${input}
    ${f.help ? `<div class="form-text">${esc(f.help)}</div>` : ''}
  </div>`;
}

/**
 * Open the shared modal.
 * kind: key of FORMS; row: existing row (edit) or null (add);
 * opts.extra: fixed values merged on save; opts.onSave: custom save handler.
 */
function openForm(kind, row = null, opts = {}) {
  const cfg = FORMS[kind];
  formCtx = { kind, row, opts };
  $('#formTitle').textContent = `${row ? 'Edit' : 'Add'} ${cfg.title}`;
  $('#formBody').innerHTML = `<div class="row g-3">${cfg.fields.map(f => {
    let v = row ? row[f.k] : (opts.defaults?.[f.k] ?? (typeof f.def === 'function' ? f.def() : f.def));
    return fieldHTML(f, v);
  }).join('')}</div>`;
  $('#formError').classList.add('d-none');
  $('#entityForm').classList.remove('was-validated');
  formModal().show();
}

function readForm(cfg, form) {
  const out = {};
  for (const f of cfg.fields) {
    const el = form.elements[f.k];
    if (f.type === 'checkbox') out[f.k] = el.checked;
    else if (el.value === '') out[f.k] = null;
    else if (f.type === 'number' || f.numeric) out[f.k] = Number(el.value);
    else out[f.k] = el.value.trim();
  }
  return out;
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const { kind, row, opts } = formCtx;
  const cfg = FORMS[kind];
  const errBox = $('#formError');
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;
  const values = { ...readForm(cfg, form), ...(opts.extra || {}) };
  const msg = cfg.validate?.(values);
  if (msg) { errBox.textContent = msg; errBox.classList.remove('d-none'); return; }

  const btn = $('#formSave');
  btn.disabled = true;
  try {
    if (opts.onSave) await opts.onSave(values);
    else {
      const q = row ? sb.from(kind).update(values).eq('id', row.id) : sb.from(kind).insert(values);
      const { error } = await q;
      if (error) throw error;
      await load(kind);
    }
    formModal().hide();
    toast(`${cfg.title} ${row ? 'updated' : 'added'}`);
    render();
  } catch (err) {
    errBox.textContent = err.message || String(err);
    errBox.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
}

async function removeRow(table, id, what) {
  if (!confirm(`Delete this ${what}? This cannot be undone.`)) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) {
    const msg = error.code === '23503' ? `This ${what} still has entries linked to it. Delete those first.` : error.message;
    toast(msg, 'error');
    return;
  }
  await load(table);
  if (table === 'loans') await load('loan_repayments');
  toast(`${what[0].toUpperCase() + what.slice(1)} deleted`);
  render();
}

/* ════════════════════════════ UI pieces ════════════════════════════ */

function statCard(label, value, sub, icon, tone = 'primary') {
  return `<div class="col-12 col-sm-6 col-xl-4 mb-4">
    <div class="card border-0 shadow stat-card h-100"><div class="card-body d-flex align-items-center">
      <div class="icon-shape icon-shape-${tone} rounded me-3">${icon}</div>
      <div class="min-w-0">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
      </div>
    </div></div>
  </div>`;
}

function pageHead(title, sub, btn) {
  return `<div class="page-head d-flex flex-column flex-sm-row justify-content-between align-items-sm-center py-4">
    <div>
      <h1 class="mb-1">${esc(title)}</h1>
      <p class="mb-0 text-gray-500 small">${sub}</p>
    </div>
    ${btn ? `<button class="btn btn-gray-800 d-inline-flex align-items-center justify-content-center" data-action="${btn.action}" ${btn.attrs || ''}>${ICON.plus}${esc(btn.label)}</button>` : ''}
  </div>`;
}

const actionBtns = (table, id, what, extra = '') => `<td class="actions">${extra}
  <button class="btn btn-sm btn-outline-gray-600 btn-icon" data-action="edit" data-table="${table}" data-id="${id}" title="Edit" aria-label="Edit">${ICON.edit}</button>
  <button class="btn btn-sm btn-outline-danger btn-icon ms-1" data-action="delete" data-table="${table}" data-id="${id}" data-what="${what}" title="Delete" aria-label="Delete">${ICON.del}</button>
</td>`;

function tableCard(title, headers, rowsHTML, footHTML = '', headRight = '') {
  const body = rowsHTML || `<tr><td colspan="${headers.length}" class="empty-state">No entries yet.</td></tr>`;
  return `<div class="card border-0 shadow mb-4">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <h2 class="fs-5 fw-bold mb-0">${title}</h2>${headRight}
    </div>
    <div class="table-responsive">
      <table class="table mb-0 rounded">
        <thead class="thead-light"><tr>${headers.map(h => {
          const [label, cls] = Array.isArray(h) ? h : [h, ''];
          return `<th class="border-0 ${cls}">${label}</th>`;
        }).join('')}</tr></thead>
        <tbody>${body}</tbody>
        ${footHTML ? `<tfoot>${footHTML}</tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

const yearText = () => state.year === 'all' ? 'All years' : state.year;

function destroyCharts() {
  state.charts.forEach(c => c.destroy());
  state.charts = [];
}

/* ════════════════════════════ Pages ════════════════════════════ */

function renderDashboard() {
  const income = incomeRows().filter(r => inYear(r.date));
  const jobIncome = sum(income.filter(r => r.kind === 'job'), 'amount');
  const otherIncome = sum(income.filter(r => r.kind === 'other'), 'amount');
  const totalIncome = round2(jobIncome + otherIncome);
  const bhaagDue = sum(income, r => r.amount * r.percent / 100);
  const donations = state.donations.filter(d => inYear(d.donation_date));
  const donated = sum(donations, 'amount');
  const india = state.india_payments.filter(p => inYear(p.payment_date));
  const indiaCad = sum(india, 'cad_amount');
  const indiaInr = sum(india, 'inr_amount');
  const loans = state.loans.map(l => ({ ...l, ...loanSummary(l) }));
  const outstanding = sum(loans, l => Math.max(l.balance, 0));
  const openLoans = loans.filter(l => l.balance > 0);
  const hours = sum(state.paystubs.filter(p => inYear(p.pay_date)), 'hours');

  // Recent transactions
  const tx = [
    ...income.map(r => ({ date: r.date, type: r.kind === 'job' ? 'Job pay' : 'CRA / Other', desc: r.source, amount: r.amount, dir: 1 })),
    ...donations.map(d => ({ date: d.donation_date, type: 'Bhaag', desc: d.description || 'Temple donation', amount: num(d.amount), dir: -1 })),
    ...india.map(p => ({ date: p.payment_date, type: 'India', desc: `${inr(p.inr_amount)}${p.ca_account ? ' · ' + p.ca_account : ''}`, amount: num(p.cad_amount), dir: -1 })),
    ...state.loan_repayments.filter(r => inYear(r.repaid_date)).map(r => {
      const l = state.loans.find(x => x.id === r.loan_id);
      return { date: r.repaid_date, type: 'Returned', desc: l ? `From ${l.name}` : 'Loan repayment', amount: num(r.amount), dir: 1 };
    }),
  ].sort(byDateDesc('date')).slice(0, 10);

  const typeBadge = { 'Job pay': 'bg-success', 'CRA / Other': 'bg-info', 'Bhaag': 'bg-secondary text-gray-800', 'India': 'bg-tertiary', 'Returned': 'bg-gray-600' };
  const txRows = tx.map(t => `<tr>
    <td>${fmtDate(t.date)}</td>
    <td><span class="badge ${typeBadge[t.type]}">${t.type}</span></td>
    <td class="text-wrap">${esc(t.desc)}</td>
    <td class="num fw-bold ${t.dir > 0 ? 'text-success' : 'text-danger'}">${t.dir > 0 ? '+' : '−'}${cad(t.amount)}</td>
  </tr>`).join('');

  // Income by job
  const jobRows = state.jobs.map(j => {
    const stubs = state.paystubs.filter(p => p.job_id === j.id && inYear(p.pay_date));
    return { j, count: stubs.length, hours: sum(stubs, 'hours'), net: sum(stubs, 'net_pay'), bhaag: sum(stubs, p => num(p.net_pay) * num(p.bhaag_percent) / 100) };
  }).filter(r => r.count).sort((a, b) => b.net - a.net);
  const jobRowsHTML = jobRows.map(r => `<tr>
    <td class="text-wrap"><div class="fw-bold">${esc(r.j.title)}</div><div class="small text-gray-500">${esc(r.j.employer)}</div></td>
    <td class="num">${r.count}</td><td class="num">${+r.hours.toFixed(2)}</td>
    <td class="num fw-bold">${cad(r.net)}</td><td class="num">${cad(r.bhaag)}</td>
  </tr>`).join('');

  const balanceTone = round2(bhaagDue - donated) > 0 ? 'danger' : 'success';

  $('#view').innerHTML = `
    ${pageHead('Dashboard', `Overview · ${yearText()}`)}
    <div class="row">
      ${statCard('Total income', cad(totalIncome), `${income.length} entries · ${+hours.toFixed(2)} hrs worked`, ICON.cash, 'success')}
      ${statCard('Job income (net)', cad(jobIncome), `${state.paystubs.filter(p => inYear(p.pay_date)).length} pay stubs`, ICON.brief, 'primary')}
      ${statCard('CRA / Other income', cad(otherIncome), `${state.other_income.filter(o => inYear(o.date_received)).length} entries`, ICON.bank, 'info')}
      ${statCard('Bhaag balance', cad(bhaagDue - donated), `Due ${cad(bhaagDue)} · Given ${cad(donated)}`, ICON.heart, balanceTone)}
      ${statCard('Sent to India', cad(indiaCad), inr(indiaInr), ICON.plane, 'tertiary')}
      ${statCard('Money lent – outstanding', cad(outstanding), `${openLoans.length} open · ${openLoans.filter(l => l.overdue).length} overdue · all years`, ICON.user, 'secondary')}
    </div>
    <div class="row">
      <div class="col-12 col-xl-8 mb-4">
        <div class="card border-0 shadow h-100">
          <div class="card-header"><h2 class="fs-5 fw-bold mb-0">Monthly money in vs out</h2>
            <div class="small text-gray-500">${state.year === 'all' ? 'Last 12 months' : state.year}</div></div>
          <div class="card-body"><div class="chart-box"><canvas id="barChart"></canvas></div></div>
        </div>
      </div>
      <div class="col-12 col-xl-4 mb-4">
        <div class="card border-0 shadow h-100">
          <div class="card-header"><h2 class="fs-5 fw-bold mb-0">Income by source</h2>
            <div class="small text-gray-500">${yearText()}</div></div>
          <div class="card-body"><div class="chart-box pie"><canvas id="pieChart"></canvas></div></div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-12 col-xxl-6">${tableCard('Recent transactions', ['Date', 'Type', 'Description', ['Amount', 'num']], txRows)}</div>
      <div class="col-12 col-xxl-6">${tableCard('Income by job', ['Job', ['Stubs', 'num'], ['Hours', 'num'], ['Net', 'num'], ['Bhaag', 'num']], jobRowsHTML)}</div>
    </div>`;

  drawDashboardCharts(income);
}

function drawDashboardCharts(income) {
  // Month buckets
  let keys = [];
  if (state.year === 'all') {
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
  } else {
    keys = Array.from({ length: 12 }, (_, i) => `${state.year}-${String(i + 1).padStart(2, '0')}`);
  }
  const bucket = (rows, dateKey, amt) => keys.map(k => sum(rows.filter(r => monthKey(r[dateKey]) === k), amt));
  const allIncome = incomeRows();

  const bar = new Chart($('#barChart'), {
    type: 'bar',
    data: {
      labels: keys.map(k => state.year === 'all' ? monthLabel(k) : MONTHS[+k.slice(5) - 1]),
      datasets: [
        { label: 'Income', data: bucket(allIncome, 'date', 'amount'), backgroundColor: '#10B981', borderRadius: 4 },
        { label: 'Bhaag given', data: bucket(state.donations, 'donation_date', 'amount'), backgroundColor: '#f0bc74', borderRadius: 4 },
        { label: 'Sent to India', data: bucket(state.india_payments, 'payment_date', 'cad_amount'), backgroundColor: '#31316A', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${cad(c.parsed.y)}` } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => cad(v).replace('.00', '') }, grid: { color: '#F2F4F6' } }, x: { grid: { display: false } } },
    },
  });

  const bySource = new Map();
  income.forEach(r => {
    const key = r.kind === 'job' ? r.source : 'CRA / Other';
    bySource.set(key, round2((bySource.get(key) || 0) + r.amount));
  });
  const entries = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const pieCanvas = $('#pieChart');
  if (!entries.length) {
    pieCanvas.parentElement.innerHTML = '<div class="empty-state">No income in this period.</div>';
    state.charts.push(bar);
    return;
  }
  const pie = new Chart(pieCanvas, {
    type: 'doughnut',
    data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.label}: ${cad(c.parsed)}` } } },
    },
  });
  state.charts.push(bar, pie);
}

function renderJobs() {
  const jf = state.jobFilter;
  const stubs = state.paystubs
    .filter(p => inYear(p.pay_date) && (jf === 'all' || p.job_id === Number(jf)))
    .sort(byDateDesc('pay_date'));
  const showJobCol = jf === 'all';
  const selJob = jf === 'all' ? null : jobById(Number(jf));

  const rows = stubs.map((p, i) => `<tr>
    <td>${i + 1}</td>
    ${showJobCol ? `<td class="text-wrap"><div class="fw-bold">${esc(jobById(p.job_id)?.title)}</div><div class="small text-gray-500">${esc(jobById(p.job_id)?.employer)}</div></td>` : ''}
    <td>${p.period_start || p.period_end ? `${fmtDate(p.period_start)} – ${fmtDate(p.period_end)}` : '—'}</td>
    <td>${fmtDate(p.pay_date)}</td>
    <td class="num">${p.hours != null ? +num(p.hours).toFixed(2) : '—'}</td>
    <td class="num fw-bold">${cad(p.net_pay)}</td>
    ${actionBtns('paystubs', p.id, 'pay stub')}
  </tr>`).join('');
  const foot = stubs.length ? `<tr><td colspan="${showJobCol ? 4 : 3}">Total (${stubs.length})</td>
    <td class="num">${+sum(stubs, 'hours').toFixed(2)}</td><td class="num">${cad(sum(stubs, 'net_pay'))}</td><td></td></tr>` : '';

  const filter = `<select class="form-select form-select-sm w-auto" id="jobFilter" aria-label="Filter by job">
    <option value="all">All jobs</option>
    ${state.jobs.map(j => `<option value="${j.id}" ${String(j.id) === String(jf) ? 'selected' : ''}>${esc(jobLabel(j))}</option>`).join('')}
  </select>`;

  const jobsRows = state.jobs.map((j, i) => {
    const s = state.paystubs.filter(p => p.job_id === j.id);
    return `<tr class="${String(j.id) === String(jf) ? 'row-selected' : ''}">
      <td>${i + 1}</td>
      <td class="text-wrap"><a href="#" class="fw-bold text-gray-800" data-action="pick-job" data-id="${j.id}">${esc(j.title)}</a>
        ${j.is_current ? '<span class="badge bg-success ms-1">Current</span>' : ''}<div class="small text-gray-500">${esc(j.employer)}</div></td>
      <td>${esc(j.location || '—')}</td>
      <td>${esc(j.job_type)}</td>
      <td class="num">${s.length}</td>
      <td class="num fw-bold">${cad(sum(s, 'net_pay'))}</td>
      ${actionBtns('jobs', j.id, 'job')}
    </tr>`;
  }).join('');

  const sub = selJob ? `${esc(jobLabel(selJob))} · ${yearText()}` : `Pay stubs for all jobs · ${yearText()}`;
  $('#view').innerHTML = `
    ${pageHead('Jobs', sub, { label: 'Add Pay Stub', action: 'add', attrs: 'data-table="paystubs"' })}
    <div class="row">
      ${statCard('Net pay', cad(sum(stubs, 'net_pay')), `${stubs.length} pay stubs`, ICON.cash, 'success')}
      ${statCard('Hours worked', +sum(stubs, 'hours').toFixed(2), stubs.length ? `Avg ${cad(sum(stubs, 'net_pay') / Math.max(sum(stubs, 'hours'), 1))}/hr (net)` : '', ICON.clock, 'primary')}
      ${statCard('Bhaag on this pay', cad(sum(stubs, p => num(p.net_pay) * num(p.bhaag_percent) / 100)), 'Based on net pay', ICON.heart, 'secondary')}
    </div>
    ${tableCard('Pay stubs', ['Sr.', ...(showJobCol ? ['Job'] : []), 'Pay period', 'Pay date', ['Hours', 'num'], ['Amount', 'num'], ['', 'actions']], rows, foot, filter)}
    ${tableCard('Your jobs', ['#', 'Job', 'Location', 'Type', ['Stubs', 'num'], ['Total earned', 'num'], ['', 'actions']], jobsRows, '',
      `<button class="btn btn-sm btn-outline-gray-800" data-action="add" data-table="jobs">${ICON.plus}Add Job</button>`)}`;
}

function renderOther() {
  const rows = state.other_income.filter(o => inYear(o.date_received)).sort(byDateDesc('date_received'));
  const html = rows.map((o, i) => `<tr>
    <td>${i + 1}</td>
    <td class="text-wrap">${esc(o.description)}</td>
    <td>${fmtDate(o.date_received)}</td>
    <td class="num fw-bold">${cad(o.amount)}</td>
    <td class="num">${pct(o.bhaag_percent)}</td>
    ${actionBtns('other_income', o.id, 'entry')}
  </tr>`).join('');
  const foot = rows.length ? `<tr><td colspan="3">Total (${rows.length})</td><td class="num">${cad(sum(rows, 'amount'))}</td><td colspan="2"></td></tr>` : '';
  $('#view').innerHTML = `
    ${pageHead('CRA / Other Income', `Benefits, refunds and other money received · ${yearText()}`, { label: 'Add Income', action: 'add', attrs: 'data-table="other_income"' })}
    <div class="row">
      ${statCard('Total received', cad(sum(rows, 'amount')), `${rows.length} entries`, ICON.bank, 'info')}
      ${statCard('Bhaag on this income', cad(sum(rows, o => num(o.amount) * num(o.bhaag_percent) / 100)), '', ICON.heart, 'secondary')}
    </div>
    ${tableCard('CRA / Other income', ['Sr.', 'Description', 'Date received', ['Amount', 'num'], ['Bhaag %', 'num'], ['', 'actions']], html, foot)}`;
}

function bhaagGroups() {
  const groups = new Map();
  incomeRows().filter(r => inYear(r.date)).forEach(r => {
    const key = `${monthKey(r.date)}|${r.kind}|${r.kind === 'job' ? r.jobId : r.source}`;
    if (!groups.has(key)) groups.set(key, { month: monthKey(r.date), kind: r.kind, source: r.source, entries: [] });
    groups.get(key).entries.push(r);
  });
  return [...groups.values()].map(g => {
    const total = sum(g.entries, 'amount');
    const bhaag = sum(g.entries, e => e.amount * e.percent / 100);
    const pcts = [...new Set(g.entries.map(e => e.percent))];
    return { ...g, total, bhaag, pctText: pcts.length === 1 ? pct(pcts[0]) : 'Mixed', pctValue: pcts.length === 1 ? pcts[0] : 10 };
  }).sort((a, b) => b.month.localeCompare(a.month) || b.total - a.total);
}

function renderBhaag() {
  const groups = bhaagGroups();
  state.bhaagGroups = groups;
  const totalIncome = sum(groups, 'total');
  const due = sum(groups, 'bhaag');
  const dons = state.donations.filter(d => inYear(d.donation_date)).sort(byDateDesc('donation_date'));
  const given = sum(dons, 'amount');
  const balance = round2(due - given);

  let lastMonth = null;
  const rows = groups.map((g, i) => {
    const first = g.month !== lastMonth;
    lastMonth = g.month;
    return `<tr>
      <td>${i + 1}</td>
      <td class="${first ? 'fw-bold' : 'text-gray-500'}">${monthLabel(g.month)}</td>
      <td class="text-wrap">${esc(g.source)} <span class="badge ${g.kind === 'job' ? 'bg-success' : 'bg-info'} ms-1">${g.kind === 'job' ? 'Job' : 'CRA/Other'}</span>
        <div class="small text-gray-500">${g.entries.length} ${g.entries.length === 1 ? 'entry' : 'entries'}</div></td>
      <td class="num">${cad(g.total)}</td>
      <td class="num">${g.pctText}</td>
      <td class="num fw-bold">${cad(g.bhaag)}</td>
      <td class="actions"><button class="btn btn-sm btn-outline-gray-600 btn-icon" data-action="edit-pct" data-idx="${i}" title="Change %" aria-label="Change percentage">${ICON.edit}</button></td>
    </tr>`;
  }).join('');
  const foot = groups.length ? `<tr><td colspan="3">Total</td><td class="num">${cad(totalIncome)}</td><td></td><td class="num">${cad(due)}</td><td></td></tr>` : '';

  const donRows = dons.map((d, i) => `<tr>
    <td>${i + 1}</td><td>${fmtDate(d.donation_date)}</td><td class="text-wrap">${esc(d.description || '—')}</td>
    <td class="num fw-bold">${cad(d.amount)}</td>${actionBtns('donations', d.id, 'donation')}
  </tr>`).join('');
  const donFoot = dons.length ? `<tr><td colspan="3">Total given</td><td class="num">${cad(given)}</td><td></td></tr>` : '';

  $('#view').innerHTML = `
    ${pageHead('10th-20th Bhaag', `Calculated monthly from Jobs (net pay) and CRA/Other income · ${yearText()}`, { label: 'Record Donation', action: 'add', attrs: 'data-table="donations"' })}
    <div class="row">
      ${statCard('Income counted', cad(totalIncome), `${groups.length} monthly rows`, ICON.cash, 'success')}
      ${statCard('Bhaag due', cad(due), totalIncome ? `${pct(due / totalIncome * 100)} of income` : '', ICON.heart, 'secondary')}
      ${statCard(balance > 0 ? 'Balance still to give' : 'Given in advance', cad(Math.abs(balance)), `Given so far ${cad(given)}`, balance > 0 ? ICON.alert : ICON.check, balance > 0 ? 'danger' : 'success')}
    </div>
    ${tableCard('Monthly Bhaag', ['Sr.', 'Month', 'Description', ['Total amount', 'num'], ['%', 'num'], ['Bhaag amount', 'num'], ['', 'actions']], rows, foot)}
    ${tableCard('Donations given', ['Sr.', 'Date', 'Description', ['Amount', 'num'], ['', 'actions']], donRows, donFoot)}`;
}

function renderIndia() {
  const rows = state.india_payments.filter(p => inYear(p.payment_date)).sort(byDateDesc('payment_date'));
  const tCad = sum(rows, 'cad_amount'), tInr = sum(rows, 'inr_amount');
  const html = rows.map((p, i) => `<tr>
    <td>${i + 1}</td><td>${fmtDate(p.payment_date)}</td>
    <td class="num fw-bold">${cad(p.cad_amount)}</td>
    <td>${esc(p.ca_account || '—')}</td>
    <td class="num">${num(p.rate).toFixed(4)}</td>
    <td class="num fw-bold">${inr(p.inr_amount)}</td>
    <td class="text-wrap small">${esc(p.comments || '')}</td>
    ${actionBtns('india_payments', p.id, 'payment')}
  </tr>`).join('');
  const foot = rows.length ? `<tr><td colspan="2">Total (${rows.length})</td><td class="num">${cad(tCad)}</td><td></td>
    <td class="num">${tCad ? (tInr / tCad).toFixed(4) : '—'}</td><td class="num">${inr(tInr)}</td><td colspan="2"></td></tr>` : '';
  $('#view').innerHTML = `
    ${pageHead('India Payment', `Money sent for the student education loan · ${yearText()}`, { label: 'Add Payment', action: 'add', attrs: 'data-table="india_payments"' })}
    <div class="row">
      ${statCard('Total sent (CAD)', cad(tCad), `${rows.length} payments`, ICON.plane, 'tertiary')}
      ${statCard('Total received (INR)', inr(tInr), '', ICON.bank, 'info')}
      ${statCard('Average rate', tCad ? (tInr / tCad).toFixed(4) : '—', 'INR per CAD, weighted', ICON.cash, 'secondary')}
    </div>
    ${tableCard('Payments', ['Sr.', 'Date', ['CAD amount', 'num'], 'CA account', ['Rate', 'num'], ['INR amount', 'num'], 'Comments', ['', 'actions']], html, foot)}`;
}

function renderLent() {
  const loans = state.loans.map(l => ({ ...l, ...loanSummary(l) }))
    .sort((a, b) => (a.status === 'Returned') - (b.status === 'Returned') || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const statusBadge = l => l.status === 'Returned' ? '<span class="badge bg-success">Returned</span>'
    : l.overdue ? `<span class="badge bg-danger">Overdue</span>${l.status === 'Partial' ? '<br><span class="badge bg-warning text-gray-800 mt-1">Partial</span>' : ''}`
    : l.status === 'Partial' ? '<span class="badge bg-warning text-gray-800">Partial</span>' : '<span class="badge bg-gray-500">Pending</span>';

  const rows = loans.map((l, i) => `<tr class="${l.id === state.loanSel ? 'row-selected' : ''}">
    <td>${i + 1}</td>
    <td class="fw-bold">${esc(l.name)}</td>
    <td class="text-wrap">${esc(l.description || '—')}</td>
    <td class="num">${cad(l.amount)}</td>
    <td class="num">${cad(l.returned)}</td>
    <td class="num fw-bold">${cad(Math.max(l.balance, 0))}</td>
    <td>${fmtDate(l.due_date)}</td>
    <td>${statusBadge(l)}</td>
    ${actionBtns('loans', l.id, 'loan', `<button class="btn btn-sm btn-outline-gray-800 px-2 me-1" data-action="repayments" data-id="${l.id}">Repayments</button>`)}
  </tr>`).join('');
  const foot = loans.length ? `<tr><td colspan="3">Total</td><td class="num">${cad(sum(loans, 'amount'))}</td><td class="num">${cad(sum(loans, 'returned'))}</td>
    <td class="num">${cad(sum(loans, l => Math.max(l.balance, 0)))}</td><td colspan="3"></td></tr>` : '';

  let panel = '';
  const sel = loans.find(l => l.id === state.loanSel);
  if (sel) {
    const reps = [...sel.reps].sort(byDateDesc('repaid_date'));
    const repRows = reps.map((r, i) => `<tr><td>${i + 1}</td><td>${fmtDate(r.repaid_date)}</td><td class="num fw-bold">${cad(r.amount)}</td>
      <td class="text-wrap">${esc(r.note || '')}</td>${actionBtns('loan_repayments', r.id, 'repayment')}</tr>`).join('');
    panel = `<div id="repayPanel">${tableCard(`Repayments from ${esc(sel.name)} <span class="small fw-normal text-gray-500">· balance ${cad(Math.max(sel.balance, 0))}</span>`,
      ['Sr.', 'Date', ['Amount', 'num'], 'Note', ['', 'actions']], repRows, '',
      `<div class="d-flex gap-2"><button class="btn btn-sm btn-gray-800" data-action="add-repayment" data-id="${sel.id}">${ICON.plus}Add Repayment</button>
       <button class="btn btn-sm btn-link text-gray-600" data-action="close-repay">Close</button></div>`)}</div>`;
  }

  const open = loans.filter(l => l.balance > 0);
  $('#view').innerHTML = `
    ${pageHead('Money Lent', 'Money given to others that needs to come back · all years', { label: 'Add Loan', action: 'add', attrs: 'data-table="loans"' })}
    <div class="row">
      ${statCard('Total lent', cad(sum(loans, 'amount')), `${loans.length} records`, ICON.user, 'secondary')}
      ${statCard('Returned', cad(sum(loans, 'returned')), `${loans.filter(l => l.status === 'Returned').length} fully returned`, ICON.check, 'success')}
      ${statCard('Outstanding', cad(sum(open, 'balance')), `${open.length} open · ${open.filter(l => l.overdue).length} overdue`, ICON.alert, 'danger')}
    </div>
    ${tableCard('Loans', ['Sr.', 'Name', 'Description', ['Amount', 'num'], ['Returned', 'num'], ['Balance', 'num'], 'Due date', 'Status', ['', 'actions']], rows, foot)}
    ${panel}`;
}

/* ════════════════════════════ Router ════════════════════════════ */

const ROUTES = { dashboard: renderDashboard, jobs: renderJobs, other: renderOther, bhaag: renderBhaag, india: renderIndia, lent: renderLent };
const currentRoute = () => {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES[r] ? r : 'dashboard';
};

function renderYearSelect() {
  const dates = [
    ...state.paystubs.map(p => p.pay_date), ...state.other_income.map(o => o.date_received),
    ...state.donations.map(d => d.donation_date), ...state.india_payments.map(p => p.payment_date),
    todayISO(),
  ];
  const years = [...new Set(dates.filter(Boolean).map(d => d.slice(0, 4)))].sort().reverse();
  if (state.year !== 'all' && !years.includes(state.year)) state.year = 'all';
  $('#yearSelect').innerHTML = `<option value="all">All years</option>${years.map(y => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('')}`;
}

function render() {
  destroyCharts();
  const route = currentRoute();
  document.querySelectorAll('#sideNav [data-route]').forEach(li => li.classList.toggle('active', li.dataset.route === route));
  renderYearSelect();
  ROUTES[route]();
}

/* ════════════════════════════ Events ════════════════════════════ */

function rowFor(table, id) { return state[table].find(r => r.id === Number(id)); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a !== 'signout') e.preventDefault();
  const { table, id } = el.dataset;

  if (a === 'add') {
    if (table === 'paystubs' && !state.jobs.length) return toast('Add a job first.', 'error');
    const defaults = table === 'paystubs' && state.jobFilter !== 'all' ? { job_id: state.jobFilter } : {};
    openForm(table, null, { defaults });
  } else if (a === 'edit') {
    openForm(table, rowFor(table, id));
  } else if (a === 'delete') {
    removeRow(table, Number(id), el.dataset.what);
  } else if (a === 'pick-job') {
    state.jobFilter = String(id);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (a === 'repayments') {
    state.loanSel = Number(id);
    render();
    $('#repayPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (a === 'close-repay') {
    state.loanSel = null;
    render();
  } else if (a === 'add-repayment') {
    const loan = rowFor('loans', id);
    const bal = loanSummary(loan).balance;
    openForm('loan_repayments', null, { extra: { loan_id: loan.id }, defaults: { amount: bal > 0 ? bal : null } });
  } else if (a === 'edit-pct') {
    const g = state.bhaagGroups[Number(el.dataset.idx)];
    openForm('bhaag_percent', { bhaag_percent: g.pctValue }, {
      async onSave({ bhaag_percent }) {
        for (const t of ['paystubs', 'other_income']) {
          const ids = g.entries.filter(x => x.table === t).map(x => x.id);
          if (!ids.length) continue;
          const { error } = await sb.from(t).update({ bhaag_percent }).in('id', ids);
          if (error) throw error;
          await load(t);
        }
      },
    });
    $('#formTitle').textContent = `Bhaag % – ${g.source} (${monthLabel(g.month)})`;
  } else if (a === 'signout') {
    sb.auth.signOut();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'yearSelect') { state.year = e.target.value; render(); }
  if (e.target.id === 'jobFilter') { state.jobFilter = e.target.value; render(); }
});

$('#entityForm').addEventListener('submit', submitForm);
$('#entityForm').addEventListener('input', e => {
  const cfg = formCtx && FORMS[formCtx.kind];
  cfg?.onInput?.(e.currentTarget.elements, e.target.name);
});

window.addEventListener('hashchange', () => {
  bootstrap.Collapse.getInstance($('#sidebarMenu'))?.hide();
  render();
  window.scrollTo(0, 0);
});

/* ════════════════════════════ Auth ════════════════════════════ */

function show(view) {
  ['loginView', 'appView', 'loadingView'].forEach(v => $('#' + v).classList.toggle('d-none', v !== view));
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#loginError');
  err.classList.add('d-none');
  $('#loginBtn').disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: $('#loginEmail').value.trim(), password: $('#loginPassword').value });
  $('#loginBtn').disabled = false;
  if (error) { err.textContent = error.message; err.classList.remove('d-none'); }
});

async function startApp(session) {
  if (state.user?.id === session.user.id) return; // already running (token refresh)
  state.user = session.user;
  show('loadingView');
  try {
    await loadAll();
    await seedJobsIfEmpty();
  } catch (err) {
    show('appView');
    $('#view').innerHTML = `<div class="alert alert-danger mt-4">Could not load data: ${esc(err.message)}.<br>Check that <code>supabase/schema.sql</code> has been run and <code>config.js</code> has the right project URL and key.</div>`;
    return;
  }
  const email = session.user.email || '';
  $('#userEmail').textContent = email;
  $('#mobileUserEmail').textContent = email;
  $('#userInitial').textContent = (email[0] || 'S').toUpperCase();
  show('appView');
  render();
}

function stopApp() {
  state.user = null;
  destroyCharts();
  Object.keys(TABLES).forEach(t => { state[t] = []; });
  show('loginView');
}

sb.auth.onAuthStateChange((_event, session) => {
  // Defer: Supabase recommends not calling other Supabase methods inside this callback.
  setTimeout(() => (session ? startApp(session) : stopApp()), 0);
});

/* ════════════════════════════ PWA ════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
