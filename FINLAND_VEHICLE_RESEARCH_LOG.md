# MotoLab Finland vehicle catalog research log

Updated: 2026-08-16
Branch: `vehicle-search-prep` only. Nothing in this file is installed to production until explicit approval.

## Current staging scope

Road-legal Finnish 50 cc geared mopeds and 125 cc A1 motorcycles are staged in `vehicle_catalog_finland_staging.json`.

Priority order for technical research:
1. Internal gearbox ratios (1st–6th)
2. Primary ratio
3. Exact engine family / generation mapping
4. Useful service and fluid data
5. Final sprockets only as editable factory reference

Uncertain gearbox ratios are retained as candidates with `pending` or `probable` confidence. They may assist Gear Learn, but must never override measured/learned GPS↔RPM data.

## Market evidence collected

Current Nettimoto used-moped listings visibly contain Derbi Senda, Yamaha DT50, Gilera SMT, Beta RR and Rieju MRT. Separate current listings also confirm Fantic Caballero 50 and Peugeot XPS / Motorhispania RYZ type road-legal mopeds in Finland.

Current Nettimoto A1 listings visibly contain Yamaha YZF-R125 and a substantial Husqvarna SM 125 population. These are therefore kept at high/very-high Finland priority.

## Primary-source evidence collected

- Rieju official user-manual portal currently provides manuals for MRT 50, MRT 50 Pro, MRT 50 SM, MRT 50 SM Pro and MRT 50 SM Trophy. Exact gearbox ratios still need extraction/verification from the appropriate generation manual.
- Yamaha official current R125 specification confirms 125 cc 4-stroke, chain final drive and constant-mesh 6-speed transmission. Exact internal ratios still need generation-specific service/manual verification.
- KTM official Finland 125 Duke specification confirms a 124.99 cc 4-stroke single and 6-speed transmission. KTM official manual portal is the preferred source for generation-specific ratio extraction.

## Already strong ratio references

- Yamaha DT125R 2000-era: 2.833 / 1.875 / 1.412 / 1.143 / 0.957 / 0.818; primary 3.227. Keep verified reference already present in MotoLab catalog.
- Derbi 6-speed family staging reference: 3.09 / 2.00 / 1.50 / 1.20 / 1.04 / 0.95; primary 3.5. Keep as probable at family level until exact EBS/EBE/D50B0 generation mapping is fully cross-checked.

## Next research batches

### 50 cc highest priority
Rieju MRT 50, Yamaha DT50 R/X, Aprilia SX/RX 50, Beta RR 50, Gilera SMT/RCR, Sherco 50, Fantic Caballero 50.

### 50 cc secondary
Motorhispania RYZ, Peugeot XPS, MBK X-Limit, Malaguti XSM/XTM, Generic Trigger, CPI SM/SX.

### 125 cc highest priority
Yamaha YZF-R125, MT-125, WR125X/R, DT125R/X; KTM 125 Duke, RC125, EXC125; Husqvarna SM/SMS125 and WRE125; Honda CBR125R and CB125R; Aprilia RS125.

### 125 cc secondary
Aprilia SX/RX125, Beta RR125, Kawasaki Ninja 125 / Z125, Suzuki GSX-R125 / GSX-S125, Derbi GPR125.

## Installation rule

Research and catalog additions stay on `vehicle-search-prep`. Production `main` is not changed until the user explicitly approves installation after concurrent MotoLab work is clear.
