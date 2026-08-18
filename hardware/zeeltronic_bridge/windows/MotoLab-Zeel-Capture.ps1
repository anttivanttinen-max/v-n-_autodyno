param(
  [string]$BaseDir = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture",
  [string]$CapturePort = 'COM11',
  [string]$ZeelProgPort = 'COM10',
  [string]$HardwarePort = 'COM7',
  [int]$Baud = 115200
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot 'ZeelProxyEngine.cs')
New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null

$engine = [MotoLab.ZeelCapture.ProxyEngine]::new()
$form = [Windows.Forms.Form]::new()
$form.Text = 'VANA MotoLab Zeel Capture 1.0.0'
$form.Size = [Drawing.Size]::new(830, 570)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [Drawing.Color]::FromArgb(18,18,20)
$form.ForeColor = [Drawing.Color]::White

$title = [Windows.Forms.Label]::new(); $title.Text='VANA MotoLab - ZEEL TRANSPARENT PROXY / CAPTURE'; $title.Font=[Drawing.Font]::new('Segoe UI',14,[Drawing.FontStyle]::Bold); $title.AutoSize=$true; $title.Location=[Drawing.Point]::new(16,15); $form.Controls.Add($title)
$route = [Windows.Forms.Label]::new(); $route.Text="ZeelProg $ZeelProgPort <-> $CapturePort (Capture) <-> $HardwarePort (Zeeltronic FTDI)   -   $Baud baud, 8N1"; $route.AutoSize=$true; $route.Location=[Drawing.Point]::new(18,55); $form.Controls.Add($route)
$warning = [Windows.Forms.Label]::new(); $warning.Text='Transparent mode: no generated CDI commands; only received bytes are forwarded.'; $warning.ForeColor=[Drawing.Color]::Gold; $warning.AutoSize=$true; $warning.Location=[Drawing.Point]::new(18,80); $form.Controls.Add($warning)
$start = [Windows.Forms.Button]::new(); $start.Text='START PROXY'; $start.Location=[Drawing.Point]::new(18,112); $start.Size=[Drawing.Size]::new(150,42); $form.Controls.Add($start)
$stop = [Windows.Forms.Button]::new(); $stop.Text='STOP'; $stop.Location=[Drawing.Point]::new(180,112); $stop.Size=[Drawing.Size]::new(150,42); $stop.BackColor=[Drawing.Color]::DarkRed; $stop.ForeColor=[Drawing.Color]::White; $stop.Enabled=$false; $form.Controls.Add($stop)
$folder = [Windows.Forms.Button]::new(); $folder.Text='AVAA DATAKANSIO'; $folder.Location=[Drawing.Point]::new(342,112); $folder.Size=[Drawing.Size]::new(165,42); $form.Controls.Add($folder)
$status = [Windows.Forms.Label]::new(); $status.Text='STOPPED'; $status.Font=[Drawing.Font]::new('Segoe UI',11,[Drawing.FontStyle]::Bold); $status.AutoSize=$true; $status.Location=[Drawing.Point]::new(525,125); $form.Controls.Add($status)
$counts = [Windows.Forms.Label]::new(); $counts.Text='PC->ZEEL 0 B   |   ZEEL->PC 0 B   |   reconnect 0'; $counts.AutoSize=$true; $counts.Location=[Drawing.Point]::new(18,171); $form.Controls.Add($counts)
$log = [Windows.Forms.TextBox]::new(); $log.Multiline=$true; $log.ReadOnly=$true; $log.ScrollBars='Vertical'; $log.BackColor=[Drawing.Color]::Black; $log.ForeColor=[Drawing.Color]::LightGreen; $log.Font=[Drawing.Font]::new('Consolas',10); $log.Location=[Drawing.Point]::new(18,202); $log.Size=[Drawing.Size]::new(775,260); $form.Controls.Add($log)
$hint = [Windows.Forms.Label]::new(); $hint.Text='STOP finalizes RAW/JSONL/CSV/summary files. On error, reconnect is attempted every 2 seconds.'; $hint.AutoSize=$true; $hint.Location=[Drawing.Point]::new(18,480); $form.Controls.Add($hint)

function Add-Log([string]$Text) { $log.AppendText("[$((Get-Date).ToString('HH:mm:ss.fff'))] $Text`r`n"); $log.SelectionStart=$log.TextLength; $log.ScrollToCaret() }
function Stop-Proxy { $stop.Enabled=$false; Add-Log 'STOP requested - closing ports and finalizing files...'; try { $engine.Stop() } catch { Add-Log "STOP ERROR: $($_.Exception.Message)" }; $start.Enabled=$true }

$start.Add_Click({
  try {
    $engine.Start($BaseDir,$CapturePort,$ZeelProgPort,$HardwarePort,$Baud)
    Add-Log "Session started: $($engine.GetStatus().SessionDirectory)"
    Add-Log "Avaa ZeelProg ja valitse $ZeelProgPort. Capture omistaa $CapturePort-portin."
    $start.Enabled=$false; $stop.Enabled=$true
  } catch { Add-Log "START ERROR: $($_.Exception.Message)"; [Windows.Forms.MessageBox]::Show($_.Exception.Message,'MotoLab Zeel Capture') | Out-Null }
})
$stop.Add_Click({ Stop-Proxy })
$folder.Add_Click({ Start-Process explorer.exe $BaseDir })
$timer = [Windows.Forms.Timer]::new(); $timer.Interval=200
$timer.Add_Tick({
  $s=$engine.GetStatus(); $status.Text=if($s.Connected){'CONNECTED'}elseif($s.Running){'RECONNECT...'}else{'STOPPED'}
  $status.ForeColor=if($s.Connected){[Drawing.Color]::LightGreen}elseif($s.Running){[Drawing.Color]::Gold}else{[Drawing.Color]::White}
  $counts.Text="PC->ZEEL $($s.PcToZeelBytes) B / $($s.PcToZeelChunks) chunks   |   ZEEL->PC $($s.ZeelToPcBytes) B / $($s.ZeelToPcChunks) chunks   |   reconnect $($s.Reconnects)"
  while($null -ne ($m=$engine.NextMessage())) { Add-Log $m }
}); $timer.Start()
$form.Add_FormClosing({ $timer.Stop(); Stop-Proxy; $engine.Dispose() })
Add-Log "Ready. Fixed route: ZeelProg $ZeelProgPort, Capture $CapturePort, Zeeltronic $HardwarePort."
[void]$form.ShowDialog()
