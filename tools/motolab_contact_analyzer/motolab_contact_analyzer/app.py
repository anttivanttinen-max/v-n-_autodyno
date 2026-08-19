from __future__ import annotations

import argparse
import json
import tkinter as tk
from dataclasses import asdict
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

import matplotlib

matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure

from .analysis import AnalysisConfig, analyze_signal
from .annotations import Annotation, LABELS, export_annotations_csv, save_annotations
from .batch import analyze_directory
from .io import load_signal


class ContactAnalyzerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("MotoLab Contact Analyzer v1 — tutkimustyökalu")
        self.geometry("1450x900")
        self.minsize(1050, 700)
        self.loaded = None
        self.result = None
        self.annotations: list[Annotation] = []
        self._selection_start: float | None = None
        self._selection_end: float | None = None

        self.highpass = tk.DoubleVar(value=40)
        self.lowpass = tk.DoubleVar(value=12_000)
        self.knock_low = tk.DoubleVar(value=3_500)
        self.knock_high = tk.DoubleVar(value=9_000)
        self.threshold = tk.DoubleVar(value=5.0)
        self.pulses = tk.DoubleVar(value=1.0)
        self.raw_rate = tk.DoubleVar(value=48_000)
        self.raw_dtype = tk.StringVar(value="int16")
        self.verified = tk.BooleanVar(value=False)
        self.annotation_label = tk.StringVar(value="UNKNOWN")
        self.status = tk.StringVar(value="Avaa WAV, CSV, RAW, PCM tai ZIP. Analyysi ei hyväksy signaalia moottorisignaaliksi ilman erillistä vahvistusta.")
        self._build_ui()

    def _build_ui(self) -> None:
        toolbar = ttk.Frame(self, padding=6)
        toolbar.pack(fill="x")
        ttk.Button(toolbar, text="Avaa tiedosto", command=self.open_file).pack(side="left")
        ttk.Button(toolbar, text="Analysoi", command=self.run_analysis).pack(side="left", padx=4)
        ttk.Button(toolbar, text="Batch-analyysi", command=self.run_batch).pack(side="left")
        ttk.Button(toolbar, text="Vie analyysi", command=self.export_analysis).pack(side="left", padx=4)
        ttk.Button(toolbar, text="Vie merkinnät", command=self.export_annotations).pack(side="left")
        ttk.Checkbutton(toolbar, text="Todistettu oikeaksi moottorin värähtelyksi", variable=self.verified, command=self.run_analysis).pack(side="right")

        controls = ttk.LabelFrame(self, text="Analyysiasetukset", padding=6)
        controls.pack(fill="x", padx=6)
        entries = [
            ("High-pass Hz", self.highpass), ("Low-pass Hz", self.lowpass),
            ("Knock alku Hz", self.knock_low), ("Knock loppu Hz", self.knock_high),
            ("Transient z", self.threshold), ("Pulssia/kierros", self.pulses),
            ("RAW rate", self.raw_rate),
        ]
        for column, (label, variable) in enumerate(entries):
            ttk.Label(controls, text=label).grid(row=0, column=column, sticky="w", padx=3)
            ttk.Entry(controls, textvariable=variable, width=11).grid(row=1, column=column, padx=3)
        ttk.Label(controls, text="RAW dtype").grid(row=0, column=len(entries), sticky="w", padx=3)
        ttk.Combobox(controls, textvariable=self.raw_dtype, values=("int16", "int32", "float32", "float64"), state="readonly", width=10).grid(row=1, column=len(entries), padx=3)

        paned = ttk.Panedwindow(self, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=6, pady=6)
        chart_frame = ttk.Frame(paned)
        side = ttk.Frame(paned, width=330)
        paned.add(chart_frame, weight=5)
        paned.add(side, weight=1)

        self.figure = Figure(figsize=(11, 8), dpi=100, layout="constrained")
        self.axes = [self.figure.add_subplot(4, 1, index + 1) for index in range(4)]
        self.canvas = FigureCanvasTkAgg(self.figure, master=chart_frame)
        self.canvas.get_tk_widget().pack(fill="both", expand=True)
        NavigationToolbar2Tk(self.canvas, chart_frame).update()
        self.canvas.mpl_connect("button_press_event", self._plot_press)
        self.canvas.mpl_connect("button_release_event", self._plot_release)

        ttk.Label(side, text="Valitse aikaväli vetämällä signaalikuvaajassa", wraplength=310).pack(anchor="w", pady=(0, 4))
        ttk.Combobox(side, textvariable=self.annotation_label, values=LABELS, state="readonly").pack(fill="x")
        ttk.Button(side, text="Lisää merkintä", command=self.add_annotation).pack(fill="x", pady=4)
        self.annotation_tree = ttk.Treeview(side, columns=("start", "end", "label"), show="headings", height=12)
        for name, title in (("start", "Alku"), ("end", "Loppu"), ("label", "Luokka")):
            self.annotation_tree.heading(name, text=title)
            self.annotation_tree.column(name, width=85)
        self.annotation_tree.pack(fill="both", expand=True)
        ttk.Button(side, text="Poista valittu", command=self.delete_annotation).pack(fill="x", pady=4)

        self.summary = tk.Text(side, height=18, width=40, state="disabled", wrap="word")
        self.summary.pack(fill="both", expand=True)
        ttk.Label(self, textvariable=self.status, relief="sunken", padding=5).pack(fill="x", side="bottom")

    def config(self) -> AnalysisConfig:
        return AnalysisConfig(
            highpass_hz=self.highpass.get(), lowpass_hz=self.lowpass.get(),
            knock_low_hz=self.knock_low.get(), knock_high_hz=self.knock_high.get(),
            transient_z_threshold=self.threshold.get(), pulses_per_revolution=self.pulses.get(),
            verified_engine_signal=self.verified.get(),
        )

    def open_file(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("Sensor files", "*.wav *.csv *.raw *.pcm *.zip"), ("All files", "*.*")])
        if not path:
            return
        try:
            self.loaded = load_signal(path, sample_rate=self.raw_rate.get(), raw_dtype=self.raw_dtype.get())
            self.annotations.clear()
            self._refresh_annotations()
            self.status.set(f"Ladattu {Path(path).name}: {self.loaded.samples.size} näytettä @ {self.loaded.sample_rate:g} Hz")
            self.run_analysis()
        except Exception as exc:
            messagebox.showerror("Tiedoston avaus epäonnistui", str(exc))

    def run_analysis(self) -> None:
        if self.loaded is None:
            return
        try:
            self.result = analyze_signal(self.loaded, self.config())
            self._draw()
            self._show_summary()
        except Exception as exc:
            messagebox.showerror("Analyysi epäonnistui", str(exc))

    def _draw(self) -> None:
        r = self.result
        if r is None:
            return
        for axis in self.axes:
            axis.clear()
        self.axes[0].plot(r.time_s, r.filtered, linewidth=0.45, color="#2463a9")
        self.axes[0].set_ylabel("Kontaktisignaali")
        self.axes[0].set_title("Vedä tästä aikaväli ja lisää manuaalinen merkintä")
        for candidate in r.candidates:
            self.axes[0].axvline(candidate.time_s, color="#d12d2d", alpha=0.55, linewidth=0.8)
        self.axes[1].plot(r.frequencies_hz, r.spectrum, linewidth=0.7, color="#793aa8")
        self.axes[1].set_xlim(0, min(self.lowpass.get() * 1.1, self.loaded.sample_rate / 2))
        self.axes[1].set_ylabel("FFT")
        mesh = self.axes[2].pcolormesh(r.spectrogram_time_s, r.spectrogram_frequencies_hz, r.spectrogram_db, shading="auto", cmap="magma")
        self.axes[2].set_ylim(0, min(self.lowpass.get(), self.loaded.sample_rate / 2))
        self.axes[2].set_ylabel("Spektrogrammi Hz")
        if r.rpm_time_s.size:
            self.axes[3].plot(r.rpm_time_s, r.estimated_rpm, color="#17864b", label="Arvioitu RPM")
        if self.loaded.reference_rpm is not None and self.loaded.time_seconds is not None:
            self.axes[3].plot(self.loaded.time_seconds, self.loaded.reference_rpm, color="#e6911a", alpha=0.8, label="Referenssi-RPM")
        self.axes[3].set_ylabel("RPM")
        self.axes[3].set_xlabel("Aika (s)")
        self.axes[3].legend(loc="upper right")
        self.canvas.draw_idle()

    def _show_summary(self) -> None:
        payload = self.result.summary()
        payload["source"] = str(self.loaded.source)
        payload["warning"] = None if payload["engine_signal_accepted"] else "Signaalia ei hyväksytä oppimis- tai knock-lähteeksi ennen moottorisignaalin todentamista ja laatukynnystä."
        self.summary.configure(state="normal")
        self.summary.delete("1.0", "end")
        self.summary.insert("1.0", json.dumps(payload, ensure_ascii=False, indent=2))
        self.summary.configure(state="disabled")
        state = "HYVÄKSYTTY TUTKIMUSKÄYTTÖÖN" if payload["engine_signal_accepted"] else "EI HYVÄKSYTTY MOOTTORISIGNAALIKSI"
        self.status.set(f"{state} — knock-ehdokkaita {payload['candidate_count']}, laatu {payload['signal_quality']:.2f}")

    def _plot_press(self, event: object) -> None:
        if getattr(event, "inaxes", None) == self.axes[0] and getattr(event, "xdata", None) is not None:
            self._selection_start = float(event.xdata)

    def _plot_release(self, event: object) -> None:
        if self._selection_start is not None and getattr(event, "inaxes", None) == self.axes[0] and getattr(event, "xdata", None) is not None:
            a, b = sorted((self._selection_start, float(event.xdata)))
            self._selection_start, self._selection_end = max(0, a), b
            self.status.set(f"Valittu {self._selection_start:.3f}–{self._selection_end:.3f} s; valitse luokka ja lisää merkintä")

    def add_annotation(self) -> None:
        if self._selection_start is None or self._selection_end is None or self._selection_end <= self._selection_start:
            messagebox.showinfo("Valitse aikaväli", "Vedä ensin aikaväli ylimmässä signaalikuvaajassa.")
            return
        self.annotations.append(Annotation(self._selection_start, self._selection_end, self.annotation_label.get()))
        self._refresh_annotations()

    def delete_annotation(self) -> None:
        selected = self.annotation_tree.selection()
        if not selected:
            return
        indexes = sorted((self.annotation_tree.index(item) for item in selected), reverse=True)
        for index in indexes:
            self.annotations.pop(index)
        self._refresh_annotations()

    def _refresh_annotations(self) -> None:
        for item in self.annotation_tree.get_children():
            self.annotation_tree.delete(item)
        for annotation in self.annotations:
            self.annotation_tree.insert("", "end", values=(f"{annotation.start_s:.3f}", f"{annotation.end_s:.3f}", annotation.label))

    def export_annotations(self) -> None:
        if not self.annotations:
            messagebox.showinfo("Ei merkintöjä", "Lisää vähintään yksi merkintä.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json"), ("CSV", "*.csv")])
        if not path:
            return
        if Path(path).suffix.lower() == ".csv":
            export_annotations_csv(path, self.annotations)
        else:
            save_annotations(path, self.annotations, str(self.loaded.source) if self.loaded else "")

    def export_analysis(self) -> None:
        if self.result is None:
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if not path:
            return
        payload = self.result.summary()
        payload["candidates"] = [asdict(candidate) for candidate in self.result.candidates]
        Path(path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def run_batch(self) -> None:
        directory = filedialog.askdirectory(title="Valitse analysoitava kansio")
        if not directory:
            return
        output = filedialog.askdirectory(title="Valitse tuloskansio")
        if not output:
            return
        try:
            rows = analyze_directory(directory, output, self.config(), sample_rate=self.raw_rate.get(), raw_dtype=self.raw_dtype.get())
            ok = sum(row["status"] == "ok" for row in rows)
            messagebox.showinfo("Batch valmis", f"Analysoitu {ok}/{len(rows)} tiedostoa. Tulokset: {output}")
        except Exception as exc:
            messagebox.showerror("Batch epäonnistui", str(exc))


def main() -> None:
    parser = argparse.ArgumentParser(description="MotoLab Contact Analyzer v1")
    parser.add_argument("--batch", metavar="DIRECTORY", help="Analyze every supported file in a directory")
    parser.add_argument("--output", default="contact-analysis-results", help="Batch result directory")
    parser.add_argument("--verified-engine-signal", action="store_true", help="Mark input as independently verified engine vibration")
    args = parser.parse_args()
    if args.batch:
        config = AnalysisConfig(verified_engine_signal=args.verified_engine_signal)
        rows = analyze_directory(args.batch, args.output, config)
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        ContactAnalyzerApp().mainloop()


if __name__ == "__main__":
    main()

