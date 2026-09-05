export const SERVICE_UUID = '7d0f1000-7b5a-4f5a-9e1c-4d4f544f524c';
export const RX_UUID = '7d0f1001-7b5a-4f5a-9e1c-4d4f544f524c';
export const TX_UUID = '7d0f1002-7b5a-4f5a-9e1c-4d4f544f524c';

const OWNER_KEY = 'motorlab.autotune.ownerId.v1';

export function isValidOwnerId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{4,12}$/.test(value);
}

export function generateOwnerId(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  }
  return out;
}

export function getOrCreateOwnerId(storage = globalThis.localStorage, random = Math.random) {
  const existing = storage?.getItem?.(OWNER_KEY);
  if (isValidOwnerId(existing)) return existing;
  const created = generateOwnerId(random);
  storage?.setItem?.(OWNER_KEY, created);
  return created;
}

export function commandStart(owner) {
  if (!isValidOwnerId(owner)) throw new Error('invalid owner id');
  return `AT START ${owner}`;
}

export function commandGps(owner, speedMps, gearHint = 0) {
  if (!isValidOwnerId(owner)) throw new Error('invalid owner id');
  if (!Number.isFinite(speedMps) || speedMps < 0 || speedMps > 80) throw new Error('invalid speed');
  const cms = Math.max(0, Math.min(8000, Math.round(speedMps * 100)));
  const gear = Number.isInteger(gearHint) && gearHint >= 1 && gearHint <= 6 ? gearHint : 0;
  return gear ? `AT GPS ${owner} ${cms} ${gear}` : `AT GPS ${owner} ${cms}`;
}

export function commandStatus() {
  return 'AT STATUS';
}

export function commandRpmStatus() {
  return 'STATUS';
}

export function commandFinish(owner) {
  if (!isValidOwnerId(owner)) throw new Error('invalid owner id');
  return `AT FINISH ${owner}`;
}

export function commandCancel(owner) {
  if (!isValidOwnerId(owner)) throw new Error('invalid owner id');
  return `AT CANCEL ${owner}`;
}

export function parseNotification(text) {
  const value = String(text ?? '').trim();
  if (!value) return { type: 'empty', raw: value };

  let m = /^AT S ([01])(?:\s+([^\s]+))?\s+(\d+)$/.exec(value);
  if (m) {
    return {
      type: 'autotuneStatus',
      active: m[1] === '1',
      owner: m[2] || '',
      gpsAgeMs: Number(m[3]),
      raw: value,
    };
  }

  m = /^R\s+(\d+)\s+(\d+)$/.exec(value);
  if (m) {
    return { type: 'rpm', rpm: Number(m[1]), periodUs: Number(m[2]), raw: value };
  }

  m = /^AT OK\s+([A-Z]+)(?:\s+([^\s]+))?$/.exec(value);
  if (m) {
    return { type: 'ok', action: m[1], owner: m[2] || '', raw: value };
  }

  m = /^AT ERR\s+(.+)$/.exec(value);
  if (m) {
    return { type: 'error', message: m[1], raw: value };
  }

  return { type: 'other', raw: value };
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371000;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function speedFromPosition(position, previousPosition = null) {
  const rawNativeSpeed = position?.coords?.speed;
  if (rawNativeSpeed !== null && rawNativeSpeed !== undefined) {
    const nativeSpeed = Number(rawNativeSpeed);
    if (Number.isFinite(nativeSpeed) && nativeSpeed >= 0 && nativeSpeed <= 80) return nativeSpeed;
  }
  if (!previousPosition) return null;
  const t1 = Number(previousPosition.timestamp);
  const t2 = Number(position.timestamp);
  const dt = (t2 - t1) / 1000;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 5) return null;
  const a = previousPosition.coords;
  const b = position.coords;
  if (![a?.latitude, a?.longitude, b?.latitude, b?.longitude].every(Number.isFinite)) return null;
  const distance = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  const speed = distance / dt;
  return Number.isFinite(speed) && speed >= 0 && speed <= 80 ? speed : null;
}
