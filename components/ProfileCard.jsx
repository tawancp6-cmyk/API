'use client';
import { useState } from 'react';
import { fmtDay } from './api';
import Icon from './Icons';
import { CopyBtn } from './ui';

/** รูปโปรไฟล์ Discord + กรอบโปรไฟล์ (avatar decoration) */
export function Avatar({ p, size = 44 }) {
  const [bad, setBad] = useState(false);
  if (!p) return null;
  return (
    <span className="av" style={{ width: size, height: size }}>
      {p.avatar && !bad ? <img className="av-img" src={p.avatar} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} /> : <span className="av-img av-ph" />}
      {p.decoration && !bad && <img className="av-deco" src={p.decoration} alt="" referrerPolicy="no-referrer" loading="lazy" />}
    </span>
  );
}

/** โปรไฟล์ Roblox ที่ผูกกับคีย์ (ส่งมาจากสคริปต์ตอนตรวจคีย์) — ไม่มีข้อมูลจะแสดงกล่องว่าง */
export function RobloxChip({ r, empty = false }) {
  if (!r) {
    if (!empty) return null;
    return (
      <div className="rbx rbx-empty">
        <span className="rbx-ph"><Icon n="user" size={18} /></span>
        <span><b>โปรไฟล์ Roblox</b><small>จะแสดงหลังเปิดสคริปต์ครั้งแรก</small></span>
      </div>
    );
  }
  return (
    <a className="rbx" href={r.profile_url} target="_blank" rel="noreferrer noopener">
      {r.avatar ? <img src={r.avatar} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="rbx-ph"><Icon n="user" size={18} /></span>}
      <span><b>{r.display_name || r.name}</b><small>@{r.name} · Roblox</small></span>
      <Icon n="external" size={14} />
    </a>
  );
}

/** การ์ดโปรไฟล์ Discord: แบนเนอร์ + รูป + กรอบ + ข้อมูล */
export default function ProfileCard({ p, badges = [], meta = false, children }) {
  if (!p) return null;
  return (
    <section className="pf">
      <div className="pf-banner" style={p.accent && !p.banner ? { background: `linear-gradient(120deg, ${p.accent}55, #0d0d10 70%)` } : undefined}>
        {p.banner && <img src={p.banner} alt="" referrerPolicy="no-referrer" />}
      </div>
      <div className="pf-body">
        <div className="pf-av"><Avatar p={p} size={84} /></div>
        <div className="pf-main">
          <div className="pf-name">
            <h2>{p.name}</h2>
            {badges.map((b) => <span key={b.t} className={`badge badge-${b.tone || 'idle'}`}>{b.i && <Icon n={b.i} size={12} />}{b.t}</span>)}
          </div>
          <div className="pf-sub">
            {p.username && <span>@{p.username}</span>}
            <span className="pf-id allow-select">{p.id}</span>
            <CopyBtn text={p.id} label="" className="pf-copy" size={13} />
          </div>
          {meta && (
            <dl className="pf-meta">
              <div><dt>สร้างบัญชี Discord</dt><dd>{fmtDay(p.discord_created_at)}</dd></div>
              {p.last_login_at && <div><dt>ล็อกอินล่าสุด</dt><dd>{fmtDay(p.last_login_at)}</dd></div>}
            </dl>
          )}
        </div>
        {children && <div className="pf-side">{children}</div>}
      </div>
    </section>
  );
}
