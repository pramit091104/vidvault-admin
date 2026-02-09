import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function findVideo() {
    console.log('Searching for video in GCS...');

    if (!process.env.GCS_BUCKET_NAME || !process.env.GCS_PROJECT_ID || !process.env.GCS_CREDENTIALS) {
        console.error('Missing GCS environment variables');
        return;
    }

    let credentials;
    try {
        const credentialsRaw = process.env.GCS_CREDENTIALS;
        if (typeof credentialsRaw === 'string') {
            credentials = JSON.parse(credentialsRaw);
        } else {
            credentials = credentialsRaw;
        }

        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
    } catch (error) {
        console.error('Error parsing credentials:', error);
        return;
    }

    const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID,
        credentials: credentials
    });

    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);
    const videoId = 'ef73ba1f-48f6-4f9f-9467-614b3ce7f749';

    console.log(`Checking bucket: ${bucketName}`);
    console.log(`Looking for video ID: ${videoId}`);

    try {
        const [files] = await bucket.getFiles();
        console.log(`\nListing all files related to ${videoId}:`);

        let found = false;
        files.forEach(file => {
            if (file.name.includes(videoId)) {
                console.log(`- Found substring match: ${file.name}`);
                found = true;
            }
        });

        if (!found) {
            console.log('No partial matches found for the video ID.');
            console.log('\nListing first 20 files in bucket to understand structure:');
            files.slice(0, 20).forEach(file => {
                console.log(`- ${file.name}`);
            });
        }

    } catch (error) {
        console.error('Error querying bucket:', error);
    }
}

findVideo();
