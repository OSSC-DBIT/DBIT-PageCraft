// server/validate.js - whitelist + length validation for analytics records
'use strict';

const PAGES = new Set(['front-page', 'project-report']);
const TYPES = new Set([
  'PDF', 'PNG', 'MERGE', 'DOC', 'DOCX',
  'REPORT_PDF', 'REPORT_MERGE', 'REPORT_DOC', 'REPORT_DOCX',
]);

// Column name -> max length (must match server/schema.sql)
const TEXT_FIELDS = {
  student_name: 200,
  usn:          64,
  subject:      300,
  subject_code: 64,
  topic:        300,
  semester:     64,
  section:      32,
  branch:       200,
  email:        254,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Collapse whitespace, strip control characters, clamp length.
function cleanText(value, max) {
  if (value == null) return '';
  let s = String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

// Returns { ok: true, record } or { ok: false, error }.
function validateGeneration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const page = cleanText(body.page, 32);
  const type = cleanText(body.type, 32);
  if (!PAGES.has(page)) return { ok: false, error: 'Invalid page' };
  if (!TYPES.has(type)) return { ok: false, error: 'Invalid type' };

  const record = { page, type };
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    record[field] = cleanText(body[field], max);
  }
  if (record.email && !EMAIL_RE.test(record.email)) record.email = '';
  record.email = record.email.toLowerCase();

  return { ok: true, record };
}

module.exports = { validateGeneration, PAGES, TYPES };
