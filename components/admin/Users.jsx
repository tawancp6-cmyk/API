'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDay } from '../api';
import Icon from '../Icons';
import { MiniCountdown } from '../Countdown';
import ProfileCard, { Avatar } from '../ProfileCard';
import { Empty, Modal, Spinner, StatusBadge, useToast } from '../ui';
import { useAdmin } from './ctx';

export function UserModal({ id, onClose }) {
  const toast = useToast();
  const { openKey, offset } = useAdmin();
  const [d, setD] = useState(null);
  const load = useCallback(async () => {
    try { setD(await api(`/api/admin/users/${id}`)); } catch (e) { toast(e.message, 'err'); onClose(); }
  }, [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  const ban = async (a) => { try { await api(`/api/admin/users/${id}/${a}`, 'PUT'); toast(a === 'ban' ? 'ระงับผู้ใช้แล้ว' : 'ปลดระงับแล้ว'); load(); } catch (e) { toast(e.message, 'err'); } };

  return (
    <Modal open onClose={onClose} title="โปรไฟล์ผู้ใช้" wide>
      {!d ? <div className="loading"><Spinner size={22} /></div> : (
        <div className="ud">
          <ProfileCard p={d.profile} badges={[...(d.profile.banned ? [{ t: 'ถูกระงับ', tone: 'bad', i: 'ban' }] : []), ...(d.registered ? [] : [{ t: 'ยังไม่เคยล็อกอินเว็บ', tone: 'idle' }])]}>
            <div className="tiles">
              <div className="tile"><span>คีย์ทั้งหมด</span><b>{d.stats.total}</b></div>
              <div className="tile tile-ok"><span>ใช้งานได้</span><b>{d.stats.active}</b></div>
              <div className="tile"><span>หมดอายุ/ระงับ</span><b>{d.stats.expired + d.stats.revoked}</b></div>
            </div>
            {d.registered && (d.profile.banned
              ? <button className="btn btn-sm" onClick={() => ban('unban')}>ปลดระงับผู้ใช้</button>
              : <button className="btn btn-sm btn-danger" onClick={() => ban('ban')}><Icon n="ban" size={14} />ระงับผู้ใช้</button>)}
          </ProfileCard>
          <h4>คีย์ของผู้ใช้</h4>
          {d.keys.length === 0 ? <Empty icon="key" title="ยังไม่มีคีย์" /> : (
            <ul className="mini-list">
              {d.keys.map((k) => (
                <li key={k.id}><button className="row-btn" onClick={() => openKey(k.id)}><code>{k.key}</code><StatusBadge status={k.status} /><MiniCountdown status={k.status} expiresAt={k.expires_at} duration={k.duration_seconds} offset={offset} /></button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const { openUser } = useAdmin();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [byId, setById] = useState('');

  useEffect(() => {
    const t = setTimeout(() => api(`/api/admin/users?q=${encodeURIComponent(q)}`).then((r) => setRows(r.rows)).catch((e) => toast(e.message, 'err')), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, toast]);

  return (
    <div>
      <div className="bar-tools">
        <div className="search"><Icon n="search" size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / username / Discord ID" /></div>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (/^\d{15,25}$/.test(byId)) openUser(byId); else toast('Discord ID ต้องเป็นตัวเลข 15–25 หลัก', 'err'); }}>
          <input className="input mono" value={byId} onChange={(e) => setById(e.target.value.trim())} placeholder="เปิดโปรไฟล์ด้วย Discord ID" />
          <button className="btn btn-sm">เปิด</button>
        </form>
      </div>
      {rows === null ? <div className="loading"><Spinner size={22} /></div> : rows.length === 0 ? <Empty icon="users" title="ไม่พบผู้ใช้" /> : (
        <div className="ugrid">
          {rows.map((u) => (
            <button key={u.id} className="ucard" onClick={() => openUser(u.id)}>
              <Avatar p={u} size={48} />
              <div><b>{u.name}</b><small>@{u.username || u.id}</small><small>ล็อกอินล่าสุด {fmtDay(u.last_login_at)}</small></div>
              <span className="ucard-n"><Icon n="key" size={13} />{u.key_count}</span>
              {u.banned && <span className="badge badge-bad"><i />ระงับ</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
