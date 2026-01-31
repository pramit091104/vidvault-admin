import https from 'https';

const BACKEND_URL = 'https://vidvault-admin-production.up.railway.app';

console.log(`\n🔍 Verifying Backend Deployment at: ${BACKEND_URL}`);

function checkEndpoint(path, description) {
    return new Promise((resolve) => {
        console.log(`\nChecking ${description} (${path})...`);

        https.get(`${BACKEND_URL}${path}`, (res) => {
            const contentType = res.headers['content-type'];
            const status = res.statusCode;

            console.log(`Status: ${status}`);
            console.log(`Content-Type: ${contentType}`);

            let data = '';
            res.on('data', (chunk) => data += chunk);

            res.on('end', () => {
                if (status !== 200) {
                    console.error(`❌ Status check failed. Expected 200, got ${status}`);
                    resolve(false);
                    return;
                }

                if (!contentType || !contentType.includes('application/json')) {
                    console.error(`❌ Content-Type check failed. Expected 'application/json', got '${contentType}'`);
                    console.error('   This indicates the server is returning HTML (likely the Frontend) instead of the API.');
                    console.error('   Diagnostic Snippet:', data.substring(0, 100).replace(/\n/g, ' '));
                    resolve(false);
                    return;
                }

                try {
                    JSON.parse(data);
                    console.log('✅ Response is valid JSON.');
                    resolve(true);
                } catch (e) {
                    console.error('❌ JSON parse failed:', e.message);
                    resolve(false);
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Connection failed: ${e.message}`);
            if (e.message.includes('ENOTFOUND')) {
                console.error('   DNS Resolution failed. Check the domain name.');
            }
            resolve(false);
        });
    });
}

async function run() {
    const healthOk = await checkEndpoint('/api/system/status', 'System Status Endpoint');

    if (healthOk) {
        console.log('\n✅ Deployment appears correct! The API is responding with JSON.');
    } else {
        console.log('\n❌ Deployment verification FAILED.');
        console.log('   Please check your Railway settings:');
        console.log('   1. Root Directory must be "/video-server"');
        console.log('   2. Start Command should be "npm start" (or use Dockerfile)');
    }
}

run();
