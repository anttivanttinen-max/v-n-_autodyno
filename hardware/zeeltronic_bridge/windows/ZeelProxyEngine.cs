using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Ports;
using System.Text;
using System.Threading;

namespace MotoLab.ZeelCapture {
  public sealed class ProxyStatus {
    public bool Running, Connected;
    public long PcToZeelBytes, ZeelToPcBytes, PcToZeelChunks, ZeelToPcChunks;
    public int Reconnects;
    public string SessionDirectory, LastError;
  }

  public sealed class ProxyEngine : IDisposable {
    readonly object sync = new object();
    readonly ConcurrentQueue<string> messages = new ConcurrentQueue<string>();
    volatile bool stopping, running, connected;
    Thread manager;
    SerialPort capturePort, hardwarePort;
    FileStream pcRaw, zeelRaw;
    StreamWriter jsonl, csv;
    Stopwatch clock;
    DateTimeOffset startUtc;
    string sessionDir, lastError = "", captureName, hardwareName;
    long pcBytes, zeelBytes, pcChunks, zeelChunks, sequence;
    int reconnects, baud;

    public void Start(string baseDirectory, string captureCom, string zeelProgCom, string hardwareCom, int baudRate) {
      lock (sync) {
        if (running) throw new InvalidOperationException("Proxy is already running.");
        captureName = captureCom; hardwareName = hardwareCom; baud = baudRate;
        stopping = false; connected = false; running = true;
        pcBytes = zeelBytes = pcChunks = zeelChunks = sequence = 0; reconnects = 0; lastError = "";
        startUtc = DateTimeOffset.UtcNow; clock = Stopwatch.StartNew();
        sessionDir = Path.Combine(baseDirectory, DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-fff", CultureInfo.InvariantCulture));
        Directory.CreateDirectory(sessionDir);
        pcRaw = NewRaw("pc_to_zeel.raw"); zeelRaw = NewRaw("zeel_to_pc.raw");
        jsonl = NewText("events.jsonl"); csv = NewText("timeline.csv");
        csv.WriteLine("sequence,elapsed_us,utc,direction,length,hex,ascii,note"); csv.Flush();
        File.WriteAllText(Path.Combine(sessionDir, "session.json"),
          "{\n  \"schema\": \"motolab_zeel_transparent_proxy_v2\",\n  \"app_version\": \"1.0.0\",\n" +
          "  \"created_utc\": \"" + Json(startUtc.ToString("o")) + "\",\n  \"capture_port\": \"" + Json(captureCom) + "\",\n" +
          "  \"zeelprog_port\": \"" + Json(zeelProgCom) + "\",\n  \"hardware_port\": \"" + Json(hardwareCom) + "\",\n" +
          "  \"baud\": " + baudRate.ToString(CultureInfo.InvariantCulture) + ",\n  \"serial\": \"8N1, no flow control\",\n" +
          "  \"generated_cdi_commands\": false,\n  \"raw_preserved\": true\n}\n", new UTF8Encoding(false));
        LogEvent("META", null, "session-start; transparent byte forwarding only");
        manager = new Thread(ManagerLoop) { IsBackground = true, Name = "MotoLab-Zeel-Proxy" }; manager.Start();
      }
    }

    FileStream NewRaw(string name) { return new FileStream(Path.Combine(sessionDir, name), FileMode.CreateNew, FileAccess.Write, FileShare.Read, 65536, FileOptions.WriteThrough); }
    StreamWriter NewText(string name) { return new StreamWriter(new FileStream(Path.Combine(sessionDir, name), FileMode.CreateNew, FileAccess.Write, FileShare.Read), new UTF8Encoding(false)); }

    void ManagerLoop() {
      try {
        while (!stopping) {
          try {
            capturePort = Open(captureName); hardwarePort = Open(hardwareName); connected = true;
            messages.Enqueue("CONNECTED: ZeelProg COM10 <-> COM11 <-> proxy <-> " + hardwareName); LogEvent("STATE", null, "connected");
            Exception faultA = null, faultB = null;
            var a = new Thread(() => { try { Pump(capturePort, hardwarePort, "PC->ZEEL"); } catch (Exception e) { faultA = e; } }) { IsBackground = true };
            var b = new Thread(() => { try { Pump(hardwarePort, capturePort, "ZEEL->PC"); } catch (Exception e) { faultB = e; } }) { IsBackground = true };
            a.Start(); b.Start();
            while (!stopping && a.IsAlive && b.IsAlive) Thread.Sleep(50);
            ClosePorts(); a.Join(2000); b.Join(2000);
            if (!stopping) throw (faultA ?? faultB ?? new IOException("Serial forwarding stopped unexpectedly."));
          } catch (Exception ex) {
            ClosePorts(); connected = false; if (stopping) break;
            lastError = ex.Message; Interlocked.Increment(ref reconnects);
            messages.Enqueue("CONNECTION ERROR: " + ex.Message + " - reconnect in 2 s");
            LogEvent("ERROR", null, ex.GetType().Name + ": " + ex.Message);
            for (int i = 0; i < 20 && !stopping; i++) Thread.Sleep(100);
          }
        }
      } finally { connected = false; running = false; ClosePorts(); }
    }

    SerialPort Open(string name) {
      var p = new SerialPort(name, baud, Parity.None, 8, StopBits.One) { Handshake = Handshake.None, ReadBufferSize = 65536, WriteBufferSize = 65536, ReadTimeout = 500, WriteTimeout = 5000, DtrEnable = true, RtsEnable = true };
      p.Open(); return p;
    }

    void Pump(SerialPort source, SerialPort destination, string direction) {
      byte[] buffer = new byte[65536];
      while (!stopping && source.IsOpen && destination.IsOpen) {
        int count;
        try { count = source.Read(buffer, 0, buffer.Length); } catch (TimeoutException) { continue; }
        if (count <= 0) throw new EndOfStreamException("Serial port returned end of stream.");
        byte[] exact = new byte[count]; Buffer.BlockCopy(buffer, 0, exact, 0, count);
        LogEvent(direction, exact, "received-before-forward");
        if (direction == "PC->ZEEL") { Interlocked.Add(ref pcBytes, count); Interlocked.Increment(ref pcChunks); }
        else { Interlocked.Add(ref zeelBytes, count); Interlocked.Increment(ref zeelChunks); }
        destination.Write(exact, 0, exact.Length);
      }
    }

    void LogEvent(string direction, byte[] data, string note) {
      lock (sync) {
        if (jsonl == null) return;
        long seq = ++sequence, us = (long)(clock.ElapsedTicks * (1000000.0 / Stopwatch.Frequency));
        string utc = startUtc.AddTicks(us * 10).ToString("o"), hex = data == null ? "" : BitConverter.ToString(data).Replace('-', ' '), ascii = data == null ? "" : Ascii(data);
        int length = data == null ? 0 : data.Length;
        if (direction == "PC->ZEEL") { pcRaw.Write(data, 0, length); pcRaw.Flush(true); }
        if (direction == "ZEEL->PC") { zeelRaw.Write(data, 0, length); zeelRaw.Flush(true); }
        jsonl.WriteLine("{\"sequence\":" + seq + ",\"elapsed_us\":" + us + ",\"utc\":\"" + Json(utc) + "\",\"direction\":\"" + Json(direction) + "\",\"length\":" + length + ",\"hex\":\"" + Json(hex) + "\",\"ascii\":\"" + Json(ascii) + "\",\"note\":\"" + Json(note) + "\"}"); jsonl.Flush();
        csv.WriteLine(seq + "," + us + ",\"" + Csv(utc) + "\",\"" + Csv(direction) + "\"," + length + ",\"" + Csv(hex) + "\",\"" + Csv(ascii) + "\",\"" + Csv(note) + "\""); csv.Flush();
      }
    }

    static string Ascii(byte[] data) { var s = new StringBuilder(data.Length); foreach (byte b in data) s.Append(b >= 32 && b <= 126 ? (char)b : '.'); return s.ToString(); }
    static string Csv(string s) { return (s ?? "").Replace("\"", "\"\""); }
    static string Json(string s) { return (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t"); }
    void ClosePorts() { connected = false; foreach (var p in new[] { capturePort, hardwarePort }) { try { if (p != null && p.IsOpen) p.Close(); } catch { } try { if (p != null) p.Dispose(); } catch { } } capturePort = null; hardwarePort = null; }

    public void Stop() {
      if (!running && jsonl == null) return;
      stopping = true; ClosePorts(); if (manager != null && manager != Thread.CurrentThread) manager.Join(5000);
      lock (sync) {
        if (jsonl == null) return;
        LogEvent("META", null, "session-stop");
        File.WriteAllText(Path.Combine(sessionDir, "summary.json"), "{\n  \"ended_utc\": \"" + Json(DateTimeOffset.UtcNow.ToString("o")) + "\",\n  \"duration_seconds\": " + clock.Elapsed.TotalSeconds.ToString("F6", CultureInfo.InvariantCulture) + ",\n  \"pc_to_zeel_bytes\": " + pcBytes + ",\n  \"zeel_to_pc_bytes\": " + zeelBytes + ",\n  \"pc_to_zeel_chunks\": " + pcChunks + ",\n  \"zeel_to_pc_chunks\": " + zeelChunks + ",\n  \"reconnect_attempts\": " + reconnects + ",\n  \"clean_stop\": true\n}\n", new UTF8Encoding(false));
        foreach (IDisposable x in new IDisposable[] { jsonl, csv, pcRaw, zeelRaw }) try { if (x != null) x.Dispose(); } catch { }
        jsonl = null; csv = null; pcRaw = null; zeelRaw = null;
      }
      running = false; connected = false; messages.Enqueue("STOPPED: files closed cleanly");
    }
    public ProxyStatus GetStatus() { return new ProxyStatus { Running = running, Connected = connected, PcToZeelBytes = Interlocked.Read(ref pcBytes), ZeelToPcBytes = Interlocked.Read(ref zeelBytes), PcToZeelChunks = Interlocked.Read(ref pcChunks), ZeelToPcChunks = Interlocked.Read(ref zeelChunks), Reconnects = reconnects, SessionDirectory = sessionDir, LastError = lastError }; }
    public string NextMessage() { string value; return messages.TryDequeue(out value) ? value : null; }
    public void Dispose() { Stop(); }
  }
}
