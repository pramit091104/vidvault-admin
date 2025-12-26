import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Settings, 
  LogOut, 
  RefreshCw, 
  Shield, 
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { onAuthStateChanged, signOut, updateProfile as updateFirebaseProfile } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { youtubeService } from "@/integrations/youtube/youtubeService";

interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
  uid: string;
}

const SettingsSection = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);  
  // Form states
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userProfile: UserProfile = {
          displayName: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          photoURL: firebaseUser.photoURL || "",
          uid: firebaseUser.uid
        };
        setUser(userProfile);
        setDisplayName(userProfile.displayName);
        setPhotoURL(userProfile.photoURL || "");
      } else {
        setUser(null);
        setDisplayName("");
        setPhotoURL("");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateProfile = async () => {
    if (!auth.currentUser || !displayName.trim()) {
      toast.error("Please enter a valid display name");
      return;
    }

    setIsUpdating(true);
    try {
      await updateFirebaseProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL || null
      });

      // Update local state
      setUser(prev => prev ? {
        ...prev,
        displayName: displayName.trim(),
        photoURL: photoURL || null
      } : null);

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) return;

    setIsSigningOut(true);
    try {
      await signOut(auth);
      // Clear YouTube service tokens
      localStorage.removeItem("youtube_access_token");
      toast.success("Signed out successfully");
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSwitchAccount = async () => {
    setIsSwitchingAccount(true);
    try {
      // Clear current authentication
      await signOut(auth);
      localStorage.removeItem("youtube_access_token");
      
      // Re-authenticate with YouTube service
      await youtubeService.authenticate();
      toast.success("Account switched successfully!");
    } catch (error: any) {
      console.error("Error switching account:", error);
      toast.error(error.message || "Failed to switch account");
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading settings...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">Not Signed In</h3>
        <p className="text-muted-foreground mb-6">
          Please sign in to access your settings.
        </p>
        <Button onClick={() => window.location.reload()}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your personal information and profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoURL} alt={displayName} />
                <AvatarFallback className="text-lg">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                variant="outline"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                disabled
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-medium">{displayName}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {user.email}
              </p>
              <Badge variant="secondary" className="text-xs">
                UID: {user.uid.slice(0, 8)}...
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Profile Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here. Sign in with a different account to change email.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdating || !displayName.trim()}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Update Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Account Management
          </CardTitle>
          <CardDescription>
            Manage your Google account and authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Google Account</h4>
                <p className="text-sm text-muted-foreground">
                  Currently signed in as {user.email}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleSwitchAccount}
                disabled={isSwitchingAccount}
              >
                {isSwitchingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Switching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Switch Account
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="font-medium">Sign Out</h4>
                <p className="text-sm text-muted-foreground">
                  Sign out from your account and clear all local data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing Out...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsSection;
