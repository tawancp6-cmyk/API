'use client';
import { createContext, useContext } from 'react';

export const AdminCtx = createContext({ openKey: () => {}, openUser: () => {}, offset: 0 });
export const useAdmin = () => useContext(AdminCtx);

export const ACTION_TH = {
  created: 'สร้างคีย์', activate: 'เริ่มนับเวลา', hwid_bind: 'ผูกเครื่อง', hwid_reset: 'รีเซ็ต HWID', hwid_mismatch: 'ใช้ผิดเครื่อง',
  rekey: 'รีคีย์', claim: 'ผูกบัญชี', revoke: 'ระงับ', unrevoke: 'ปลดระงับ', extend: 'ปรับเวลา', assign: 'เปลี่ยนเจ้าของ', note: 'แก้โน้ต',
};
export const ACTION_TONE = { hwid_mismatch: 'bad', revoke: 'bad', created: 'ok', activate: 'ok', hwid_bind: 'ok', unrevoke: 'ok' };
