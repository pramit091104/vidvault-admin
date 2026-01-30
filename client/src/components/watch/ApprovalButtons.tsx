import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle, XCircle, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { updateVideoApprovalStatus } from "@/integrations/firebase/videoService";
import { updateClientProjectStatus } from "@/integrations/firebase/clientService";
import { useAuth } from "@/contexts/AuthContext";

interface ApprovalButtonsProps {
  videoId: string;
  videoTitle: string;
  currentStatus?: string;
  onStatusUpdate?: (newStatus: string) => void;
  onApprovalAction?: (action: 'approved' | 'rejected' | 'revision_requested', feedback?: string) => Promise<void>;
  isClient?: boolean; // Whether the current user is the client (not the creator)
  clientName?: string; // Client name for updating project status
  videoCreatorId?: string; // Video creator's user ID for updating client project
  rateLimitStatus?: { allowed: boolean; reason?: string } | null;
}

export const ApprovalButtons = ({ 
  videoId, 
  videoTitle, 
  currentStatus = 'pending_review',
  onStatusUpdate,
  onApprovalAction,
  isClient = true,
  clientName,
  videoCreatorId,
  rateLimitStatus
}: ApprovalButtonsProps) => {
  const { currentUser } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);

  // Only show approval buttons if video is in review status and user is client
  if (!isClient || (currentStatus !== 'pending_review' && currentStatus !== 'draft')) {
    return null;
  }

  const isAnonymous = !currentUser;

  const handleApprove = async () => {
    if (onApprovalAction) {
      // Use the new approval action handler with identity verification
      setIsApproving(true);
      try {
        await onApprovalAction('approved');
      } catch (error) {
        // Error handling is done in the parent component
      } finally {
        setIsApproving(false);
      }
    } else {
      // Fallback to old method for backward compatibility
      try {
        setIsApproving(true);
        // Use 'anonymous_client' as reviewedBy for anonymous users
        const reviewerId = currentUser?.uid || 'anonymous_client';
        await updateVideoApprovalStatus(videoId, 'approved', reviewerId);
        
        // Update client project status to "Done" if we have the necessary info
        if (clientName && videoCreatorId) {
          try {
            await updateClientProjectStatus(clientName, videoCreatorId, 'Done');
          } catch (error) {
            console.warn('Could not update client project status:', error);
            // Don't fail the approval if client status update fails
          }
        }
        
        toast.success("Draft approved! Project is now completed.");
        onStatusUpdate?.('approved');
      } catch (error) {
        console.error('Error approving video:', error);
        toast.error("Failed to approve draft. Please try again.");
      } finally {
        setIsApproving(false);
      }
    }
  };

  const handleRequestChanges = async () => {
    if (!revisionNotes.trim()) {
      toast.error("Please provide feedback about what needs to be changed.");
      return;
    }

    if (onApprovalAction) {
      // Use the new approval action handler with identity verification
      setIsRequestingChanges(true);
      try {
        await onApprovalAction('revision_requested', revisionNotes);
        setShowRevisionDialog(false);
        setRevisionNotes("");
      } catch (error) {
        // Error handling is done in the parent component
      } finally {
        setIsRequestingChanges(false);
      }
    } else {
      // Fallback to old method for backward compatibility
      try {
        setIsRequestingChanges(true);
        // Use 'anonymous_client' as reviewedBy for anonymous users
        const reviewerId = currentUser?.uid || 'anonymous_client';
        await updateVideoApprovalStatus(videoId, 'needs_changes', reviewerId, revisionNotes);
        
        // Update client project status back to "In progress" if we have the necessary info
        if (clientName && videoCreatorId) {
          try {
            await updateClientProjectStatus(clientName, videoCreatorId, 'In progress');
          } catch (error) {
            console.warn('Could not update client project status:', error);
            // Don't fail the revision request if client status update fails
          }
        }
        
        toast.success("Revision requested. The creator will be notified to upload a new version.");
        onStatusUpdate?.('needs_changes');
        setShowRevisionDialog(false);
        setRevisionNotes("");
      } catch (error) {
        console.error('Error requesting changes:', error);
        toast.error("Failed to request changes. Please try again.");
      } finally {
        setIsRequestingChanges(false);
      }
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Review Draft
            </h3>
            <p className="text-sm text-muted-foreground">
              Please review this draft and let us know if you'd like any changes or if you approve it.
            </p>
            {isAnonymous && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">Reviewing as Anonymous</span>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Your feedback will be recorded anonymously. Consider signing in for a personalized experience.
                </p>
              </div>
            )}
            {rateLimitStatus && !rateLimitStatus.allowed && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">Action Limit Reached</span>
                </div>
                <p className="text-xs text-red-700 mt-1">
                  {rateLimitStatus.reason}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Approve Button */}
            <Button
              onClick={handleApprove}
              disabled={isApproving || isRequestingChanges || (rateLimitStatus && !rateLimitStatus.allowed)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium h-12"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>

            {/* Request Changes Button */}
            <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isApproving || isRequestingChanges || (rateLimitStatus && !rateLimitStatus.allowed)}
                  className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-medium h-12"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Needs Changes
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Request Changes
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Please describe what changes you'd like to see in the next version:
                  </p>
                  <Textarea
                    placeholder="Describe the changes you'd like to see..."
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRevisionDialog(false);
                        setRevisionNotes("");
                      }}
                      disabled={isRequestingChanges}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRequestChanges}
                      disabled={isRequestingChanges || !revisionNotes.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {isRequestingChanges ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Request Changes
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            <p>
              <strong>Approve:</strong> Mark this draft as final and complete the project<br />
              <strong>Needs Changes:</strong> Request revisions and a new version will be uploaded
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};