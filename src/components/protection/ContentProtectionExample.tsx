import React from 'react';
import { ProtectedVideo } from './ProtectedVideo';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Eye, Download } from 'lucide-react';

interface ContentProtectionExampleProps {
  videoId: string;
  title: string;
}

export const ContentProtectionExample: React.FC<ContentProtectionExampleProps> = ({
  videoId,
  title
}) => {
  const { subscription } = useAuth();
  const isPremium = subscription.tier === 'premium';

  const handleUnauthorizedAccess = () => {
    console.log('Unauthorized access attempt detected');
    // Could trigger upgrade prompt or logging
  };

  const handleUpgrade = () => {
    // Navigate to upgrade page
    window.location.href = '/upgrade';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Protection Status Banner - Same for all users */}
      <div className="p-4 rounded-lg border bg-blue-50 border-blue-200 text-blue-800">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium">Content Protected</h3>
            <p className="text-sm mt-1">
              This content is protected with comprehensive download prevention for all users.
            </p>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>Standard Quality</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span>Download Disabled</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>Content Protected</span>
            </div>
          </div>
        </div>

        <ProtectedVideo
          videoId={videoId}
          title={title}
          isPaid={isPremium} // Still passed but doesn't affect protection
          allowDownload={false} // Always false
          quality="standard" // Same quality for all
          onUnauthorizedAccess={handleUnauthorizedAccess}
        />

        {/* Upgrade Prompt for Premium Features (not protection-related) */}
        {!isPremium && (
          <div className="p-6 bg-gray-50 border-t">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Unlock Premium Features
              </h3>
              <p className="text-gray-600 mb-4">
                Get additional storage, advanced analytics, and priority support
              </p>
              <Button onClick={handleUpgrade} className="bg-blue-600 hover:bg-blue-700">
                Upgrade to Premium
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Protection Features Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-medium text-gray-900 mb-3">Content Protection Features</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Comprehensive download prevention
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Right-click and download prevention
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Developer tools detection
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Secure token-based access
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Mobile download prevention
            </li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-medium text-gray-900 mb-3">Security Features</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              No downloads allowed for any user
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Download attempts are watermarked
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Real-time violation monitoring
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Cross-platform protection
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Automatic threat detection
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ContentProtectionExample;