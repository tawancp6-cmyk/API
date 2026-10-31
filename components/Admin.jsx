'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from './Icons';
import { AdminCtx } from './admin/ctx';
import Keys from './admin/Keys';
import Users, { UserModal } from './admin/Users';
import Settings from './admin/Settings';
import KeyDetail from './admin/KeyDetail';

const TABS = [['keys', 'คีย์', 'key', Keys], ['users', 'ผู้ใช้', 'users', Users], ['settings', 'ตั้งค่า', 'sliders', Settings]];

export default function Admin({ serverTime }) {
  const [tab, setTab] = useState('keys');
  const [keyId, setKeyId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [tick, setTick] = useState(0); // รีเฟรชรายการหลังแก้ไขในหน้าต่างรายละเอียด
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(serverTime - Date.now());
    const h = location.hash.slice(1);
    if (TABS.some((t) => t[0] === h)) setTab(h);
  }, [serverTime]);
  const go = (t) => { setTab(t); history.replaceState(null, '', '#' + t); };

  const ctx = useMemo(() => ({ openKey: setKeyId, openUser: setUserId, offset }), [offset]);
  const closeKey = useCallback(() => setKeyId(null), []);
  const closeUser = useCallback(() => setUserId(null), []);
  const Cur = TABS.find((t) => t[0] === tab)[3];

  return (
    <AdminCtx.Provider value={ctx}>
      <div className="adm">
        <header className="adm-h">
          <h1><Icon n="crown" size={22} />หลังบ้าน</h1>
          <Link className="btn btn-sm" href="/dashboard"><Icon n="key" size={15} />คีย์ของฉัน</Link>
        </header>
        <nav className="tabs" role="tablist">
          {TABS.map(([k, l, ic]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><Icon n={ic} size={16} /><span>{l}</span></button>
          ))}
        </nav>
        <div className="adm-body" key={tab + tick}><Cur /></div>
      </div>
      {keyId && <KeyDetail id={keyId} onClose={closeKey} onChanged={() => setTick((t) => t + 1)} />}
      {userId && <UserModal id={userId} onClose={closeUser} />}
    </AdminCtx.Provider>
  );
}
