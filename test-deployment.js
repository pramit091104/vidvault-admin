// Deployment validation script
// Run this script to test if the deployed API endpoints are working

const DEPLOYMENT_URL = process.argv[2] || 'https://previu.vercel.app';

console.log(`🔍 Testing deployment at: ${DEPLOYMENT_URL}\n`);

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    const url = `${DEPLOYMENT_URL}${endpoint}`;
    console.log(`Testing ${method} ${url}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.text();
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
    
    return {
      success: response.status !== 404,
      status: response.status,
      data
    };
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 DEPLOYMENT VALIDATION TESTS');
  console.log('='.repeat(60));
  
  // Test 1: Basic API test endpoint
  console.log('\n1. Testing basic API functionality...');
  const testResult = await testEndpoint('/api/test');
  
  // Test 2: Razorpay create-order endpoint (should not return 404)
  console.log('\n2. Testing Razorpay create-order endpoint...');
  const createOrderResult = await testEndpoint('/api/razorpay/create-order', 'POST', {
    amount: 10000,
    currency: 'INR',
    receipt: 'test_receipt_123'
  });
  
  // Test 3: Razorpay verify-payment endpoint (should not return 404)
  console.log('\n3. Testing Razorpay verify-payment endpoint...');
  const verifyPaymentResult = await testEndpoint('/api/razorpay/verify-payment', 'POST', {
    orderId: 'order_test123',
    paymentId: 'pay_test123',
    signature: 'test_signature'
  });
  
  // Test 4: Check if frontend is accessible
  console.log('\n4. Testing frontend accessibility...');
  const frontendResult = await testEndpoint('/');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const results = [
    { name: 'API Test Endpoint', result: testResult },
    { name: 'Create Order Endpoint', result: createOrderResult },
    { name: 'Verify Payment Endpoint', result: verifyPaymentResult },
    { name: 'Frontend Accessibility', result: frontendResult }
  ];
  
  results.forEach(({ name, result }) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const statusCode = result.status ? `(${result.status})` : '';
    console.log(`${status} ${name} ${statusCode}`);
  });
  
  const allPassed = results.every(r => r.success);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - Deployment appears to be working correctly!');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Please check the deployment configuration');
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Check Vercel function logs for errors');
    console.log('   - Verify environment variables are set');
    console.log('   - Ensure vercel.json routing is correct');
    console.log('   - Check CORS configuration');
  }
  console.log('='.repeat(60));
}

// Handle the case where fetch might not be available (Node.js < 18)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ with built-in fetch support');
  console.log('💡 Alternative: Test the endpoints manually in your browser or with curl');
  console.log('💡 Test URL: ' + DEPLOYMENT_URL + '/api/test');
  process.exit(1);
}

runTests().catch(console.error);