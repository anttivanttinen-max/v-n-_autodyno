import {
  SERVICE_UUID, RX_UUID, TX_UUID,
  getOrCreateOwnerId, generateOwnerId, isValidOwnerId,
  commandStart, commandGps, commandStatus, commandRpmStatus,
  commandFinish, commandCancel, parseNotification, speedFromPosition,
} from './protocol.js';

const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
  log: [],
};

function nowStamp() {
  return new Date().toLocaleTimeString('fi-FI', { hour12: false });
}

function addLog(message, kind = 'info') {
  state.log.unshift({ time: nowStamp(), message, kind });
  state.log = state.log.slice(0, 80);
  $('log').innerHTML = state.log.map((x) =>
    `<div class="log-row ${x.kind}"><span>${x.time}</span><b>${escapeHtml(x.message)}</b></div>`
  ).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[c]);
}

function setStatus(message, tone = 'idle') {
  $('mainStatus').textContent = message;
  $('mainStatus').dataset.tone = tone;
}

function updateUi() {
  $('ownerId').textContent = state.ownerId;
  $('riderName').value = state.riderName;
  $('bleState').textContent = state.connected ? 'YHDISTETTY' : state.connecting ? 'YHDISTETÄÄN…' : 'EI YHTEYTTÄ';
  $('bleState').dataset.on = state.connected ? '1' : '0';
  $('sessionState').textContent = state.sessionActive ? `AKTIIVINEN · ${state.sessionOwner || '?'}` : 'EI SESSIOTA';
  $('sessionState').dataset.on = state.sessionActive ? '1' : '0';
  $('rpm').textContent = String(state.rpm || 0);
  $('speed').textContent = state.lastSpeedMps == null ? '—' : (state.lastSpeedMps * 3.6).toFixed(1);
  $('gpsAge').textContent = state.lastGpsFixAt ? `${Math.max(0, Date.now() - state.lastGpsFixAt)} ms` : '—';
  $('gpsCount').textContent = String(state.gpsSent);
  $('gpsDropped').textContent = String(state.gpsDropped);
  $('connectBtn').disabled = state.connecting;
  $('startBtn').disabled = !state.connected || state.sessionActive;
  $('finishBtn').disabled = !state.connected || !state.sessionActive || state.sessionOwner !== state.ownerId || state.rpm !== 0;
  $('cancelBtn').disabled = !state.connected || !state.sessionActive || state.sessionOwner !== state.ownerId;
  $('newOwnerBtn').disabled = state.sessionActive;
}

function browserSupport() {
  const hasBluetooth = !!navigator.bluetooth;
  const hasGeo = !!navigator.geolocation;
  $('supportBluetooth').textContent = hasBluetooth ? 'OK' : 'PUUTTUU';
  $('supportBluetooth').dataset.on = hasBluetooth ? '1' : '0';
  $('supportGps').textContent = hasGeo ? 'OK' : 'PUUTTUU';
  $('supportGps').dataset.on = hasGeo ? '1' : '0';
  if (!hasBluetooth) {
    setStatus('iPhone: avaa tämä sivu Bluefyssä. Android: käytä Chromea.', 'warn');
  } else if (!hasGeo) {
    setStatus('Sijaintipalvelu ei ole käytettävissä tässä selaimessa.', 'warn');
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
    } catch (_) {
      // Fall back to acknowledged write below.
    }
  }
  await state.rx.writeValue(bytes);
}

function onNotification(event) {
  const view = event.target.value;
  const text = decoder.decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)).trim();
  if (!text) return;
  const parsed = parseNotification(text);
  if (parsed.type !== 'rpm') addLog(`← ${text}`, parsed.type === 'error' ? 'error' : 'rx');

  switch (parsed.type) {
    case 'autotuneStatus':
      state.sessionActive = parsed.active;
      state.sessionOwner = parsed.owner || '';
      if (parsed.active && parsed.owner && parsed.owner !== state.ownerId) {
        setStatus(`VäNä on varattu toiselle puhelimelle (${parsed.owner}).`, 'warn');
      } else if (parsed.active) {
        setStatus('AutoTune aktiivinen. GPS menee suoraan VäNälle.', 'good');
        startGps();
      }
      break;
    case 'rpm':
      state.rpm = parsed.rpm;
      state.periodUs = parsed.periodUs;
      break;
    case 'ok':
      if (parsed.action === 'START') {
        state.sessionActive = true;
        state.sessionOwner = parsed.owner || state.ownerId;
        setStatus('AutoTune käynnissä.', 'good');
        startGps();
      } else if (parsed.action === 'FINISH') {
        state.sessionActive = false;
        state.sessionOwner = '';
        stopGps();
        setStatus('AutoTune valmis. BEST-kartta tallennettu VäNään.', 'good');
      } else if (parsed.action === 'CANCEL') {
        setStatus('Cancel hyväksytty. VäNä palauttaa session alkukartan.', 'warn');
        setTimeout(refreshStatus, 300);
      }
      break;
    case 'error':
      if (parsed.message.startsWith('BUSY')) {
        const other = parsed.message.split(/\s+/)[1] || '?';
        state.sessionActive = true;
        state.sessionOwner = other;
        stopGps();
        setStatus(`VäNä on toisen puhelimen sessiossa (${other}).`, 'warn');
      } else {
        setStatus(`VäNä: ${parsed.message}`, 'warn');
      }
      break;
    default:
      break;
  }
  updateUi();
}

async function bindDevice(device) {
  clearReconnect();
  state.device = device;
  state.connecting = true;
  updateUi();
  setStatus(`Yhdistetään ${device.name || 'VäNä'}…`, 'idle');

  device.removeEventListener?.('gattserverdisconnected', onDisconnected);
  device.addEventListener('gattserverdisconnected', onDisconnected);

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const rx = await service.getCharacteristic(RX_UUID);
  const tx = await service.getCharacteristic(TX_UUID);
  await tx.startNotifications();
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
  setStatus('VäNä yhdistetty.', 'good');
  await keepAwake(true);
  updateUi();
  await refreshStatus();
}

async function chooseAndConnect() {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth puuttuu. iPhonella avaa sivu Bluefyssä.');
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'VANA-Ignition' }],
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
  state.connected = false;
  state.connecting = false;
  state.server = null;
  state.rx = null;
  state.tx = null;
  addLog('BLE-yhteys katkesi. Sytytys jatkuu VäNässä; katkennut veto hylätään.', 'warn');
  setStatus('BLE katkesi — yritän yhdistää uudelleen. Sytytys jatkuu normaalisti.', 'warn');
  updateUi();
  scheduleReconnect();
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
      if (state.sessionActive || state.sessionOwner === state.ownerId) await refreshStatus();
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

async function refreshStatus() {
  if (!state.connected) return;
  try {
    await writeCommand(commandStatus(), { log: false });
    await writeCommand(commandRpmStatus(), { log: false });
  } catch (err) {
    addLog(`Status-virhe: ${err.message}`, 'warn');
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
    .then(() => {
      state.gpsSent += 1;
      updateUi();
    })
    .catch((err) => {
      state.gpsDropped += 1;
      addLog(`GPS→BLE jäi lähettämättä: ${err.message}`, 'warn');
      updateUi();
    });
}

function onGpsError(error) {
  state.gpsDropped += 1;
  addLog(`GPS-virhe: ${error.message}`, 'error');
  setStatus('GPS ei anna sijaintia. AutoTune ei muuta karttaa ilman GPS-dataa.', 'warn');
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
}

function stopGps() {
  if (state.gpsWatchId != null) navigator.geolocation?.clearWatch(state.gpsWatchId);
  state.gpsWatchId = null;
  state.lastPosition = null;
  state.lastSentPositionTimestamp = 0;
}

async function keepAwake(enable) {
  try {
    if (enable && navigator.wakeLock?.request) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    } else if (!enable && state.wakeLock) {
      await state.wakeLock.release();
      state.wakeLock = null;
    }
  } catch (_) {}

  try {
    if (typeof navigator.bluetooth?.setScreenDimEnabled === 'function') {
      await navigator.bluetooth.setScreenDimEnabled(!enable);
    }
  } catch (_) {}
}

async function startSession() {
  if (!state.connected) return;
  if (state.rpm !== 0) {
    setStatus('Sammuta moottori ennen uuden AutoTune-session aloitusta.', 'warn');
    return;
  }
  await writeCommand(commandStart(state.ownerId));
  setTimeout(refreshStatus, 250);
}

async function finishSession() {
  if (state.rpm !== 0) {
    setStatus('Finish vaatii RPM=0. Pysäytä moottori ensin.', 'warn');
    return;
  }
  await writeCommand(commandFinish(state.ownerId));
}

async function cancelSession() {
  if (!confirm('Perutaanko AutoTune ja palautetaanko session alkukartta?')) return;
  await writeCommand(commandCancel(state.ownerId));
}

async function resetOwnerId() {
  if (state.sessionActive) return;
  const next = generateOwnerId();
  localStorage.setItem('motorlab.autotune.ownerId.v1', next);
  state.ownerId = next;
  addLog(`Uusi puhelintunnus: ${next}`, 'good');
  updateUi();
}

function wireUi() {
  $('connectBtn').addEventListener('click', () => chooseAndConnect().catch((err) => {
    state.connecting = false;
    setStatus(err.message, 'warn');
    addLog(`BLE: ${err.message}`, 'error');
    updateUi();
  }));
  $('startBtn').addEventListener('click', () => startSession().catch((err) => addLog(err.message, 'error')));
  $('finishBtn').addEventListener('click', () => finishSession().catch((err) => addLog(err.message, 'error')));
  $('cancelBtn').addEventListener('click', () => cancelSession().catch((err) => addLog(err.message, 'error')));
  $('statusBtn').addEventListener('click', refreshStatus);
  $('newOwnerBtn').addEventListener('click', resetOwnerId);
  $('riderName').addEventListener('change', (event) => {
    state.riderName = event.target.value.trim().slice(0, 32);
    localStorage.setItem('motorlab.autotune.riderName', state.riderName);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.connected) {
      keepAwake(true);
      refreshStatus();
    }
  });
  setInterval(() => {
    if (state.connected) refreshStatus();
    updateUi();
  }, 1000);
}

async function boot() {
  browserSupport();
  wireUi();
  updateUi();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => addLog(`Offline-cache: ${err.message}`, 'warn'));
  }
  if (navigator.bluetooth && navigator.geolocation) {
    try {
      const didReconnect = await reconnectKnownDevice();
      if (!didReconnect) setStatus('Valmis. Yhdistä VäNä.', 'idle');
    } catch (err) {
      addLog(`Automaattinen reconnect: ${err.message}`, 'warn');
      setStatus('Valmis. Paina Yhdistä VäNä.', 'idle');
    }
  }
}

boot();
