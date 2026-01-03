import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { loginWithEmail, signUpWithEmail, currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate Gmail address
    if (!email.endsWith('@gmail.com')) {
      setError("Only Gmail addresses are allowed. Please use a @gmail.com email address.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim()) {
          setError("Please enter your full name.");
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(email, password, name);
        // User is now signed in automatically
      }
    } catch (error: any) {
      setError(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <Card className="w-full max-w-md relative animate-fade-in-up border-border/50 bg-card/95">
        <CardHeader className="space-y-4 p-6 sm:p-8">
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Previu
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm sm:text-base">
              {isLogin ? "Sign in to your account" : "Create a new account"}
            </CardDescription>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
              <Mail className="w-3 h-3" />
              <span>Gmail addresses only</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 p-6 sm:p-8 pt-0">
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required={!isLogin}
                  disabled={isLoading}
                  className="h-11 touch-manipulation"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Gmail Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                required
                disabled={isLoading}
                className="h-11 touch-manipulation"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                {isLogin && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline touch-manipulation"
                    onClick={() => {/* Add forgot password functionality */}}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isLoading}
                className="h-11 touch-manipulation"
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base font-medium touch-manipulation" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-4">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsLogin(!isLogin);
              }}
              className="font-medium text-primary hover:underline touch-manipulation"
              disabled={isLoading}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;