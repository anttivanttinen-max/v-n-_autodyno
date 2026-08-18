param([string]$BaseDir = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture")

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$script:Version = '1.1.0-readonly-capture'
$script:Serial = $null
$script:SessionDir = $null
$script:Raw = $null
$script:Json = $null
$script:Csv = $null
$script:BytesRx = 0L
$script:PacketsRx = 0L
$script:StartUtc = $null

New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null

function Get-PortInventory {
    $result = @()
    try {
        $devices = Get-PnpDevice -Class Ports -PresentOnly -ErrorAction Stop
        foreach ($device in $devices) {
            $name = [string]$device.FriendlyName
            if ($name -notmatch '\((COM\d+)\)') { continue }
            $port = $Matches[1]
            $id = [string]$device.InstanceId
            $kind = 'other'

            # FTDI may appear as FTDIBUS\VID_0403+PID_6001+... rather than VID_0403&PID_6001.
            if ($id -match 'VID_0403(?:\+|&|_)PID_6001' -or $id -match 'VID_0403.*PID_6001') {
                $kind = 'zeel-ftdi'
            } elseif ($name -match 'CH343|Enhanced-SERIAL') {
                $kind = 'esp32-debug'
            } elseif ($name -match 'Virtual|com0com|CNCA|CNCB') {
                $kind = 'virtual'
            }

            $result += [pscustomobject]@{
                Port = $port
                Name = $name
                Id = $id
                Kind = $kind
            }
        }
    } catch {
        foreach ($port in [IO.Ports.SerialPort]::GetPortNames()) {
            $result += [pscustomobject]@{Port=$port;Name=$port;Id='';Kind='unknown'}
        }
    }
    return $result | Sort-Object {[int]($_.Port -replace '\D','')}
}

function Log([string]$text) {
    $stamp = (Get-Date).ToString('HH:mm:ss.fff')
    $log.AppendText("[$stamp] $text`r`n")
    $log.SelectionStart = $log.TextLength
    $log.ScrollToCaret()
}

function Get-SelectedPort {
    if (-not $ports.SelectedItem) { return '' }
    $s = [string]$ports.SelectedItem
    if ($s -match '^(COM\d+)') { return $Matches[1] }
    return ''
}

function Start-ReadOnlyCapture {
    if ($script:Serial) { Log 'Tallennus on jo kaynnissa.'; return }
    $port = Get-SelectedPort
    if (-not $port) { Log 'Valitse COM-portti.'; return }
    $baudRate = [int]$baud.SelectedItem

    try {
        $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
        $script:SessionDir = Join-Path $BaseDir $stamp
        New-Item -ItemType Directory -Force -Path $script:SessionDir | Out-Null
        $script:StartUtc = [DateTimeOffset]::UtcNow
        $script:BytesRx = 0
        $script:PacketsRx = 0

        $meta = [ordered]@{
            schema = 'motolab_zeel_readonly_capture_v1'
            app_version = $script:Version
            created_utc = $script:StartUtc.ToString('o')
            port = $port
            baud = $baudRate
            safety = [ordered]@{
                mode = 'read-only'
                generated_writes = $false
                raw_preserved = $true
                dtr = $false
                rts = $false
            }
        }
        $meta | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $script:SessionDir 'session.json')

        $script:Raw = [IO.File]::Open((Join-Path $script:SessionDir 'zeel_to_pc.raw'),[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::Read)
        $script:Json = [IO.StreamWriter]::new((Join-Path $script:SessionDir 'events.jsonl'),$false,[Text.UTF8Encoding]::new($false))
        $script:Csv = [IO.StreamWriter]::new((Join-Path $script:SessionDir 'timeline.csv'),$false,[Text.UTF8Encoding]::new($false))
        $script:Csv.WriteLine('utc,elapsed_ms,length,hex,ascii')

        $sp = [IO.Ports.SerialPort]::new($port,$baudRate,[IO.Ports.Parity]::None,8,[IO.Ports.StopBits]::One)
        $sp.ReadTimeout = 20
        $sp.WriteTimeout = 1000
        $sp.DtrEnable = $false
        $sp.RtsEnable = $false
        $sp.Open()
        $script:Serial = $sp
        $timer.Enabled = $true
        $status.Text = "READ-ONLY CAPTURE: $port @ $baudRate"
        Log "READ-ONLY capture kaynnissa: $port @ $baudRate"
        Log "Sessio: $script:SessionDir"
        Log 'Sovellus ei laheta yhtaan tavua porttiin.'
    } catch {
        Log "Kaynnistysvirhe: $($_.Exception.Message)"
        Stop-Capture
    }
}

function Stop-Capture {
    $timer.Enabled = $false
    try { if ($script:Serial -and $script:Serial.IsOpen) { $script:Serial.Close() } } catch {}
    try { if ($script:Serial) { $script:Serial.Dispose() } } catch {}
    $script:Serial = $null
    foreach ($objName in @('Raw','Json','Csv')) {
        try {
            $obj = Get-Variable -Name $objName -Scope Script -ValueOnly -ErrorAction SilentlyContinue
            if ($obj) { $obj.Flush(); $obj.Dispose(); Set-Variable -Name $objName -Scope Script -Value $null }
        } catch {}
    }
    if ($script:SessionDir) {
        $summary = [ordered]@{
            ended_utc = [DateTimeOffset]::UtcNow.ToString('o')
            bytes_rx = $script:BytesRx
            packets_rx = $script:PacketsRx
            generated_writes = 0
        }
        $summary | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $script:SessionDir 'summary.json')
        Log "Tallennus suljettu: $script:BytesRx tavua / $script:PacketsRx pakettia"
        $script:SessionDir = $null
    }
    $status.Text = 'Pysaytetty'
}

$form = New-Object Windows.Forms.Form
$form.Text = "MotoLab Zeel Capture $script:Version"
$form.Size = New-Object Drawing.Size(980,680)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [Drawing.Color]::FromArgb(18,18,20)
$form.ForeColor = [Drawing.Color]::White

$title = New-Object Windows.Forms.Label
$title.Text = 'VANA MotoLab - ZEEL CAPTURE'
$title.Font = New-Object Drawing.Font('Segoe UI',16,[Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object Drawing.Point(20,18)
$form.Controls.Add($title)

$ports = New-Object Windows.Forms.ComboBox
$ports.Location = New-Object Drawing.Point(20,62)
$ports.Width = 510
$ports.DropDownStyle = 'DropDownList'
$form.Controls.Add($ports)

$baud = New-Object Windows.Forms.ComboBox
$baud.Location = New-Object Drawing.Point(540,62)
$baud.Width = 120
$baud.DropDownStyle = 'DropDownList'
foreach ($b in @(9600,19200,38400,57600,115200,230400,460800,921600)) { [void]$baud.Items.Add($b) }
$baud.SelectedItem = 115200
$form.Controls.Add($baud)

$detect = New-Object Windows.Forms.Button
$detect.Text = 'TUNNISTA'
$detect.Location = New-Object Drawing.Point(675,60)
$detect.Width = 120
$form.Controls.Add($detect)

$start = New-Object Windows.Forms.Button
$start.Text = 'READ-ONLY START'
$start.Location = New-Object Drawing.Point(805,60)
$start.Width = 140
$form.Controls.Add($start)

$stop = New-Object Windows.Forms.Button
$stop.Text = 'STOP'
$stop.Location = New-Object Drawing.Point(805,98)
$stop.Width = 140
$form.Controls.Add($stop)

$status = New-Object Windows.Forms.Label
$status.Location = New-Object Drawing.Point(20,105)
$status.Size = New-Object Drawing.Size(760,42)
$status.Text = 'Valmis. Tunnista laitteet.'
$form.Controls.Add($status)

$log = New-Object Windows.Forms.TextBox
$log.Location = New-Object Drawing.Point(20,155)
$log.Size = New-Object Drawing.Size(925,430)
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = 'Vertical'
$log.BackColor = [Drawing.Color]::Black
$log.ForeColor = [Drawing.Color]::LightGreen
$log.Font = New-Object Drawing.Font('Consolas',10)
$form.Controls.Add($log)

$safety = New-Object Windows.Forms.Label
$safety.Location = New-Object Drawing.Point(20,600)
$safety.Size = New-Object Drawing.Size(925,35)
$safety.Text = 'READ-ONLY: ei kirjoituksia. RAW + HEX + ASCII + aikaleimat tallennetaan muuttamattomina.'
$form.Controls.Add($safety)

$detect.Add_Click({
    $ports.Items.Clear()
    $inventory = @(Get-PortInventory)
    if ($inventory.Count -eq 0) {
        $status.Text = 'COM-portteja ei loytynyt.'
        Log 'Ei COM-portteja.'
        return
    }
    $zeelFound = $false
    $espFound = $false
    foreach ($item in $inventory) {
        [void]$ports.Items.Add("$($item.Port) | $($item.Kind) | $($item.Name)")
        Log "$($item.Port)  $($item.Kind)  $($item.Name)  [$($item.Id)]"
        if ($item.Kind -eq 'zeel-ftdi') { $zeelFound = $true }
        if ($item.Kind -eq 'esp32-debug') { $espFound = $true }
    }
    for ($i=0; $i -lt $ports.Items.Count; $i++) {
        if ([string]$ports.Items[$i] -match '\| zeel-ftdi \|') { $ports.SelectedIndex = $i; break }
    }
    if ($ports.SelectedIndex -lt 0 -and $ports.Items.Count -gt 0) { $ports.SelectedIndex = 0 }
    $status.Text = "Portteja: $($inventory.Count) | Zeel FTDI: $zeelFound | ESP32: $espFound"
})

$start.Add_Click({ Start-ReadOnlyCapture })
$stop.Add_Click({ Stop-Capture })

$timer = New-Object Windows.Forms.Timer
$timer.Interval = 20
$timer.Enabled = $false
$timer.Add_Tick({
    if (-not $script:Serial) { return }
    try {
        $n = $script:Serial.BytesToRead
        if ($n -le 0) { return }
        $buf = New-Object byte[] $n
        $read = $script:Serial.Read($buf,0,$n)
        if ($read -le 0) { return }
        if ($read -ne $buf.Length) { $buf = [byte[]]$buf[0..($read-1)] }

        $script:Raw.Write($buf,0,$buf.Length)
        $script:Raw.Flush()
        $script:BytesRx += $buf.Length
        $script:PacketsRx++

        $hex = ([BitConverter]::ToString($buf)).Replace('-',' ')
        $ascii = -join ($buf | ForEach-Object { if ($_ -ge 32 -and $_ -le 126) {[char]$_} else {'.'} })
        $utc = [DateTimeOffset]::UtcNow
        $elapsed = [math]::Round(($utc - $script:StartUtc).TotalMilliseconds,3)
        $event = [ordered]@{utc=$utc.ToString('o');elapsed_ms=$elapsed;length=$buf.Length;hex=$hex;ascii=$ascii}
        $script:Json.WriteLine(($event | ConvertTo-Json -Compress))
        $script:Json.Flush()
        $script:Csv.WriteLine(('"{0}",{1},{2},"{3}","{4}"' -f $event.utc,$event.elapsed_ms,$event.length,$hex,$ascii))
        $script:Csv.Flush()
        Log "RX $($buf.Length) B | $hex | $ascii"
        $status.Text = "READ-ONLY | RX $script:BytesRx B / $script:PacketsRx pkt"
    } catch {
        Log "READ ERROR: $($_.Exception.Message)"
    }
})

$form.Add_Shown({ $detect.PerformClick() })
$form.Add_FormClosing({ Stop-Capture })
[void]$form.ShowDialog()
