#!/usr/bin/env node

/**
 * Email Testing Script
 * 
 * This script helps test the email notification functionality
 * both locally and in production.
 */

import fetch from 'node-fetch';

const TEST_DATA = {
  videoId: 'test-video-123',
  commentText: 'This is a test comment to verify email functionality.',
  commenterName: 'Test User',
  commenterEmail: 'test@example.com'
};

async function testEmail(baseUrl = 'http://localhost:3001') {
  console.log(`🧪 Testing email notification at: ${baseUrl}`);
  
  try {
    const response = await fetch(`${baseUrl}/api/notifications/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_DATA)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Email test successful!');
      console.log('Response:', result);
    } else {
      console.log('❌ Email test failed!');
      console.log('Status:', response.status);
      console.log('Error:', result);
    }
  } catch (error) {
    console.log('❌ Email test error!');
    console.log('Error:', error.message);
  }
}

async function testBothEnvironments() {
  console.log('🚀 Testing Email Notifications\n');
  
  // Test local
  console.log('--- LOCAL TEST ---');
  await testEmail('http://localhost:3001');
  
  console.log('\n--- PRODUCTION TEST ---');
  // Replace with your actual Vercel URL
  const productionUrl = process.env.VERCEL_URL || 'https://your-app.vercel.app';
  await testEmail(productionUrl);
}

// Run tests
if (process.argv[2] === 'local') {
  testEmail('http://localhost:3001');
} else if (process.argv[2] === 'prod') {
  const url = process.argv[3] || 'https://your-app.vercel.app';
  testEmail(url);
} else {
  testBothEnvironments();
}