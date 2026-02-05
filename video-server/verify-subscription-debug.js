
import { getUserSubscription } from './api/lib/subscriptionValidator.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
    try {
        console.log('Testing getUserSubscription...');
        const subscription = await getUserSubscription('test-user-id');
        console.log('Success!', subscription);
    } catch (error) {
        console.error('FAILED:', error);
    }
}

test();
