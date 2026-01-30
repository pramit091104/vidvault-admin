import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { applicationService, SystemHealth, ServiceHealth } from "@/services";
import { toast } from "sonner";

/**
 * SystemHealthDashboard provides a comprehensive view of all integrated services
 * This component demonstrates how to use the integrated application service
 * for monitoring system health and service status.
 */
export const SystemHealthDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serviceStats, setServiceStats] = useState<any>(null);

  // Load system health data
  const loadSystemHealth = async () => {
    try {
      setIsLoading(true);
      const health = await applicationService.performHealthCheck();
      const stats = applicationService.getServiceStats();
      
      setSystemHealth(health);
      setServiceStats(stats);
    } catch (error) {
      console.error('Error loading system health:', error);
      toast.error('Failed to load system health data');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh system health
  const refreshHealth = async () => {
    try {
      setIsRefreshing(true);
      await loadSystemHealth();
      toast.success('System health refreshed');
    } catch (error) {
      toast.error('Failed to refresh system health');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Clear service errors (admin function)
  const clearErrors = () => {
    applicationService.clearServiceErrors();
    toast.success('Service errors cleared');
    loadSystemHealth();
  };

  // Load data on component mount
  useEffect(() => {
    loadSystemHealth();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadSystemHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Get status icon for service health
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get status color for badges
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor the health and performance of all integrated services
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearErrors}
            className="text-red-600 hover:text-red-700"
          >
            Clear Errors
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHealth}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(systemHealth.overall)}
                <CardTitle>Overall System Status</CardTitle>
              </div>
              <Badge className={getStatusColor(systemHealth.overall)}>
                {systemHealth.overall.toUpperCase()}
              </Badge>
            </div>
            <CardDescription>
              System uptime: {Math.floor(systemHealth.uptime / 1000 / 60)} minutes
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Service Health Grid */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemHealth.services.map((service: ServiceHealth) => (
            <Card key={service.service}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(service.status)}
                    <CardTitle className="text-sm">{service.service}</CardTitle>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(service.status)}
                  >
                    {service.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Check:</span>
                    <span>{service.lastCheck.toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Error Count:</span>
                    <span className={service.errorCount > 0 ? 'text-red-600' : 'text-green-600'}>
                      {service.errorCount}
                    </span>
                  </div>
                  {service.responseTime && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Response Time:</span>
                      <span>{service.responseTime}ms</span>
                    </div>
                  )}
                  {service.details && Object.keys(service.details).length > 0 && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <pre>{JSON.stringify(service.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service Statistics */}
      {serviceStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cache Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cache Manager</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Entries:</span>
                  <span>{serviceStats.cacheStats.totalEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid:</span>
                  <span className="text-green-600">{serviceStats.cacheStats.validEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expired:</span>
                  <span className="text-red-600">{serviceStats.cacheStats.expiredEntries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TTL:</span>
                  <span>{Math.floor(serviceStats.cacheStats.unifiedTtl / 1000)}s</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Queue */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Notification Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span>{serviceStats.notificationQueueStatus.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="text-yellow-600">{serviceStats.notificationQueueStatus.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="text-red-600">{serviceStats.notificationQueueStatus.failed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent:</span>
                  <span className="text-green-600">{serviceStats.notificationQueueStatus.sent}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Health Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">System Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Services:</span>
                  <span>{serviceStats.systemHealth.services.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Healthy:</span>
                  <span className="text-green-600">
                    {serviceStats.systemHealth.services.filter((s: ServiceHealth) => s.status === 'healthy').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Degraded:</span>
                  <span className="text-yellow-600">
                    {serviceStats.systemHealth.services.filter((s: ServiceHealth) => s.status === 'degraded').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unhealthy:</span>
                  <span className="text-red-600">
                    {serviceStats.systemHealth.services.filter((s: ServiceHealth) => s.status === 'unhealthy').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Errors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {serviceStats.serviceErrors.length === 0 ? (
                  <p className="text-green-600">No recent errors</p>
                ) : (
                  serviceStats.serviceErrors.slice(0, 3).map((error: any, index: number) => (
                    <div key={index} className="p-2 bg-red-50 rounded text-xs">
                      <div className="font-medium text-red-800">{error.component}</div>
                      <div className="text-red-600 truncate">{error.message}</div>
                      <div className="text-red-500 text-xs">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SystemHealthDashboard;