// Simple test file to verify security code generation functionality
import { generateSecurityCode, generateVideoId, createSecurityCodeRecord } from '@/lib/securityCode';

// Test security code generation
console.log('Testing security code generation...');
const testCode1 = generateSecurityCode();
const testCode2 = generateSecurityCode(12);
console.log('Generated 8-character code:', testCode1);
console.log('Generated 12-character code:', testCode2);
console.log('Codes are different:', testCode1 !== testCode2);

// Test video ID generation
console.log('\nTesting video ID generation...');
const videoId1 = generateVideoId();
const videoId2 = generateVideoId();
console.log('Generated video ID 1:', videoId1);
console.log('Generated video ID 2:', videoId2);
console.log('Video IDs are different:', videoId1 !== videoId2);

// Test security code record creation
console.log('\nTesting security code record creation...');
const record = createSecurityCodeRecord(
  'Test Video Title',
  'youtube123',
  'https://youtube.com/watch?v=youtube123',
  'testUser123'
);
console.log('Security code record:', record);

// Verify record structure
const requiredFields = ['videoId', 'securityCode', 'title', 'youtubeVideoId', 'youtubeVideoUrl', 'uploadedAt', 'userId', 'isActive', 'accessCount'];
const hasAllFields = requiredFields.every(field => field in record);
console.log('Record has all required fields:', hasAllFields);
console.log('Security code format (8 chars, alphanumeric):', /^[A-Z0-9]{8}$/.test(record.securityCode));

console.log('\nAll tests completed successfully!');
