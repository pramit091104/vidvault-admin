import { auth } from '@/integrations/firebase/config';

export interface CommentNotificationRequest {
  videoId: string;
  commentText: string;
  commenterName?: string;
  commenterEmail?: string;
}

class NotificationService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const user = auth.currentUser;
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async sendCommentNotification(data: CommentNotificationRequest): Promise<boolean> {
    try {
      const user = auth.currentUser;
      const headers = await this.getAuthHeaders();
      
      // Add anonymous flag if user is not authenticated
      const requestData = {
        ...data,
        isAnonymous: !user
      };
      
      const response = await fetch('/api/notifications/comment', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send notification' }));
        console.error('Notification API error:', error);
        return false;
      }

      const result = await response.json();
      console.log('Notification result:', result.message);
      return result.success;
    } catch (error) {
      console.error('Error sending comment notification:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();