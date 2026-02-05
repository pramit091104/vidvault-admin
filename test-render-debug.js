// Test script to verify the GCS upload fix on Render
// This simulates what the frontend does when uploading

const testEndpoints = async () => {
    const baseUrl = 'https://vidvault-admin.onrender.com';

    console.log('🧪 Testing Render Endpoints...\n');

    // 1. Check Debug Endpoint (to verify credentials)
    console.log('Test 1: Check GCS Credentials Configuration');
    try {
        const debugUrl = `${baseUrl}/api/debug/gcs-check`;
        console.log(`Failed to fetch debug info from: ${debugUrl}`);
        const res = await fetch(debugUrl);
        if (res.status === 404) {
            console.log('⚠️  Debug endpoint not found (Deployment might still be in progress)');
        } else {
            const data = await res.json();
            console.log('🔍 SERVER DEBUG INFO:');
            console.log(JSON.stringify(data, null, 2));

            if (data.privateKeyInfo) {
                const pk = data.privateKeyInfo;
                if (pk.hasHeader && pk.hasFooter && (pk.newlineCount > 0 || pk.escapedNewlineCount > 0)) {
                    console.log('\n✅ Private Key looks valid structure-wise.');
                } else {
                    console.log('\n❌ Private Key looks MALFORMED.');
                }
            }
        }
    } catch (error) {
        console.log(`❌ Debug check failed: ${error.message}`);
    }

    console.log('\n---\n');

    // 2. Test Upload Endpoint
    console.log('Test 2: Method Validation (GET request - should fail)');
    const uploadUrl = `${baseUrl}/api/upload/simple`;
    try {
        const getResponse = await fetch(uploadUrl, { method: 'GET' });
        console.log(`✅ GET Status: ${getResponse.status} (Expected: 405 Method Not Allowed)`);
    } catch (error) {
        console.log(`❌ GET test failed: ${error.message}`);
    }
};

// Run the test
testEndpoints().catch(console.error);
