'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import Icon from '../Icons';
import { MiniCountdown } from '../Countdown';
import { Avatar } from '../ProfileCard';
import { CopyBtn, Empty, Modal, Spinner, StatusBadge, Switch, useToast } from '../ui';
import Confirm from './Confirm';
import Stats from './Stats';
import { useAdmin } from './ctx';

const PRESETS = [['1 วัน', 86400], ['7 วัน', 604800], ['30 วัน', 2592000], ['90 วัน', 7776000], ['ตลอดชีพ', 0]];
const UNITS = [['นาที', 60], ['ชั่วโมง', 3600], ['วัน', 86400]];
const STATUSES = [['', 'ทั้งหมด'], ['active', 'ใช้งานได้'], ['unused', 'ยังไม่เริ่ม'], ['expired', 'หมดอายุ'], ['revoked', 'ระงับ'], ['bound', 'ผูกเครื่อง']];
const LIMIT = 25;

function Generator({ onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ qty: 1, label: '', note: '', discordId: '', startMode: 'activate', hwidLock: true });
  const [preset, setPreset] = useState(2592000);
  const [custom, setCustom] = useState({ n: '', u: 86400 });
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const seconds = preset === 'custom' ? Math.round(Number(custom.n || 0) * custom.u) : preset;

  const go = async (e) => {
    e.preventDefault();
    if (preset === 'custom' && !(seconds > 0)) return toast('ใส่อายุคีย์ให้ถูกต้อง', 'err');
    setBusy(true);
    try {
      const r = await api('/api/admin/keys', 'POST', { ...f, qty: Number(f.qty), seconds });
      setOut(r.keys); onDone();
    } catch (er) { toast(er.message, 'err'); }
    setBusy(false);
  };
  const dl = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.join('\n') + '\n'], { type: 'text/plain' }));
    a.download = `keys-${Date.now()}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <form className="gen card" onSubmit={go}>
      <h3><Icon n="plus" size={18} />ออกคีย์ใหม่</h3>
      <div className="field"><span>อายุคีย์</span>
        <div className="chips">
          {PRESETS.map(([l, v]) => <button type="button" key={l} className={`chip ${preset === v ? 'on' : ''}`} onClick={() => setPreset(v)}>{l}</button>)}
          <button type="button" className={`chip ${preset === 'custom' ? 'on' : ''}`} onClick={() => setPreset('custom')}>กำหนดเอง</button>
        </div>
        {preset === 'custom' && (
          <div className="inline-form">
            <input className="input" type="number" min="1" step="any" value={custom.n} onChange={(e) => setCustom((c) => ({ ...c, n: e.target.value }))} placeholder="จำนวน" />
            <select className="input" value={custom.u} onChange={(e) => setCustom((c) => ({ ...c, u: Number(e.target.value) }))}>{UNITS.map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
        )}
      </div>
      <div className="gen-row">
        <label className="field gen-qty"><span>จำนวนคีย์</span><input className="input" type="number" min="1" max="500" value={f.qty} onChange={(e) => set('qty', e.target.value)} /></label>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <Spinner /> : <Icon n="key" size={18} />}ออกคีย์</button>
      </div>
      <details className="adv">
        <summary>ตัวเลือกเพิ่มเติม</summary>
        <div className="adv-body">
          <div className="grid2">
            <label className="field"><span>ชื่อแพ็กเกจ</span><input className="input" value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="เช่น VIP 30 วัน" maxLength={60} /></label>
            <label className="field"><span>โน้ต</span><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={120} /></label>
          </div>
          <label className="field"><span>Discord ID เจ้าของ (ไม่ใส่ = ให้ผู้ใช้ล็อกอินแล้วผูกเอง)</span><input className="input mono" value={f.discordId} onChange={(e) => set('discordId', e.target.value.trim())} /></label>
          <div className="gen-opts">
            <div className="seg">
              <button type="button" className={f.startMode === 'activate' ? 'on' : ''} onClick={() => set('startMode', 'activate')}>นับเวลาเมื่อใช้ครั้งแรก</button>
              <button type="button" className={f.startMode === 'issue' ? 'on' : ''} onClick={() => set('startMode', 'issue')}>นับเวลาทันที</button>
            </div>
            <Switch checked={f.hwidLock} onChange={(v) => set('hwidLock', v)} label="ล็อกเครื่อง (HWID)" />
          </div>
        </div>
      </details>

      <Modal open={!!out} onClose={() => setOut(null)} title={`ออกคีย์แล้ว ${out?.length || 0} รายการ`}
        footer={<><button type="button" className="btn" onClick={dl}><Icon n="download" size={16} />ดาวน์โหลด .txt</button><CopyBtn text={(out || []).join('\n')} label="คัดลอกทั้งหมด" className="btn-primary" /></>}>
        <textarea className="input mono keys-out allow-select" readOnly value={(out || []).join('\n')} rows={Math.min(12, (out || []).length + 1)} />
      </Modal>
    </form>
  );
}

export default function Keys() {
  const toast = useToast();
  const { openKey, openUser, offset } = useAdmin();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statTick, setStatTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api(`/api/admin/keys?q=${encodeURIComponent(q)}&status=${status}&limit=${LIMIT}&offset=${page * LIMIT}`)); }
    catch (e) { toast(e.message, 'err'); }
    setLoading(false);
  }, [q, status, page, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { setPage(0); setSel(new Set()); }, [q, status]);

  const bulk = async (action) => {
    setBusy(true);
    try { await api('/api/admin/keys/bulk', 'POST', { ids: [...sel], action }); toast(action === 'delete' || action === 'revoke' ? 'สำเร็จ · ผู้เล่นในเกมจะถูกเตะภายใน ~10 วินาที' : 'สำเร็จ'); setSel(new Set()); await load(); } catch (e) { toast(e.message, 'err'); }
    setBusy(false); setAsk(null);
  };
  const quick = async (id, a, msg) => { try { await api(`/api/admin/keys/${id}/${a}`, 'PUT'); toast(msg); load(); } catch (e) { toast(e.message, 'err'); } };
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = data.rows.length > 0 && data.rows.every((r) => sel.has(r.id));
  const pages = Math.max(1, Math.ceil(data.total / LIMIT));

  return (
    <div className="keys-page">
      <Stats refresh={statTick} />
      <Generator onDone={() => { setPage(0); load(); setStatTick((t) => t + 1); }} />

      <div className="bar-tools">
        <div className="search"><Icon n="search" size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา คีย์ / Discord ID / ชื่อ Roblox / HWID / โน้ต" /></div>
        <div className="seg">{STATUSES.map(([v, l]) => <button key={v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{l}</button>)}</div>
      </div>

      {sel.size > 0 && (
        <div className="bulk">
          <b>เลือก {sel.size} รายการ</b>
          <CopyBtn text={data.rows.filter((r) => sel.has(r.id)).map((r) => r.key).join('\n')} label="คัดลอกคีย์" />
          <button className="btn btn-sm" onClick={() => bulk('revoke')}><Icon n="ban" size={14} />ระงับ</button>
          <button className="btn btn-sm" onClick={() => bulk('unrevoke')}>ปลดระงับ</button>
          <button className="btn btn-sm btn-danger" onClick={() => setAsk('delete')}><Icon n="trash" size={14} />ลบ</button>
        </div>
      )}

      {loading && !data.rows.length ? <div className="loading"><Spinner size={22} /></div> : data.rows.length === 0 ? (
        <Empty icon="key" title="ไม่พบคีย์">{q || status ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'กด “ออกคีย์ใหม่” เพื่อสร้างคีย์แรก'}</Empty>
      ) : (
        <div className={`tbl-wrap ${loading ? 'is-loading' : ''}`}>
          <table className="tbl">
            <thead><tr>
              <th className="c-sel"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(data.rows.map((r) => r.id)))} aria-label="เลือกทั้งหมด" /></th>
              <th>คีย์</th><th>สถานะ</th><th>เวลาที่เหลือ</th><th>HWID</th><th>เจ้าของ</th><th />
            </tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className={r.status === 'revoked' || r.status === 'expired' ? 'row-dead' : ''}>
                  <td className="c-sel"><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label="เลือก" /></td>
                  <td><button className="lnk mono" onClick={() => openKey(r.id)}>{r.key}</button>{r.label && <small className="dim sub">{r.label}</small>}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><MiniCountdown status={r.status} expiresAt={r.expires_at} duration={r.duration_seconds} offset={offset} /></td>
                  <td>{r.hwid ? <span className="hw"><Icon n="cpu" size={14} /><code>{r.hwid.length > 12 ? r.hwid.slice(0, 10) + '…' : r.hwid}</code></span> : <span className="dim">—</span>}</td>
                  <td>{r.owner ? <button className="owner" onClick={() => openUser(r.owner.id)}><Avatar p={r.owner} size={24} /><span>{r.owner.name}</span></button> : <span className="dim">—</span>}</td>
                  <td className="tbl-act">
                    <button className="icon-btn" title="รายละเอียด" onClick={() => openKey(r.id)}><Icon n="eye" size={15} /></button>
                    <button className="icon-btn" title="รีเซ็ต HWID" disabled={!r.hwid} onClick={() => quick(r.id, 'reset-hwid', 'รีเซ็ต HWID แล้ว')}><Icon n="refresh" size={15} /></button>
                    <button className="icon-btn" title={r.status === 'revoked' ? 'ปลดระงับ' : 'ระงับ'} onClick={() => quick(r.id, r.status === 'revoked' ? 'unrevoke' : 'revoke', r.status === 'revoked' ? 'ปลดระงับแล้ว' : 'ระงับแล้ว · ผู้เล่นในเกมจะถูกเตะภายใน ~10 วินาที')}><Icon n="ban" size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pager">
        <span className="dim">{data.total.toLocaleString('th-TH')} คีย์</span>
        <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
        <span>{page + 1} / {pages}</span>
        <button className="btn btn-sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
      </div>

      <Confirm open={ask === 'delete'} danger yes="ลบถาวร" busy={busy} onNo={() => setAsk(null)} onYes={() => bulk('delete')} title={`ลบ ${sel.size} คีย์?`}><p>ลบแล้วกู้คืนไม่ได้ ผู้เล่นที่ใช้คีย์เหล่านี้อยู่ในเกมจะ<b>ถูกเตะออกทันที</b></p></Confirm>
    </div>
  );
}
