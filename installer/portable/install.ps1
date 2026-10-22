param(
  [string]$InstallDir = '',
  [string]$ShortcutDir = '',
  [switch]$SkipStartMenu
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($InstallDir)) { $InstallDir = Join-Path $env:ProgramFiles 'Oficina Pro' }
$payload = @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'payload*.zip' -File | Sort-Object LastWriteTime -Descending)[0]
if ($null -eq $payload) { throw 'Pacote de atualização não encontrado.' }

# Encerra somente o servidor oculto de uma instalação anterior do Oficina Pro.
# O banco de dados em %APPDATA% não é tocado neste processo.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*Oficina Pro*server.mjs*' } |
  ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
Start-Sleep -Milliseconds 800

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Expand-Archive -LiteralPath $payload.FullName -DestinationPath $InstallDir -Force
if (-not (Test-Path -LiteralPath (Join-Path $InstallDir 'version.txt'))) { throw 'A atualização não contém a versão do sistema.' }
$installedVersion = (Get-Content -LiteralPath (Join-Path $InstallDir 'version.txt') -Raw).Trim()
$logDirectory = Join-Path $env:ProgramData 'Oficina Pro'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Content -LiteralPath (Join-Path $logDirectory 'ultima-atualizacao.txt') -Value "Oficina Pro $installedVersion atualizado em $(Get-Date -Format s)" -Encoding UTF8

$shell = New-Object -ComObject WScript.Shell
$desktop = if ([string]::IsNullOrWhiteSpace($ShortcutDir)) { [Environment]::GetFolderPath('CommonDesktopDirectory') } else { $ShortcutDir }
New-Item -ItemType Directory -Path $desktop -Force | Out-Null
$shortcut = $shell.CreateShortcut((Join-Path $desktop 'Oficina Pro.lnk'))
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = '"' + (Join-Path $InstallDir 'launch.vbs') + '"'
$shortcut.WorkingDirectory = $InstallDir
$shortcut.IconLocation = (Join-Path $InstallDir 'oficina-pro.ico') + ',0'
$shortcut.Description = 'Oficina Pro - Sistema de gestão de oficinas'
$shortcut.Save()

if (-not $SkipStartMenu) {
  $startMenu = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'Oficina Pro.lnk'
  $menuShortcut = $shell.CreateShortcut($startMenu)
  $menuShortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
  $menuShortcut.Arguments = '"' + (Join-Path $InstallDir 'launch.vbs') + '"'
  $menuShortcut.WorkingDirectory = $InstallDir
  $menuShortcut.IconLocation = (Join-Path $InstallDir 'oficina-pro.ico') + ',0'
  $menuShortcut.Description = 'Oficina Pro - Sistema de gestão de oficinas'
  $menuShortcut.Save()
}
