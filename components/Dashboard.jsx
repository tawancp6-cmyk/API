'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from './api';
import Icon from './Icons';
import { MiniCountdown } from './Countdown';
import KeyPass from './KeyPass';
import ProfileCard from './ProfileCard';
import { Empty, Spinner, useToast } from './ui';

const RANK = { active: 0, lifetime: 1, unused: 2, expired: 3, revoked: 4 };

export default function Dashboard({ initial, adminPath }) {
  const toast = useToast();
  const [data, setData] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [claim, setClaim] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setOffset(data.server_time - Date.now()); }, [data.server_time]);

  const refresh = useCallback(async () => {
    try { setData(await api('/api/me')); } catch (e) { if (e.status === 401) location.href = '/'; }
  }, []);

  // ซิงก์สถานะอัตโนมัติ (เช่น สคริปต์เพิ่งผูกเครื่อง/ส่งโปรไฟล์ Roblox มา) ทุก 30 วินาทีตอนเปิดหน้าอยู่
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const submitClaim = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/me/keys', 'POST', { key: claim.trim().toUpperCase() });
      setClaim('');
      toast('ผูกคีย์กับบัญชีของคุณแล้ว');
      await refresh();
    } catch (er) { toast(er.message, 'err'); }
    setBusy(false);
  };

  const { user, keys, stats } = data;
  const list = [...keys].sort((a, b) => (RANK[a.status] - RANK[b.status]) || (new Date(a.expires_at || 8e15) - new Date(b.expires_at || 8e15)));
  const badges = user.role === 'admin' ? [{ t: 'แอดมิน', tone: 'idle', i: 'crown' }] : [];

  return (
    <div className="page">
      <ProfileCard p={user} badges={badges}>
        <div className="tiles">
          <div className="tile"><span>คีย์ทั้งหมด</span><b>{stats.total}</b></div>
          <div className="tile tile-ok"><span>ใช้งานได้</span><b>{stats.active}</b></div>
          <div className="tile"><span>หมดอายุถัดไป</span><b className="tile-t">{stats.next_expiry ? <MiniCountdown status="active" expiresAt={stats.next_expiry} offset={offset} /> : '—'}</b></div>
        </div>
        {user.role === 'admin' && adminPath && <Link className="btn btn-sm" href={`/${adminPath}`}><Icon n="crown" size={15} />เปิดหลังบ้าน</Link>}
      </ProfileCard>

      <form className="claim" onSubmit={submitClaim}>
        <div className="claim-t"><Icon n="key" size={20} /><div><b>ผูกคีย์กับบัญชีนี้</b><span>คีย์ต้องผูกกับ Discord ของคุณก่อน สคริปต์ถึงจะใช้ผ่าน</span></div></div>
        <div className="claim-f">
          <input className="input mono" value={claim} onChange={(e) => setClaim(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="NEXUSHUBX-XXXX-XXXX-XXXX" maxLength={30} spellCheck={false} autoComplete="off" />
          <button className="btn btn-primary" disabled={busy || !claim}>{busy ? <Spinner /> : <Icon n="plus" size={16} />}ผูกคีย์</button>
        </div>
      </form>

      <div className="sec-h"><h2>คีย์ของฉัน</h2></div>
      {list.length === 0 ? (
        <Empty icon="key" title="ยังไม่มีคีย์ในบัญชีนี้">กรอกคีย์ที่ได้รับด้านบน หรือติดต่อแอดมินเพื่อรับคีย์</Empty>
      ) : (
        <div className="pass-list">{list.map((k) => <KeyPass key={k.id} k={k} offset={offset} onChanged={refresh} />)}</div>
      )}
    </div>
  );
}
