# MotoLab Finland Vehicle Catalog v2 — staging ready

Date: 2026-08-16
Branch: `vehicle-search-prep`
Production/main: **NOT INSTALLED**

## State

The Finland-focused road-legal 50 cc geared-moped and 125 cc A1 dataset has been expanded as far as practical in this research pass. Internal gearbox ratios are the highest-priority field. Primary reduction, engine basics, engine family and generation splits are included where available.

Uncertain/model-family ratios are retained as weak Gear Learn priors because a partially correct ratio can help identify a gear. They must never force a gear and must always yield to learned GPS/RPM data. User profile values override catalog values.

## Strongly covered gearbox families/models

50 cc: Minarelli AM6 family, Derbi EBE/EBS/D50B family, CPI SM/SX and AM6-type weak candidates for Generic/Keeway where exact model proof is weaker.

125 cc coverage includes verified or generation-verified data for major Yamaha DT/YZF/MT/WR/TZR/TDR/YBR/YS/XT families; Honda CBR/CB/CBF/Varadero/NSR/XR/MSX/Monkey families; Kawasaki Ninja/Z/KLX/KMX/Eliminator families; Suzuki GSX-R/GSX-S/DR/VanVan/GN/GZ/RG families; Aprilia RS/RX/SX generations; Beta RR125 2T and LC 4T; Husqvarna SM/WRE/WR/TE and current LC4c-platform candidates; KTM EXC and current LC4c Duke/SMC R/Enduro R; Derbi GPR/Terra/Mulhacen families; Fantic Caballero/XMF/XEF; Cagiva Raptor/Planet and Mito generation candidates; Hyosung GT125; Zontes G1/ZT family; and Keeway Superlight/RKS partial family data.

## Remaining exact internal-ratio gaps

Exact internal ratios remain intentionally blank where model-specific proof was not strong enough: Benelli BN125, Benelli TNT125, Brixton Cromwell/BX125 internal-only gear pairs, Brixton Felsberg125 internal-only gear pairs and Keeway RKF125. Some model names also span multiple engine generations; those must remain generation-specific rather than receiving one global ratio set.

Brixton's published 5 values `33.767 / 21.257 / 15.881 / 12.858 / 10.515` are stored only as `overallTransmissionRatios`; they are **not** treated as internal gear-pair ratios.

Suzuki GZ125 is no longer pending: OEM tooth counts provide 1st–5th as 33/11, 26/14, 26/19, 23/21 and 21/23, with primary 59/17.

## Integration package

- `vehicle_catalog_finland_v2_ready_manifest.json` defines deterministic overlay order and safety policy.
- `scripts/build_finland_vehicle_catalog_v2.mjs` builds and validates a single staging artifact when integration is authorized.
- `vehicle_catalog_finland_v2_loader.js` is a prepared rich runtime loader that preserves engine data, primary ratio, gear ratios, confidence and Gear Learn policy.
- All source/research rounds remain separate for traceability.

## Before main

Do not merge the whole divergent research branch. Integration should be a controlled pick/build from this manifest onto current `main`, followed by JSON validation, representative search tests and a check that weak priors cannot override GPS/RPM learned data. Only perform that step after explicit user approval.
