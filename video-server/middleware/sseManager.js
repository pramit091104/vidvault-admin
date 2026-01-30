// Server-Sent Events manager for real-time updates
class SSEManager {
  constructor() {
    this.connections = new Map(); // sessionId -> response objects
    this.uploadProgress = new Map(); // sessionId -> progress data
  }

  // Add SSE connection for upload progress
  addUploadConnection(sessionId, res) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    this.sendEvent(res, 'connected', { sessionId, timestamp: new Date().toISOString() });

    // Store connection
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, []);
    }
    this.connections.get(sessionId).push(res);

    // Handle client disconnect
    req.on('close', () => {
      this.removeConnection(sessionId, res);
    });

    req.on('aborted', () => {
      this.removeConnection(sessionId, res);
    });

    // Send current progress if available
    const currentProgress = this.uploadProgress.get(sessionId);
    if (currentProgress) {
      this.sendEvent(res, 'progress', currentProgress);
    }
  }

  // Remove SSE connection
  removeConnection(sessionId, res) {
    const connections = this.connections.get(sessionId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
      
      if (connections.length === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  // Send event to specific session
  sendToSession(sessionId, eventType, data) {
    const connections = this.connections.get(sessionId);
    if (connections) {
      connections.forEach(res => {
        try {
          this.sendEvent(res, eventType, data);
        } catch (error) {
          console.warn('Failed to send SSE event:', error.message);
          this.removeConnection(sessionId, res);
        }
      });
    }
  }

  // Send event to all connections
  broadcast(eventType, data) {
    for (const [sessionId, connections] of this.connections) {
      connections.forEach(res => {
        try {
          this.sendEvent(res, eventType, data);
        } catch (error) {
          console.warn('Failed to broadcast SSE event:', error.message);
          this.removeConnection(sessionId, res);
        }
      });
    }
  }

  // Send individual event
  sendEvent(res, eventType, data) {
    const eventData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(eventData);
  }

  // Update upload progress
  updateUploadProgress(sessionId, progressData) {
    this.uploadProgress.set(sessionId, {
      ...progressData,
      timestamp: new Date().toISOString()
    });
    
    this.sendToSession(sessionId, 'progress', progressData);
  }

  // Mark upload as completed
  completeUpload(sessionId, completionData) {
    this.sendToSession(sessionId, 'completed', {
      ...completionData,
      timestamp: new Date().toISOString()
    });
    
    // Clean up progress data
    this.uploadProgress.delete(sessionId);
    
    // Close connections after a delay
    setTimeout(() => {
      const connections = this.connections.get(sessionId);
      if (connections) {
        connections.forEach(res => {
          try {
            this.sendEvent(res, 'close', { message: 'Upload completed' });
            res.end();
          } catch (error) {
            console.warn('Failed to close SSE connection:', error.message);
          }
        });
        this.connections.delete(sessionId);
      }
    }, 5000); // Close after 5 seconds
  }

  // Mark upload as failed
  failUpload(sessionId, errorData) {
    this.sendToSession(sessionId, 'error', {
      ...errorData,
      timestamp: new Date().toISOString()
    });
    
    // Clean up
    this.uploadProgress.delete(sessionId);
    
    // Close connections after a delay
    setTimeout(() => {
      const connections = this.connections.get(sessionId);
      if (connections) {
        connections.forEach(res => {
          try {
            this.sendEvent(res, 'close', { message: 'Upload failed' });
            res.end();
          } catch (error) {
            console.warn('Failed to close SSE connection:', error.message);
          }
        });
        this.connections.delete(sessionId);
      }
    }, 10000); // Close after 10 seconds for errors
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: Array.from(this.connections.values()).reduce((sum, conns) => sum + conns.length, 0),
      activeSessions: this.connections.size,
      activeUploads: this.uploadProgress.size
    };
  }

  // Clean up expired connections
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, progressData] of this.uploadProgress) {
      if (progressData.timestamp && (now - new Date(progressData.timestamp).getTime()) > maxAge) {
        console.log(`Cleaning up expired upload progress for session: ${sessionId}`);
        this.uploadProgress.delete(sessionId);
        
        // Close any remaining connections
        const connections = this.connections.get(sessionId);
        if (connections) {
          connections.forEach(res => {
            try {
              this.sendEvent(res, 'timeout', { message: 'Session expired' });
              res.end();
            } catch (error) {
              console.warn('Failed to close expired SSE connection:', error.message);
            }
          });
          this.connections.delete(sessionId);
        }
      }
    }
  }
}

// Create singleton instance
export const sseManager = new SSEManager();

// Start cleanup interval (every 5 minutes)
setInterval(() => {
  sseManager.cleanup();
}, 5 * 60 * 1000);

export default sseManager;