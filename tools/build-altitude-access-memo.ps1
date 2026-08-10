param(
  [string]$MarkdownPath = "docs/reports/altitude-access-roadmap-strategy-memo.md",
  [string]$ReferenceDocx = "C:\Users\klent\.codex\plugins\cache\openai-curated-remote\openai-templates\0.1.1\skills\artifact-template-strategy-memorandum\assets\reference.docx",
  [string]$OutputDocx = "artifacts/Altitude-Access-Strategy-Memorandum.docx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function XmlText([string]$s) {
  return [System.Security.SecurityElement]::Escape($s)
}

function RunXml([string]$text, [string]$bold = "false", [string]$font = "", [string]$size = "") {
  $props = ""
  if ($bold -eq "true" -or $font -or $size) {
    $bits = @()
    if ($bold -eq "true") { $bits += "<w:b/>" }
    if ($font) { $bits += "<w:rFonts w:ascii=`"$font`" w:hAnsi=`"$font`"/>" }
    if ($size) { $bits += "<w:sz w:val=`"$size`"/>" }
    $props = "<w:rPr>$($bits -join '')</w:rPr>"
  }
  return "<w:r>$props<w:t xml:space=`"preserve`">$(XmlText $text)</w:t></w:r>"
}

function ParagraphXml([string]$text, [string]$style = "", [int]$numId = 0, [string]$font = "", [string]$size = "") {
  $pPr = @()
  if ($style) { $pPr += "<w:pStyle w:val=`"$style`"/>" }
  if ($numId -gt 0) { $pPr += "<w:numPr><w:ilvl w:val=`"0`"/><w:numId w:val=`"$numId`"/></w:numPr>" }
  $run = RunXml $text "false" $font $size
  if ($pPr.Count -gt 0) {
    return "<w:p><w:pPr>$($pPr -join '')</w:pPr>$run</w:p>"
  }
  return "<w:p>$run</w:p>"
}

function TableXml([string[][]]$rows) {
  if ($rows.Count -eq 0) { return "" }
  $colCount = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
  $cellWidth = [Math]::Floor(9000 / [Math]::Max(1, $colCount))
  $grid = (1..$colCount | ForEach-Object { "<w:gridCol w:w=`"$cellWidth`"/>" }) -join ""
  $xml = @()
  $xml += "<w:tbl>"
  $xml += "<w:tblPr><w:tblW w:w=`"9000`" w:type=`"dxa`"/><w:tblBorders><w:top w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/><w:left w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/><w:bottom w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/><w:right w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/><w:insideH w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/><w:insideV w:val=`"single`" w:sz=`"4`" w:space=`"0`" w:color=`"D9E2F3`"/></w:tblBorders><w:tblCellMar><w:top w:w=`"90`" w:type=`"dxa`"/><w:left w:w=`"120`" w:type=`"dxa`"/><w:bottom w:w=`"90`" w:type=`"dxa`"/><w:right w:w=`"120`" w:type=`"dxa`"/></w:tblCellMar></w:tblPr>"
  $xml += "<w:tblGrid>$grid</w:tblGrid>"
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $xml += "<w:tr>"
    for ($c = 0; $c -lt $colCount; $c++) {
      $value = if ($c -lt $rows[$r].Count) { $rows[$r][$c].Trim() } else { "" }
      $shade = if ($r -eq 0) { "<w:shd w:val=`"clear`" w:color=`"auto`" w:fill=`"F3F6FA`"/>" } else { "" }
      $bold = if ($r -eq 0) { "true" } else { "false" }
      $run = RunXml $value $bold
      $xml += "<w:tc><w:tcPr><w:tcW w:w=`"$cellWidth`" w:type=`"dxa`"/>$shade</w:tcPr><w:p>$run</w:p></w:tc>"
    }
    $xml += "</w:tr>"
  }
  $xml += "</w:tbl><w:p/>"
  return $xml -join ""
}

function ParseTable([string[]]$lines, [ref]$i) {
  $rows = New-Object System.Collections.Generic.List[string[]]
  while ($i.Value -lt $lines.Count -and $lines[$i.Value].Trim().StartsWith("|")) {
    $line = $lines[$i.Value].Trim()
    $cells = $line.Trim("|").Split("|") | ForEach-Object { $_.Trim() }
    $isSeparator = ($cells -join "") -match "^[\s:\-]+$"
    if (-not $isSeparator) { $rows.Add([string[]]$cells) }
    $i.Value++
  }
  $i.Value--
  return ,$rows.ToArray()
}

$mdFull = Get-Content -LiteralPath $MarkdownPath -Raw
$mdFull = $mdFull -replace "`r`n", "`n"
$lines = $mdFull.Split("`n")

$body = New-Object System.Collections.Generic.List[string]
$inCode = $false
$codeLang = ""

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  $trim = $line.Trim()
  if ($trim.StartsWith('```')) {
    $inCode = -not $inCode
    if (-not $inCode) { $body.Add((ParagraphXml "")) }
    continue
  }
  if ($inCode) {
    if ($trim.Length -gt 0) { $body.Add((ParagraphXml $line "" 0 "Courier New" "18")) }
    continue
  }
  if ($trim.Length -eq 0) {
    $body.Add((ParagraphXml ""))
    continue
  }
  if ($trim.StartsWith("|")) {
    $rows = ParseTable $lines ([ref]$i)
    $body.Add((TableXml $rows))
    continue
  }
  if ($trim -match "^# (.+)$") {
    $body.Add((ParagraphXml $Matches[1] "Title"))
    continue
  }
  if ($trim -match "^## (.+)$") {
    $body.Add((ParagraphXml $Matches[1] "Heading1"))
    continue
  }
  if ($trim -match "^### (.+)$") {
    $body.Add((ParagraphXml $Matches[1] "Heading2"))
    continue
  }
  if ($trim -match "^- (.+)$") {
    $body.Add((ParagraphXml $Matches[1] "" 1))
    continue
  }
  if ($trim -match "^\d+\. (.+)$") {
    $body.Add((ParagraphXml $Matches[1] "" 2))
    continue
  }
  $body.Add((ParagraphXml $trim))
}

$outFull = Resolve-Path -LiteralPath (Split-Path -Parent $OutputDocx) -ErrorAction SilentlyContinue
if (-not $outFull) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputDocx) | Out-Null
}
$outputPath = (Resolve-Path -LiteralPath (Split-Path -Parent $OutputDocx)).Path
$outputFile = Join-Path $outputPath (Split-Path -Leaf $OutputDocx)
Copy-Item -LiteralPath $ReferenceDocx -Destination $outputFile -Force

$work = Join-Path (Get-Location) ".tmp-docx-build"
if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($outputFile, $work)

$documentPath = Join-Path $work "word\document.xml"
$docXml = [xml](Get-Content -LiteralPath $documentPath -Raw)
$ns = New-Object System.Xml.XmlNamespaceManager($docXml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
$sectPr = $docXml.SelectSingleNode("//w:body/w:sectPr", $ns).OuterXml

$newDoc = "<?xml version=`"1.0`" encoding=`"UTF-8`" standalone=`"yes`"?><w:document xmlns:wpc=`"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas`" xmlns:cx=`"http://schemas.microsoft.com/office/drawing/2014/chartex`" xmlns:cx1=`"http://schemas.microsoft.com/office/drawing/2015/9/8/chartex`" xmlns:cx2=`"http://schemas.microsoft.com/office/drawing/2015/10/21/chartex`" xmlns:cx3=`"http://schemas.microsoft.com/office/drawing/2016/5/9/chartex`" xmlns:cx4=`"http://schemas.microsoft.com/office/drawing/2016/5/10/chartex`" xmlns:cx5=`"http://schemas.microsoft.com/office/drawing/2016/5/11/chartex`" xmlns:cx6=`"http://schemas.microsoft.com/office/drawing/2016/5/12/chartex`" xmlns:cx7=`"http://schemas.microsoft.com/office/drawing/2016/5/13/chartex`" xmlns:cx8=`"http://schemas.microsoft.com/office/drawing/2016/5/14/chartex`" xmlns:mc=`"http://schemas.openxmlformats.org/markup-compatibility/2006`" xmlns:aink=`"http://schemas.microsoft.com/office/drawing/2016/ink`" xmlns:am3d=`"http://schemas.microsoft.com/office/drawing/2017/model3d`" xmlns:o=`"urn:schemas-microsoft-com:office:office`" xmlns:oel=`"http://schemas.microsoft.com/office/2019/extlst`" xmlns:r=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships`" xmlns:m=`"http://schemas.openxmlformats.org/officeDocument/2006/math`" xmlns:v=`"urn:schemas-microsoft-com:vml`" xmlns:wp14=`"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing`" xmlns:wp=`"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing`" xmlns:w10=`"urn:schemas-microsoft-com:office:word`" xmlns:w=`"http://schemas.openxmlformats.org/wordprocessingml/2006/main`" xmlns:w14=`"http://schemas.microsoft.com/office/word/2010/wordml`" xmlns:w15=`"http://schemas.microsoft.com/office/word/2012/wordml`" xmlns:w16cex=`"http://schemas.microsoft.com/office/word/2018/wordml/cex`" xmlns:w16cid=`"http://schemas.microsoft.com/office/word/2016/wordml/cid`" xmlns:w16=`"http://schemas.microsoft.com/office/word/2018/wordml`" xmlns:w16du=`"http://schemas.microsoft.com/office/word/2023/wordml/word16du`" xmlns:w16sdtdh=`"http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash`" xmlns:w16sdtfl=`"http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock`" xmlns:w16se=`"http://schemas.microsoft.com/office/word/2015/wordml/symex`" xmlns:wpg=`"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup`" xmlns:wpi=`"http://schemas.microsoft.com/office/word/2010/wordprocessingInk`" xmlns:wne=`"http://schemas.microsoft.com/office/word/2006/wordml`" xmlns:wps=`"http://schemas.microsoft.com/office/word/2010/wordprocessingShape`" mc:Ignorable=`"w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14`"><w:body>$($body -join '')$sectPr</w:body></w:document>"
Set-Content -LiteralPath $documentPath -Value $newDoc -Encoding UTF8

$tmpZip = "$outputFile.zip"
if (Test-Path -LiteralPath $tmpZip) { Remove-Item -LiteralPath $tmpZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($work, $tmpZip)
Move-Item -LiteralPath $tmpZip -Destination $outputFile -Force
Remove-Item -LiteralPath $work -Recurse -Force

Write-Output $outputFile
