@echo off
REM Local HLS Worker Startup Script for Windows
REM Use this to test the worker locally before deploying to Render

echo ╔════════════════════════════════════════╗
echo ║   Starting HLS Worker Locally         ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if .env file exists
if not exist .env (
    echo ❌ Error: .env file not found
    echo Please create a .env file with required variables
    exit /b 1
)

REM Check if Redis is running
echo 🔍 Checking Redis connection...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Warning: Redis not responding on localhost:6379
    echo    Make sure Redis is running:
    echo    - Download from: https://github.com/microsoftarchive/redis/releases
    echo    - Or use Docker: docker run -d -p 6379:6379 redis
    echo.
    set /p continue="Continue anyway? (y/n) "
    if /i not "%continue%"=="y" exit /b 1
) else (
    echo ✅ Redis is running
)

echo.
echo 🔍 Checking environment variables...

REM Check for required variables
findstr /C:"GCS_PROJECT_ID=" .env >nul || (
    echo ❌ Missing GCS_PROJECT_ID in .env
    exit /b 1
)

findstr /C:"GCS_BUCKET_NAME=" .env >nul || (
    echo ❌ Missing GCS_BUCKET_NAME in .env
    exit /b 1
)

findstr /C:"GCS_CREDENTIALS=" .env >nul || (
    echo ❌ Missing GCS_CREDENTIALS in .env
    exit /b 1
)

echo ✅ All required variables found
echo.

REM Start the worker
echo 🚀 Starting worker...
echo.
node worker.js
