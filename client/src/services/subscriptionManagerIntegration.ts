/**
 * Integration example showing how to use the SubscriptionManager
 * in existing components and services
 */

import { subscriptionManager } from './subscriptionManager';
import { SubscriptionUpgradeOptions } from '@/types/subscription';

/**
 * Example: Validating subscription before video upload
 */
export async function validateVideoUploadAccess(userId: string): Promise<boolean> {
  try {
    const subscriptionStatus = await subscriptionManager.validateSubscription(userId);
    
    // Check if subscription is active and user hasn't exceeded upload limits
    if (!subscriptionStatus.isActive) {
      console.log('Subscription is not active');
      return false;
    }
    
    if (subscriptionStatus.uploadCount >= subscriptionStatus.maxUploads) {
      console.log('Upload limit reached');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating video upload access:', error);
    return false;
  }
}

/**
 * Example: Upgrading subscription after successful payment
 */
export async function handleSubscriptionUpgrade(
  userId: string,
  newTier: 'premium' | 'enterprise',
  paymentId: string
): Promise<boolean> {
  try {
    const upgradeOptions: SubscriptionUpgradeOptions = {
      newTier,
      preserveData: true, // Preserve existing upload counts
      paymentId
    };
    
    const updatedSubscription = await subscriptionManager.upgradeSubscription(userId, upgradeOptions);
    
    console.log('Subscription upgraded successfully:', {
      tier: updatedSubscription.tier,
      maxUploads: updatedSubscription.maxUploads,
      expiryDate: updatedSubscription.expiryDate
    });
    
    return true;
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return false;
  }
}

/**
 * Example: Checking if user can access premium features
 */
export async function canAccessPremiumFeatures(userId: string): Promise<boolean> {
  try {
    const subscriptionStatus = await subscriptionManager.validateSubscription(userId);
    
    return subscriptionStatus.isActive && 
           (subscriptionStatus.tier === 'premium' || subscriptionStatus.tier === 'enterprise');
  } catch (error) {
    console.error('Error checking premium feature access:', error);
    return false;
  }
}

/**
 * Example: Getting user's current subscription features
 */
export async function getUserFeatures(userId: string): Promise<string[]> {
  try {
    const subscriptionStatus = await subscriptionManager.validateSubscription(userId);
    return subscriptionStatus.features;
  } catch (error) {
    console.error('Error getting user features:', error);
    return ['basic_upload', 'basic_sharing']; // Default free features
  }
}

/**
 * Example: Validating subscription data before update
 */
export async function validateSubscriptionUpdate(
  userId: string,
  updateData: any
): Promise<{ isValid: boolean; errors: string[] }> {
  try {
    const validation = await subscriptionManager.validateSubscriptionIntegrity(userId, updateData);
    
    return {
      isValid: validation.isValid,
      errors: validation.errors
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}