import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  UserCredential,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { toast } from "sonner";
import { getSubscription, saveSubscription, incrementVideoUploadCount } from "@/integrations/firebase/subscriptionService";
import { getSubscriptionStatus, validateClientCreation, updateSubscription } from "@/services/backendApiService";
import { getCachedSubscription, setCachedSubscription, clearCachedSubscription } from "@/lib/subscriptionCache";

export interface UserSubscription {
  tier: 'free' | 'premium' | 'enterprise';
  videoUploadsUsed: number;
  maxVideoUploads: number;
  clientsUsed: number;
  maxClients: number;
  maxFileSize: number; // in MB
  subscriptionDate?: Date;
  expiryDate?: Date;
}

export interface AuthContextType {
  currentUser: User | null;
  subscription: UserSubscription;
  loading: boolean;
  // Email/Password Auth
  loginWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
  // Common
  logout: () => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  // Subscription
  upgradeSubscription: () => Promise<void>;
  incrementVideoUpload: () => Promise<void>;
  incrementClientCount: () => Promise<void>;
  canUploadVideo: () => boolean;
  canAddClient: () => boolean;
  setSubscription: React.Dispatch<React.SetStateAction<UserSubscription>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription>({
    tier: 'free',
    videoUploadsUsed: 0,
    maxVideoUploads: 5,
    clientsUsed: 0,
    maxClients: 5,
    maxFileSize: 100
  });

  // Validate Gmail address
  const validateGmailAddress = (email: string): boolean => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return gmailRegex.test(email);
  };

  // Email/Password Authentication
  const loginWithEmail = async (email: string, password: string) => {
    if (!validateGmailAddress(email)) {
      throw new Error("Only Gmail addresses are allowed. Please use a @gmail.com email address.");
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
      toast.success(`Welcome back, ${userCredential.user.email}!`);
      return userCredential;
    } catch (error: any) {
      console.error("Error signing in with email/password:", error);
      toast.error(error.message || "Failed to sign in");
      throw error;
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (!validateGmailAddress(email)) {
      throw new Error("Only Gmail addresses are allowed. Please use a @gmail.com email address.");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile with display name
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
        // Update the current user in state
        setCurrentUser({ ...auth.currentUser });
      }
      
      toast.success(`Welcome, ${displayName}! Your account has been created.`);
      return userCredential;
    } catch (error: any) {
      console.error("Error creating account:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("This email address is already registered. Please sign in instead.");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Password is too weak. Please use at least 6 characters.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent. Please check your inbox.");
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast.error(error.message || "Failed to send password reset email");
      throw error;
    }
  };

  // Update user profile
  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    if (!auth.currentUser) {
      throw new Error("No user is currently signed in.");
    }

    try {
      await updateProfile(auth.currentUser, { displayName, photoURL });
      // Update the current user in state
      setCurrentUser({ ...auth.currentUser });
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
      throw error;
    }
  };

  // Upgrade subscription to premium (called after successful payment)
  const upgradeSubscription = async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const premiumSubscriptionData = {
        tier: 'premium' as const,
        maxVideoUploads: 50,
        maxClients: 50,
        maxFileSize: 500, // 500MB for premium
        subscriptionDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'active' as const
      };

      // Update backend subscription first
      const updatedBackendSubscription = await updateSubscription(premiumSubscriptionData);
      
      // Also save to frontend Firestore for backward compatibility
      const premiumSubscription = {
        userId: currentUser.uid,
        ...premiumSubscriptionData
      };
      await saveSubscription(premiumSubscription);
      
      // Update local state with backend response
      setSubscription({
        tier: updatedBackendSubscription.tier,
        videoUploadsUsed: updatedBackendSubscription.videoUploadsUsed,
        maxVideoUploads: updatedBackendSubscription.maxVideoUploads,
        clientsUsed: updatedBackendSubscription.clientsUsed,
        maxClients: updatedBackendSubscription.maxClients,
        maxFileSize: updatedBackendSubscription.maxFileSize,
        subscriptionDate: updatedBackendSubscription.subscriptionDate 
          ? new Date(updatedBackendSubscription.subscriptionDate) 
          : undefined,
        expiryDate: updatedBackendSubscription.expiryDate 
          ? new Date(updatedBackendSubscription.expiryDate) 
          : undefined
      });
      
      toast.success("Welcome to Premium! You now have access to 50 video uploads and larger file sizes.");
    } catch (error: any) {
      console.error("Error upgrading subscription:", error);
      toast.error("Failed to upgrade subscription");
      throw error;
    }
  };

  // Increment video upload count
  const incrementVideoUpload = async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    if (!canUploadVideo()) {
      throw new Error("Upload limit reached");
    }
    
    try {
      await incrementVideoUploadCount(currentUser.uid);
      setSubscription(prev => ({
        ...prev,
        videoUploadsUsed: prev.videoUploadsUsed + 1
      }));
    } catch (error: any) {
      console.error("Error incrementing upload count:", error);
      throw error;
    }
  };

  // Increment client count
  const incrementClientCount = async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    // Validate with backend first
    const validation = await validateClientCreation();
    if (!validation.allowed) {
      throw new Error(validation.error || "Client limit reached");
    }
    
    try {
      // Update local state - backend will handle the actual increment
      setSubscription(prev => ({
        ...prev,
        clientsUsed: (validation.currentClientCount || prev.clientsUsed) + 1
      }));
    } catch (error: any) {
      console.error("Error incrementing client count:", error);
      throw error;
    }
  };

  // Check if user can upload more videos
  const canUploadVideo = () => {
    return subscription.videoUploadsUsed < subscription.maxVideoUploads;
  };

  // Check if user can add more clients
  const canAddClient = () => {
    return subscription.clientsUsed < subscription.maxClients;
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      clearCachedSubscription(); // Clear subscription cache
      // Reset subscription to free tier on logout
      setSubscription({
        tier: 'free',
        videoUploadsUsed: 0,
        maxVideoUploads: 5,
        clientsUsed: 0,
        maxClients: 5,
        maxFileSize: 100
      });
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast.error(error.message || "Failed to sign out");
      throw error;
    }
  };

  // Load user subscription data with caching
  useEffect(() => {
    const loadSubscription = async () => {
      if (currentUser) {
        try {
          // Check cache first for instant loading
          const cached = getCachedSubscription(currentUser.uid);
          if (cached) {
            setSubscription({
              tier: cached.tier,
              videoUploadsUsed: cached.videoUploadsUsed,
              maxVideoUploads: cached.maxVideoUploads,
              clientsUsed: cached.clientsUsed,
              maxClients: cached.maxClients,
              maxFileSize: cached.maxFileSize,
              subscriptionDate: cached.subscriptionDate 
                ? new Date(cached.subscriptionDate) 
                : undefined,
              expiryDate: cached.expiryDate 
                ? new Date(cached.expiryDate) 
                : undefined
            });
            
            // Load fresh data in background
            getSubscriptionStatus().then(backendSubscription => {
              setSubscription({
                tier: backendSubscription.tier,
                videoUploadsUsed: backendSubscription.videoUploadsUsed,
                maxVideoUploads: backendSubscription.maxVideoUploads,
                clientsUsed: backendSubscription.clientsUsed,
                maxClients: backendSubscription.maxClients,
                maxFileSize: backendSubscription.maxFileSize,
                subscriptionDate: backendSubscription.subscriptionDate 
                  ? new Date(backendSubscription.subscriptionDate) 
                  : undefined,
                expiryDate: backendSubscription.expiryDate 
                  ? new Date(backendSubscription.expiryDate) 
                  : undefined
              });
            }).catch(console.error);
            
            return; // Use cached data immediately
          }

          // No cache, load from backend
          const backendSubscription = await getSubscriptionStatus();
          setSubscription({
            tier: backendSubscription.tier,
            videoUploadsUsed: backendSubscription.videoUploadsUsed,
            maxVideoUploads: backendSubscription.maxVideoUploads,
            clientsUsed: backendSubscription.clientsUsed,
            maxClients: backendSubscription.maxClients,
            maxFileSize: backendSubscription.maxFileSize,
            subscriptionDate: backendSubscription.subscriptionDate 
              ? new Date(backendSubscription.subscriptionDate) 
              : undefined,
            expiryDate: backendSubscription.expiryDate 
              ? new Date(backendSubscription.expiryDate) 
              : undefined
          });
        } catch (error) {
          console.error('Error loading subscription from backend:', error);
          // Fallback to frontend service
          try {
            const userSubscription = await getSubscription(currentUser.uid);
            if (userSubscription) {
              const subscriptionData = {
                tier: userSubscription.tier,
                videoUploadsUsed: userSubscription.videoUploadsUsed,
                maxVideoUploads: userSubscription.maxVideoUploads,
                clientsUsed: userSubscription.clientsUsed || 0,
                maxClients: userSubscription.maxClients || (userSubscription.tier === 'premium' ? 50 : 5),
                maxFileSize: userSubscription.maxFileSize,
                subscriptionDate: userSubscription.subscriptionDate,
                expiryDate: userSubscription.expiryDate
              };
              setSubscription(subscriptionData);
              // Cache the fallback data
              setCachedSubscription(currentUser.uid, subscriptionData);
            } else {
              // Create default free subscription for new users
              const defaultSubscription = {
                userId: currentUser.uid,
                tier: 'free' as const,
                videoUploadsUsed: 0,
                maxVideoUploads: 5,
                clientsUsed: 0,
                maxClients: 5,
                maxFileSize: 100,
                status: 'active' as const
              };
              await saveSubscription(defaultSubscription);
              const subscriptionData = {
                tier: 'free' as const,
                videoUploadsUsed: 0,
                maxVideoUploads: 5,
                clientsUsed: 0,
                maxClients: 5,
                maxFileSize: 100
              };
              setSubscription(subscriptionData);
              setCachedSubscription(currentUser.uid, subscriptionData);
            }
          } catch (fallbackError) {
            console.error('Error with fallback subscription loading:', fallbackError);
            // Final fallback to default free subscription
            const defaultSubscriptionData = {
              tier: 'free' as const,
              videoUploadsUsed: 0,
              maxVideoUploads: 5,
              clientsUsed: 0,
              maxClients: 5,
              maxFileSize: 100
            };
            setSubscription(defaultSubscriptionData);
            setCachedSubscription(currentUser.uid, defaultSubscriptionData);
          }
        }
      } else {
        // Reset to default when user logs out and clear cache
        clearCachedSubscription();
        setSubscription({
          tier: 'free',
          videoUploadsUsed: 0,
          maxVideoUploads: 5,
          clientsUsed: 0,
          maxClients: 5,
          maxFileSize: 100
        });
      }
    };

    loadSubscription();
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, set them as current user
        setCurrentUser(user);
        setLoading(false);
      } else {
        // User is signed out
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    subscription,
    loading,
    // Email/Password Auth
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
    // Common
    logout,
    updateUserProfile,
    // Subscription
    upgradeSubscription,
    incrementVideoUpload,
    incrementClientCount,
    canUploadVideo,
    canAddClient,
    setSubscription,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
