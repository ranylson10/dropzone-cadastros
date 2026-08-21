param(
    [string]$SourcePath = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$webMedia = Join-Path $root 'web\public\media'
$appMedia = Join-Path $root 'app\assets\media'
$tempRoot = Join-Path $env:TEMP 'dropzone-bg-video-build'
$sourceMp4 = Join-Path $tempRoot 'pixabay-243825-source.mp4'
$legacyManualSource = Join-Path $PSScriptRoot 'dropzone-bg-source.mp4'
$ffmpegZip = Join-Path $tempRoot 'ffmpeg-release-essentials.zip'
$ffmpegDir = Join-Path $tempRoot 'ffmpeg-portable'
$pixabayPageUrl = 'https://pixabay.com/videos/red-hud-digital-background-243825/'
$ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

New-Item -ItemType Directory -Force -Path $webMedia, $appMedia, $tempRoot | Out-Null

function Get-FfmpegPath {
    $existing = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($existing) { return $existing.Source }

    Write-Host '[DropZone] FFmpeg nao encontrado. Baixando versao portatil temporaria...'
    Invoke-WebRequest -UseBasicParsing -Uri $ffmpegUrl -OutFile $ffmpegZip
    if (Test-Path $ffmpegDir) { Remove-Item -Recurse -Force $ffmpegDir }
    Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegDir -Force
    $binary = Get-ChildItem -Path $ffmpegDir -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
    if (-not $binary) { throw 'Nao foi possivel localizar ffmpeg.exe no pacote baixado.' }
    return $binary.FullName
}

function Resolve-VideoSource {
    param([string]$RequestedPath)

    if ($RequestedPath) {
        $resolved = Resolve-Path -LiteralPath $RequestedPath -ErrorAction SilentlyContinue
        if (-not $resolved) {
            throw ('Arquivo informado em -SourcePath nao foi encontrado: ' + $RequestedPath)
        }
        return $resolved.Path
    }

    # Compatibilidade com a instrucao da rodada anterior, caso o arquivo ja tenha sido salvo aqui.
    if (Test-Path -LiteralPath $legacyManualSource) {
        Write-Host '[DropZone] Fonte local encontrada em scripts\dropzone-bg-source.mp4.' -ForegroundColor Green
        return $legacyManualSource
    }

    # Tenta apenas localizar um download JA FEITO pelo usuario. Nao tenta burlar Cloudflare/Pixabay.
    $downloads = Join-Path $HOME 'Downloads'
    if (Test-Path -LiteralPath $downloads) {
        $preferred = Get-ChildItem -LiteralPath $downloads -File -Filter '*.mp4' -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Length -gt 500KB -and
                $_.LastWriteTime -gt (Get-Date).AddHours(-6) -and
                ($_.Name -match '243825|red[-_ ]?hud|hud[-_ ]?digital')
            } |
            Sort-Object LastWriteTime -Descending

        if ($preferred.Count -eq 1) {
            Write-Host ('[DropZone] Download do Pixabay localizado automaticamente: ' + $preferred[0].FullName) -ForegroundColor Green
            return $preferred[0].FullName
        }

        if ($preferred.Count -gt 1) {
            Write-Host ''
            Write-Host '[DropZone] Encontrei mais de um MP4 possivel em Downloads:' -ForegroundColor Yellow
            $preferred | ForEach-Object { Write-Host ('  ' + $_.FullName) -ForegroundColor Cyan }
            Write-Host ''
            Write-Host '[DropZone] Execute novamente informando o arquivo correto:' -ForegroundColor Yellow
            Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\prepare-dropzone-bg-video.ps1 -SourcePath "C:\CAMINHO\video.mp4"' -ForegroundColor Cyan
            return $null
        }
    }

    return $null
}

$resolvedSource = Resolve-VideoSource -RequestedPath $SourcePath

if (-not $resolvedSource) {
    Write-Host ''
    Write-Host '[DropZone] O Pixabay protege o download com Cloudflare; o script nao vai tentar contornar essa protecao.' -ForegroundColor Yellow
    Write-Host '[DropZone] Baixe uma unica vez o video escolhido pelo navegador:' -ForegroundColor Yellow
    Write-Host ('  ' + $pixabayPageUrl) -ForegroundColor Cyan
    Write-Host ''
    Write-Host '[DropZone] Depois rode, apontando para o MP4 baixado:' -ForegroundColor Yellow
    Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\prepare-dropzone-bg-video.ps1 -SourcePath "C:\Users\Administrator\Downloads\SEU-ARQUIVO.mp4"' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '[DropZone] Dica: se o nome do download contiver 243825 ou Red HUD, normalmente basta baixar e executar este script de novo sem parametro.' -ForegroundColor DarkGray
    exit 2
}

if ((Get-Item -LiteralPath $resolvedSource).Length -lt 500KB) {
    throw 'O MP4 de origem parece pequeno demais ou invalido.'
}

Copy-Item -Force -LiteralPath $resolvedSource -Destination $sourceMp4
$ffmpeg = Get-FfmpegPath

$desktopMp4 = Join-Path $webMedia 'dropzone-bg-desktop.mp4'
$desktopWebm = Join-Path $webMedia 'dropzone-bg-desktop.webm'
$mobileMp4 = Join-Path $webMedia 'dropzone-bg-mobile.mp4'
$posterWebp = Join-Path $webMedia 'dropzone-bg-poster.webp'
$appMobileMp4 = Join-Path $appMedia 'dropzone-bg-mobile.mp4'

Write-Host '[DropZone] Gerando MP4 desktop 1280px / 24fps...'
& $ffmpeg -hide_banner -loglevel error -y -stream_loop -1 -i $sourceMp4 -t 8 -an `
  -vf 'fps=24,scale=1280:-2:flags=lanczos' `
  -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags '+faststart' $desktopMp4
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar dropzone-bg-desktop.mp4' }

Write-Host '[DropZone] Gerando WebM desktop VP9...'
& $ffmpeg -hide_banner -loglevel error -y -stream_loop -1 -i $sourceMp4 -t 8 -an `
  -vf 'fps=24,scale=1280:-2:flags=lanczos' `
  -c:v libvpx-vp9 -b:v 0 -crf 39 -deadline good -cpu-used 2 -row-mt 1 $desktopWebm
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar dropzone-bg-desktop.webm' }

Write-Host '[DropZone] Gerando MP4 mobile vertical 720x1280 / 24fps...'
& $ffmpeg -hide_banner -loglevel error -y -stream_loop -1 -i $sourceMp4 -t 8 -an `
  -vf 'fps=24,scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280' `
  -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags '+faststart' $mobileMp4
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar dropzone-bg-mobile.mp4' }

Write-Host '[DropZone] Gerando poster WebP...'
& $ffmpeg -hide_banner -loglevel error -y -ss 1.0 -i $sourceMp4 -frames:v 1 `
  -vf 'scale=1280:-2:flags=lanczos' -c:v libwebp -quality 72 $posterWebp
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar dropzone-bg-poster.webp' }

Copy-Item -Force $mobileMp4 $appMobileMp4

$sourceNote = @"
DropZone motion background
Source: $pixabayPageUrl
Title: Red, Hud, Digital
Creator: olenchic
Pixabay media ID: 243825
Original listed by source page: MP4, 3840x2160, 30 FPS.
License/source page: Pixabay Content License; keep this note with the project for provenance.
Runtime Home/Login use only the generated local assets; Pixabay is not contacted by the app/site.
Generated variants: 8s, no audio, 24fps, desktop 1280px, mobile 720x1280, WebP poster.
"@
Set-Content -Path (Join-Path $webMedia 'dropzone-bg-source.txt') -Value $sourceNote -Encoding UTF8
Set-Content -Path (Join-Path $appMedia 'dropzone-bg-source.txt') -Value $sourceNote -Encoding UTF8

Write-Host ''
Write-Host '[DropZone] Red HUD Digital instalado como BG local:' -ForegroundColor Green
Get-Item $desktopWebm, $desktopMp4, $mobileMp4, $posterWebp, $appMobileMp4 | ForEach-Object {
    $mb = [Math]::Round($_.Length / 1MB, 2)
    Write-Host ('  {0}  {1} MB' -f $_.FullName, $mb)
}
Write-Host ''
Write-Host '[DropZone] Concluido. Home/Login nao dependem do Pixabay em runtime.' -ForegroundColor Green

Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
