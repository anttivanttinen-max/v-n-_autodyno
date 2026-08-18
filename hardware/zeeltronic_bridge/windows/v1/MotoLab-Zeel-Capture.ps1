param([string]$BaseDir = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$script:Version = '1.0.1-parser-fix'
New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null
function Get-PortInventory {
 $result=@()
 try {
  $devices=Get-PnpDevice -Class Ports -PresentOnly
  foreach ($device in $devices) {
   $name=[string]$device.FriendlyName
   if ($name -notmatch '\((COM\d+)\)') { continue }
   $port=$Matches[1]; $id=[string]$device.InstanceId; $kind='other'
   if ($id -match 'VID_0403&PID_6001') {$kind='zeel-ftdi'} elseif ($name -match 'CH343|Enhanced-SERIAL') {$kind='esp32-debug'} elseif ($name -match 'Virtual|com0com|CNCA|CNCB') {$kind='virtual'}
   $result += [pscustomobject]@{Port=$port;Name=$name;Id=$id;Kind=$kind}
  }
 } catch {
  foreach ($port in [IO.Ports.SerialPort]::GetPortNames()) {$result += [pscustomobject]@{Port=$port;Name=$port;Id='';Kind='unknown'}}
 }
 return $result | Sort-Object {[int]($_.Port -replace '\D','')}
}
$form=New-Object Windows.Forms.Form
$form.Text="MotoLab Zeel Capture $script:Version"; $form.Size=New-Object Drawing.Size(900,600); $form.StartPosition='CenterScreen'
$title=New-Object Windows.Forms.Label; $title.Text='VANA MotoLab - ZEEL CAPTURE'; $title.AutoSize=$true; $title.Location=New-Object Drawing.Point(20,20); $form.Controls.Add($title)
$ports=New-Object Windows.Forms.ComboBox; $ports.Location=New-Object Drawing.Point(20,60); $ports.Width=620; $ports.DropDownStyle='DropDownList'; $form.Controls.Add($ports)
$detect=New-Object Windows.Forms.Button; $detect.Text='TUNNISTA LAITTEET'; $detect.Location=New-Object Drawing.Point(655,58); $detect.Width=190; $form.Controls.Add($detect)
$status=New-Object Windows.Forms.Label; $status.Location=New-Object Drawing.Point(20,105); $status.Size=New-Object Drawing.Size(825,40); $status.Text='Zeeltronicin ei tarvitse olla kytketty.'; $form.Controls.Add($status)
$log=New-Object Windows.Forms.TextBox; $log.Location=New-Object Drawing.Point(20,155); $log.Size=New-Object Drawing.Size(825,340); $log.Multiline=$true; $log.ReadOnly=$true; $log.ScrollBars='Vertical'; $form.Controls.Add($log)
$safety=New-Object Windows.Forms.Label; $safety.Location=New-Object Drawing.Point(20,510); $safety.Size=New-Object Drawing.Size(825,35); $safety.Text='TESTI: vain tunnistus. Ei avaa porttia, laheta dataa tai muuta CDI-asetuksia.'; $form.Controls.Add($safety)
$detect.Add_Click({
 $ports.Items.Clear(); $log.Clear(); $inventory=@(Get-PortInventory)
 if ($inventory.Count -eq 0) {$status.Text='COM-portteja ei loytynyt.'; return}
 $zeelFound=$false; $espFound=$false
 foreach ($item in $inventory) {
  [void]$ports.Items.Add("$($item.Port) | $($item.Kind) | $($item.Name)")
  $log.AppendText("$($item.Port)  $($item.Kind)  $($item.Name)`r`n")
  if ($item.Kind -eq 'zeel-ftdi') {$zeelFound=$true}; if ($item.Kind -eq 'esp32-debug') {$espFound=$true}
 }
 if ($ports.Items.Count -gt 0) {$ports.SelectedIndex=0}
 $status.Text="Portteja: $($inventory.Count) | Zeel FTDI: $zeelFound | ESP32: $espFound"
})
$form.Add_Shown({$detect.PerformClick()})
[void]$form.ShowDialog()
