#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$PythonVersion = "3.13.13"
$BuildTag = "20260510"
$Platform = "x86_64-pc-windows-msvc"
$Url = "https://github.com/astral-sh/python-build-standalone/releases/download/$BuildTag/cpython-$PythonVersion+$BuildTag-$Platform-install_only.tar.gz"

$ResourceDir = "ui\resources"
$BinDir = "$ResourceDir\bin"
$SitePackagesDir = "$ResourceDir\site-packages"

Write-Host "Preparing Sidecar Resources (Python $PythonVersion)..."

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
New-Item -ItemType Directory -Force -Path $SitePackagesDir | Out-Null
New-Item -ItemType Directory -Force -Path "ui\build" | Out-Null

$VersionFile = "$BinDir\python-runtime\BIN_VERSION"
$CurrentVer = ""
if (Test-Path $VersionFile) {
    $CurrentVer = Get-Content $VersionFile -Raw
    $CurrentVer = $CurrentVer.Trim()
}

if ($CurrentVer -ne "$PythonVersion+$BuildTag") {
    Write-Host "Downloading Portable Python $PythonVersion (Tag: $BuildTag)..."
    if (Test-Path "$BinDir\python-runtime") {
        Remove-Item -Recurse -Force "$BinDir\python-runtime"
    }
    Invoke-WebRequest -Uri $Url -OutFile "python-standalone.tar.gz"
    New-Item -ItemType Directory -Force -Path "$BinDir\python-runtime" | Out-Null
    tar -xzf "python-standalone.tar.gz" -C "$BinDir\python-runtime" --strip-components=1
    Set-Content -Path "$BinDir\python-runtime\BIN_VERSION" -Value "$PythonVersion+$BuildTag"
    Remove-Item "python-standalone.tar.gz"
    Write-Host "Python downloaded and installed."
} else {
    Write-Host "Portable Python $PythonVersion already exists."
}

Write-Host "Exporting production site-packages..."
Get-ChildItem -Path $SitePackagesDir -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

uv export --no-dev --format requirements-txt | Out-File -FilePath "build_reqs.txt" -Encoding utf8
uv pip install -r build_reqs.txt --target $SitePackagesDir
Remove-Item "build_reqs.txt"

Write-Host "Cleaning up heavy and macOS-only dependencies..."
@("torch*", "torchaudio*", "nvidia*", "mlx*") | ForEach-Object {
    Get-ChildItem -Path $SitePackagesDir -Filter $_ -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
}

Write-Host "Removing optional STT packages (installed on-demand via Settings)..."
@("moonshine_voice*", "ctranslate2*", "av*", "onnxruntime*", "faster_whisper*", "transformers*") | ForEach-Object {
    Get-ChildItem -Path $SitePackagesDir -Filter $_ -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
}

Get-ChildItem -Path $SitePackagesDir -Filter "__pycache__" -Recurse -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

New-Item -ItemType Directory -Force -Path "$SitePackagesDir\torch" | Out-Null
Set-Content -Path "$SitePackagesDir\torch\__init__.py" -Value ""
New-Item -ItemType Directory -Force -Path "$SitePackagesDir\torchaudio" | Out-Null
Set-Content -Path "$SitePackagesDir\torchaudio\__init__.py" -Value ""

Write-Host "Sidecar preparation complete!"
Write-Host "Next: run 'pnpm -C ui install' and 'mise run build'"
