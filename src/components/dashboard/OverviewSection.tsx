import { useState, useEffect } from "react";
import { Users, Video, MessageSquare, TrendingUp, Clock, Star, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { getClients } from "@/integrations/firebase/clientService";
import { getAllVideosForUser } from "@/integrations/firebase/videoService";
import { getUserTimestampedComments } from "@/integrations/firebase/commentService";

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalVideos: number;
  totalComments: number;
  recentActivity: number;
  averageRating: number;
  completionRate: number;
  monthlyGrowth: number;
}

interface RecentActivity {
  id: string;
  type: 'video' | 'comment' | 'client';
  message: string;
  timestamp: string;
  client?: string;
}

interface OverviewSectionProps {
  onSectionChange: (section: string) => void;
}

const OverviewSection = ({ onSectionChange }: OverviewSectionProps) => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    totalVideos: 0,
    totalComments: 0,
    recentActivity: 0,
    averageRating: 0,
    completionRate: 0,
    monthlyGrowth: 0
  });
  const [loading, setLoading] = useState(true);

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  // Fetch real data from Firebase
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        setLoading(true);
        
        // Fetch clients
        const clients = await getClients(currentUser.uid);
        
        // Fetch videos
        const videos = await getAllVideosForUser(currentUser.uid);
        
        // Fetch comments
        const comments = await getUserTimestampedComments(currentUser.uid);
        
        // Calculate stats
        const totalClients = clients.length;
        const activeClients = clients.filter(client => 
          client.status === "In progress" || client.status === "Not paid yet"
        ).length;
        const totalVideos = videos.length;
        const totalComments = comments.length;
        
        // Calculate completion rate (clients with "Done" status)
        const completedClients = clients.filter(client => client.status === "Done").length;
        const completionRate = totalClients > 0 ? Math.round((completedClients / totalClients) * 100) : 0;
        
        // Calculate monthly growth (clients created in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentClients = clients.filter(client => 
          client.createdAt && client.createdAt > thirtyDaysAgo
        ).length;
        const monthlyGrowth = totalClients > 0 ? Math.round((recentClients / totalClients) * 100) : 0;
        
        // Generate recent activities from real data
        const activities: RecentActivity[] = [];
        
        // Add recent videos
        videos.slice(0, 3).forEach(video => {
          activities.push({
            id: `video-${video.id}`,
            type: 'video',
            message: `New video uploaded: "${video.title}"`,
            timestamp: formatRelativeTime(video.uploadedAt),
            client: video.clientName
          });
        });
        
        // Add recent comments
        comments.slice(0, 3).forEach(comment => {
          activities.push({
            id: `comment-${comment.id}`,
            type: 'comment',
            message: `New comment on "${comment.videoTitle}"`,
            timestamp: formatRelativeTime(new Date(comment.createdAt)),
            client: comment.userName
          });
        });
        
        // Add recent clients
        clients.slice(0, 2).forEach(client => {
          if (client.createdAt) {
            activities.push({
              id: `client-${client.id}`,
              type: 'client',
              message: `New client onboarded: ${client.clientName}`,
              timestamp: formatRelativeTime(client.createdAt),
              client: client.clientName
            });
          }
        });
        
        // Sort activities by timestamp (most recent first)
        activities.sort((a, b) => {
          const timeA = getTimeValue(a.timestamp);
          const timeB = getTimeValue(b.timestamp);
          return timeB - timeA;
        });
        
        setStats({
          totalClients,
          activeClients,
          totalVideos,
          totalComments,
          recentActivity: activities.length,
          averageRating: 4.8, // Could be calculated from ratings if available
          completionRate,
          monthlyGrowth
        });
        
        setRecentActivities(activities.slice(0, 5)); // Show only 5 most recent
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  // Helper function to format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper function to convert timestamp string to numeric value for sorting
  const getTimeValue = (timestamp: string): number => {
    if (timestamp.includes('hour')) {
      const hours = parseInt(timestamp.match(/\d+/)?.[0] || '0');
      return hours * 60 * 60 * 1000;
    } else if (timestamp.includes('day')) {
      const days = parseInt(timestamp.match(/\d+/)?.[0] || '0');
      return days * 24 * 60 * 60 * 1000;
    } else if (timestamp.includes('Just now')) {
      return 0;
    }
    return 0;
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    description,
    color = "blue"
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: number;
    description?: string;
    color?: string;
  }) => {
    const colorClasses = {
      blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      green: "bg-green-500/10 text-green-500 border-green-500/20",
      purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
    };

    return (
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold">{value}</p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      case 'client':
        return <Users className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-blue-500/10 text-blue-500';
      case 'comment':
        return 'bg-green-500/10 text-green-500';
      case 'client':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Clients"
          value={loading ? "..." : stats.totalClients}
          icon={Users}
          trend={loading ? undefined : stats.monthlyGrowth}
          description="Active client accounts"
          color="blue"
        />
        <StatCard
          title="Active Now"
          value={loading ? "..." : stats.activeClients}
          icon={Activity}
          description="Currently active clients"
          color="green"
        />
        <StatCard
          title="Total Videos"
          value={loading ? "..." : stats.totalVideos}
          icon={Video}
          description="All uploaded videos"
          color="purple"
        />
        <StatCard
          title="Total Comments"
          value={loading ? "..." : stats.totalComments}
          icon={MessageSquare}
          trend={loading ? undefined : 8}
          description="Client feedback"
          color="orange"
        />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activity.timestamp}</span>
                      {activity.client && (
                        <>
                          <span>•</span>
                          <span>{activity.client}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => onSectionChange('upload')}
              className="p-4 border rounded-lg hover:bg-accent transition-colors text-left"
            >
              <Video className="h-6 w-6 mb-2 text-blue-500" />
              <h3 className="font-semibold">Upload New Video</h3>
              <p className="text-sm text-muted-foreground">Share a draft with clients</p>
            </button>
            <button 
              onClick={() => onSectionChange('clients')}
              className="p-4 border rounded-lg hover:bg-accent transition-colors text-left"
            >
              <Users className="h-6 w-6 mb-2 text-green-500" />
              <h3 className="font-semibold">Add New Client</h3>
              <p className="text-sm text-muted-foreground">Invite a client to collaborate</p>
            </button>
            <button 
              onClick={() => onSectionChange('videos')}
              className="p-4 border rounded-lg hover:bg-accent transition-colors text-left"
            >
              <BarChart3 className="h-6 w-6 mb-2 text-purple-500" />
              <h3 className="font-semibold">Manage Videos</h3>
              <p className="text-sm text-muted-foreground">View and organize all videos</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewSection;
