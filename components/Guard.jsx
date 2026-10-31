'use client';
import { useEffect } from 'react';

// ป้องกันการเปิดดูโค้ด/DevTools ฝั่งเบราว์เซอร์ (ทำงานเฉพาะ build production)
// หมายเหตุ: เป็นเพียงด่านชะลอ ไม่ใช่การป้องกันจริง 100% — ความปลอดภัยของคีย์ทั้งหมดตรวจที่เซิร์ฟเวอร์เสมอ
const LOCK = '<div style="position:fixed;inset:0;z-index:2147483647;background:#050506;color:#f5f5f7;display:grid;place-items:center;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><div style="font-size:44px">🔒</div><h1 style="font-size:20px;margin:14px 0 6px">ตรวจพบเครื่องมือนักพัฒนา</h1><p style="color:#9a9aa4;margin:0">ปิด DevTools แล้วหน้านี้จะโหลดใหม่อัตโนมัติ</p></div></div>';

export default function Guard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_GUARD === '0') return;
    const cleanups = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); cleanups.push(() => t.removeEventListener(ev, fn, opt)); };
    const elOf = (t) => (t && t.nodeType === 3 ? t.parentElement : t);
    const allowed = (t) => { const e = elOf(t); return !!(e && e.closest && e.closest('input,textarea,select,[contenteditable="true"],.allow-select')); };

    // 1) คีย์ลัด: ใช้ e.code เพื่อไม่ให้ขึ้นกับภาษาคีย์บอร์ด (เช่น แป้นพิมพ์ไทย)
    on(document, 'keydown', (e) => {
      const c = e.code, mod = e.ctrlKey || e.metaKey;
      const bad =
        c === 'F12' || c === 'ContextMenu' ||
        (mod && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyK', 'KeyE', 'KeyM'].includes(c)) ||
        (mod && e.altKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyU'].includes(c)) ||
        (mod && ['KeyU', 'KeyS'].includes(c));
      if (bad) { e.preventDefault(); e.stopImmediatePropagation(); return false; }
    }, true);

    // 2) คลิกขวา / เลือกข้อความ / ลากรูป (ยกเว้นช่องกรอกและกล่องคีย์ที่ให้คัดลอกได้)
    on(document, 'contextmenu', (e) => { if (!allowed(e.target)) e.preventDefault(); }, true);
    on(document, 'selectstart', (e) => { if (!allowed(e.target)) e.preventDefault(); }, true);
    on(document, 'dragstart', (e) => e.preventDefault(), true);

    // 3) ปิดเสียง console
    const real = { log: console.log.bind(console), clear: console.clear ? console.clear.bind(console) : () => {} };
    ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir', 'trace'].forEach((k) => { try { console[k] = () => {}; } catch {} });

    // 4) ตรวจจับ DevTools: จับเวลา debugger + ตัวหลอก getter ใน console
    let locked = false;
    const probe = () => {
      let open = false;
      const t0 = performance.now();
      try { (function () {}).constructor('debugger')(); } catch {}
      if (performance.now() - t0 > 120) open = true;
      if (!open) {
        const bait = new Image();
        Object.defineProperty(bait, 'id', { get() { open = true; return ''; } });
        real.log(bait);
        real.clear();
      }
      return open;
    };
    const timer = setInterval(() => {
      const open = probe();
      if (open && !locked) { locked = true; document.body.innerHTML = LOCK; }
      else if (!open && locked) location.reload();
    }, 1000);

    return () => { clearInterval(timer); cleanups.forEach((f) => f()); };
  }, []);
  return null;
}
