import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  UserCredential,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/integrations/firebase/config";
import { toast } from "sonner";

export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  // Google Auth
  signInWithGoogle: () => Promise<UserCredential>;
  // Email/Password Auth
  loginWithEmail: (email: string, password: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
  // Common
  logout: () => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
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

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setCurrentUser(user);
      toast.success(`Welcome, ${user.displayName || user.email}!`);
      return result;
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast.error(error.message || "Failed to sign in with Google");
      throw error;
    }
  };

  // Sign in with email and password
  const loginWithEmail = async (email: string, password: string) => {
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
      toast.error(error.message || "Failed to create account");
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

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      toast.success("Logged out successfully");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast.error(error.message || "Failed to sign out");
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    // Google Auth
    signInWithGoogle,
    // Email/Password Auth
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
    // Common
    logout,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
