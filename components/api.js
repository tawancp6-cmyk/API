export async function api(url, method = 'GET', data, timeoutMs = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctl.signal,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้าเกินไป กรุณาลองใหม่' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
  } finally {
    clearTimeout(timer);
  }
  let out = {};
  try { out = await res.json(); } catch {}
  if (!res.ok) {
    const e = new Error(out.error || out.message || 'เกิดข้อผิดพลาด');
    e.status = res.status;
    throw e;
  }
  return out;
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }) : '—');
