import { Storage } from '@google-cloud/storage';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function auditVideos() {
    console.log('Auditing all videos in gcsClientCodes against GCS...');

    // 1. Initialize Firebase
    const credentialsEnv = process.env.GCS_CREDENTIALS;
    if (!credentialsEnv) { console.error('Missing GCS_CREDENTIALS'); return; }

    let serviceAccount;
    try {
        serviceAccount = typeof credentialsEnv === 'string' ? JSON.parse(credentialsEnv) : credentialsEnv;
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
    } catch (e) { console.error('Error parsing credentials:', e); return; }

    try {
        initializeApp({ credential: cert(serviceAccount) });
    } catch (err) { if (err.code !== 'app/already-exists') throw err; }

    const db = getFirestore();

    // 2. Initialize GCS
    const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: serviceAccount
    });
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    // 3. Fetch all videos
    const snapshot = await db.collection('gcsClientCodes').get();
    console.log(`Found ${snapshot.size} records in Firestore.`);

    let foundCount = 0;
    let missingCount = 0;
    let mismatchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const videoId = doc.id;
        const { userId, fileName } = data;

        if (!userId || !fileName) {
            console.log(`[SKIP] ${videoId}: Missing userId or fileName`);
            continue;
        }

        // Check direct Firestore path
        const firestorePath = `drafts/${userId}/${fileName}`;
        const file = bucket.file(firestorePath);
        const [exists] = await file.exists();

        if (exists) {
            // console.log(`[OK] ${videoId}`);
            foundCount++;
        } else {
            // Try recursive search check
            const [files] = await bucket.getFiles({ prefix: 'drafts/', maxResults: 5000 });
            const matchingFile = files.find(f => f.name.endsWith(fileName));

            if (matchingFile) {
                console.log(`[MISMATCH] ${videoId}: Expected ${firestorePath}, Found at ${matchingFile.name}`);
                mismatchCount++;
            } else {
                console.log(`[MISSING] ${videoId}: Filename ${fileName} not found anywhere in drafts/`);
                missingCount++;
            }
        }
    }

    console.log('\n--- Audit Summary ---');
    console.log(`Total: ${snapshot.size}`);
    console.log(`Found (Correct Path): ${foundCount}`);
    console.log(`Found (Path Mismatch - Fixable): ${mismatchCount}`);
    console.log(`Missing (Not found): ${missingCount}`);
}

auditVideos();
