param(
  [string]$BaseDir = "$env:USERPROFILE\Documents\MotoLab\ZeelCapture",
  [string]$SessionA = '',
  [string]$SessionB = '',
  [string]$Search = '',
  [int]$TopNgrams = 50
)

$ErrorActionPreference='Stop'

function Read-Events([string]$dir){
  $f=Join-Path $dir 'events.jsonl'; if(-not(Test-Path $f)){return @()}
  $out=@(); Get-Content $f | ForEach-Object { try{$out += ($_|ConvertFrom-Json)}catch{} }; return $out
}
function Get-SessionDirs { Get-ChildItem $BaseDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name }
function Resolve-Session([string]$s){
  if(-not $s){return $null}; if(Test-Path $s){return (Resolve-Path $s).Path}
  $p=Join-Path $BaseDir $s; if(Test-Path $p){return (Resolve-Path $p).Path}; return $null
}
function Byte-Ngrams([byte[]]$b,[int]$n){
  $h=@{}; if($b.Length -lt $n){return $h}
  for($i=0;$i -le $b.Length-$n;$i++){
    $key=([BitConverter]::ToString($b,$i,$n)).Replace('-',' ')
    if($h.ContainsKey($key)){$h[$key]++}else{$h[$key]=1}
  }; return $h
}
function Load-Raw([string]$dir,[string]$name){$p=Join-Path $dir $name;if(Test-Path $p){return [IO.File]::ReadAllBytes($p)}return [byte[]]@()}
function Diff-Bytes([byte[]]$a,[byte[]]$b){
  $max=[Math]::Max($a.Length,$b.Length);$changes=@()
  for($i=0;$i -lt $max;$i++){
    $av=if($i -lt $a.Length){$a[$i]}else{$null};$bv=if($i -lt $b.Length){$b[$i]}else{$null}
    if($av -ne $bv){$changes += [pscustomobject]@{Offset=$i;A=if($null-ne$av){'{0:X2}'-f$av}else{'--'};B=if($null-ne$bv){'{0:X2}'-f$bv}else{'--'}}}
  };return $changes
}

New-Item -ItemType Directory -Force $BaseDir|Out-Null

if($Search){
  $q=$Search.Trim().ToUpperInvariant();$hits=@()
  foreach($d in Get-SessionDirs){
    $line=0;$f=Join-Path $d.FullName 'events.jsonl';if(-not(Test-Path$f)){continue}
    Get-Content $f|ForEach-Object{$line++;if($_.ToUpperInvariant().Contains($q)){$hits+=[pscustomobject]@{Session=$d.Name;Line=$line;Text=$_}}}
  }
  $hits|Format-Table -Wrap -AutoSize
  exit
}

$a=Resolve-Session $SessionA;$b=Resolve-Session $SessionB
if($a -and $b){
  $out=Join-Path $BaseDir ("diff_"+(Split-Path $a -Leaf)+"__"+(Split-Path $b -Leaf))
  New-Item -ItemType Directory -Force $out|Out-Null
  foreach($rawName in @('zeel_to_pc.raw','pc_to_zeel.raw')){
    $ra=Load-Raw $a $rawName;$rb=Load-Raw $b $rawName
    $diff=Diff-Bytes $ra $rb
    $diff|Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $out ($rawName+'.diff.csv'))
    $summary=[ordered]@{file=$rawName;a_bytes=$ra.Length;b_bytes=$rb.Length;changed_offsets=$diff.Count;first_changes=@($diff|Select-Object -First 100)}
    $summary|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 (Join-Path $out ($rawName+'.summary.json'))
  }
  Write-Host "Diff valmis: $out"
  exit
}

$index=@()
foreach($d in Get-SessionDirs){
  $meta=$null;$sum=$null
  try{$meta=Get-Content (Join-Path $d.FullName 'session.json') -Raw|ConvertFrom-Json}catch{}
  try{$sum=Get-Content (Join-Path $d.FullName 'summary.json') -Raw|ConvertFrom-Json}catch{}
  if($meta){$index+=[pscustomobject]@{Session=$d.Name;Created=$meta.created_utc;Mode=$meta.mode;Hardware=$meta.hardware_port;Virtual=$meta.virtual_port;Baud=$meta.baud;RX=$sum.bytes_zeel_to_pc;TX=$sum.bytes_pc_to_zeel}}
}
$index|Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $BaseDir 'capture_index.csv')

foreach($d in Get-SessionDirs){
  $analysisDir=Join-Path $d.FullName 'analysis';New-Item -ItemType Directory -Force $analysisDir|Out-Null
  foreach($rawName in @('zeel_to_pc.raw','pc_to_zeel.raw')){
    $raw=Load-Raw $d.FullName $rawName
    $stats=[ordered]@{file=$rawName;bytes=$raw.Length;unique_bytes=(@($raw|Sort-Object -Unique)).Count;byte_histogram=@{};ngrams=@{}}
    foreach($x in $raw){$k='{0:X2}'-f$x;if($stats.byte_histogram.Contains($k)){$stats.byte_histogram[$k]++}else{$stats.byte_histogram[$k]=1}}
    foreach($n in 2..8){
      $h=Byte-Ngrams $raw $n
      $stats.ngrams["n$n"]=@($h.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First $TopNgrams|ForEach-Object{[ordered]@{hex=$_.Key;count=$_.Value}})
    }
    $stats|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 (Join-Path $analysisDir ($rawName+'.analysis.json'))
  }
}
Write-Host "Indeksi ja analyysit päivitetty: $BaseDir"
