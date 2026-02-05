// Test script to verify the GCS upload fix on Render
// This simulates what the frontend does when uploading

const testUploadEndpoint = async () => {
    const endpoint = 'https://vidvault-admin.onrender.com/api/upload/simple';

    console.log('🧪 Testing upload endpoint...\n');
    console.log(`Endpoint: ${endpoint}\n`);

    // Test 1: Check if endpoint responds to OPTIONS (CORS preflight)
    console.log('Test 1: CORS Preflight (OPTIONS request)');
    try {
        const optionsResponse = await fetch(endpoint, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://previu.online',
                'Access-Control-Request-Method': 'POST',
            }
        });
        console.log(`✅ OPTIONS Status: ${optionsResponse.status}`);
        console.log(`   CORS Headers: ${optionsResponse.headers.get('access-control-allow-origin')}`);
    } catch (error) {
        console.log(`❌ OPTIONS failed: ${error.message}`);
    }

    console.log('\n---\n');

    // Test 2: Check if endpoint rejects GET requests (should return 405)
    console.log('Test 2: Method Validation (GET request - should fail)');
    try {
        const getResponse = await fetch(endpoint, {
            method: 'GET'
        });
        console.log(`✅ GET Status: ${getResponse.status} (Expected: 405 Method Not Allowed)`);
        if (getResponse.status === 405) {
            console.log(`   ✓ Endpoint correctly rejects GET requests`);
        }
    } catch (error) {
        console.log(`❌ GET test failed: ${error.message}`);
    }

    console.log('\n---\n');

    // Test 3: Check if endpoint requires authentication (should return 401 without token)
    console.log('Test 3: Authentication Check (POST without auth - should fail)');
    try {
        const formData = new FormData();
        formData.append('fileName', 'test.mp4');

        const noAuthResponse = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        const responseText = await noAuthResponse.text();
        console.log(`✅ POST Status: ${noAuthResponse.status}`);

        if (noAuthResponse.status === 401) {
            console.log(`   ✓ Endpoint correctly requires authentication`);
            console.log(`   Response: ${responseText}`);
        } else if (noAuthResponse.status === 400) {
            console.log(`   ✓ Endpoint is processing requests (validation error)`);
            console.log(`   Response: ${responseText}`);
        } else if (noAuthResponse.status === 500) {
            console.log(`   ❌ Server error - Check Render logs!`);
            console.log(`   Response: ${responseText}`);

            // Try to parse error details
            try {
                const errorData = JSON.parse(responseText);
                if (errorData.error && errorData.error.includes('JWT')) {
                    console.log(`\n   ⚠️  JWT ERROR DETECTED - Fix may not be deployed yet!`);
                }
            } catch (e) {
                // Not JSON
            }
        }
    } catch (error) {
        console.log(`❌ POST test failed: ${error.message}`);
    }

    console.log('\n---\n');
    console.log('📊 Summary:');
    console.log('- If you see status 405 for GET: ✅ Endpoint is alive');
    console.log('- If you see status 401 for POST: ✅ Authentication is working');
    console.log('- If you see status 500: ❌ Check Render logs for errors');
    console.log('\n💡 Next step: Try uploading a file from your frontend!');
};

// Run the test
testUploadEndpoint().catch(console.error);
