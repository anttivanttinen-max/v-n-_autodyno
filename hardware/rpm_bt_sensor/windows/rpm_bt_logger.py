import argparse, asyncio, csv, json, struct, sys
from datetime import datetime, timezone
from pathlib import Path

DEVICE = "MotoLab-RPM-BT"
TELEMETRY = "7b7d0002-6b8a-4f2a-9c4b-3b9a4e4d0001"
CONFIG = "7b7d0003-6b8a-4f2a-9c4b-3b9a4e4d0001"
FORMAT = "<BBHIfffBBHIHHHH"
FIELDS = ["version","flags","sequence","uptimeMs","rpm","rawRpm","pulsesPerRev","confidence","reserved","windowAccepted","acceptedTotal","noiseRejected","jumpRejected","dropoutCount","resetCounter"]

def decode(payload: bytes):
    if len(payload) != struct.calcsize(FORMAT): raise ValueError(f"payload length {len(payload)} != 36")
    d = dict(zip(FIELDS, struct.unpack(FORMAT, payload)))
    d["engineOff"] = bool(d["flags"] & 1); d["signalValid"] = bool(d["flags"] & 2)
    return d

async def run(args):
    from bleak import BleakClient, BleakScanner
    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csvf = (out/f"rpm_bt_{stamp}.csv").open("w", newline="", encoding="utf-8")
    jsonf = (out/f"rpm_bt_{stamp}.jsonl").open("w", encoding="utf-8")
    rawf = (out/f"rpm_bt_{stamp}.raw").open("w", encoding="ascii")
    cols = ["hostTimeUtc","blePacketLoss"] + FIELDS + ["engineOff","signalValid"]
    writer = csv.DictWriter(csvf, fieldnames=cols); writer.writeheader()
    print(f"Searching for {DEVICE}...")
    device = await BleakScanner.find_device_by_filter(lambda d, ad: d.name == DEVICE, timeout=20)
    if not device: raise RuntimeError(f"{DEVICE} not found; check power, firmware and Windows Bluetooth")
    last_seq = None; loss = 0
    async with BleakClient(device) as client:
        if args.ppr is not None: await client.write_gatt_char(CONFIG, f"PPR={args.ppr:.3f}".encode(), response=True)
        def notify(_, payload: bytearray):
            nonlocal last_seq, loss
            host = datetime.now(timezone.utc).isoformat()
            try:
                d = decode(bytes(payload))
                if last_seq is not None: loss += ((d["sequence"] - last_seq) & 0xffff) - 1
                last_seq = d["sequence"]
                row = {"hostTimeUtc":host,"blePacketLoss":loss,**d}
                writer.writerow(row); csvf.flush(); jsonf.write(json.dumps(row,separators=(",",":"))+"\n"); jsonf.flush()
                rawf.write(f"{host} {bytes(payload).hex()}\n"); rawf.flush()
                print(f"\rRPM {d['rpm']:7.1f} conf {d['confidence']:3d} valid {int(d['signalValid'])} off {int(d['engineOff'])} noise {d['noiseRejected']} jump {d['jumpRejected']} loss {loss}", end="", flush=True)
            except Exception as e: print(f"\nDecode error: {e}", file=sys.stderr)
        await client.start_notify(TELEMETRY, notify)
        print("Connected. Ctrl+C stops and closes logs.")
        try:
            while True: await asyncio.sleep(1)
        finally:
            await client.stop_notify(TELEMETRY); csvf.close(); jsonf.close(); rawf.close()

def main():
    p=argparse.ArgumentParser(); p.add_argument("--ppr",type=float); p.add_argument("--output",default=str(Path(__file__).parent/"logs")); a=p.parse_args()
    if a.ppr is not None and not 0.1 <= a.ppr <= 8.0: p.error("--ppr must be 0.1..8.0")
    try: asyncio.run(run(a))
    except KeyboardInterrupt: print("\nStopped; logs saved.")
    except Exception as e: print(f"\nERROR: {e}"); input("Press Enter to close..."); raise SystemExit(1)
if __name__ == "__main__": main()

