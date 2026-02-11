@echo off
REM Git Cleanup Script - Remove sensitive files from Git tracking
REM Run this if sensitive files were already committed

echo Cleaning up sensitive files from Git...
echo.

REM Remove .env files
echo Removing .env files...
git rm --cached video-server/.env 2>nul
git rm --cached .env.vercel 2>nul
git rm --cached .env.security-audit.md 2>nul
git rm --cached client/.env 2>nul
git rm --cached client/.env.local 2>nul

REM Remove credential files
echo Removing credential files...
git rm --cached RENDER_GCS_CREDENTIALS.txt 2>nul
git rm --cached gcs-key.json 2>nul

REM Remove debug scripts
echo Removing debug scripts...
git rm --cached get-render-credentials.js 2>nul
git rm --cached verify-fix.js 2>nul
git rm --cached test-render-upload.js 2>nul
git rm --cached test-render-debug.js 2>nul

REM Remove documentation files (except README.md)
echo Removing documentation files...
for %%f in (*.md) do (
    if not "%%f"=="README.md" (
        git rm --cached %%f 2>nul
    )
)
git add README.md 2>nul

echo.
echo Cleanup complete!
echo.
echo Next steps:
echo 1. Review changes: git status
echo 2. Commit changes: git commit -m "Remove sensitive files from tracking"
echo 3. Push to remote: git push
echo.
echo WARNING: If credentials were exposed, rotate them immediately!
echo    See SECURITY_CHECKLIST.txt for instructions
echo.
pause
