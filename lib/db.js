import pg from 'pg';
import { ensureSchema } from './schema';

const { Pool, types } = pg;
// bigint (int8) -> number
types.setTypeParser(20, (v) => parseInt(v, 10));

const g = globalThis;

function getPool() {
  if (!g.__dhPool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new HttpError(500, 'ยังไม่ได้ตั้งค่า DATABASE_URL');
    g.__dhPool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      query_timeout: 15000, // ไม่ให้คำขอค้างไม่รู้จบ — หมดเวลาแล้วตอบ error ให้หน้าเว็บแสดงปุ่มลองใหม่
      statement_timeout: 15000,
      keepAlive: true,
    });
    g.__dhPool.on('error', (e) => console.error('pg pool error', e.message));
  }
  return g.__dhPool;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function ready() {
  if (!g.__dhReady) {
    g.__dhReady = ensureSchema(getPool()).catch((e) => {
      g.__dhReady = null; // ลองใหม่ได้ในคำขอถัดไป
      throw e;
    });
  }
  return g.__dhReady;
}

export async function q(text, params = []) {
  await ready();
  return getPool().query(text, params);
}

export async function one(text, params = []) {
  const r = await q(text, params);
  return r.rows[0] || null;
}

export async function tx(fn) {
  await ready();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
