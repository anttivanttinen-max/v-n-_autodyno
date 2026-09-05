import {
  SERVICE_UUID, RX_UUID, TX_UUID,
  getOrCreateOwnerId, generateOwnerId,
  commandStart, commandGps, commandStatus, commandRpmStatus,
  commandFinish, commandCancel, parseNotification, speedFromPosition,
} from './protocol.js';

const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function withTimeout(promise, ms, label = 'Toiminto') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} aikakatkaistiin`)), ms)),
  ]);
}

const state = {
  ownerId: getOrCreateOwnerId(),
  riderName: localStorage.getItem('motorlab.autotune.riderName') || '',
  device: null,
  server: null,
  rx: null,
  tx: null,
  connected: false,
  connecting: false,
  sessionActive: false,
  sessionOwner: '',
  rpm: 0,
  periodUs: 0,
  appliedDeg: null,
  predictionConfidence: null,
  predictiveReady: false,
  map: [],
  mapLoading: false,
  gpsWatchId: null,
  lastPosition: null,
  lastSentPositionTimestamp: 0,
  lastGpsFixAt: 0,
  lastSpeedMps: null,
  gpsSent: 0,
  gpsDropped: 0,
  reconnectTimer: null,
  reconnectAttempt: 0,
  wakeLock: null,
  statusTimer: null,
  log: [],
};

function nowStamp() {
  return new Date().toLocaleTimeString('fi-FI', { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[c]);
}

function addLog(message, kind = 'info') {
  state.log.unshift({ time: nowStamp(), message, kind });
  state.log = state.log.slice(0, 80);
  $('log').innerHTML = state.log.map((x) =>
    `<div class="log-row ${x.kind}"><span>${x.time}</span><b>${escapeHtml(x.message)}</b></div>`
  ).join('');
}

function setConnection(mode, label) {
  const badge = $('connectionBadge');
  badge.className = `connection-badge ${mode}`;
  badge.querySelector('span').textContent = label;
}

function nearestMapPoint(rpm = state.rpm) {
  if (!state.map.length || !Number.isFinite(rpm)) return null;
  return state.map.reduce((best, point) => (
    !best || Math.abs(point.rpm - rpm) < Math.abs(best.rpm - rpm) ? point : best
  ), null);
}

function renderMap() {
  const root = $('map');
  if (!state.map.length) {
    root.innerHTML = `<div class="empty-state">${state.mapLoading ? 'Ladataan karttaa VäNästä…' : 'Yhdistä VäNä ja lataa kartta.'}</div>`;
    return;
  }
  const active = nearestMapPoint();
  root.innerHTML = state.map.map((point) => {
    const isActive = active && point.index === active.index && state.rpm > 0;
    return `<div class="map-cell${isActive ? ' active' : ''}"><div class="map-rpm">${point.rpm}</div><div class="map-deg">${Number(point.deg).toFixed(1)}<small>°</small></div></div>`;
  }).join('');
}

function updateUi() {
  $('ownerId').textContent = state.ownerId;
  $('riderName').value = state.riderName;
  $('deviceName').textContent = state.device?.name || 'Ei valittu';

  if (state.connecting) setConnection('connecting', 'YHDISTETÄÄN');
  else if (state.connected) setConnection('online', 'VÄNÄ ONLINE');
  else setConnection('offline', 'EI YHTEYTTÄ');

  $('connectBtn').disabled = state.connecting;
  $('connectBtn').querySelector('span:last-child').textContent = state.connected ? 'VÄNÄ YHDISTETTY' : (state.connecting ? 'YHDISTETÄÄN…' : 'YHDISTÄ VÄNÄ');
  $('disconnectBtn').disabled = !state.connected;
  $('mapRefreshBtn').disabled = !state.connected || state.mapLoading;

  $('rpm').textContent = Math.round(state.rpm || 0);
  $('periodUs').textContent = state.periodUs ? `${Math.round(state.periodUs)} µs` : '— µs';
  $('rpmStatus').textContent = state.rpm > 0 ? 'PICKUP AKTIIVINEN' : (state.connected ? 'ODOTTAA PYÖRINTÄÄ' : 'ODOTTAA YHTEYTTÄ');
  const pct = Math.max(0, Math.min(100, (Number(state.rpm || 0) / 12000) * 100));
  $('rpmGauge').style.setProperty('--rpm-pct', `${pct}%`);

  const fallbackMap = nearestMapPoint();
  if (Number.isFinite(state.appliedDeg)) $('appliedDeg').textContent = Number(state.appliedDeg).toFixed(1);
  else if (fallbackMap && state.rpm > 0) $('appliedDeg').textContent = `~${Number(fallbackMap.deg).toFixed(1)}`;
  else $('appliedDeg').textContent = '—';

  if (Number.isFinite(state.predictionConfidence)) {
    $('prediction').textContent = `${Math.round(state.predictionConfidence)}%`;
    $('predictionMeta').textContent = state.predictiveReady ? 'READY' : 'SYNC';
  } else {
    $('prediction').textContent = '—';
    $('predictionMeta').textContent = 'compact BLE';
  }

  $('speed').textContent = state.lastSpeedMps == null ? '—' : (state.lastSpeedMps * 3.6).toFixed(1);
  const gearHint = Number($('gearHint').value || 0);
  $('gear').textContent = gearHint > 0 ? String(gearHint) : 'A';
  $('gearMeta').textContent = gearHint > 0 ? 'manuaaliapu' : 'automaattinen';

  $('sessionState').textContent = state.sessionActive ? `AKTIIVINEN · ${state.sessionOwner || '?'}` : 'EI SESSIOTA';
  $('autotuneBadge').textContent = state.sessionActive ? 'AKTIIVINEN' : 'VALMIS';
  $('autotuneBadge').className = `mini-badge${state.sessionActive ? ' active' : ''}`;
  $('gpsState').textContent = state.gpsWatchId != null ? (state.lastGpsFixAt ? 'LIVE' : 'HAKEE') : 'EI KÄYTÖSSÄ';
  $('gpsCount').textContent = String(state.gpsSent);
  $('gpsDropped').textContent = String(state.gpsDropped);

  $('startBtn').disabled = !state.connected || state.sessionActive || state.rpm !== 0;
  $('finishBtn').disabled = !state.connected || !state.sessionActive || state.sessionOwner !== state.ownerId || state.rpm !== 0;
  $('cancelBtn').disabled = !state.connected || !state.sessionActive || state.sessionOwner !== state.ownerId;
  $('newOwnerBtn').disabled = state.sessionActive;

  if (state.sessionActive) {
    $('heroState').textContent = 'AUTOTUNE ACTIVE';
    $('heroMessage').textContent = state.sessionOwner === state.ownerId ? 'GPS ja vetovertailu menevät suoraan VäNälle.' : `VäNä on toisen puhelimen sessiossa (${state.sessionOwner || '?'}).`;
  } else if (state.connected) {
    $('heroState').textContent = 'VÄNÄ ONLINE';
    $('heroMessage').textContent = state.rpm > 0 ? 'Ajonäkymä live — sytytys toimii VäNässä.' : 'Yhteys kunnossa. Valmis ajoon.';
  } else {
    $('heroState').textContent = 'VALMIS';
    $('heroMessage').textContent = 'Yhdistä VäNä aloittaaksesi.';
  }

  renderMap();
}

function browserSupport() {
  const hasBluetooth = !!navigator.bluetooth;
  const hasGeo = !!navigator.geolocation;
  $('browserSupport').textContent = hasBluetooth ? (hasGeo ? 'Web Bluetooth + GPS OK' : 'Web Bluetooth OK · GPS puuttuu') : 'Web Bluetooth puuttuu';
  if (!hasBluetooth) {
    $('heroState').textContent = 'SELAIN EI TUE BLE:TÄ';
    $('heroMessage').textContent = 'iPhone: avaa Bluefyssä. Android: käytä Chromea.';
  }
}

async function writeCommand(text, { log = true } = {}) {
  if (!state.connected || !state.rx) throw new Error('VäNä ei ole BLE-yhteydessä');
  if (log) addLog(`→ ${text}`);
  const bytes = encoder.encode(text);
  if (state.rx.writeValueWithoutResponse) {
    try {
      await state.rx.writeValueWithoutResponse(bytes);
      return;
    } catch (_) {}
  }
  await state.rx.writeValue(bytes);
}

function ingestExtendedStatus(text) {
  if (!text.startsWith('{') || !text.endsWith('}')) return false;
  try {
    const data = JSON.parse(text);
    if (Number.isFinite(Number(data.rpm))) state.rpm = Number(data.rpm);
    if (Number.isFinite(Number(data.period_us))) state.periodUs = Number(data.period_us);
    if (Number.isFinite(Number(data.applied_deg))) state.appliedDeg = Number(data.applied_deg);
    if (Number.isFinite(Number(data.prediction_confidence))) state.predictionConfidence = Number(data.prediction_confidence);
    if (typeof data.predictive_ready === 'boolean') state.predictiveReady = data.predictive_ready;
    addLog('Laaja BLE-telemetria vastaanotettu.', 'good');
    return true;
  } catch (_) {
    return false;
  }
}

function onNotification(event) {
  const view = event.target.value;
  const text = decoder.decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)).trim();
  if (!text) return;

  if (ingestExtendedStatus(text)) {
    updateUi();
    return;
  }

  if (text === 'MAP_BEGIN') {
    state.map = [];
    state.mapLoading = true;
    updateUi();
    return;
  }
  if (text.startsWith('MAP ')) {
    const p = text.split(/\s+/);
    if (p.length >= 4) {
      const point = { index: Number(p[1]), rpm: Number(p[2]), deg: Number(p[3]) };
      if ([point.index, point.rpm, point.deg].every(Number.isFinite)) state.map.push(point);
    }
    return;
  }
  if (text === 'MAP_END') {
    state.map.sort((a, b) => a.index - b.index);
    state.mapLoading = false;
    addLog(`Kartta ladattu: ${state.map.length} pistettä.`, 'good');
    updateUi();
    return;
  }

  const parsed = parseNotification(text);
  if (parsed.type !== 'rpm') addLog(`← ${text}`, parsed.type === 'error' ? 'error' : 'rx');

  switch (parsed.type) {
    case 'autotuneStatus':
      state.sessionActive = parsed.active;
      state.sessionOwner = parsed.owner || '';
      if (parsed.active && parsed.owner === state.ownerId) startGps();
      else if (!parsed.active) stopGps();
      break;
    case 'rpm':
      state.rpm = parsed.rpm;
      state.periodUs = parsed.periodUs;
      break;
    case 'ok':
      if (parsed.action === 'START') {
        state.sessionActive = true;
        state.sessionOwner = parsed.owner || state.ownerId;
        startGps();
      } else if (parsed.action === 'FINISH') {
        state.sessionActive = false;
        state.sessionOwner = '';
        stopGps();
      } else if (parsed.action === 'CANCEL') {
        setTimeout(refreshStatus, 300);
      }
      break;
    case 'error':
      if (parsed.message.startsWith('BUSY')) {
        state.sessionActive = true;
        state.sessionOwner = parsed.message.split(/\s+/)[1] || '?';
        stopGps();
      }
      break;
    default:
      break;
  }
  updateUi();
}

async function requestMap() {
  if (!state.connected) return;
  state.mapLoading = true;
  updateUi();
  try {
    await writeCommand('MAP?', { log: false });
  } catch (err) {
    state.mapLoading = false;
    addLog(`Kartta: ${err.message}`, 'warn');
    updateUi();
  }
}

async function requestExtendedStatus() {
  if (!state.connected) return;
  try {
    await writeCommand('BAT STATUS', { log: false });
  } catch (_) {}
}

async function bindDevice(device) {
  clearReconnect();
  state.device = device;
  state.connecting = true;
  updateUi();
  device.removeEventListener?.('gattserverdisconnected', onDisconnected);
  device.addEventListener('gattserverdisconnected', onDisconnected);

  try {
  const server = await withTimeout(device.gatt.connect(), 10000, 'BLE-yhdistys');
  const service = await withTimeout(server.getPrimaryService(SERVICE_UUID), 6000, 'BLE-palvelun haku');
  const rx = await withTimeout(service.getCharacteristic(RX_UUID), 4000, 'BLE RX');
  const tx = await withTimeout(service.getCharacteristic(TX_UUID), 4000, 'BLE TX');
  await withTimeout(tx.startNotifications(), 5000, 'BLE-notifikaatiot');
  tx.removeEventListener?.('characteristicvaluechanged', onNotification);
  tx.addEventListener('characteristicvaluechanged', onNotification);

  state.server = server;
  state.rx = rx;
  state.tx = tx;
  state.connected = true;
  state.connecting = false;
  state.reconnectAttempt = 0;
  localStorage.setItem('motorlab.autotune.lastDeviceId', device.id || '');
  localStorage.setItem('motorlab.autotune.lastDeviceName', device.name || 'VANA-Ignition');
  addLog(`BLE yhdistetty: ${device.name || device.id}`, 'good');
  await keepAwake(true);
  updateUi();
  await refreshStatus();
  await requestMap();
  setTimeout(requestExtendedStatus, 450);
  startStatusPolling();
  } catch (err) {
    state.connected = false;
    state.connecting = false;
    state.server = null; state.rx = null; state.tx = null;
    try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) {}
    updateUi();
    throw err;
  }
}

async function chooseAndConnect() {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth puuttuu. iPhonella avaa sivu Bluefyssä.');
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  });
  await bindDevice(device);
}

async function reconnectKnownDevice() {
  if (!navigator.bluetooth?.getDevices) return false;
  const savedId = localStorage.getItem('motorlab.autotune.lastDeviceId');
  if (!savedId) return false;
  const devices = await navigator.bluetooth.getDevices();
  const device = devices.find((d) => d.id === savedId) || devices.find((d) => d.name?.startsWith('VANA-Ignition'));
  if (!device) return false;
  await bindDevice(device);
  return true;
}

function onDisconnected() {
  stopStatusPolling();
  state.connected = false;
  state.connecting = false;
  state.server = null;
  state.rx = null;
  state.tx = null;
  state.rpm = 0;
  state.periodUs = 0;
  addLog('BLE-yhteys katkesi. Sytytys jatkuu VäNässä.', 'warn');
  updateUi();
  scheduleReconnect();
}

function disconnect() {
  clearReconnect();
  stopStatusPolling();
  try { if (state.device?.gatt?.connected) state.device.gatt.disconnect(); } catch (_) {}
  state.connected = false;
  state.connecting = false;
  state.server = null;
  state.rx = null;
  state.tx = null;
  state.rpm = 0;
  state.periodUs = 0;
  stopGps();
  addLog('BLE irrotettu käyttäjän toimesta.', 'warn');
  updateUi();
}

function scheduleReconnect() {
  clearReconnect();
  if (!state.device) return;
  const delay = Math.min(10000, 500 * (2 ** Math.min(5, state.reconnectAttempt)));
  state.reconnectAttempt += 1;
  state.reconnectTimer = setTimeout(async () => {
    try {
      await bindDevice(state.device);
      addLog('BLE reconnect onnistui.', 'good');
    } catch (err) {
      addLog(`Reconnect ei vielä onnistunut: ${err.message}`, 'warn');
      scheduleReconnect();
    }
  }, delay);
}

function clearReconnect() {
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function startStatusPolling() {
  stopStatusPolling();
  state.statusTimer = setInterval(refreshStatus, 1000);
}

function stopStatusPolling() {
  if (state.statusTimer) clearInterval(state.statusTimer);
  state.statusTimer = null;
}

async function refreshStatus() {
  if (!state.connected) return;
  try {
    await writeCommand(commandStatus(), { log: false });
    await writeCommand(commandRpmStatus(), { log: false });
  } catch (err) {
    addLog(`Status: ${err.message}`, 'warn');
  }
}

function selectedGearHint() {
  const n = Number($('gearHint').value);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 0;
}

function onGpsPosition(position) {
  state.lastGpsFixAt = Date.now();
  if (position.timestamp === state.lastSentPositionTimestamp) return;
  const speed = speedFromPosition(position, state.lastPosition);
  state.lastPosition = position;
  if (speed == null) {
    state.gpsDropped += 1;
    updateUi();
    return;
  }
  state.lastSpeedMps = speed;
  const age = Date.now() - Number(position.timestamp);
  if (age > 1500 || !state.connected || !state.sessionActive || state.sessionOwner !== state.ownerId) {
    if (age > 1500) state.gpsDropped += 1;
    updateUi();
    return;
  }
  state.lastSentPositionTimestamp = position.timestamp;
  writeCommand(commandGps(state.ownerId, speed, selectedGearHint()), { log: false })
    .then(() => { state.gpsSent += 1; updateUi(); })
    .catch((err) => { state.gpsDropped += 1; addLog(`GPS→BLE: ${err.message}`, 'warn'); updateUi(); });
}

function onGpsError(error) {
  state.gpsDropped += 1;
  addLog(`GPS: ${error.message}`, 'error');
  updateUi();
}

function startGps() {
  if (state.gpsWatchId != null || !navigator.geolocation) return;
  state.lastPosition = null;
  state.lastSentPositionTimestamp = 0;
  state.gpsWatchId = navigator.geolocation.watchPosition(onGpsPosition, onGpsError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000,
  });
  addLog('GPS-seuranta käynnistetty.', 'good');
  updateUi();
}

function stopGps() {
  if (state.gpsWatchId != null) navigator.geolocation?.clearWatch(state.gpsWatchId);
  state.gpsWatchId = null;
  state.lastPosition = null;
  state.lastSentPositionTimestamp = 0;
  updateUi();
}

async function keepAwake(enable) {
  try {
    if (enable && navigator.wakeLock?.request) state.wakeLock = await navigator.wakeLock.request('screen');
    else if (!enable && state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; }
  } catch (_) {}
  try {
    if (typeof navigator.bluetooth?.setScreenDimEnabled === 'function') {
      await navigator.bluetooth.setScreenDimEnabled(!enable);
    }
  } catch (_) {}
}

async function startSession() {
  if (!state.connected) return;
  if (state.rpm !== 0) throw new Error('Sammuta moottori ennen uuden AutoTune-session aloitusta.');
  await writeCommand(commandStart(state.ownerId));
  setTimeout(refreshStatus, 250);
}

async function finishSession() {
  if (state.rpm !== 0) throw new Error('Finish vaatii RPM=0. Pysäytä moottori ensin.');
  await writeCommand(commandFinish(state.ownerId));
}

async function cancelSession() {
  if (!confirm('Perutaanko AutoTune ja palautetaanko session alkukartta?')) return;
  await writeCommand(commandCancel(state.ownerId));
}

function resetOwnerId() {
  if (state.sessionActive) return;
  const next = generateOwnerId();
  localStorage.setItem('motorlab.autotune.ownerId.v1', next);
  state.ownerId = next;
  addLog(`Uusi puhelin-ID: ${next}`, 'good');
  updateUi();
}

function wireUi() {
  $('connectBtn').addEventListener('click', () => {
    if (state.connected) return;
    chooseAndConnect().catch((err) => {
      state.connecting = false;
      addLog(`BLE: ${err.message}`, err?.name === 'NotFoundError' ? 'warn' : 'error');
      updateUi();
    });
  });
  $('disconnectBtn').addEventListener('click', disconnect);
  $('mapRefreshBtn').addEventListener('click', () => { requestMap(); requestExtendedStatus(); });
  $('startBtn').addEventListener('click', () => startSession().catch((err) => { addLog(err.message, 'error'); alert(err.message); }));
  $('finishBtn').addEventListener('click', () => finishSession().catch((err) => { addLog(err.message, 'error'); alert(err.message); }));
  $('cancelBtn').addEventListener('click', () => cancelSession().catch((err) => { addLog(err.message, 'error'); alert(err.message); }));
  $('newOwnerBtn').addEventListener('click', resetOwnerId);
  $('riderName').addEventListener('change', (event) => {
    state.riderName = event.target.value.trim().slice(0, 32);
    localStorage.setItem('motorlab.autotune.riderName', state.riderName);
  });
  $('gearHint').addEventListener('change', updateUi);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.connected) {
      keepAwake(true);
      refreshStatus();
    }
  });
}

async function registerOffline() {
  if (!('serviceWorker' in navigator)) {
    $('cacheState').textContent = 'Ei tuettu';
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    $('cacheState').textContent = 'Valmis';
  } catch (err) {
    $('cacheState').textContent = 'Virhe';
    addLog(`Offline-cache: ${err.message}`, 'warn');
  }
}

async function boot() {
  browserSupport();
  wireUi();
  updateUi();
  registerOffline();
  // Bluefy/iOS can stall on eager GATT reconnect during page load.
  // Keep startup deterministic: user taps YHDISTÄ VÄNÄ, then reconnect logic
  // is used only after an established connection drops.
  state.connecting = false;
  updateUi();
}

boot();
