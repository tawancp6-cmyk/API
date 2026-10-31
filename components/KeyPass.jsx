'use client';
import { useState } from 'react';
import { api, fmtDate } from './api';
import Icon from './Icons';
import Countdown, { Until } from './Countdown';
import { RobloxChip } from './ProfileCard';
import { CopyBtn, Modal, Spinner, StatusBadge, useToast } from './ui';

const mask = (k) => k.replace(/^([A-Z0-9]+)-.{4}-.{4}-(.{4})$/, '$1-••••-••••-$2');

/** การ์ดคีย์ของผู้ใช้: คีย์ + เวลาที่เหลือ + HWID + โปรไฟล์ Roblox + รีเซ็ต HWID / รีคีย์ */
export default function KeyPass({ k, offset, onChanged }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [ask, setAsk] = useState(null); // 'reset' | 'rekey'
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // คีย์ใหม่หลังรีคีย์
  const lim = k.limits;

  const run = async () => {
    setBusy(true);
    try {
      const r = await api(`/api/me/keys/${k.id}`, 'PUT', { action: ask === 'reset' ? 'reset-hwid' : 'rekey' });
      if (ask === 'rekey') setFresh(r.key);
      else toast('รีเซ็ต HWID แล้ว — ผูกเครื่องใหม่ตอนใช้งานครั้งถัดไป');
      setAsk(null);
      await onChanged();
    } catch (e) { toast(e.message, 'err'); setAsk(null); }
    setBusy(false);
  };

  const note = (l) => (l?.allowed ? (l.left != null ? `เหลือสิทธิ์ ${l.left}/${l.max} ครั้ง` : '') : l?.reason === 'cooldown' ? <>รออีก <Until at={l.next_at} offset={offset} /></> : l?.reason);

  return (
    <article className={`pass pass-${k.status}`}>
      <header className="pass-h">
        <div>
          <div className="pass-label">{k.label || 'คีย์'}</div>
          <div className="pass-key allow-select">{show ? k.key : mask(k.key)}</div>
          <div className="pass-tools">
            <button className="btn btn-ghost btn-sm" onClick={() => setShow((v) => !v)}><Icon n={show ? 'eyeOff' : 'eye'} size={15} />{show ? 'ซ่อน' : 'แสดง'}</button>
            <CopyBtn text={k.key} />
          </div>
        </div>
        <StatusBadge status={k.status} />
      </header>

      <Countdown status={k.status} expiresAt={k.expires_at} duration={k.duration_seconds} offset={offset} onExpire={onChanged} />

      <div className="pass-grid">
        <div className="hwbox">
          <small>HWID · รหัสเครื่อง</small>
          <div className="hw"><Icon n="cpu" size={15} />{k.hwid_bound ? <code title={k.hwid}>{k.hwid}</code> : <span className="dim">{k.hwid_locked ? 'ยังไม่ผูกเครื่อง' : 'ไม่ล็อกเครื่อง'}</span>}</div>
        </div>
        <RobloxChip r={k.roblox} empty />
      </div>

      <dl className="pass-meta">
        <div><dt>เริ่มใช้งาน</dt><dd>{k.activated_at ? fmtDate(k.activated_at) : 'ยังไม่เริ่ม'}</dd></div>
        <div><dt>หมดอายุ</dt><dd>{k.lifetime ? 'ไม่มีวันหมดอายุ' : k.expires_at ? fmtDate(k.expires_at) : 'หลังใช้ครั้งแรก'}</dd></div>
      </dl>

      <div className="pass-act">
        <div>
          <button className="btn" disabled={!lim?.reset.allowed} onClick={() => setAsk('reset')}><Icon n="refresh" size={16} />รีเซ็ต HWID</button>
          <small className="hint">{note(lim?.reset)}</small>
        </div>
        <div>
          <button className="btn" disabled={!lim?.rekey.allowed} onClick={() => setAsk('rekey')}><Icon n="shuffle" size={16} />รีคีย์</button>
          <small className="hint">{note(lim?.rekey)}</small>
        </div>
      </div>

      <Modal
        open={!!ask}
        onClose={() => !busy && setAsk(null)}
        title={ask === 'reset' ? 'รีเซ็ต HWID?' : 'รีคีย์ (ออกรหัสคีย์ใหม่)?'}
        footer={<>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setAsk(null)}>ยกเลิก</button>
          <button className="btn btn-primary" disabled={busy} onClick={run}>{busy && <Spinner />}ยืนยัน</button>
        </>}
      >
        {ask === 'reset' ? (
          <p>ระบบจะล้างเครื่องที่ผูกกับคีย์นี้ แล้วผูกเครื่องใหม่อัตโนมัติเมื่อคุณใช้งานครั้งถัดไป{lim?.reset.left != null && <> · เหลือสิทธิ์ <b>{lim.reset.left}</b> ครั้ง</>}</p>
        ) : (
          <p>รหัสคีย์เดิมจะใช้ไม่ได้ทันที และคุณจะได้รหัสใหม่ที่มีเวลาเหลือเท่าเดิม (HWID จะถูกล้างด้วย){lim?.rekey.left != null && <> · เหลือสิทธิ์ <b>{lim.rekey.left}</b> ครั้ง</>}</p>
        )}
      </Modal>

      <Modal open={!!fresh} onClose={() => setFresh(null)} title="คีย์ใหม่ของคุณ" footer={<button className="btn btn-primary" onClick={() => setFresh(null)}>เรียบร้อย</button>}>
        <p>คัดลอกเก็บไว้ได้เลย รหัสเดิมใช้ไม่ได้แล้ว</p>
        <div className="keybox allow-select">{fresh}</div>
        <CopyBtn text={fresh || ''} label="คัดลอกคีย์ใหม่" className="btn-primary" />
      </Modal>
    </article>
  );
}
