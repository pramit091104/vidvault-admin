import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Environment Variable Diagnostic\n');

// Check which credential variables are set
console.log('📋 Credential Variables Status:');
console.log('  GCS_CREDENTIALS:', process.env.GCS_CREDENTIALS ? '✅ SET' : '❌ NOT SET');
console.log('  GCS_CREDENTIALS_BASE64:', process.env.GCS_CREDENTIALS_BASE64 ? '✅ SET' : '❌ NOT SET');
console.log('  FIREBASE_SERVICE_ACCOUNT_KEY:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? '✅ SET' : '❌ NOT SET');
console.log('  GCS_KEY_FILE:', process.env.GCS_KEY_FILE ? '✅ SET' : '❌ NOT SET');

console.log('\n📋 Other Required Variables:');
console.log('  GCS_PROJECT_ID:', process.env.GCS_PROJECT_ID || '❌ NOT SET');
console.log('  GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME || '❌ NOT SET');

// Try to parse credentials
console.log('\n🔧 Credential Parsing Test:');

let credentials = null;
let credSource = 'NONE';

try {
    if (process.env.GCS_CREDENTIALS) {
        credentials = JSON.parse(process.env.GCS_CREDENTIALS);
        credSource = 'GCS_CREDENTIALS';
    } else if (process.env.GCS_CREDENTIALS_BASE64) {
        const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
        credSource = 'GCS_CREDENTIALS_BASE64';
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credSource = 'FIREBASE_SERVICE_ACCOUNT_KEY';
    }

    if (credentials) {
        console.log(`  ✅ Successfully parsed credentials from: ${credSource}`);
        console.log(`  Project ID: ${credentials.project_id || 'MISSING'}`);
        console.log(`  Client Email: ${credentials.client_email || 'MISSING'}`);
        console.log(`  Private Key: ${credentials.private_key ? 'PRESENT' : 'MISSING'}`);

        if (credentials.private_key) {
            // Check for escaped newlines
            const hasEscapedNewlines = credentials.private_key.includes('\\n');
            const hasActualNewlines = credentials.private_key.includes('\n');

            console.log(`  Private Key Format:`);
            console.log(`    - Has escaped \\\\n: ${hasEscapedNewlines ? '⚠️ YES (needs fix)' : '✅ NO'}`);
            console.log(`    - Has actual newlines: ${hasActualNewlines ? '✅ YES' : '❌ NO'}`);

            // Test the fix
            const fixedKey = credentials.private_key.replace(/\\n/g, '\n');
            const fixWorked = fixedKey.includes('\n') && !fixedKey.includes('\\n');
            console.log(`    - Fix would work: ${fixWorked ? '✅ YES' : '❌ NO'}`);
        }
    } else {
        console.log('  ❌ No credentials found in any environment variable');
    }
} catch (error) {
    console.log(`  ❌ Error parsing credentials: ${error.message}`);
}

// Test Firebase Admin initialization
console.log('\n🔥 Firebase Admin Initialization Test:');
try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    if (getApps().length > 0) {
        console.log('  ℹ️ Firebase Admin already initialized');
    } else if (credentials) {
        // Fix private key
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        const projectId = process.env.GCS_PROJECT_ID || credentials.project_id;

        initializeApp({
            credential: cert(credentials),
            projectId: projectId
        });

        console.log(`  ✅ Firebase Admin initialized successfully`);
        console.log(`  Project: ${projectId}`);

        // Test Firestore access
        const { getFirestore } = await import('firebase-admin/firestore');
        const db = getFirestore();
        console.log('  ✅ Firestore instance created');

        // Try a simple read operation
        try {
            const testDoc = await db.collection('subscriptions').limit(1).get();
            console.log(`  ✅ Firestore read test: SUCCESS (found ${testDoc.size} docs)`);
        } catch (firestoreError) {
            console.log(`  ⚠️ Firestore read test failed: ${firestoreError.message}`);
        }
    } else {
        console.log('  ❌ Cannot initialize - no credentials available');
    }
} catch (error) {
    console.log(`  ❌ Firebase Admin initialization failed: ${error.message}`);
    console.log(`  Error code: ${error.code}`);
    if (error.stack) {
        console.log(`  Stack trace:\n${error.stack}`);
    }
}

console.log('\n✅ Diagnostic complete');
