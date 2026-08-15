$ErrorActionPreference = "Stop"

$NodeVersion = "20.20.2"
$NodeDir = "node-v$NodeVersion-win-x64"
$NodeZip = "node20.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$ChecksumFile = "SHASUMS256.txt"
$ChecksumUrl = "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt"

if (-not (Test-Path -Path $NodeDir)) {
    Write-Host "Downloading Node.js $NodeVersion for a reproducible extension build..."
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    Invoke-WebRequest -Uri $ChecksumUrl -OutFile $ChecksumFile
    $ExpectedHash = ((Select-String -LiteralPath $ChecksumFile -Pattern " node-v$NodeVersion-win-x64.zip$").Line -split "\s+")[0]
    $ActualHash = (Get-FileHash -LiteralPath $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
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

Write-Host "Running vite build with Node 20 LTS..."
& $NodeExe $ViteJs build -c vite.ext.config.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "Zipping extension..."
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }
    tar.exe -a -cf $ZipPath -C "dist-ext" .
    if ($LASTEXITCODE -ne 0) {
        throw "Extension packaging failed."
    }
    Write-Host "Done! Extension built and zipped successfully: $ZipPath"
} else {
    Write-Host "Vite build failed."
    exit 1
}
