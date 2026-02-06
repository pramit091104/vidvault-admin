@echo off
echo ========================================
echo Starting Video Server with Fixed Credentials
echo ========================================
echo.

echo Checking credentials configuration...
node -e "const dotenv = require('dotenv'); const path = require('path'); dotenv.config({ path: path.join(__dirname, 'video-server', '.env') }); const creds = JSON.parse(process.env.GCS_CREDENTIALS); console.log('Project:', creds.project_id); console.log('Email:', creds.client_email); console.log('Key ID:', creds.private_key_id);"

echo.
echo Starting server...
cd video-server
npm start
