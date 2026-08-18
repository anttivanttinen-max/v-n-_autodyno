#!/usr/bin/env python3
import argparse, asyncio, csv, json, math, struct, sys, time
from datetime import datetime, timezone
from pathlib import Path
from bleak import BleakClient, BleakScanner

SERVICE="f7b10001-6a4d-4b2a-9c41-7a3b84d2e001"
MEAS="f7b10002-6a4d-4b2a-9c41-7a3b84d2e001"
STATUS="f7b10003-6a4d-4b2a-9c41-7a3b84d2e001"
CONFIG="f7b10004-6a4d-4b2a-9c41-7a3b84d2e001"
FMT="<BBHIIHBBfHH"
FIELDS=("version","source","flags","seq","timestamp_ms","rpm","confidence","signal","raw_frequency_hz","raw_candidate_rpm","rejection_count")

def decode(data):
    if len(data)!=24: raise ValueError(f"measurement length {len(data)}, expected 24")
    d=dict(zip(FIELDS,struct.unpack(FMT,data)))
    f=d["flags"]
    d.update(valid=bool(f&1),learning_eligible=bool(f&2),engine_validated=bool(f&4),
             dropout=bool(f&8),jump_rejected=bool(f&16),harmonic_adjusted=bool(f&32))
    return d

async def choose(address=None):
    if address: return address
    print("Etsitään VANA-RPM-BT-anturia...")
    devices=await BleakScanner.discover(timeout=8,return_adv=True)
    found=[]
    for addr,(dev,adv) in devices.items():
        name=adv.local_name or dev.name or ""
        if name.startswith("VANA-RPM-BT") or SERVICE.lower() in [str(x).lower() for x in adv.service_uuids]: found.append((dev,name))
    if not found: raise RuntimeError("Anturia ei löytynyt. Tarkista virta, Bluetooth ja firmware.")
    for i,(d,n) in enumerate(found,1): print(f"  {i}: {n}  {d.address}")
    if len(found)==1:return found[0][0].address
    return found[int(input("Valitse numero: "))-1][0].address

def load_gps(path):
    if not path:return []
    rows=[]
    with open(path,encoding="utf-8-sig",newline="") as f:
        for r in csv.DictReader(f):
            try: rows.append((float(r["host_unix_ms"]),float(r["gps_reference_rpm"])))
            except (KeyError,ValueError): pass
    return rows

def nearest_gps(rows,ts,tolerance=500):
    if not rows:return None
    t,r=min(rows,key=lambda x:abs(x[0]-ts))
    return r if abs(t-ts)<=tolerance else None

async def run(args):
    address=await choose(args.address); out=Path(args.output or ("sessions/"+datetime.now().strftime("rpm_bt_%Y%m%d_%H%M%S")))
    out.parent.mkdir(parents=True,exist_ok=True); csv_path=out.with_suffix(".csv"); jsonl_path=out.with_suffix(".jsonl")
    gps=load_gps(args.gps_csv); samples=[]; done=asyncio.Event(); started=time.monotonic()
    with csv_path.open("w",newline="",encoding="utf-8") as cf, jsonl_path.open("w",encoding="utf-8") as jf:
        writer=None
        async with BleakClient(address,timeout=20) as client:
            if args.pulses_per_rev:
                payload=json.dumps({"pulsesPerRev":args.pulses_per_rev}).encode()
                await client.write_gatt_char(CONFIG,payload,response=True)
            status=(await client.read_gatt_char(STATUS)).decode(errors="replace"); print("Yhdistetty:",status)
            def on_data(_,data):
                nonlocal writer
                try:d=decode(bytes(data))
                except Exception as e: print("Virheellinen paketti:",e);return
                host_ms=time.time()*1000; d["host_unix_ms"]=round(host_ms,3); d["host_iso_utc"]=datetime.now(timezone.utc).isoformat()
                ref=nearest_gps(gps,host_ms); d["gps_reference_rpm"]=ref
                d["error_pct_to_gps"]=(100*(d["rpm"]-ref)/ref) if ref and d["valid"] else None
                if writer is None: writer=csv.DictWriter(cf,fieldnames=list(d)); writer.writeheader()
                writer.writerow(d); cf.flush(); jf.write(json.dumps(d,separators=(",",":"))+"\n"); jf.flush(); samples.append(d)
                flags="OK" if d["valid"] else "INVALID"
                print(f"\r{flags:7} RPM {d['rpm']:5}  conf {d['confidence']:3}%  raw {d['raw_frequency_hz']:8.2f} Hz  seq {d['seq']:8}",end="",flush=True)
                if args.seconds and time.monotonic()-started>=args.seconds: done.set()
            await client.start_notify(MEAS,on_data)
            try: await done.wait() if args.seconds else await asyncio.Future()
            except (KeyboardInterrupt,asyncio.CancelledError): pass
            finally: await client.stop_notify(MEAS)
    print(f"\nTallennettu: {csv_path} ja {jsonl_path}")
    summarize(samples)

def percentile(v,p):
    if not v:return None
    s=sorted(v); i=(len(s)-1)*p; lo=math.floor(i); hi=math.ceil(i)
    return s[lo] if lo==hi else s[lo]*(hi-i)+s[hi]*(i-lo)

def summarize(rows):
    valid=[r for r in rows if r.get("valid")]; errors=[abs(r["error_pct_to_gps"]) for r in valid if r.get("error_pct_to_gps") is not None]
    gaps=sum(max(0,b["seq"]-a["seq"]-1) for a,b in zip(rows,rows[1:])); total=(rows[-1]["seq"]-rows[0]["seq"]+1) if len(rows)>1 else len(rows)
    result={"samples":len(rows),"valid_samples":len(valid),"valid_pct":100*len(valid)/len(rows) if rows else 0,
            "sequence_gaps":gaps,"sequence_completeness_pct":100*(total-gaps)/total if total else 0,
            "gps_abs_error_median_pct":percentile(errors,.5),"gps_abs_error_p95_pct":percentile(errors,.95)}
    print(json.dumps(result,indent=2))

def replay(path):
    rows=[]
    with open(path,encoding="utf-8-sig",newline="") as f:
        if str(path).lower().endswith(".jsonl"): rows=[json.loads(x) for x in f if x.strip()]
        else: rows=list(csv.DictReader(f));
    for r in rows:
        for k in ("seq","rpm"): r[k]=int(r[k]); r["valid"]=str(r.get("valid","")).lower() in ("1","true")
        e=r.get("error_pct_to_gps"); r["error_pct_to_gps"]=float(e) if e not in (None,"","None") else None
    summarize(rows)

def main():
    p=argparse.ArgumentParser(description="VÄNÄ RPM-BT live logger and calibration summary")
    p.add_argument("--address");p.add_argument("--output");p.add_argument("--seconds",type=int,default=0)
    p.add_argument("--pulses-per-rev",type=float);p.add_argument("--gps-csv",help="CSV columns host_unix_ms,gps_reference_rpm")
    p.add_argument("--replay",help="Summarize an existing CSV/JSONL")
    a=p.parse_args()
    if a.replay:return replay(a.replay)
    try:asyncio.run(run(a))
    except KeyboardInterrupt:pass
    except Exception as e: print("\nVIRHE:",e);sys.exit(1)
if __name__=="__main__":main()

