import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 GCS Connectivity Verification Script\n');

const verifyGCS = async () => {
    // 1. Check for required environment variables
    const projectId = process.env.GCS_PROJECT_ID;
    const bucketName = process.env.GCS_BUCKET_NAME;

    console.log(`📋 Configuration:`);
    console.log(`   Project ID: ${projectId || '❌ MISSING'}`);
    console.log(`   Bucket Name: ${bucketName || '❌ MISSING'}`);

    if (!projectId || !bucketName) {
        console.error('❌ Missing GCS_PROJECT_ID or GCS_BUCKET_NAME');
        process.exit(1);
    }

    // 2. Parse credentials
    let credentials;
    console.log('\n🔑 Credentials Check:');

    try {
        if (process.env.GCS_CREDENTIALS) {
            console.log('   Source: GCS_CREDENTIALS environment variable');
            credentials = JSON.parse(process.env.GCS_CREDENTIALS);
        } else if (process.env.GCS_CREDENTIALS_BASE64) {
            console.log('   Source: GCS_CREDENTIALS_BASE64 environment variable');
            const decoded = Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf-8');
            credentials = JSON.parse(decoded);
        } else {
            console.error('❌ No GCS credentials found (GCS_CREDENTIALS or GCS_CREDENTIALS_BASE64)');
            process.exit(1);
        }

        console.log(`   Client Email: ${credentials.client_email}`);

        // 3. Check and fix private key
        if (credentials.private_key) {
            const hasEscapedNewlines = credentials.private_key.includes('\\n');
            const hasActualNewlines = credentials.private_key.includes('\n');

            console.log(`   Private Key Format:`);
            console.log(`     - Has literal escaped \\\\n: ${hasEscapedNewlines ? '⚠️ YES' : 'NONE'}`);
            console.log(`     - Has actual newlines: ${hasActualNewlines ? '✅ YES' : '⚠️ NO'}`);

            if (!hasActualNewlines && hasEscapedNewlines) {
                console.log('   🛠️  Applying fix: Replacing escaped newlines with actual newlines...');
                credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            } else if (hasActualNewlines) {
                console.log('   ✅ Private key looks correct (has actual newlines)');
            } else {
                console.warn('   ⚠️  Private key might be malformed (no newlines found)');
            }
        } else {
            console.error('❌ Credentials missing private_key');
            process.exit(1);
        }

    } catch (error) {
        console.error(`❌ Failed to parse credentials: ${error.message}`);
        process.exit(1);
    }

    // 4. Test Connectivity
    console.log('\n☁️  Testing GCS Connectivity...');
    try {
        const storage = new Storage({
            projectId,
            credentials
        });

        const bucket = storage.bucket(bucketName);

        console.log(`   Attempting to list files in bucket '${bucketName}'...`);
        // Try to list just 1 file to verify access
        const [files] = await bucket.getFiles({ maxResults: 1 });

        console.log('   ✅ SUCCESS: Successfully connected to GCS!');
        if (files.length > 0) {
            console.log(`   ℹ️  Found file: ${files[0].name}`);
        } else {
            console.log('   ℹ️  Bucket is empty (but accessible)');
        }

    } catch (error) {
        console.error(`❌ GCS Connection Failed:`);
        console.error(`   Error Code: ${error.code}`);
        console.error(`   Message: ${error.message}`);

        if (error.message.includes('invalid_grant') || error.message.includes('monitor your private key')) {
            console.log('\n👉 DIAGNOSIS: This is an authentication error. The private key or project ID is likely incorrect.');
        } else if (error.code === 404) {
            console.log('\n👉 DIAGNOSIS: The bucket name might be incorrect or the service account does not have access.');
        }
        process.exit(1);
    }
};

verifyGCS().catch(console.error);
