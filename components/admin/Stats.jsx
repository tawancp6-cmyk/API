'use client';
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Stats({ refresh = 0 }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('/api/admin/stats').then(setS).catch(() => {}); }, [refresh]);
  const items = [['ทั้งหมด', s?.total, ''], ['ใช้งานได้', s?.active, 'ok'], ['ยังไม่เริ่มใช้', s?.unused, ''], ['หมดอายุ', s?.expired, 'bad']];
  return (
    <div className="tiles tiles-4">
      {items.map(([l, v, tone]) => (
        <div key={l} className={`tile ${tone ? 'tile-' + tone : ''}`}><span>{l}</span><b>{v == null ? '–' : Number(v).toLocaleString('th-TH')}</b></div>
      ))}
    </div>
  );
}
