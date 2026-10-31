/**
 * ดึงโปรไฟล์ Roblox (ชื่อ, ชื่อที่แสดง, รูป) จาก API สาธารณะของ Roblox
 * สคริปต์ส่ง roblox_id (LocalPlayer.UserId) และ/หรือ roblox_name (LocalPlayer.Name) มาตอนตรวจคีย์
 * ถ้า Roblox ล่ม/ช้า จะไม่ทำให้การตรวจคีย์พัง — ใช้ค่าที่ส่งมาแทน
 */
const cache = new Map(); // id -> { at, profile }
const TTL = 60 * 60 * 1000;

export const ID_RE = /^\d{1,12}$/;
export const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;

async function getJson(url, opt = {}) {
  const r = await fetch(url, { ...opt, cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/** รับ { id, name } (อย่างใดอย่างหนึ่งก็ได้) → { id, name, display, avatar } หรือ null ถ้าไม่ได้ส่งมา/รูปแบบผิด */
export async function resolveRoblox({ id, name } = {}) {
  let uid = ID_RE.test(String(id ?? '').trim()) ? String(id).trim() : '';
  const uname = NAME_RE.test(String(name ?? '').trim()) ? String(name).trim() : '';
  if (!uid && !uname) return null;

  const hit = uid && cache.get(uid);
  if (hit && Date.now() - hit.at < TTL) return hit.profile;

  let profile = { id: uid || null, name: uname || null, display: null, avatar: null };
  try {
    if (!uid) {
      const d = await getJson('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [uname], excludeBannedUsers: false }),
      });
      uid = d?.data?.[0]?.id ? String(d.data[0].id) : '';
      if (!uid) return profile; // ไม่พบชื่อนี้ใน Roblox
      profile.id = uid;
    }
    const [u, t] = await Promise.allSettled([
      getJson(`https://users.roblox.com/v1/users/${uid}`),
      getJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png&isCircular=false`),
    ]);
    if (u.status === 'fulfilled' && u.value?.name) {
      profile.name = u.value.name;
      profile.display = u.value.displayName || u.value.name;
    }
    if (t.status === 'fulfilled') {
      const img = t.value?.data?.[0]?.imageUrl;
      if (typeof img === 'string' && /^https:\/\/[a-z0-9.-]+\.(rbxcdn|roblox)\.com\//i.test(img)) profile.avatar = img;
    }
    if (profile.name) cache.set(uid, { at: Date.now(), profile });
  } catch {
    /* Roblox ไม่ตอบ → ใช้ค่าที่ส่งมา */
  }
  return profile;
}

export const robloxProfileUrl = (id) => (id ? `https://www.roblox.com/users/${id}/profile` : null);
