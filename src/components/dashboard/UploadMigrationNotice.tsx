import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, Zap, ArrowRight } from "lucide-react";
import { useState } from "react";

interface UploadMigrationNoticeProps {
  onSwitchToUppy?: () => void;
}

export const UploadMigrationNotice = ({ onSwitchToUppy }: UploadMigrationNoticeProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert className="border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="text-blue-800">
          <strong>New Upload System Available!</strong>
          <br />
          For files over 100MB, we recommend using our new resumable upload system with pause/resume support.
        </div>
        <div className="flex gap-2 ml-4">
          {onSwitchToUppy && (
            <Button 
              size="sm" 
              onClick={onSwitchToUppy}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="h-3 w-3 mr-1" />
              Try New Upload
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setDismissed(true)}
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};