#!/usr/bin/env python3
"""MotorLab Zeel Studio development UI for evidence-gated PCDI-10VT work."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import threading
import tkinter as tk
from datetime import datetime, timezone
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

APP_DIR = Path(__file__).resolve().parent
WORK_DIR = APP_DIR.parent
DEFAULT_BLOCK = WORK_DIR / "analyzer_restore_snapshot" / "cluster_10_frames_530475-532423_poll_values.bin"
BRIDGE = WORK_DIR / "ZeelProg-SafeProgramBridge.ps1"
READ_BRIDGE = WORK_DIR / "ZeelProg-ControlBridge.ps1"
ANALYZER = WORK_DIR / "Analyze-ZeelUsbPcapRead.ps1"
CAPTURE_STARTER = WORK_DIR / "Start-MotoLabZeelUsbCapture.ps1"
CAPTURE_DIR = Path.home() / "Documents" / "MotoLab" / "ZeelCapture"
LIVE_READ_DIR = APP_DIR / "live_reads"
VERSION_DIR = APP_DIR / "versions"
AUDIT_FILE = APP_DIR / "audit.jsonl"
BLOCK_SIZE = 480


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode_block(data: bytes) -> dict:
    if len(data) != BLOCK_SIZE:
        raise ValueError(f"Odotettiin {BLOCK_SIZE} tavua, saatiin {len(data)}")
    map1_advance = [int.from_bytes(data[i:i + 2], "little") / 10 for i in range(47, 67, 2)]
    map2_advance = [int.from_bytes(data[i:i + 2], "little") / 10 for i in range(67, 87, 2)]
    map1_rpm = [value * 100 for value in data[107:117]]
    map2_rpm = [value * 100 for value in data[127:137]]
    return {
        "description": data[0:32].decode("ascii", errors="replace").rstrip(),
        "ignition_map_1": list(zip(map1_rpm, map1_advance)),
        "ignition_map_2": list(zip(map2_rpm, map2_advance)),
        "point_counts": list(data[137:140]),
        "shift_light_rpm": data[140] * 100,
        "shift_light_mirror_rpm": data[364] * 100,
        "raw_sha256": sha256(data),
    }


class MapChart(tk.Canvas):
    def __init__(self, master, **kwargs):
        super().__init__(master, background="#101820", highlightthickness=0, **kwargs)
        self.maps: list[tuple[str, str, list[tuple[int, float]]]] = []
        self.bind("<Configure>", lambda _event: self.draw())

    def set_maps(self, maps):
        self.maps = maps
        self.draw()

    def draw(self):
        self.delete("all")
        width, height = max(self.winfo_width(), 320), max(self.winfo_height(), 220)
        left, top, right, bottom = 58, 24, width - 22, height - 40
        self.create_rectangle(left, top, right, bottom, outline="#40505c")
        for rpm in range(0, 17000, 2000):
            x = left + (right - left) * rpm / 16000
            self.create_line(x, top, x, bottom, fill="#26343e")
            self.create_text(x, bottom + 16, text=str(rpm), fill="#9fb0bd", font=("Segoe UI", 8))
        for deg in range(0, 31, 5):
            y = bottom - (bottom - top) * deg / 30
            self.create_line(left, y, right, y, fill="#26343e")
            self.create_text(left - 20, y, text=str(deg), fill="#9fb0bd", font=("Segoe UI", 8))
        for name, color, points in self.maps:
            coords = []
            for rpm, advance in points:
                coords.extend((left + (right - left) * rpm / 16000, bottom - (bottom - top) * advance / 30))
            if len(coords) >= 4:
                self.create_line(*coords, fill=color, width=2, smooth=False)
                for index in range(0, len(coords), 2):
                    self.create_oval(coords[index] - 3, coords[index + 1] - 3, coords[index] + 3, coords[index + 1] + 3, fill=color, outline="")
        legend_x = left + 8
        for index, (name, color, _points) in enumerate(self.maps):
            self.create_text(legend_x, top + 12 + index * 18, text=name, fill=color, anchor="w", font=("Segoe UI Semibold", 9))


class ZeelStudio(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("VÄNÄ MotorLab — Zeel Studio (DEV)")
        self.geometry("1380x860")
        self.minsize(980, 680)
        self.configure(bg="#0b1218")
        self.raw: bytes | None = None
        self.model: dict | None = None
        self.baseline: bytes | None = None
        self.source_path: Path | None = None
        self.device_var = tk.StringVar(value="Ei tarkistettu")
        self.hash_var = tk.StringVar(value="—")
        self.shift_var = tk.StringVar(value="—")
        self.mode_var = tk.StringVar(value="Vain luku")
        self.source_var = tk.StringVar(value="—")
        self.quality_var = tk.StringVar(value="Ei dataa")
        self.capture_var = tk.StringVar(value="Ei tarkistettu")
        self._styles()
        self._build_menu()
        self._build()
        if DEFAULT_BLOCK.exists():
            self.load_block(DEFAULT_BLOCK, set_baseline=True)

    def _styles(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background="#0b1218")
        style.configure("Card.TFrame", background="#14212b")
        style.configure("TLabel", background="#0b1218", foreground="#d8e3ea", font=("Segoe UI", 10))
        style.configure("Card.TLabel", background="#14212b", foreground="#d8e3ea", font=("Segoe UI", 10))
        style.configure("Title.TLabel", background="#0b1218", foreground="#ffffff", font=("Segoe UI Semibold", 20))
        style.configure("Muted.TLabel", background="#0b1218", foreground="#8ca0ae", font=("Segoe UI", 9))
        style.configure("Accent.TButton", font=("Segoe UI Semibold", 10), padding=9, background="#e35b24", foreground="white")
        style.map("Accent.TButton", background=[("active", "#ff7439")])
        style.configure("TButton", font=("Segoe UI", 10), padding=8, background="#253744", foreground="#edf4f7")
        style.configure("TNotebook", background="#0b1218", borderwidth=0)
        style.configure("TNotebook.Tab", padding=(16, 9), background="#1b2a35", foreground="#b9c8d1")
        style.map("TNotebook.Tab", background=[("selected", "#e35b24")], foreground=[("selected", "white")])
        style.configure("Treeview", background="#101820", fieldbackground="#101820", foreground="#d8e3ea", rowheight=28)
        style.configure("Treeview.Heading", background="#253744", foreground="white")

    def _build_menu(self):
        menubar = tk.Menu(self)

        file_menu = tk.Menu(menubar, tearoff=False)
        file_menu.add_command(label="Avaa 480 B lukublokki…", command=self.open_block, accelerator="Ctrl+O")
        file_menu.add_command(label="Tallenna nykyinen versio", command=self.save_version, accelerator="Ctrl+S")
        file_menu.add_command(label="Avaa lähdekansio", command=self.open_source_folder)
        file_menu.add_separator()
        file_menu.add_command(label="Sulje", command=self.destroy, accelerator="Alt+F4")
        menubar.add_cascade(label="Tiedosto", menu=file_menu)

        connection_menu = tk.Menu(menubar, tearoff=False)
        connection_menu.add_command(label="Päivitä yhteystila", command=self.refresh_environment, accelerator="F5")
        connection_menu.add_command(label="Tarkista Zeel-laite", command=self.inspect_device)
        connection_menu.add_command(label="Lue CDI turvallisesti", command=self.read_cdi, accelerator="Ctrl+R")
        connection_menu.add_separator()
        connection_menu.add_command(label="Bluetooth-silta — ei käytössä", state="disabled")
        connection_menu.add_command(label="Wi-Fi-silta — odottaa ESP32-testiä", state="disabled")
        menubar.add_cascade(label="Yhteys", menu=connection_menu)

        device_menu = tk.Menu(menubar, tearoff=False)
        device_menu.add_command(label="Laitteen tunnistus", command=self.inspect_device)
        device_menu.add_command(label="Lue kaikki asetukset", command=self.read_cdi)
        device_menu.add_separator()
        device_menu.add_command(label="Kirjoita asetukset — LUKITTU", state="disabled")
        device_menu.add_command(label="PROGRAM — LUKITTU", state="disabled")
        device_menu.add_command(label="Palauta snapshot — ei vielä käytössä", state="disabled")
        menubar.add_cascade(label="CDI-laite", menu=device_menu)

        maps_menu = tk.Menu(menubar, tearoff=False)
        maps_menu.add_command(label="Sytytyskartta 1", command=lambda: self._select_tab(0))
        maps_menu.add_command(label="Sytytyskartta 2", command=lambda: self._select_tab(0))
        maps_menu.add_command(label="YPVS / PV -käyrä", command=lambda: self._select_tab(1))
        maps_menu.add_command(label="Limiter", command=lambda: self._select_tab(1))
        maps_menu.add_command(label="Shift Light", command=lambda: self._select_tab(1))
        maps_menu.add_separator()
        maps_menu.add_command(label="Muokkaus — LUKITTU", state="disabled")
        menubar.add_cascade(label="Kartat", menu=maps_menu)

        versions_menu = tk.Menu(menubar, tearoff=False)
        versions_menu.add_command(label="Tallenna versio", command=self.save_version)
        versions_menu.add_command(label="Vertaa tiedostoon…", command=self.compare_file)
        versions_menu.add_command(label="Näytä versiot ja erot", command=lambda: self._select_tab(2))
        versions_menu.add_command(label="Päivitä versioluettelo", command=self.refresh_versions)
        versions_menu.add_separator()
        versions_menu.add_command(label="Rollback — vaatii varmennetun snapshotin", state="disabled")
        menubar.add_cascade(label="Versiot", menu=versions_menu)

        capture_menu = tk.Menu(menubar, tearoff=False)
        capture_menu.add_command(label="Näytä RAW ja todistusaineisto", command=lambda: self._select_tab(3))
        capture_menu.add_command(label="Päivitä USBPcap-tila", command=self.refresh_environment)
        capture_menu.add_command(label="Avaa kaappauskansio", command=self.open_capture_folder)
        capture_menu.add_separator()
        capture_menu.add_command(label="Käynnistä kaappaus", command=self.start_capture)
        capture_menu.add_command(label="Pysäytä kaappaus — käsin vahvistettava", state="disabled")
        menubar.add_cascade(label="Kaappaus", menu=capture_menu)

        tools_menu = tk.Menu(menubar, tearoff=False)
        tools_menu.add_command(label="Tarkista datan eheys", command=self.verify_current_data)
        tools_menu.add_command(label="Näytä auditointiloki", command=lambda: self._select_tab(4))
        tools_menu.add_command(label="Päivitä auditointiloki", command=self.refresh_audit)
        tools_menu.add_separator()
        tools_menu.add_command(label="Autotune-ehdotukset — suunnitteluvaihe", state="disabled")
        tools_menu.add_command(label="Protokollan kenttäkartoitus — vain analyysi", state="disabled")
        menubar.add_cascade(label="Työkalut", menu=tools_menu)

        view_menu = tk.Menu(menubar, tearoff=False)
        for index, label in enumerate(("Sytytyskartat", "YPVS / PV", "Versiot ja erot", "RAW ja todistusaineisto", "Auditointi", "Turvallinen kirjoitus")):
            view_menu.add_command(label=label, command=lambda tab=index: self._select_tab(tab))
        view_menu.add_separator()
        view_menu.add_command(label="Päivitä kaikki", command=self.refresh_all, accelerator="Ctrl+F5")
        menubar.add_cascade(label="Näkymä", menu=view_menu)

        help_menu = tk.Menu(menubar, tearoff=False)
        help_menu.add_command(label="MotorLab Zeel Studion ohje", command=self.show_help)
        help_menu.add_command(label="Turvarajat", command=self.show_safety)
        help_menu.add_separator()
        help_menu.add_command(label="Tietoja", command=self.show_about)
        menubar.add_cascade(label="Ohje", menu=help_menu)

        self.configure(menu=menubar)
        self.bind_all("<Control-o>", lambda _event: self.open_block())
        self.bind_all("<Control-s>", lambda _event: self.save_version())
        self.bind_all("<Control-r>", lambda _event: self.read_cdi())
        self.bind_all("<F5>", lambda _event: self.refresh_environment())
        self.bind_all("<Control-F5>", lambda _event: self.refresh_all())

    def _build(self):
        header = ttk.Frame(self, padding=(20, 16))
        header.pack(fill="x")
        ttk.Label(header, text="VÄNÄ MotorLab", style="Title.TLabel").pack(side="left")
        ttk.Label(header, text="ZEEL STUDIO · DEV · EI TUOTANTOKÄYTTÖÖN", style="Muted.TLabel").pack(side="left", padx=16, pady=(8, 0))
        ttk.Button(header, text="Tarkista laite", command=self.inspect_device).pack(side="right")
        self.read_cdi_button = ttk.Button(header, text="Lue CDI", command=self.read_cdi, style="Accent.TButton")
        self.read_cdi_button.pack(side="right", padx=8)
        ttk.Button(header, text="Avaa 480 B lukublokki", command=self.open_block).pack(side="right", padx=8)

        status = ttk.Frame(self, style="Card.TFrame", padding=14)
        status.pack(fill="x", padx=20, pady=(0, 12))
        for title, variable in (("LAITE", self.device_var), ("TILA", self.mode_var), ("LAATU", self.quality_var), ("SHIFT LIGHT", self.shift_var), ("LÄHDE", self.source_var), ("SHA-256", self.hash_var)):
            box = ttk.Frame(status, style="Card.TFrame")
            box.pack(side="left", fill="x", expand=True, padx=8)
            ttk.Label(box, text=title, style="Card.TLabel", foreground="#8ca0ae").pack(anchor="w")
            ttk.Label(box, textvariable=variable, style="Card.TLabel").pack(anchor="w")

        notebook = ttk.Notebook(self)
        self.notebook = notebook
        notebook.pack(fill="both", expand=True, padx=20, pady=(0, 12))
        self.maps_tab = ttk.Frame(notebook, padding=14)
        self.pv_tab = ttk.Frame(notebook, padding=14)
        self.diff_tab = ttk.Frame(notebook, padding=14)
        self.evidence_tab = ttk.Frame(notebook, padding=14)
        self.audit_tab = ttk.Frame(notebook, padding=14)
        self.write_tab = ttk.Frame(notebook, padding=14)
        notebook.add(self.maps_tab, text="Sytytyskartat")
        notebook.add(self.pv_tab, text="YPVS / PV")
        notebook.add(self.diff_tab, text="Versiot ja erot")
        notebook.add(self.evidence_tab, text="RAW ja todistusaineisto")
        notebook.add(self.audit_tab, text="Auditointi")
        notebook.add(self.write_tab, text="Turvallinen kirjoitus")
        self._maps_ui()
        self._pv_ui()
        self._diff_ui()
        self._evidence_ui()
        self._audit_ui()
        self._write_ui()

        self.log = tk.Text(self, height=6, bg="#080d11", fg="#a9bac5", insertbackground="white", relief="flat", font=("Cascadia Mono", 9))
        self.log.pack(fill="x", padx=20, pady=(0, 18))
        self._log("Sovellus käynnistetty vain luku -tilassa.")
        self.after(300, self.refresh_environment)

    def _maps_ui(self):
        self.chart = MapChart(self.maps_tab, height=350)
        self.chart.pack(fill="both", expand=True)
        tables = ttk.Frame(self.maps_tab)
        tables.pack(fill="x", pady=(12, 0))
        self.map_trees = []
        for number in (1, 2):
            frame = ttk.Frame(tables, style="Card.TFrame", padding=10)
            frame.pack(side="left", fill="both", expand=True, padx=(0 if number == 1 else 6, 6 if number == 1 else 0))
            ttk.Label(frame, text=f"IGNITION MAP #{number}", style="Card.TLabel").pack(anchor="w", pady=(0, 6))
            tree = ttk.Treeview(frame, columns=("point", "rpm", "advance"), show="headings", height=6)
            for key, text, width in (("point", "Piste", 60), ("rpm", "RPM", 90), ("advance", "Ennakko °", 100)):
                tree.heading(key, text=text); tree.column(key, width=width, anchor="center")
            tree.pack(fill="x")
            self.map_trees.append(tree)

    def _pv_ui(self):
        card = ttk.Frame(self.pv_tab, style="Card.TFrame", padding=24)
        card.pack(fill="both", expand=True)
        ttk.Label(card, text="YPVS / PV -käyrä", style="Card.TLabel", font=("Segoe UI Semibold", 16)).pack(anchor="w")
        ttk.Label(card, text="Näkymä on valmis tietomallille, mutta kenttien tavupaikkoja ei ole vielä todistettu.\nPV-arvoja ei avata muokkaukseen ennen hallittuja yhden arvon testejä.", style="Card.TLabel").pack(anchor="w", pady=16)
        self.pv_tree = ttk.Treeview(card, columns=("field", "state", "confidence", "source"), show="headings", height=8)
        for key, text, width in (("field", "Kenttä", 220), ("state", "Tila", 240), ("confidence", "Luottamus", 120), ("source", "Todiste", 420)):
            self.pv_tree.heading(key, text=text); self.pv_tree.column(key, width=width, anchor="w")
        self.pv_tree.pack(fill="x", pady=(8, 0))
        rows = (("YPVS/PV-käyrä", "Tavupaikat kartoittamatta", "Tuntematon", "Ei yksittäismuuttujatestiä"), ("Limiter", "Ei avattu muokkaukseen", "Tuntematon", "Vaatii kontrolloidun diff-testin"), ("Shift Light", "Luettavissa", "Korkea", "offsetit 140 ja 364; peiliarvon tarkistus"))
        for row in rows: self.pv_tree.insert("", "end", values=row)

    def _diff_ui(self):
        toolbar = ttk.Frame(self.diff_tab)
        toolbar.pack(fill="x", pady=(0, 10))
        ttk.Button(toolbar, text="Tallenna versio", command=self.save_version).pack(side="left")
        ttk.Button(toolbar, text="Vertaa tiedostoon", command=self.compare_file).pack(side="left", padx=8)
        ttk.Button(toolbar, text="Päivitä versiot", command=self.refresh_versions).pack(side="left")
        self.version_var = tk.StringVar(value="Ei tallennettuja versioita")
        ttk.Label(toolbar, textvariable=self.version_var).pack(side="right")
        self.diff_tree = ttk.Treeview(self.diff_tab, columns=("offset", "before", "after", "field"), show="headings")
        for key, text, width in (("offset", "Offset", 90), ("before", "Ennen", 90), ("after", "Jälkeen", 90), ("field", "Tunnettu kenttä", 260)):
            self.diff_tree.heading(key, text=text); self.diff_tree.column(key, width=width, anchor="center")
        self.diff_tree.pack(fill="both", expand=True)
        self.after(100, self.refresh_versions)

    def _evidence_ui(self):
        tools = ttk.Frame(self.evidence_tab); tools.pack(fill="x", pady=(0, 10))
        ttk.Button(tools, text="Päivitä ympäristö", command=self.refresh_environment).pack(side="left")
        ttk.Button(tools, text="Avaa lähdekansio", command=self.open_source_folder).pack(side="left", padx=8)
        ttk.Label(tools, textvariable=self.capture_var).pack(side="right")
        body = ttk.Panedwindow(self.evidence_tab, orient="horizontal"); body.pack(fill="both", expand=True)
        meta = ttk.Frame(body, style="Card.TFrame", padding=12); raw = ttk.Frame(body, style="Card.TFrame", padding=12)
        body.add(meta, weight=1); body.add(raw, weight=2)
        ttk.Label(meta, text="Lähdeketju", style="Card.TLabel", font=("Segoe UI Semibold", 14)).pack(anchor="w")
        self.meta_tree = ttk.Treeview(meta, columns=("value",), show="tree headings", height=15)
        self.meta_tree.heading("#0", text="Tieto"); self.meta_tree.heading("value", text="Arvo")
        self.meta_tree.column("#0", width=150); self.meta_tree.column("value", width=330)
        self.meta_tree.pack(fill="both", expand=True, pady=(8, 0))
        ttk.Label(raw, text="Muuttumaton 480 B RAW", style="Card.TLabel", font=("Segoe UI Semibold", 14)).pack(anchor="w")
        self.hex_view = tk.Text(raw, bg="#080d11", fg="#c9d7df", relief="flat", font=("Cascadia Mono", 9), wrap="none")
        self.hex_view.pack(fill="both", expand=True, pady=(8, 0)); self.hex_view.configure(state="disabled")

    def _audit_ui(self):
        bar = ttk.Frame(self.audit_tab); bar.pack(fill="x", pady=(0, 10))
        ttk.Button(bar, text="Päivitä loki", command=self.refresh_audit).pack(side="left")
        ttk.Label(bar, text="Paikallinen append-only tapahtumaloki").pack(side="left", padx=12)
        self.audit_tree = ttk.Treeview(self.audit_tab, columns=("time", "event", "detail"), show="headings")
        for key, text, width in (("time", "Aika (UTC)", 190), ("event", "Tapahtuma", 180), ("detail", "Tiedot", 760)):
            self.audit_tree.heading(key, text=text); self.audit_tree.column(key, width=width, anchor="w")
        self.audit_tree.pack(fill="both", expand=True)
        self.refresh_audit()

    def _write_ui(self):
        card = ttk.Frame(self.write_tab, style="Card.TFrame", padding=24)
        card.pack(fill="both", expand=True)
        ttk.Label(card, text="Kirjoituslukko käytössä", style="Card.TLabel", font=("Segoe UI Semibold", 18), foreground="#ffb04a").pack(anchor="w")
        ttk.Label(card, text="Tämä kehitysversio ei siirrä muokattuja arvoja ZeelProgiin eikä käynnistä Programia.\nKirjoitus avataan vasta, kun kentän muunnos, snapshot, Program, Read ja byte-for-byte-palautus toimivat yhtenä testattuna tapahtumana.", style="Card.TLabel").pack(anchor="w", pady=14)
        ttk.Button(card, text="PROGRAM — LUKITTU", state="disabled", style="Accent.TButton").pack(anchor="w", pady=10)
        ttk.Label(card, text="Todistettu kenttä: Shift Light · read offsets 140/364 · Program payload offset 115 · yksikkö 100 rpm", style="Card.TLabel").pack(anchor="w", pady=8)

    def _log(self, text):
        stamp = datetime.now().strftime("%H:%M:%S")
        self.log.insert("end", f"[{stamp}] {text}\n")
        self.log.see("end")

    def _audit(self, event: str, detail: str):
        record = {"time": datetime.now(timezone.utc).isoformat(), "event": event, "detail": detail}
        with AUDIT_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
        if hasattr(self, "audit_tree"):
            self.audit_tree.insert("", 0, values=(record["time"], event, detail))

    def refresh_audit(self):
        if not hasattr(self, "audit_tree"): return
        self.audit_tree.delete(*self.audit_tree.get_children())
        if not AUDIT_FILE.exists(): return
        for line in reversed(AUDIT_FILE.read_text(encoding="utf-8").splitlines()[-500:]):
            try:
                item = json.loads(line)
                self.audit_tree.insert("", "end", values=(item.get("time"), item.get("event"), item.get("detail")))
            except json.JSONDecodeError:
                pass

    def refresh_environment(self):
        running = subprocess.run(["powershell.exe", "-NoProfile", "-Command", "if(Get-Process USBPcapCMD -ErrorAction SilentlyContinue){exit 0}else{exit 1}"], capture_output=True).returncode == 0
        captures = sorted(CAPTURE_DIR.glob("*.pcapng"), key=lambda p: p.stat().st_mtime, reverse=True)
        latest = captures[0] if captures else None
        self.capture_var.set(("USBPcap käynnissä" if running else "USBPcap pysäytetty") + (f" · {latest.name} · {latest.stat().st_size} B" if latest else " · ei kaappausta"))

    def open_source_folder(self):
        os.startfile(self.source_path.parent if self.source_path else APP_DIR)

    def refresh_versions(self):
        VERSION_DIR.mkdir(parents=True, exist_ok=True)
        bins = sorted(VERSION_DIR.glob("*.bin"), key=lambda p: p.stat().st_mtime, reverse=True)
        self.version_var.set(f"Tallennettuja versioita: {len(bins)}" + (f" · uusin {bins[0].name}" if bins else ""))

    def _select_tab(self, index: int):
        self.notebook.select(index)

    def refresh_all(self):
        self.refresh_environment(); self.refresh_versions(); self.refresh_audit()
        self._log("Kaikki näkymät päivitetty.")

    def open_capture_folder(self):
        CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
        os.startfile(CAPTURE_DIR)

    def start_capture(self):
        if not CAPTURE_STARTER.exists():
            messagebox.showerror("Kaappaustyökalu puuttuu", str(CAPTURE_STARTER)); return
        try:
            subprocess.Popen(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(CAPTURE_STARTER)], creationflags=subprocess.CREATE_NO_WINDOW)
            self._log("USB-kaappauksen käynnistys pyydetty.")
            self._audit("capture_start_requested", str(CAPTURE_STARTER))
            self.after(1500, self.refresh_environment)
        except OSError as error:
            messagebox.showerror("Kaappaus ei käynnistynyt", str(error))

    def verify_current_data(self):
        if self.raw is None or self.model is None:
            messagebox.showinfo("Ei dataa", "Avaa ensin 480 tavun lukublokki."); return
        checks = {
            "Koko on 480 tavua": len(self.raw) == BLOCK_SIZE,
            "SHA-256 täsmää": sha256(self.raw) == self.model["raw_sha256"],
            "Shift Light -peiliarvo täsmää": self.model["shift_light_rpm"] == self.model["shift_light_mirror_rpm"],
            "Kartta 1 sisältää 10 pistettä": len(self.model["ignition_map_1"]) == 10,
            "Kartta 2 sisältää 10 pistettä": len(self.model["ignition_map_2"]) == 10,
        }
        report = "\n".join(("✓ " if passed else "✗ ") + name for name, passed in checks.items())
        self._audit("integrity_checked", json.dumps(checks, ensure_ascii=False))
        messagebox.showinfo("Datan eheystarkistus", report)

    def show_help(self):
        messagebox.showinfo("MotorLab Zeel Studio", "1. Käynnistä USB-kaappaus.\n2. Tarkista Zeel-laite.\n3. Kytke CDI ja valitse Lue CDI.\n4. Tarkista RAW, SHA-256 ja laatumerkinnät.\n5. Tallenna versio ja vertaa aiempaan.\n\nKirjoitus CDI:lle ei ole käytössä.")

    def show_safety(self):
        messagebox.showwarning("Turvarajat", "Sovellus toimii vain luku -tilassa. PROGRAM ja asetusten kirjoitus ovat lukittuina. GPS säilyy RPM-oppimisen auktoriteettina, kameran RPM-dataa ei käytetä ja raakaa audiota ei hyväksytä oppimiseen ennen moottorisignaalin todentamista.")

    def show_about(self):
        messagebox.showinfo("Tietoja", "VÄNÄ MotorLab — Zeel Studio\nKehitysversio\nRAW-first · read-only · audit trail")

    def open_block(self):
        path = filedialog.askopenfilename(title="Valitse 480 tavun lukublokki", filetypes=[("Binary", "*.bin"), ("Kaikki", "*.*")])
        if path:
            self.load_block(Path(path), set_baseline=self.baseline is None)

    def load_block(self, path: Path, set_baseline=False):
        try:
            data = path.read_bytes()
            model = decode_block(data)
        except (OSError, ValueError) as error:
            messagebox.showerror("Lukeminen epäonnistui", str(error)); return
        self.raw, self.model, self.source_path = data, model, path
        if set_baseline:
            self.baseline = data
        self.hash_var.set(model["raw_sha256"][:16] + "…")
        self.source_var.set(path.name)
        mirror_ok = model["shift_light_rpm"] == model["shift_light_mirror_rpm"]
        self.quality_var.set("Hyvä · 480 B · peili OK" if mirror_ok else "Varoitus · peiliarvo poikkeaa")
        self.shift_var.set(f'{model["shift_light_rpm"]} rpm' + (" ✓" if mirror_ok else " ⚠"))
        self.chart.set_maps([("Map #1", "#ff6536", model["ignition_map_1"]), ("Map #2", "#4dd78a", model["ignition_map_2"])])
        for tree, key in zip(self.map_trees, ("ignition_map_1", "ignition_map_2")):
            tree.delete(*tree.get_children())
            for index, (rpm, advance) in enumerate(model[key], 1):
                tree.insert("", "end", values=(index, rpm, f"{advance:.1f}"))
        self.meta_tree.delete(*self.meta_tree.get_children())
        metadata = (("Tiedosto", str(path)), ("Koko", f"{len(data)} B"), ("SHA-256", model["raw_sha256"]), ("Kuvaus", model["description"] or "—"), ("Shift-peili", "Täsmää" if mirror_ok else "Poikkeaa"), ("Tulkinta", "RAW säilytetään ensisijaisena"))
        for name, value in metadata: self.meta_tree.insert("", "end", text=name, values=(value,))
        lines = []
        for offset in range(0, len(data), 16):
            chunk = data[offset:offset + 16]
            hex_part = " ".join(f"{value:02X}" for value in chunk)
            ascii_part = "".join(chr(value) if 32 <= value < 127 else "." for value in chunk)
            lines.append(f"{offset:04X}  {hex_part:<47}  {ascii_part}")
        self.hex_view.configure(state="normal"); self.hex_view.delete("1.0", "end"); self.hex_view.insert("1.0", "\n".join(lines)); self.hex_view.configure(state="disabled")
        self._log(f"Ladattu {path.name}; SHA-256 {model['raw_sha256']}")
        self._audit("block_loaded", f"{path} sha256={model['raw_sha256']}")

    def inspect_device(self):
        if not BRIDGE.exists():
            messagebox.showerror("Silta puuttuu", str(BRIDGE)); return
        try:
            result = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(BRIDGE), "-Action", "Inspect"], capture_output=True, text=True, timeout=20, check=True)
            state = json.loads(result.stdout)
            self.device_var.set(f"{state['product']} · {state['programmer']} · {state['firmware']}")
            self._log(f"Laite tarkistettu: Program={state['program_status']}")
            self._audit("device_inspected", self.device_var.get())
        except Exception as error:
            self.device_var.set("Tarkistus epäonnistui")
            self._log(f"Laitetarkistus epäonnistui: {error}")

    def read_cdi(self):
        if not READ_BRIDGE.exists() or not ANALYZER.exists():
            messagebox.showerror("Lukusilta puuttuu", f"{READ_BRIDGE}\n{ANALYZER}")
            return
        captures = sorted(CAPTURE_DIR.glob("*.pcapng"), key=lambda path: path.stat().st_mtime, reverse=True)
        if not captures:
            messagebox.showerror("USB-kaappaus puuttuu", f"Käynnistä USBPcap-kaappaus hakemistoon {CAPTURE_DIR}")
            return
        capture = captures[0]
        capture_check = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command",
             "if (Get-Process USBPcapCMD -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"],
            capture_output=True, text=True,
        )
        if capture_check.returncode != 0:
            messagebox.showerror(
                "USB-kaappaus ei ole käynnissä",
                "Käynnistä USBPcap ennen CDI-lukua. Vanhaa kaappausta ei käytetä Live-tuloksena.",
            )
            return
        self.read_cdi_button.configure(state="disabled")
        self.mode_var.set("Luetaan CDI:tä…")
        self._log(f"Live-luku aloitettu: {capture.name}")
        self._audit("live_read_started", str(capture))
        threading.Thread(target=self._read_cdi_worker, args=(capture,), daemon=True).start()

    def _read_cdi_worker(self, capture: Path):
        try:
            before_size = capture.stat().st_size
            read_result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(READ_BRIDGE), "-Action", "Read"],
                capture_output=True, text=True, timeout=30, check=True,
            )
            read_state = json.loads(read_result.stdout)
            capture_growth = capture.stat().st_size - before_size
            if capture_growth <= 0:
                raise RuntimeError(
                    "USBPcap-tiedosto ei kasvanut Readin aikana; Live-tulos hylättiin eikä vanhaa dataa näytetä"
                )
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            output_dir = LIVE_READ_DIR / stamp
            analyze_result = subprocess.run(
                ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ANALYZER),
                 "-PcapPath", str(capture), "-OutputDir", str(output_dir)],
                capture_output=True, text=True, timeout=90, check=True,
            )
            analysis = json.loads(analyze_result.stdout)
            candidates = [
                cluster for cluster in analysis.get("clusters", [])
                if cluster.get("poll_value_count") == BLOCK_SIZE
            ]
            if not candidates:
                raise RuntimeError("Kaappauksesta ei löytynyt yhtään 480 tavun lukublokkia")
            newest = max(candidates, key=lambda cluster: int(cluster["cluster"]))
            prefix = f"cluster_{int(newest['cluster']):02d}_frames_{newest['start_frame']}-{newest['end_frame']}"
            block = output_dir / f"{prefix}_poll_values.bin"
            data = block.read_bytes()
            model = decode_block(data)
            result = {
                "block": block,
                "model": model,
                "read_state": read_state,
                "capture_growth": capture_growth,
                "shift_mirror_ok": model["shift_light_rpm"] == model["shift_light_mirror_rpm"],
            }
            self.after(0, lambda: self._finish_live_read(result))
        except Exception as error:
            message = str(error)
            self.after(0, lambda detail=message: self._fail_live_read(detail))

    def _finish_live_read(self, result: dict):
        block = Path(result["block"])
        self.load_block(block)
        self.mode_var.set("Vain luku · LIVE")
        mirror = "täsmää" if result["shift_mirror_ok"] else "POIKKEAA"
        self._log(
            f"Live-luku valmis; Read-painallus ok, kaappaus +{result['capture_growth']} B, "
            f"Shift Light -peiliarvo {mirror}"
        )
        self._audit("live_read_completed", f"{block} capture_growth={result['capture_growth']} sha256={self.model['raw_sha256']}")
        self.refresh_environment()
        self.read_cdi_button.configure(state="normal")

    def _fail_live_read(self, error: str):
        self.mode_var.set("Vain luku · virhe")
        self._log(f"Live-luku epäonnistui: {error}")
        self._audit("live_read_failed", error)
        self.read_cdi_button.configure(state="normal")
        messagebox.showerror("CDI:n lukeminen epäonnistui", error)

    def save_version(self):
        if self.raw is None or self.model is None:
            messagebox.showinfo("Ei dataa", "Avaa ensin lukublokki."); return
        VERSION_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        base = VERSION_DIR / f"pcdi10vt_{stamp}"
        base.with_suffix(".bin").write_bytes(self.raw)
        base.with_suffix(".json").write_text(json.dumps({"created_at": stamp, "source": str(self.source_path), **self.model}, indent=2), encoding="utf-8")
        self._log(f"Versio tallennettu: {base.name}")
        self._audit("version_saved", f"{base.name} sha256={self.model['raw_sha256']}")
        self.refresh_versions()

    def compare_file(self):
        if self.raw is None:
            messagebox.showinfo("Ei dataa", "Avaa ensin lukublokki."); return
        path = filedialog.askopenfilename(title="Valitse vertailublokki", filetypes=[("Binary", "*.bin")])
        if not path: return
        try:
            other = Path(path).read_bytes()
            if len(other) != BLOCK_SIZE: raise ValueError("Vertailutiedosto ei ole 480 tavua")
        except (OSError, ValueError) as error:
            messagebox.showerror("Vertailu epäonnistui", str(error)); return
        self.diff_tree.delete(*self.diff_tree.get_children())
        known = {140: "Shift Light", 364: "Shift Light mirror"}
        changes = 0
        for offset, (before, after) in enumerate(zip(self.raw, other)):
            if before != after:
                changes += 1
                self.diff_tree.insert("", "end", values=(offset, before, after, known.get(offset, "Tuntematon / vain tarkastelu")))
        self._log(f"Vertailu {Path(path).name}: {changes} muuttunutta tavua")
        self._audit("blocks_compared", f"{self.source_path} vs {path}: {changes} changed bytes")


if __name__ == "__main__":
    ZeelStudio().mainloop()
