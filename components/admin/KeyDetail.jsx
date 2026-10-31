'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import Icon from '../Icons';
import Countdown from '../Countdown';
import { Avatar, RobloxChip } from '../ProfileCard';
import { CopyBtn, Modal, Spinner, StatusBadge, useToast } from '../ui';
import Confirm from './Confirm';
import { ACTION_TH, ACTION_TONE, useAdmin } from './ctx';

const Row = ({ ic, label, children }) => (
  <div className="kd-row"><span><Icon n={ic} size={15} />{label}</span><b>{children}</b></div>
);

const TABS = [['ov', 'ภาพรวม'], ['manage', 'จัดการ'], ['logs', 'ประวัติ']];

export default function KeyDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { openUser, offset } = useAdmin();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('ov');
  const [days, setDays] = useState('7');
  const [owner, setOwner] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api(`/api/admin/keys/${id}`); setD(r); setOwner(r.key.discord_id || ''); setNote(r.key.note || ''); }
    catch (e) { toast(e.message, 'err'); onClose(); }
  }, [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);

  const act = async (a, body, msg) => {
    setBusy(true);
    try {
      const r = await api(`/api/admin/keys/${id}/${a}`, 'PUT', body);
      toast(r.key ? `คีย์ใหม่: ${r.key} · ผู้เล่นที่ใช้คีย์เก่าจะถูกเตะออกจากเกม` : msg || 'สำเร็จ');
      await load(); onChanged?.();
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    try { await api(`/api/admin/keys/${id}`, 'DELETE'); toast('ลบคีย์แล้ว · ผู้เล่นในเกมจะถูกเตะภายใน ~10 วินาที'); onChanged?.(); onClose(); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };

  const k = d?.key;
  const revoked = k?.status === 'revoked';
  return (
    <Modal open onClose={onClose} title="รายละเอียดคีย์" wide>
      {!k ? <div className="loading"><Spinner size={22} /></div> : (
        <div className="kd">
          <div className="kd-top">
            <div className="kd-top-l">
              <small>{k.label || 'คีย์'}</small>
              <div className="kd-key allow-select">{k.key}</div>
              <div className="kd-tools"><StatusBadge status={k.status} /><CopyBtn text={k.key} label="คัดลอกคีย์" /></div>
            </div>
            <Countdown status={k.status} expiresAt={k.expires_at} duration={k.duration_seconds} offset={offset} />
          </div>

          <div className="seg kd-tabs" role="tablist">
            {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}{v === 'logs' ? ` (${d.logs.length})` : ''}</button>)}
          </div>

          {tab === 'ov' && (
            <div className="kd-pane">
              <div className={`kd-two ${k.roblox ? '' : 'kd-one'}`}>
                <section className="kd-card">
                  <div className="kd-card-h">
                    <h4><Icon n="cpu" size={16} />HWID (รหัสเครื่อง)</h4>
                    <span className={`kd-pill ${k.hwid ? 'on' : ''}`}>{k.hwid ? 'ผูกเครื่องแล้ว' : k.hwid_locked ? 'ยังไม่ผูก' : 'ไม่ล็อกเครื่อง'}</span>
                  </div>
                  {k.hwid
                    ? <div className="kd-hw-box"><code className="allow-select">{k.hwid}</code><CopyBtn text={k.hwid} label="" /></div>
                    : <div className="kd-hw-box kd-hw-empty">{k.hwid_locked ? 'จะผูกเครื่องอัตโนมัติเมื่อใช้คีย์ครั้งแรก' : 'คีย์นี้ไม่ล็อกเครื่อง ใช้ได้ทุกเครื่อง'}</div>}
                  <div className="kd-card-f">
                    <small className="dim">{k.hwid_bound_at ? `ผูกเมื่อ ${fmtDate(k.hwid_bound_at)}` : 'ยังไม่มีการผูกเครื่อง'}{k.last_ip ? ` · IP ${k.last_ip}` : ''}</small>
                    <button className="btn btn-sm" disabled={busy || !k.hwid} onClick={() => act('reset-hwid', null, 'รีเซ็ต HWID แล้ว')}><Icon n="refresh" size={14} />รีเซ็ต HWID</button>
                  </div>
                </section>
                {k.roblox && (
                  <section className="kd-card">
                    <div className="kd-card-h"><h4><Icon n="user" size={16} />โปรไฟล์ Roblox</h4></div>
                    <RobloxChip r={k.roblox} />
                  </section>
                )}
              </div>
              <div className="kd-rows">
                <Row ic="clock" label="เริ่มใช้งาน">{k.activated_at ? fmtDate(k.activated_at) : 'ยังไม่เริ่ม'}</Row>
                <Row ic="timer" label="หมดอายุ">{k.lifetime ? 'ไม่มีวันหมดอายุ' : k.expires_at ? fmtDate(k.expires_at) : 'หลังใช้ครั้งแรก'}</Row>
                <Row ic="activity" label="ใช้งานล่าสุด">{k.last_check_at ? fmtDate(k.last_check_at) : '—'}</Row>
                <Row ic="shieldCheck" label="จำนวนครั้งที่ตรวจ">{k.uses.toLocaleString('th-TH')}</Row>
                <Row ic="refresh" label="รีเซ็ต HWID / รีคีย์">{k.hwid_resets} / {k.rekeys} ครั้ง</Row>
                <Row ic="plus" label="สร้างเมื่อ">{fmtDate(k.created_at)}</Row>
              </div>
            </div>
          )}

          {tab === 'manage' && (
            <div className="kd-pane">
              <section className="kd-card">
                <div className="kd-card-h"><h4><Icon n="sliders" size={16} />คำสั่ง</h4></div>
                <div className="kd-act">
                  <button className="btn" disabled={busy} onClick={() => act('reset-hwid-quota', null, 'รีเซ็ต HWID และคืนโควต้าแล้ว')}><Icon n="gift" size={16} />รีเซ็ต + คืนโควต้า</button>
                  <button className="btn" disabled={busy} onClick={() => act('rekey', null)}><Icon n="shuffle" size={16} />รีคีย์</button>
                  <button className={`btn ${revoked ? '' : 'btn-warn'}`} disabled={busy} onClick={() => act(revoked ? 'unrevoke' : 'revoke', null, revoked ? 'ปลดระงับแล้ว' : 'ระงับแล้ว · ผู้เล่นในเกมจะถูกเตะภายใน ~10 วินาที')}><Icon n="ban" size={16} />{revoked ? 'ปลดระงับ' : 'ระงับ'}</button>
                  <button className="btn btn-danger" disabled={busy} onClick={() => setDel(true)}><Icon n="trash" size={16} />ลบคีย์</button>
                </div>
                <p className="hint">ระงับ ลบ หรือรีคีย์ จะเตะผู้เล่นที่ใช้คีย์นี้อยู่ในเกมภายใน ~10 วินาที</p>
              </section>

              {!k.lifetime && (
                <section className="kd-card">
                  <div className="kd-card-h"><h4><Icon n="clock" size={16} />เพิ่ม / ลดเวลา (วัน)</h4></div>
                  <div className="chips">
                    {[1, 7, 30].map((n) => <button type="button" key={n} className="chip" onClick={() => setDays(String(n))}>+{n} วัน</button>)}
                    <button type="button" className="chip" onClick={() => setDays('-1')}>−1 วัน</button>
                  </div>
                  <div className="inline-form">
                    <input className="input" type="number" step="0.5" value={days} onChange={(e) => setDays(e.target.value)} aria-label="จำนวนวัน" />
                    <button className="btn btn-primary" disabled={busy || !Number(days)} onClick={() => act('extend', { days: Number(days) }, 'ปรับเวลาแล้ว')}>ปรับเวลา</button>
                  </div>
                </section>
              )}

              <section className="kd-card">
                <div className="kd-card-h"><h4><Icon n="user" size={16} />เจ้าของ (Discord) และโน้ต</h4></div>
                {k.owner
                  ? <button className="owner owner-lg" onClick={() => openUser(k.owner.id)}><Avatar p={k.owner} size={40} /><span><b>{k.owner.name}</b><small>ID {k.owner.id} · ดูโปรไฟล์</small></span></button>
                  : <p className="dim">ไม่ได้ผูกบัญชี Discord (ไม่จำเป็นต้องผูก)</p>}
                <div className="inline-form">
                  <input className="input" value={owner} onChange={(e) => setOwner(e.target.value.trim())} placeholder="Discord ID (เว้นว่าง = ปลดเจ้าของ)" />
                  <button className="btn btn-sm" disabled={busy} onClick={() => act('assign', { discordId: owner }, 'เปลี่ยนเจ้าของแล้ว')}>บันทึก</button>
                </div>
                <div className="inline-form">
                  <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="โน้ต" />
                  <button className="btn btn-sm" disabled={busy} onClick={() => act('note', { note }, 'บันทึกโน้ตแล้ว')}>บันทึก</button>
                </div>
              </section>
            </div>
          )}

          {tab === 'logs' && (
            <div className="kd-pane">
              {d.logs.length === 0 ? <p className="dim kd-none">ยังไม่มีประวัติ</p> : (
                <ol className="kd-logs">
                  {d.logs.map((l) => (
                    <li key={l.id} className={`kd-log kd-log-${ACTION_TONE[l.action] || 'idle'}`}>
                      <i aria-hidden="true" />
                      <div>
                        <div className="kd-log-h"><b>{ACTION_TH[l.action] || l.action}</b><time>{fmtDate(l.at)}</time></div>
                        {l.detail && <div className="kd-log-b">{l.detail}</div>}
                        <small className="dim">{l.actor}{l.ip ? ` · ${l.ip}` : ''}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
      <Confirm open={del} danger yes="ลบถาวร" busy={busy} onNo={() => setDel(false)} onYes={remove} title="ลบคีย์นี้?"><p>ลบแล้วกู้คืนไม่ได้ ผู้เล่นที่กำลังใช้คีย์นี้อยู่ในเกมจะ<b>ถูกเตะออกทันที</b> (ภายใน ~10 วินาที)</p></Confirm>
    </Modal>
  );
}
