'use client';
import { useEffect, useState } from 'react';
import Icon from './Icons';

const pad = (n) => String(n).padStart(2, '0');

/** หน้าปฏิเสธการเข้าถึง + นับถอยหลังจนกว่าจะหมดโทษแบน */
export default function Denied({ until }) {
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const t = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    t();
    const i = setInterval(t, 1000);
    return () => clearInterval(i);
  }, [end]);
  const h = Math.floor((left || 0) / 3600), m = Math.floor(((left || 0) % 3600) / 60), s = (left || 0) % 60;
  return (
    <main className="denied">
      <div className="denied-card">
        <div className="denied-ic"><Icon n="ban" size={28} /></div>
        <h1>ปฏิเสธการเข้าถึง</h1>
        <p>พื้นที่นี้สำหรับผู้ดูแลเท่านั้น การเข้าถึงของคุณถูกบล็อกชั่วคราว</p>
        <div className="denied-t" role="timer"><span>{pad(h)}</span>:<span>{pad(m)}</span>:<span>{left === null ? '––' : pad(s)}</span></div>
        <small>เวลาที่เหลือก่อนปลดบล็อก</small>
        <a className="btn" href="/">กลับหน้าแรก</a>
      </div>
    </main>
  );
}
