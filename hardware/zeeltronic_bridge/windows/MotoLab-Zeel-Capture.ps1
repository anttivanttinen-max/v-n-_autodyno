param(
  [string]$BaseDir = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$script:Version = '0.1.0-readonly-first'
$script:Capture = $null
$script:UiTimer = $null
$script:SessionDir = $null
$script:EventsWriter = $null
$script:CsvWriter = $null
$script:RawRx = $null
$script:RawTx = $null
$script:StopRequested = $false
$script:BytesRx = 0L
$script:BytesTx = 0L
$script:PacketsRx = 0L
$script:PacketsTx = 0L
$script:StartUtc = $null

New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null

function Get-NowUs {
  return [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000)
}

function Escape-Json([string]$s) {
  return ($s | ConvertTo-Json -Compress)
}

function Get-PortInventory {
  $ports = @()
  try {
    $pnp = Get-PnpDevice -Class Ports -PresentOnly -ErrorAction Stop
    foreach ($d in $pnp) {
      $name = [string]$d.FriendlyName
      $com = $null
      if ($name -match '\((COM\d+)\)') { $com = $Matches[1] }
      if (-not $com) { continue }
      $inst = [string]$d.InstanceId
      $kind = 'other'
      if ($inst -match 'VID_0403&PID_6001') { $kind = 'zeel-ftdi' }
      elseif ($name -match 'CH343|Enhanced-SERIAL') { $kind = 'esp32-debug' }
      elseif ($name -match 'Virtual|com0com|CNCA|CNCB') { $kind = 'virtual' }
      $ports += [pscustomobject]@{ Port=$com; FriendlyName=$name; InstanceId=$inst; Kind=$kind }
    }
  } catch {
    foreach ($p in [System.IO.Ports.SerialPort]::GetPortNames()) {
      $ports += [pscustomobject]@{ Port=$p; FriendlyName=$p; InstanceId=''; Kind='unknown' }
    }
  }
  return $ports | Sort-Object {[int]($_.Port -replace '\D','')}
}

function Add-UiLog([string]$text) {
  if (-not $script:LogBox) { return }
  $stamp = (Get-Date).ToString('HH:mm:ss.fff')
  $line = "[$stamp] $text`r`n"
  $script:LogBox.AppendText($line)
  $script:LogBox.SelectionStart = $script:LogBox.TextLength
  $script:LogBox.ScrollToCaret()
}

function Write-Event([string]$dir,[byte[]]$data,[string]$note='') {
  $us = Get-NowUs
  $obj = [ordered]@{
    ts_us = $us
    utc = [DateTimeOffset]::UtcNow.ToString('o')
    direction = $dir
    length = if($data){$data.Length}else{0}
    hex = if($data){([BitConverter]::ToString($data)).Replace('-',' ')}else{''}
    ascii = if($data){-join ($data | ForEach-Object { if($_ -ge 32 -and $_ -le 126){[char]$_}else{'.'} })}else{''}
    note = $note
  }
  $script:EventsWriter.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  $script:EventsWriter.Flush()
  $script:CsvWriter.WriteLine(('"{0}","{1}","{2}","{3}","{4}","{5}"' -f $obj.ts_us,$obj.utc,$obj.direction,$obj.length,($obj.hex -replace '"','""'),($obj.ascii -replace '"','""')))
  $script:CsvWriter.Flush()
}

function New-Session([string]$mode,[string]$hardwarePort,[int]$baud,[string]$virtualPort='') {
  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
  $script:SessionDir = Join-Path $BaseDir $stamp
  New-Item -ItemType Directory -Force -Path $script:SessionDir | Out-Null
  $script:StartUtc = [DateTimeOffset]::UtcNow
  $script:BytesRx = 0; $script:BytesTx = 0; $script:PacketsRx = 0; $script:PacketsTx = 0

  $meta = [ordered]@{
    schema='motolab_zeel_capture_session_v1'
    app_version=$script:Version
    created_utc=$script:StartUtc.ToString('o')
    computer=$env:COMPUTERNAME
    user=$env:USERNAME
    os=[Environment]::OSVersion.VersionString
    mode=$mode
    hardware_port=$hardwarePort
    virtual_port=$virtualPort
    baud=$baud
    known_device=[ordered]@{ vendor='FTDI'; vid='0403'; pid='6001'; expected='Zeeltronic PC-USB adapter' }
    safety=[ordered]@{ default='read-only'; generated_cdi_writes=$false; raw_preserved=$true }
  }
  $meta | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $script:SessionDir 'session.json')
  $script:EventsWriter = [IO.StreamWriter]::new((Join-Path $script:SessionDir 'events.jsonl'),$false,[Text.UTF8Encoding]::new($false))
  $script:CsvWriter = [IO.StreamWriter]::new((Join-Path $script:SessionDir 'timeline.csv'),$false,[Text.UTF8Encoding]::new($false))
  $script:CsvWriter.WriteLine('ts_us,utc,direction,length,hex,ascii')
  $script:RawRx = [IO.File]::Open((Join-Path $script:SessionDir 'zeel_to_pc.raw'),[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::Read)
  $script:RawTx = [IO.File]::Open((Join-Path $script:SessionDir 'pc_to_zeel.raw'),[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::Read)
  Write-Event 'META' @() "session-start mode=$mode hardware=$hardwarePort virtual=$virtualPort baud=$baud"
  Add-UiLog "Sessio: $script:SessionDir"
}

function Close-Session {
  try { if($script:Capture){ $script:Capture.Dispose(); $script:Capture=$null } } catch {}
  foreach($x in @('RawRx','RawTx','EventsWriter','CsvWriter')) {
    try { if($script:$x){ $script:$x.Flush(); $script:$x.Dispose(); $script:$x=$null } } catch {}
  }
  if($script:SessionDir) {
    $summary = [ordered]@{
      ended_utc=[DateTimeOffset]::UtcNow.ToString('o')
      duration_s= if($script:StartUtc){([DateTimeOffset]::UtcNow-$script:StartUtc).TotalSeconds}else{0}
      bytes_zeel_to_pc=$script:BytesRx
      bytes_pc_to_zeel=$script:BytesTx
      packets_zeel_to_pc=$script:PacketsRx
      packets_pc_to_zeel=$script:PacketsTx
    }
    $summary | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $script:SessionDir 'summary.json')
  }
}

class SerialEndpoint : System.IDisposable {
  [System.IO.Ports.SerialPort]$Port
  SerialEndpoint([string]$name,[int]$baud) {
    $this.Port = [System.IO.Ports.SerialPort]::new($name,$baud,[System.IO.Ports.Parity]::None,8,[System.IO.Ports.StopBits]::One)
    $this.Port.ReadTimeout = 100
    $this.Port.WriteTimeout = 1000
    $this.Port.DtrEnable = $true
    $this.Port.RtsEnable = $true
    $this.Port.Open()
  }
  [byte[]] ReadAvailable() {
    $n = $this.Port.BytesToRead
    if($n -le 0){ return [byte[]]@() }
    $b = New-Object byte[] $n
    $r = $this.Port.Read($b,0,$n)
    if($r -eq $n){ return $b }
    return $b[0..($r-1)]
  }
  [void] WriteBytes([byte[]]$b) {
    if($b.Length -gt 0){ $this.Port.Write($b,0,$b.Length) }
  }
  [void] Dispose() {
    try { if($this.Port -and $this.Port.IsOpen){ $this.Port.Close() } } catch {}
    try { if($this.Port){ $this.Port.Dispose() } } catch {}
  }
}

class CapturePair : System.IDisposable {
  [SerialEndpoint]$Hardware
  [SerialEndpoint]$Virtual
  [bool]$Proxy
  CapturePair([string]$hardware,[int]$baud,[string]$virtual) {
    $this.Hardware = [SerialEndpoint]::new($hardware,$baud)
    if($virtual){ $this.Virtual=[SerialEndpoint]::new($virtual,$baud); $this.Proxy=$true } else { $this.Proxy=$false }
  }
  [void] Dispose() {
    if($this.Hardware){$this.Hardware.Dispose()}
    if($this.Virtual){$this.Virtual.Dispose()}
  }
}

function Poll-Capture {
  if(-not $script:Capture){ return }
  try {
    $rx = $script:Capture.Hardware.ReadAvailable()
    if($rx.Length -gt 0) {
      $script:RawRx.Write($rx,0,$rx.Length); $script:RawRx.Flush()
      Write-Event 'ZEEL->PC' $rx
      $script:BytesRx += $rx.Length; $script:PacketsRx++
      if($script:Capture.Proxy){ $script:Capture.Virtual.WriteBytes($rx) }
    }
    if($script:Capture.Proxy) {
      $tx = $script:Capture.Virtual.ReadAvailable()
      if($tx.Length -gt 0) {
        $script:RawTx.Write($tx,0,$tx.Length); $script:RawTx.Flush()
        Write-Event 'PC->ZEEL' $tx 'forwarded-from-virtual-com'
        $script:BytesTx += $tx.Length; $script:PacketsTx++
        $script:Capture.Hardware.WriteBytes($tx)
      }
    }
    $script:StatusLabel.Text = "RX $script:BytesRx B / $script:PacketsRx pkt    TX $script:BytesTx B / $script:PacketsTx pkt"
  } catch {
    Add-UiLog "CAPTURE ERROR: $($_.Exception.Message)"
    try { Write-Event 'ERROR' @() $_.Exception.Message } catch {}
  }
}

function Refresh-Ports {
  $inv = @(Get-PortInventory)
  $script:HwCombo.Items.Clear(); $script:VirtCombo.Items.Clear()
  foreach($p in $inv) {
    [void]$script:HwCombo.Items.Add("$($p.Port) | $($p.Kind) | $($p.FriendlyName)")
    if($p.Kind -eq 'virtual'){ [void]$script:VirtCombo.Items.Add("$($p.Port) | $($p.FriendlyName)") }
  }
  $zeel = $inv | Where-Object Kind -eq 'zeel-ftdi' | Select-Object -First 1
  if($zeel) {
    $idx = 0
    foreach($item in $script:HwCombo.Items){ if($item -like "$($zeel.Port) *"){ $script:HwCombo.SelectedIndex=$idx; break }; $idx++ }
    Add-UiLog "Zeeltronic FTDI löytyi: $($zeel.Port) / VID 0403 PID 6001"
  } else { Add-UiLog 'Zeeltronic FTDI 0403:6001 ei löytynyt.' }
  $esp = $inv | Where-Object Kind -eq 'esp32-debug' | Select-Object -First 1
  if($esp){ Add-UiLog "ESP32 Single Serial: $($esp.Port)" }
  if($script:VirtCombo.Items.Count -eq 0){ [void]$script:VirtCombo.Items.Add('(ei virtuaali-COM-paria havaittu)') }
  if($script:HwCombo.Items.Count -gt 0 -and $script:HwCombo.SelectedIndex -lt 0){$script:HwCombo.SelectedIndex=0}
  if($script:VirtCombo.Items.Count -gt 0){$script:VirtCombo.SelectedIndex=0}
}

function Selected-Port([System.Windows.Forms.ComboBox]$combo) {
  if(-not $combo.SelectedItem){return ''}
  $s=[string]$combo.SelectedItem
  if($s -match '^(COM\d+)'){return $Matches[1]}
  return ''
}

function Start-Direct {
  if($script:Capture){ return }
  $hw=Selected-Port $script:HwCombo; if(-not $hw){[System.Windows.Forms.MessageBox]::Show('Valitse Zeeltronic COM-portti.');return}
  $baud=[int]$script:BaudCombo.SelectedItem
  try {
    New-Session 'direct-read-only' $hw $baud
    $script:Capture=[CapturePair]::new($hw,$baud,'')
    Add-UiLog "READ-ONLY direct capture käynnissä: $hw @ $baud. Tämä tila ei lähetä omia komentoja CDI:lle."
  } catch { Add-UiLog "Käynnistys epäonnistui: $($_.Exception.Message)"; Close-Session }
}

function Start-Proxy {
  if($script:Capture){ return }
  $hw=Selected-Port $script:HwCombo; $virt=Selected-Port $script:VirtCombo
  if(-not $hw -or -not $virt){[System.Windows.Forms.MessageBox]::Show('Proxy vaatii Zeeltronic COM-portin ja virtuaali-COM-parin tämän pään.');return}
  $baud=[int]$script:BaudCombo.SelectedItem
  $answer=[System.Windows.Forms.MessageBox]::Show("PROXY välittää ZeelProgin lähettämät tavut fyysiselle Zeeltronic-portille. Sovellus ei generoi omia kirjoituskomentoja. Jatketaanko?",'MotoLab Zeel Capture',[System.Windows.Forms.MessageBoxButtons]::YesNo,[System.Windows.Forms.MessageBoxIcon]::Warning)
  if($answer -ne [System.Windows.Forms.DialogResult]::Yes){return}
  try {
    New-Session 'transparent-proxy' $hw $baud $virt
    $script:Capture=[CapturePair]::new($hw,$baud,$virt)
    Add-UiLog "PROXY käynnissä: ZeelProg <-> $virt <-> Capture <-> $hw <-> Zeeltronic"
    Add-UiLog 'Aseta ZeelProg käyttämään virtuaaliparin TOISTA COM-porttia, ei tätä Capture-porttia.'
  } catch { Add-UiLog "Proxy epäonnistui: $($_.Exception.Message)"; Close-Session }
}

function Stop-Capture {
  if($script:Capture){ Add-UiLog 'Tallennus pysäytetään.' }
  Close-Session
  $script:StatusLabel.Text='Pysäytetty'
}

function Search-Captures([string]$needle) {
  if([string]::IsNullOrWhiteSpace($needle)){return}
  $needle=$needle.Trim().ToUpperInvariant()
  $hits=@()
  Get-ChildItem $BaseDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $f=Join-Path $_.FullName 'events.jsonl'; if(-not (Test-Path $f)){return}
    $lineNo=0
    Get-Content $f | ForEach-Object {
      $lineNo++
      if($_.ToUpperInvariant().Contains($needle)){ $hits += [pscustomobject]@{Session=$_.PSParentPath; File=$f; Line=$lineNo; Text=$_} }
    }
  }
  $script:SearchBox.Clear()
  if($hits.Count -eq 0){$script:SearchBox.AppendText('Ei osumia.');return}
  foreach($h in $hits | Select-Object -First 300){$script:SearchBox.AppendText("$($h.File):$($h.Line)`r`n$($h.Text)`r`n`r`n")}
}

function Build-Index {
  $out=Join-Path $BaseDir 'capture_index.csv'
  'session,created_utc,mode,hardware_port,virtual_port,baud,rx_bytes,tx_bytes' | Set-Content -Encoding UTF8 $out
  foreach($d in Get-ChildItem $BaseDir -Directory -ErrorAction SilentlyContinue){
    $m=Join-Path $d.FullName 'session.json'; $s=Join-Path $d.FullName 'summary.json'; if(-not(Test-Path $m)){continue}
    try{$meta=Get-Content $m -Raw|ConvertFrom-Json;$sum=if(Test-Path $s){Get-Content $s -Raw|ConvertFrom-Json}else{$null};
      ('"{0}","{1}","{2}","{3}","{4}",{5},{6},{7}' -f $d.Name,$meta.created_utc,$meta.mode,$meta.hardware_port,$meta.virtual_port,$meta.baud,($sum.bytes_zeel_to_pc),($sum.bytes_pc_to_zeel)) | Add-Content -Encoding UTF8 $out
    }catch{}
  }
  Add-UiLog "Hakemisto päivitetty: $out"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "MotoLab Zeel Capture $script:Version"
$form.Size = New-Object Drawing.Size(1040,720)
$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.Color]::FromArgb(18,18,20)
$form.ForeColor=[Drawing.Color]::White

$top = New-Object Windows.Forms.Panel; $top.Dock='Top'; $top.Height=145; $form.Controls.Add($top)
$lbl = New-Object Windows.Forms.Label; $lbl.Text='VäNä MotoLab • ZEEL CAPTURE'; $lbl.Font=New-Object Drawing.Font('Segoe UI',16,[Drawing.FontStyle]::Bold); $lbl.AutoSize=$true; $lbl.Location=New-Object Drawing.Point(15,12); $top.Controls.Add($lbl)

$script:HwCombo=New-Object Windows.Forms.ComboBox; $script:HwCombo.DropDownStyle='DropDownList'; $script:HwCombo.Location=New-Object Drawing.Point(15,52); $script:HwCombo.Width=430; $top.Controls.Add($script:HwCombo)
$script:VirtCombo=New-Object Windows.Forms.ComboBox; $script:VirtCombo.DropDownStyle='DropDownList'; $script:VirtCombo.Location=New-Object Drawing.Point(455,52); $script:VirtCombo.Width=320; $top.Controls.Add($script:VirtCombo)
$script:BaudCombo=New-Object Windows.Forms.ComboBox; $script:BaudCombo.DropDownStyle='DropDownList'; $script:BaudCombo.Location=New-Object Drawing.Point(785,52); $script:BaudCombo.Width=105; foreach($b in @(9600,19200,38400,57600,115200,230400,460800,921600)){[void]$script:BaudCombo.Items.Add($b)};$script:BaudCombo.SelectedItem=115200;$top.Controls.Add($script:BaudCombo)

$btnRefresh=New-Object Windows.Forms.Button;$btnRefresh.Text='TUNNISTA LAITTEET';$btnRefresh.Location=New-Object Drawing.Point(15,88);$btnRefresh.Width=150;$top.Controls.Add($btnRefresh)
$btnDirect=New-Object Windows.Forms.Button;$btnDirect.Text='READ-ONLY CAPTURE';$btnDirect.Location=New-Object Drawing.Point(175,88);$btnDirect.Width=150;$top.Controls.Add($btnDirect)
$btnProxy=New-Object Windows.Forms.Button;$btnProxy.Text='ZEELPROG PROXY';$btnProxy.Location=New-Object Drawing.Point(335,88);$btnProxy.Width=150;$top.Controls.Add($btnProxy)
$btnStop=New-Object Windows.Forms.Button;$btnStop.Text='STOP';$btnStop.Location=New-Object Drawing.Point(495,88);$btnStop.Width=90;$top.Controls.Add($btnStop)
$btnFolder=New-Object Windows.Forms.Button;$btnFolder.Text='AVAA DATA';$btnFolder.Location=New-Object Drawing.Point(595,88);$btnFolder.Width=100;$top.Controls.Add($btnFolder)
$btnIndex=New-Object Windows.Forms.Button;$btnIndex.Text='PÄIVITÄ HAKEMISTO';$btnIndex.Location=New-Object Drawing.Point(705,88);$btnIndex.Width=140;$top.Controls.Add($btnIndex)

$tabs=New-Object Windows.Forms.TabControl;$tabs.Dock='Fill';$form.Controls.Add($tabs)
$tabLog=New-Object Windows.Forms.TabPage;$tabLog.Text='LIVE / LOKI';$tabLog.BackColor=$form.BackColor;$tabs.TabPages.Add($tabLog)
$script:LogBox=New-Object Windows.Forms.TextBox;$script:LogBox.Multiline=$true;$script:LogBox.ReadOnly=$true;$script:LogBox.ScrollBars='Vertical';$script:LogBox.Dock='Fill';$script:LogBox.BackColor=[Drawing.Color]::Black;$script:LogBox.ForeColor=[Drawing.Color]::LightGreen;$script:LogBox.Font=New-Object Drawing.Font('Consolas',10);$tabLog.Controls.Add($script:LogBox)
$script:StatusLabel=New-Object Windows.Forms.Label;$script:StatusLabel.Dock='Bottom';$script:StatusLabel.Height=28;$script:StatusLabel.Text='Valmis';$tabLog.Controls.Add($script:StatusLabel)

$tabSearch=New-Object Windows.Forms.TabPage;$tabSearch.Text='HAKU';$tabSearch.BackColor=$form.BackColor;$tabs.TabPages.Add($tabSearch)
$searchTop=New-Object Windows.Forms.Panel;$searchTop.Dock='Top';$searchTop.Height=45;$tabSearch.Controls.Add($searchTop)
$searchInput=New-Object Windows.Forms.TextBox;$searchInput.Location=New-Object Drawing.Point(10,10);$searchInput.Width=700;$searchTop.Controls.Add($searchInput)
$searchBtn=New-Object Windows.Forms.Button;$searchBtn.Text='HAE RAW/HEX/ASCII';$searchBtn.Location=New-Object Drawing.Point(720,8);$searchBtn.Width=160;$searchTop.Controls.Add($searchBtn)
$script:SearchBox=New-Object Windows.Forms.TextBox;$script:SearchBox.Multiline=$true;$script:SearchBox.ReadOnly=$true;$script:SearchBox.ScrollBars='Both';$script:SearchBox.Dock='Fill';$script:SearchBox.BackColor=[Drawing.Color]::Black;$script:SearchBox.ForeColor=[Drawing.Color]::White;$script:SearchBox.Font=New-Object Drawing.Font('Consolas',9);$tabSearch.Controls.Add($script:SearchBox);$script:SearchBox.BringToFront()

$tabInfo=New-Object Windows.Forms.TabPage;$tabInfo.Text='OHJE / TURVA';$tabInfo.BackColor=$form.BackColor;$tabs.TabPages.Add($tabInfo)
$info=New-Object Windows.Forms.TextBox;$info.Multiline=$true;$info.ReadOnly=$true;$info.Dock='Fill';$info.BackColor=$form.BackColor;$info.ForeColor=[Drawing.Color]::White;$info.Text=@'
READ-ONLY CAPTURE
• Avaa vain fyysisen Zeeltronic FTDI -portin ja tallentaa Zeeltronicilta saapuvan datan.
• Ei generoi eikä lähetä CDI:lle omia komentoja.

ZEELPROG PROXY
• Vaatii valmiiksi asennetun virtuaali-COM-parin.
• Capture avaa parin toisen pään ja fyysisen FTDI-portin.
• ZeelProg asetetaan käyttämään virtuaaliparin toista päätä.
• Kaikki ZeelProgin aidosti lähettämä liikenne välitetään ja tallennetaan molempiin suuntiin.

TALLENNUS
• session.json = laite-, aika-, portti- ja turvallisuusmetadata
• events.jsonl = jokainen paketti aikaleimalla + HEX + ASCII
• timeline.csv = helposti avattava taulukko
• zeel_to_pc.raw / pc_to_zeel.raw = alkuperäinen muuttamaton binääridata
• summary.json = session yhteenveto

TUNNETTU ZEELTRONIC USB-ADAPTERI
• FTDI VID 0403 / PID 6001

TÄRKEÄÄ
• RAW-tiedostoja ei muokata eikä poisteta analyysin aikana.
• Ensimmäinen tutkimusvaihe pidetään read-onlyna aina kun ZeelProg-proxya ei tarvita.
'@;$tabInfo.Controls.Add($info)

$btnRefresh.Add_Click({Refresh-Ports})
$btnDirect.Add_Click({Start-Direct})
$btnProxy.Add_Click({Start-Proxy})
$btnStop.Add_Click({Stop-Capture})
$btnFolder.Add_Click({Start-Process explorer.exe $BaseDir})
$btnIndex.Add_Click({Build-Index})
$searchBtn.Add_Click({Search-Captures $searchInput.Text})

$script:UiTimer=New-Object Windows.Forms.Timer;$script:UiTimer.Interval=20;$script:UiTimer.Add_Tick({Poll-Capture});$script:UiTimer.Start()
$form.Add_FormClosing({$script:UiTimer.Stop();Stop-Capture})
Refresh-Ports
Add-UiLog "MotoLab Zeel Capture $script:Version käynnissä. Data: $BaseDir"
[void]$form.ShowDialog()
