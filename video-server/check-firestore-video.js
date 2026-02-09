import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkVideo() {
    console.log('Checking Firestore for video metadata...');

    // Use GCS_CREDENTIALS as it contains the service account
    const credentialsEnv = process.env.GCS_CREDENTIALS;

    if (!credentialsEnv) {
        console.error('Missing GCS_CREDENTIALS in .env');
        return;
    }

    let serviceAccount;
    try {
        if (typeof credentialsEnv === 'string') {
            serviceAccount = JSON.parse(credentialsEnv);
        } else {
            serviceAccount = credentialsEnv;
        }

        // Fix private key if needed
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        console.log('Service account parsed successfully.');
    } catch (e) {
        console.error('Error parsing service account:', e);
        return;
    }

    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log('Firebase App initialized.');
    } catch (err) {
        if (err.code === 'app/already-exists') {
            console.log('Firebase App already initialized.');
        } else {
            console.error('Error initializing app:', err);
            return;
        }
    }

    const db = getFirestore();
    const videoId = 'ef73ba1f-48f6-4f9f-9467-614b3ce7f749';

    console.log(`Querying for videoId: ${videoId}`);

    try {
        const doc = await db.collection('videos').doc(videoId).get();
        if (!doc.exists) {
            console.log(`Video document ${videoId} not found in 'videos' collection.`);

            console.log('Checking "uploads" collection...');
            const uploadDoc = await db.collection('uploads').doc(videoId).get();
            if (!uploadDoc.exists) {
                console.log(`Video not found in 'uploads' either.`);
            } else {
                console.log('Found in uploads:', JSON.stringify(uploadDoc.data(), null, 2));
            }
        } else {
            console.log('Found video document in videos:', JSON.stringify(doc.data(), null, 2));
        }
    } catch (error) {
        console.error('Error fetching document:', error);
    }
}

checkVideo();
