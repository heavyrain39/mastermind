$ErrorActionPreference = "Stop"

$NodeVersion = "24.19.0"
$NodeDir = "node-v$NodeVersion-win-x64"
$NodeZip = "node24.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$ChecksumFile = "SHASUMS256.txt"
$ChecksumUrl = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)

    $Stream = [System.IO.File]::OpenRead((Resolve-Path -LiteralPath $Path).Path)
    $Sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($Sha256.ComputeHash($Stream))).Replace("-", "").ToLowerInvariant()
    } finally {
        $Sha256.Dispose()
        $Stream.Dispose()
    }
}

if (-not (Test-Path -Path $NodeDir)) {
    Write-Host "Downloading Node.js $NodeVersion for a reproducible extension build..."
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile $ChecksumFile
    $ExpectedHash = ((Select-String -LiteralPath $ChecksumFile -Pattern " node-v$NodeVersion-win-x64.zip$").Line -split "\s+")[0]
    $ActualHash = Get-Sha256Hex -Path $NodeZip
    if (-not $ExpectedHash -or $ActualHash -ne $ExpectedHash.ToLowerInvariant()) {
        throw "Node.js archive checksum verification failed."
    }
    Write-Host "Extracting Node.js..."
    Expand-Archive -Path $NodeZip -DestinationPath "." -Force
    Remove-Item -Path $NodeZip -Force
    Remove-Item -Path $ChecksumFile -Force
}

$NodeExe = Join-Path $NodeDir "node.exe"
$TscJs = Join-Path "node_modules" "typescript\bin\tsc"
$ViteJs = Join-Path "node_modules" "vite\bin\vite.js"
$Package = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
$ZipPath = Join-Path (Get-Location) "mstrmnd-ext-v$($Package.version).zip"

Write-Host "Running tsc -b..."
& $NodeExe $TscJs -b
if ($LASTEXITCODE -ne 0) {
    throw "TypeScript build failed."
}

Write-Host "Running vite build with Node 24 LTS..."
& $NodeExe $ViteJs build -c vite.ext.config.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "Zipping extension..."
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }
    # Pass every top-level build entry by name so manifest.json stays at the
    # ZIP root (without a ./ prefix) and new build assets cannot be omitted.
    $ArchiveEntries = @("manifest.json")
    $ArchiveEntries += Get-ChildItem -LiteralPath "dist-ext" |
        Where-Object { $_.Name -ne "manifest.json" } |
        Sort-Object -Property Name |
        Select-Object -ExpandProperty Name
    tar.exe -a -cf $ZipPath -C "dist-ext" $ArchiveEntries
    if ($LASTEXITCODE -ne 0) {
        throw "Extension packaging failed."
    }
    Write-Host "Done! Extension built and zipped successfully: $ZipPath"
} else {
    Write-Host "Vite build failed."
    exit 1
}
