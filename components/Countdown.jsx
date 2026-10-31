'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import Icon from './Icons';

const pad = (n) => String(n).padStart(2, '0');
export function parts(sec) {
  sec = Math.max(0, Math.floor(sec));
  return { d: Math.floor(sec / 86400), h: Math.floor((sec % 86400) / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

/** นาฬิกาเวลา: คืนเวลาปัจจุบัน (ms, ปรับตามเวลาเซิร์ฟเวอร์) อัปเดตทุกวินาที — null จนกว่าจะ mount (กัน hydration ไม่ตรง) */
export function useNow(offset = 0, on = true) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now() + offset);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [offset, on]);
  return now;
}

const tone = (status, left) => {
  if (status === 'revoked') return 'off';
  if (status === 'expired') return 'bad';
  if (status === 'unused') return 'idle';
  if (status === 'lifetime') return 'life';
  if (left <= 3600) return 'bad';
  if (left <= 86400) return 'warn';
  return 'ok';
};

/** ตัวนับเวลาถอยหลังแบบเต็ม (วัน : ชม. : นาที : วินาที + แถบความคืบหน้า) */
export default function Countdown({ status, expiresAt, duration = 0, offset = 0, onExpire, compact = false }) {
  const ticking = status === 'active';
  const now = useNow(offset, ticking);
  const fired = useRef(false);
  const exp = expiresAt ? new Date(expiresAt).getTime() : 0;
  const left = ticking && now ? Math.max(0, Math.floor((exp - now) / 1000)) : status === 'unused' ? Number(duration) : 0;

  useEffect(() => {
    if (ticking && now && exp - now <= 0 && !fired.current) { fired.current = true; onExpire?.(); }
  }, [ticking, now, exp, onExpire]);

  const t = tone(status, left);
  const lifetime = status === 'lifetime' || (status === 'unused' && Number(duration) === 0);
  const pct = ticking && duration > 0 && now ? Math.min(100, Math.max(0, (left / Number(duration)) * 100)) : status === 'unused' ? 100 : 0;
  const p = parts(left);
  const ready = !ticking || now !== null;
  const segs = [[ready ? String(p.d).padStart(2, '0') : '––', 'วัน'], [ready ? pad(p.h) : '––', 'ชม.'], [ready ? pad(p.m) : '––', 'นาที'], [ready ? pad(p.s) : '––', 'วินาที']];

  const caption = {
    active: 'เวลาที่เหลือ',
    unused: lifetime ? 'ตลอดชีพ · เริ่มนับเมื่อใช้งานครั้งแรก' : 'อายุคีย์ · เริ่มนับเมื่อใช้งานครั้งแรก',
    lifetime: 'ใช้งานได้ไม่จำกัดเวลา',
    expired: 'หมดอายุแล้ว',
    revoked: 'คีย์ถูกระงับการใช้งาน',
  }[status];

  return (
    <div className={`cd ${compact ? 'cd-compact' : ''}`} data-tone={t}>
      {lifetime ? (
        <div className="cd-life">
          <Icon n="infinity" size={compact ? 34 : 52} />
          <span>{status === 'unused' ? 'ตลอดชีพ' : 'ไม่มีวันหมดอายุ'}</span>
        </div>
      ) : (
        <div className="cd-row" role="timer" aria-label={caption}>
          {segs.map(([v, l], i) => (
            <Fragment key={l}>
              {i > 0 && <span className="cd-sep" aria-hidden="true">:</span>}
              <div className="cd-seg">
                <b key={l === 'วินาที' && ticking ? v : 'x'} className={l === 'วินาที' && ticking ? 'tick' : ''}>{v}</b>
                <i>{l}</i>
              </div>
            </Fragment>
          ))}
        </div>
      )}
      <div className="cd-bar" aria-hidden="true"><span style={{ width: `${lifetime ? 100 : pct}%` }} /></div>
      <div className="cd-cap">{caption}</div>
    </div>
  );
}

/** เวลาถอยหลังแบบบรรทัดเดียว (ใช้ในตาราง/การ์ดเล็ก) */
export function MiniCountdown({ status, expiresAt, duration = 0, offset = 0 }) {
  const ticking = status === 'active';
  const now = useNow(offset, ticking);
  if (status === 'lifetime') return <span className="mc" data-tone="life">∞ ตลอดชีพ</span>;
  if (status === 'revoked') return <span className="mc" data-tone="off">ระงับ</span>;
  if (status === 'expired') return <span className="mc" data-tone="bad">หมดอายุ</span>;
  if (status === 'unused') return <span className="mc" data-tone="idle">{Number(duration) ? fmtShort(Number(duration)) : '∞'} · รอเริ่ม</span>;
  const left = now ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
  if (left === null) return <span className="mc" data-tone="ok">––</span>;
  return <span className="mc" data-tone={tone('active', left)}>{fmtShort(left, true)}</span>;
}

export function fmtShort(sec, clock = false) {
  const p = parts(sec);
  if (clock) return `${p.d ? p.d + 'd ' : ''}${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
  if (p.d) return `${p.d} วัน${p.h ? ` ${p.h} ชม.` : ''}`;
  if (p.h) return `${p.h} ชม.${p.m ? ` ${p.m} น.` : ''}`;
  return `${p.m || 0} นาที`;
}

/** นับถอยหลังถึงเวลาที่กำหนด (ใช้บอกว่าอีกนานเท่าไหร่จึงรีเซ็ตได้) */
export function Until({ at, offset = 0, prefix = '' }) {
  const now = useNow(offset, !!at);
  if (!at || !now) return null;
  const left = Math.max(0, Math.ceil((new Date(at).getTime() - now) / 1000));
  if (!left) return null;
  const p = parts(left);
  return <>{prefix}{p.d ? `${p.d} วัน ` : ''}{p.h ? `${p.h} ชม. ` : ''}{p.m ? `${p.m} นาที` : p.d || p.h ? '' : `${p.s} วินาที`}</>;
}
