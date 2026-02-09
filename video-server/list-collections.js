import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function listCollections() {
    console.log('Listing root collections...');

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
    const collections = await db.listCollections();

    console.log('Root Collections:');
    if (collections.length === 0) {
        console.log('No root collections found.');
    } else {
        for (const col of collections) {
            console.log(`- ${col.id}`);
            // List first doc in each collection
            const snap = await col.limit(1).get();
            if (!snap.empty) {
                console.log(`  Sample doc ID: ${snap.docs[0].id}`);
            }
        }
    }
}

listCollections();
