
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize Storage
const getCredentials = () => {
    // Try to parse GCS_CREDENTIALS
    if (process.env.GCS_CREDENTIALS) {
        try {
            const credentials = typeof process.env.GCS_CREDENTIALS === 'string'
                ? JSON.parse(process.env.GCS_CREDENTIALS)
                : process.env.GCS_CREDENTIALS;
            return { credentials };
        } catch (error) {
            console.error('Failed to parse GCS_CREDENTIALS:', error.message);
        }
    }

    // Fallback to key file
    if (process.env.GCS_KEY_FILE && fs.existsSync(process.env.GCS_KEY_FILE)) {
        return { keyFilename: process.env.GCS_KEY_FILE };
    }

    // Fallback to specific file (based on .env viewing)
    if (fs.existsSync('./gcs-key.json')) {
        return { keyFilename: './gcs-key.json' };
    }

    console.error('No valid GCS credentials found.');
    process.exit(1);
};

const storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID || 'veedo-401e0',
    ...getCredentials()
});

const bucketName = process.env.GCS_BUCKET_NAME || 'previu_videos';
const bucket = storage.bucket(bucketName);

const configureCors = async () => {
    try {
        console.log(`Configuring CORS for bucket: ${bucketName}...`);

        const origins = [
            'https://previu.online',
            'http://localhost:5173',
            'http://localhost:8080',
            'https://previuproject.vercel.app', // Added HTTPS
            'https://previuproject.vercel.app/'
        ];

        console.log('Allowed Origins:', origins);

        await bucket.setCorsConfiguration([
            {
                maxAgeSeconds: 3600,
                method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
                origin: origins,
                responseHeader: [
                    'Content-Type',
                    'Authorization',
                    'Content-Range',
                    'Access-Control-Allow-Origin',
                    'x-goog-resumable',
                    'x-goog-content-length-range',
                    'x-goog-meta-metadata'
                ],
            },
        ]);

        console.log('✅ GCS CORS configuration updated successfully.');

        // better to verify
        const [metadata] = await bucket.getMetadata();
        console.log('Current CORS Configuration:', JSON.stringify(metadata.cors, null, 2));

    } catch (error) {
        console.error('❌ Failed to configure GCS CORS:', error);
    }
};

configureCors();
