import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'vehicle_catalog_finland_v2_ready_manifest.json'), 'utf8'));
const base = JSON.parse(await fs.readFile(path.join(root, manifest.base), 'utf8'));

const out = structuredClone(base);
out.schema = 'motolab_vehicle_catalog_finland_v2_ready';
out.production = false;
out.readyForControlledIntegration = true;
out.updated = manifest.updated;
out.gearboxFamilies = { ...(out.gearboxFamilies || {}) };
out.vehicles = Array.isArray(out.vehicles) ? out.vehicles : [];

const byId = new Map(out.vehicles.map(v => [v.id, v]));
const applied = [];
const missingTargets = [];

function mergeDefined(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeDefined(target[key], value);
    } else {
      target[key] = structuredClone(value);
    }
  }
  return target;
}

for (const overlayFile of manifest.overlayOrder) {
  const data = JSON.parse(await fs.readFile(path.join(root, overlayFile), 'utf8'));
  const gearboxDefs = data.gearboxes || data.gearboxFamilies || {};
  for (const [key, def] of Object.entries(gearboxDefs)) {
    out.gearboxFamilies[key] = mergeDefined(out.gearboxFamilies[key] || {}, def);
  }
  for (const overlay of data.vehicleOverlays || []) {
    const target = byId.get(overlay.targetId);
    if (!target) {
      missingTargets.push({ file: overlayFile, targetId: overlay.targetId });
      continue;
    }
    const patch = structuredClone(overlay);
    delete patch.targetId;
    mergeDefined(target, patch);
    const family = target.gearbox ? out.gearboxFamilies[target.gearbox] : null;
    if (family) {
      if (target.speeds == null && family.speeds != null) target.speeds = family.speeds;
      if (target.gearRatios == null && Array.isArray(family.ratios)) target.gearRatios = structuredClone(family.ratios);
      if (target.primaryRatio == null && family.primaryRatio != null) target.primaryRatio = family.primaryRatio;
      if (!target.gearRatioConfidence && family.confidence) target.gearRatioConfidence = family.confidence;
    }
    applied.push({ file: overlayFile, targetId: overlay.targetId });
  }
}

const issues = [];
const seen = new Set();
for (const v of out.vehicles) {
  if (!v.id) issues.push({ type: 'missing-id', model: `${v.make || ''} ${v.model || ''}`.trim() });
  if (seen.has(v.id)) issues.push({ type: 'duplicate-id', id: v.id });
  seen.add(v.id);
  const ratios = v.gearRatios || (v.gearbox && out.gearboxFamilies[v.gearbox]?.ratios) || null;
  const speeds = v.speeds || (v.gearbox && out.gearboxFamilies[v.gearbox]?.speeds) || null;
  if (Array.isArray(ratios) && speeds && ratios.length !== speeds) issues.push({ type: 'ratio-count-mismatch', id: v.id, speeds, ratioCount: ratios.length });
  if (Array.isArray(v.overallTransmissionRatios) && Array.isArray(ratios) && v.overallTransmissionRatios === ratios) issues.push({ type: 'overall-used-as-internal', id: v.id });
  const conf = String(v.gearboxOverrideConfidence || v.gearRatioConfidence || '').toLowerCase();
  if (/probable|candidate|reference-only/.test(conf)) v.gearLearnPolicy = 'weak-prior-only';
  else if (/verified/.test(conf)) v.gearLearnPolicy = 'strong-seed-yields-to-learned-data';
  else if (!ratios) v.gearLearnPolicy = 'no-ratio-seed';
}

out.buildReport = {
  manifest: 'vehicle_catalog_finland_v2_ready_manifest.json',
  overlaysApplied: applied.length,
  missingOverlayTargets: missingTargets,
  validationIssues: issues,
  generatedAt: new Date().toISOString(),
  note: 'Staging artifact only. Do not merge to production without explicit approval.'
};

const outPath = path.join(root, 'vehicle_catalog_finland_v2_ready.json');
await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ outPath, vehicles: out.vehicles.length, gearboxes: Object.keys(out.gearboxFamilies).length, applied: applied.length, missingTargets, issues }, null, 2));
