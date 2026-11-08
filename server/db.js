// server/db.js - PostgreSQL connection pool + startup migration
'use strict';

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[db] DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Apply server/schema.sql. Retries while Postgres is still starting up so the
// app container can boot alongside the database container.
async function migrate({ attempts = 20, delayMs = 1500 } = {}) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query(sql);
      console.log('[db] Schema is up to date.');
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[db] Not ready (attempt ${i}/${attempts}): ${err.message}`);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function insertGeneration(rec) {
  await pool.query(
    `insert into generations
       (page, type, student_name, usn, subject, subject_code, topic, semester, section, branch, email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [rec.page, rec.type, rec.student_name, rec.usn, rec.subject, rec.subject_code,
     rec.topic, rec.semester, rec.section, rec.branch, rec.email]
  );
}

async function listGenerations(limit) {
  const { rows } = await pool.query(
    `select id, created_at, page, type, student_name, usn, subject, subject_code,
            topic, semester, section, branch, email
       from generations
      order by created_at desc, id desc
      limit $1`,
    [limit]
  );
  return rows;
}

async function ping() {
  await pool.query('select 1');
}

module.exports = { pool, migrate, insertGeneration, listGenerations, ping };
