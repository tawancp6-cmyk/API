import Link from 'next/link';
import Icon from '@/components/Icons';

export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-code">404</div>
      <h1>ไม่พบหน้านี้</h1>
      <p>ลิงก์อาจผิดหรือถูกย้ายไปแล้ว</p>
      <Link className="btn btn-primary" href="/"><Icon n="key" size={16} />กลับหน้าแรก</Link>
    </main>
  );
}
