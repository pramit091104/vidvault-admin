import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Clock, Zap } from "lucide-react";
import { FEATURES } from "@/config/features";

interface MigrationStatusProps {
  className?: string;
}

const MigrationStatus = ({ className }: MigrationStatusProps) => {
  const [migrationStats, setMigrationStats] = useState({
    totalUploads: 0,
    simpleUploads: 0,
    uppyUploads: 0,
    successRate: 0,
    avgUploadTime: 0
  });

  // Mock data for demonstration - in real app, this would come from analytics
  useEffect(() => {
    // Simulate fetching migration stats
    const mockStats = {
      totalUploads: 45,
      simpleUploads: 28,
      uppyUploads: 17,
      successRate: 96.7,
      avgUploadTime: 45
    };
    setMigrationStats(mockStats);
  }, []);

  const migrationChecklist = [
    {
      id: 'smart-upload',
      title: 'Smart Upload Component',
      status: 'completed',
      description: 'Automatic file size detection and method selection'
    },
    {
      id: 'dashboard-integration',
      title: 'Dashboard Integration',
      status: 'completed',
      description: 'SmartUploadSection integrated into main dashboard'
    },
    {
      id: 'feature-config',
      title: 'Feature Configuration',
      status: 'completed',
      description: 'Upload thresholds and feature flags configured'
    },
    {
      id: 'environment-setup',
      title: 'Environment Setup',
      status: 'completed',
      description: 'Upload size limits and chunk configuration added'
    },
    {
      id: 'backward-compatibility',
      title: 'Backward Compatibility',
      status: 'completed',
      description: 'Both upload methods coexist seamlessly'
    },
    {
      id: 'testing',
      title: 'Testing & Validation',
      status: 'in-progress',
      description: 'Comprehensive testing of both upload methods'
    },
    {
      id: 'monitoring',
      title: 'Performance Monitoring',
      status: 'pending',
      description: 'Analytics and error tracking setup'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in-progress':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const completedTasks = migrationChecklist.filter(task => task.status === 'completed').length;
  const totalTasks = migrationChecklist.length;
  const progressPercentage = (completedTasks / totalTasks) * 100;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Migration Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Migration Progress - Phase 8
          </CardTitle>
          <CardDescription>
            Uppy Upload Integration Status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{completedTasks}/{totalTasks} tasks completed</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{migrationStats.totalUploads}</div>
                <div className="text-sm text-muted-foreground">Total Uploads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{migrationStats.successRate}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{migrationStats.simpleUploads}</div>
                <div className="text-sm text-muted-foreground">Simple Uploads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{migrationStats.uppyUploads}</div>
                <div className="text-sm text-muted-foreground">Uppy Uploads</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Checklist</CardTitle>
          <CardDescription>
            Track the completion of migration tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {migrationChecklist.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium">{task.title}</h4>
                    {getStatusBadge(task.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feature Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Configuration</CardTitle>
          <CardDescription>
            Current upload system configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Upload Methods</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Simple Upload:</span>
                  <Badge variant={FEATURES.SIMPLE_UPLOAD ? "default" : "secondary"}>
                    {FEATURES.SIMPLE_UPLOAD ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Uppy Upload:</span>
                  <Badge variant={FEATURES.UPPY_UPLOAD ? "default" : "secondary"}>
                    {FEATURES.UPPY_UPLOAD ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Auto Selection:</span>
                  <Badge variant={FEATURES.AUTO_SELECT_METHOD ? "default" : "secondary"}>
                    {FEATURES.AUTO_SELECT_METHOD ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Size Limits</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Simple Upload Max:</span>
                  <span className="font-mono">{(FEATURES.SIMPLE_UPLOAD_MAX_SIZE / (1024 * 1024)).toFixed(0)}MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Resumable Upload Max:</span>
                  <span className="font-mono">{(FEATURES.RESUMABLE_UPLOAD_MAX_SIZE / (1024 * 1024 * 1024)).toFixed(1)}GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunk Size:</span>
                  <span className="font-mono">{(FEATURES.CHUNK_SIZE / (1024 * 1024)).toFixed(0)}MB</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MigrationStatus;