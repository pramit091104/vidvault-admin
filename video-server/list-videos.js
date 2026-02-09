import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function listVideos() {
    console.log('Listing videos from Firestore...');

    const credentialsEnv = process.env.GCS_CREDENTIALS;
    if (!credentialsEnv) { console.error('Missing GCS_CREDENTIALS'); return; }

    let serviceAccount;
    try {
        serviceAccount = typeof credentialsEnv === 'string' ? JSON.parse(credentialsEnv) : credentialsEnv;
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
    } catch (e) {
        console.error('Error parsing service account:', e);
        return;
    }

    try {
        initializeApp({ credential: cert(serviceAccount) });
    } catch (err) {
        if (err.code !== 'app/already-exists') { console.error(err); return; }
    }

    const db = getFirestore();
    const collections = ['videos', 'uploads'];

    for (const colName of collections) {
        console.log(`\n--- Collection: ${colName} ---`);
        const snapshot = await db.collection(colName).limit(5).get();
        if (snapshot.empty) {
            console.log('No documents found.');
        } else {
            snapshot.forEach(doc => {
                console.log(`ID: ${doc.id}`);
                console.log('Data:', JSON.stringify(doc.data(), null, 2));
                console.log('---');
            });
        }
    }
}

listVideos();
