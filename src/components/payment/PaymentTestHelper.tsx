import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { VideoPaymentModal } from "./VideoPaymentModal";
import { Play, Settings, TestTube } from "lucide-react";

interface PaymentTestHelperProps {
  video?: {
    id: string;
    slug: string;
    title: string;
    clientName: string;
  };
}

export const PaymentTestHelper = ({ video }: PaymentTestHelperProps) => {
  const [showTestModal, setShowTestModal] = useState(false);
  const [testAmount, setTestAmount] = useState(100);

  if (!video) {
    return (
      <Card className="border-dashed border-2 border-gray-300">
        <CardContent className="p-6 text-center">
          <TestTube className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-500">No video loaded for payment testing</p>
        </CardContent>
      </Card>
    );
  }

  const handleTestPayment = () => {
    setShowTestModal(true);
  };

  const handlePaymentComplete = () => {
    setShowTestModal(false);
    console.log('Test payment completed successfully!');
  };

  return (
    <>
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <TestTube className="h-5 w-5" />
            Payment Test Helper
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-blue-700">Video</Label>
              <p className="font-medium">{video.title}</p>
            </div>
            <div>
              <Label className="text-blue-700">Client</Label>
              <p className="font-medium">{video.clientName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-amount" className="text-blue-700">Test Amount (₹)</Label>
            <Input
              id="test-amount"
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(parseFloat(e.target.value) || 0)}
              min="1"
              max="100000"
              className="border-blue-300 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleTestPayment}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Test Payment Flow
            </Button>
          </div>

          <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
            <strong>Note:</strong> This simulates the payment modal that appears when a video ends. 
            Use Razorpay test credentials for safe testing.
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              <Settings className="h-3 w-3 mr-1" />
              Test Mode
            </Badge>
          </div>
        </CardContent>
      </Card>

      <VideoPaymentModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        video={video}
        paymentAmount={testAmount}
        onPaymentComplete={handlePaymentComplete}
      />
    </>
  );
};