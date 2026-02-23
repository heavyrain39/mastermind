$ErrorActionPreference = "Stop"

$NodeDir = "node-v20.18.0-win-x64"
$NodeZip = "node20.zip"
$NodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"

if (-not (Test-Path -Path $NodeDir)) {
    Write-Host "Downloading Node.js 20.18.0 to bypass Vite build crash on Node 24..."
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    Write-Host "Extracting Node.js..."
    Expand-Archive -Path $NodeZip -DestinationPath "." -Force
    Remove-Item -Path $NodeZip -Force
}

$NodeExe = Join-Path $NodeDir "node.exe"
$ViteJs = Join-Path "node_modules" "vite\bin\vite.js"

Write-Host "Running tsc -b..."
npx tsc -b

Write-Host "Running vite build with Node 20 LTS..."
& $NodeExe $ViteJs build -c vite.ext.config.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "Zipping extension..."
    npm run zip:ext
    Write-Host "Done! Extenstion built and zipped successfully."
} else {
    Write-Host "Vite build failed."
    exit 1
}
