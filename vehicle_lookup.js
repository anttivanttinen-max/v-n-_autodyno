(() => {
  'use strict';
  const MODULE_VERSION = 'v32-vehicle-lookup-1';
  let catalog = null;
  let matches = [];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function findKnowledgePanel() {
    return [...document.querySelectorAll('.panel')].find(p => /VEHICLE\s*\/\s*ENGINE KNOWLEDGE BASE/i.test(p.textContent || '')) || null;
  }

  function injectUi() {
    if (document.getElementById('vehicleLookupPanel')) return;
    const kbPanel = findKnowledgePanel();
    if (!kbPanel) return;
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'vehicleLookupPanel';
    panel.innerHTML = `
      <div class="phead"><div class="ptitle"><span class="r">🔎</span> AJONEUVOTIEDON HAKU</div><span class="tiny">${MODULE_VERSION}</span></div>
      <div class="form">
        <label class="full">Hae merkki / malli / versio<input id="vehicleLookupInput" value="Derbi Senda 50" placeholder="esim. Derbi Senda 50"></label>
        <button id="vehicleLookupBtn" class="action full" type="button">HAE AJONEUVOTIEDOT</button>
      </div>
      <div id="vehicleLookupStatus" class="statusbox">Tietoja ei kirjoiteta profiiliin ennen kuin hyväksyt ehdotuksen.</div>
      <div id="vehicleLookupResults" class="runlist"></div>`;
    kbPanel.parentNode.insertBefore(panel, kbPanel);
    document.getElementById('vehicleLookupBtn').addEventListener('click', search);
    document.getElementById('vehicleLookupInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); search(); }
    });
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    const r = await fetch('./vehicle_catalog.json?v=32', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j || !Array.isArray(j.entries)) throw new Error('Virheellinen ajoneuvotietokanta');
    catalog = j;
    return j;
  }

  function score(e, q) {
    const hay = [e.make, e.model, e.variant, e.engineCode, ...(e.aliases || [])].filter(Boolean).join(' ').toLowerCase();
    const parts = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 0;
    let hits = 0;
    for (const p of parts) if (hay.includes(p)) hits++;
    return hits / parts.length;
  }

  async function search() {
    const q = (document.getElementById('vehicleLookupInput')?.value || '').trim();
    const status = document.getElementById('vehicleLookupStatus');
    if (!q) { status.textContent = 'Kirjoita merkki tai malli.'; return; }
    status.textContent = 'Haetaan ajoneuvotietoja…';
    try {
      const db = await loadCatalog();
      matches = db.entries.map(e => ({ e, s: score(e, q) }))
        .filter(x => x.s >= 0.5)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map(x => x.e);
      render(q);
    } catch (e) {
      status.textContent = 'Ajoneuvotietokannan lataus epäonnistui: ' + e.message;
    }
  }

  function render(q) {
    const status = document.getElementById('vehicleLookupStatus');
    const box = document.getElementById('vehicleLookupResults');
    if (!matches.length) {
      box.innerHTML = '';
      status.textContent = `Ei osumaa haulle “${q}”. Tietokantaa kasvatetaan jatkuvasti.`;
      return;
    }
    status.textContent = `Löytyi ${matches.length} ehdotusta. Vahvista oikea versio ennen tallennusta.`;
    box.innerHTML = matches.map(e => {
      const y = e.yearFrom ? (e.yearTo && e.yearTo !== e.yearFrom ? `${e.yearFrom}–${e.yearTo}` : `${e.yearFrom}`) : 'vuosimalli vahvistettava';
      const eng = e.engine || {};
      const d = e.drivetrain || {};
      const src = e.source || {};
      const wheels = d.frontWheelIn ? `etu ${d.frontWheelIn}\" • taka ${d.rearWheelIn}\" • ` : '';
      return `<div class="runCard good">
        <h4>${esc(e.make)} ${esc(e.model)} ${esc(e.variant || '')}</h4>
        <p>${esc(y)} • ${esc(e.engineType || '–')} • ${eng.displacementCc ?? '–'} cc • ${eng.cooling === 'liquid' ? 'nestejäähdytys' : esc(eng.cooling || '')}</p>
        <p>${wheels}${src.verified ? '✓ virallinen lähde' : 'lähde vahvistettava'}</p>
        <button class="action" type="button" data-vehicle-id="${esc(e.id)}" style="margin-top:7px;width:100%">KÄYTÄ EHDOTUSTA</button>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-vehicle-id]').forEach(b => b.addEventListener('click', () => apply(b.dataset.vehicleId)));
  }

  function apply(id) {
    const e = matches.find(x => x.id === id);
    if (!e) return;
    if (typeof getCurrentProfile !== 'function' || typeof saveCurrentProfile !== 'function') {
      document.getElementById('vehicleLookupStatus').textContent = 'MotoLab-profiilirajapinta ei ole käytettävissä.';
      return;
    }
    const cur = getCurrentProfile();
    const kb = JSON.parse(JSON.stringify(cur.knowledge || {}));
    kb.engine = { ...(kb.engine || {}) };
    kb.drivetrain = { ...(kb.drivetrain || {}) };
    const eng = e.engine || {};
    const d = e.drivetrain || {};
    if (eng.displacementCc != null) kb.engine.displacementCc = eng.displacementCc;
    if (eng.cylinders != null) kb.engine.cylinders = eng.cylinders;
    if (eng.cooling) kb.engine.cooling = eng.cooling;
    if (d.frontWheelIn != null) kb.drivetrain.frontWheelIn = d.frontWheelIn;
    if (d.rearWheelIn != null) kb.drivetrain.rearWheelIn = d.rearWheelIn;
    const src = e.source || {};
    const identity = [e.make, e.model, e.variant].filter(Boolean).join(' ');
    const lookupNote = [
      `Ajoneuvohaku: ${identity}`,
      e.yearFrom ? `vuosimalli ${e.yearFrom}${e.yearTo && e.yearTo !== e.yearFrom ? '–' + e.yearTo : ''}` : '',
      src.verified ? 'lähde: virallinen' : 'lähde: vahvistettava',
      src.url || '',
      e.notes || ''
    ].filter(Boolean).join(' | ');
    const oldNotes = String(kb.notes || '').trim();
    if (!oldNotes.includes(`Ajoneuvohaku: ${identity}`)) kb.notes = [oldNotes, lookupNote].filter(Boolean).join(' | ');
    saveCurrentProfile({ name: identity || cur.name, engineType: e.engineType || cur.engineType, knowledge: kb });
    if (typeof renderProfiles === 'function') renderProfiles();
    const status = document.getElementById('vehicleLookupStatus');
    status.textContent = `Hyväksytty: ${identity}. Tarkista vuosimalli ja puuttuvat tiedot Knowledge Basesta.`;
    const kbStatus = document.getElementById('kbStatus');
    if (kbStatus) kbStatus.textContent = `Ajoneuvotieto lisätty: ${identity}. Epävarmoja arvoja ei täytetty.`;
    if (typeof addLearningEvent === 'function') addLearningEvent('vehicle_lookup_applied', { vehicleId: e.id, sourceVerified: !!src.verified });
  }

  function boot() {
    injectUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
