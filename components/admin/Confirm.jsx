'use client';
import { Modal, Spinner } from '../ui';

export default function Confirm({ open, title, children, onYes, onNo, busy, danger, yes = 'ยืนยัน' }) {
  return (
    <Modal open={open} onClose={() => !busy && onNo()} title={title}
      footer={<>
        <button className="btn btn-ghost" disabled={busy} onClick={onNo}>ยกเลิก</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onYes}>{busy && <Spinner />}{yes}</button>
      </>}>
      {children}
    </Modal>
  );
}
