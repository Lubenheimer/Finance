$pgBin  = "C:\Program Files\PostgreSQL\16\bin"
$pgData = "C:\Program Files\PostgreSQL\16\data"
$pgLog  = "$pgData\log\server.log"
$root   = $PSScriptRoot

# ── 1. PostgreSQL ─────────────────────────────────────────────────────────────
Write-Host "[1/3] PostgreSQL..." -ForegroundColor Cyan

$pgRunning = netstat -ano | Select-String ":5432 " | Select-Object -First 1
if ($pgRunning) {
    Write-Host "      bereits aktiv auf Port 5432" -ForegroundColor Green
} else {
    & "$pgBin\pg_ctl.exe" start -D "$pgData" -w -l "$pgLog" | Out-Null
    Start-Sleep -Seconds 3
    $pgRunning = netstat -ano | Select-String ":5432 " | Select-Object -First 1
    if ($pgRunning) {
        Write-Host "      gestartet" -ForegroundColor Green
    } else {
        Write-Host "      FEHLER - bitte Log pruefen: $pgLog" -ForegroundColor Red
        exit 1
    }
}

# ── 2. Backend ────────────────────────────────────────────────────────────────
Write-Host "[2/3] Backend  (http://localhost:8000) ..." -ForegroundColor Cyan

$backendAlreadyUp = $false
try { $null = Invoke-RestMethod "http://localhost:8000/health" -TimeoutSec 1; $backendAlreadyUp = $true } catch {}

if ($backendAlreadyUp) {
    Write-Host "      bereits aktiv auf Port 8000" -ForegroundColor Green
} else {
    $backendCmd = "cd '$root\backend'; `$env:DATABASE_URL='postgresql+asyncpg://finanzen:devpassword@127.0.0.1:5432/finanzen'; `$env:SECRET_KEY='dev-secret-key-sprint1'; .venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

    Write-Host "      Fenster geoeffnet, warte auf Start..." -ForegroundColor DarkGray
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-RestMethod "http://localhost:8000/health" -TimeoutSec 1
            Write-Host "      bereit ($($i+1)s)" -ForegroundColor Green
            break
        } catch {
            if ($i -eq 39) {
                Write-Host "      laeuft noch - bitte Backend-Fenster beobachten" -ForegroundColor Yellow
            }
        }
    }
}

# ── 3. Frontend ───────────────────────────────────────────────────────────────
Write-Host "[3/3] Frontend (http://localhost:3000) ..." -ForegroundColor Cyan

$frontendCmd = "cd '$root\frontend'; `$env:NEXT_PUBLIC_API_URL='http://localhost:8000'; pnpm dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

Write-Host ""
Write-Host "Alle Dienste gestartet:" -ForegroundColor Yellow
Write-Host "  Frontend  ->  http://localhost:3000" -ForegroundColor White
Write-Host "  Backend   ->  http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs  ->  http://localhost:8000/docs" -ForegroundColor White
