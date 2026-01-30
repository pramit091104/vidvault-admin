import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "firebase/auth";
import { Loader2 } from "lucide-react";

interface LoginConfirmationDialogProps {
  isOpen: boolean;
  user: User;
  onConfirm: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

const LoginConfirmationDialog = ({
  isOpen,
  user,
  onConfirm,
  onDecline,
  isLoading = false
}: LoginConfirmationDialogProps) => {
  const getUserInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => !isLoading && onDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome back!</DialogTitle>
          <DialogDescription>
            We found an existing session. Would you like to continue as:
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.photoURL || undefined} />
            <AvatarFallback>
              {getUserInitials(user.email || "")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{user.displayName || "User"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Use different account
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginConfirmationDialog;