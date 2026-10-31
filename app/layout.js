import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/500.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './globals.css';
import { getSettings } from '@/lib/settings';
import { ToastProvider } from '@/components/ui';
import Guard from '@/components/Guard';

export const dynamic = 'force-dynamic';

const SITE = (process.env.SITE_URL || 'https://api-flame-five-99.vercel.app').replace(/\/+$/, '');
const DESC = 'จัดการคีย์ รีเซ็ต HWID รีคีย์ และดูโปรไฟล์ Roblox ของคุณ';

export async function generateMetadata() {
  let s = { site_name: 'Cipher Hub' };
  try { s = await getSettings(); } catch {}
  return {
    metadataBase: new URL(SITE),
    title: { default: s.site_name, template: `%s · ${s.site_name}` },
    description: DESC,
    icons: {
      icon: [{ url: '/favicon.ico' }, { url: '/icon.png', type: 'image/png', sizes: '512x512' }],
      apple: '/apple-touch-icon.png',
    },
    openGraph: { type: 'website', siteName: s.site_name, title: s.site_name, description: DESC, locale: 'th_TH', images: [{ url: '/og.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', images: ['/og.png'] },
  };
}

export const viewport = { themeColor: '#050506', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <ToastProvider>
          <Guard />
          {children}
        </ToastProvider>
        <noscript><div style={{ padding: 24, textAlign: 'center' }}>ต้องเปิด JavaScript เพื่อใช้งานเว็บนี้</div></noscript>
      </body>
    </html>
  );
}
