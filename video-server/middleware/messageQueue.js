import NodeCache from 'node-cache';

// Simple in-memory message queue with Redis fallback
class MessageQueue {
  constructor() {
    // In-memory queue storage
    this.queues = new Map();
    this.processing = new Map();
    this.retryAttempts = new Map();
    
    // Configuration
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.processingTimeout = 30000; // 30 seconds
    
    // Redis client (optional)
    this.redisClient = null;
    this.initializeRedis();
    
    // Start processing
    this.startProcessing();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        const { Redis } = await import('ioredis');
        this.redisClient = new Redis(process.env.REDIS_URL);
        console.log('✅ Redis connected for message queue');
      }
    } catch (error) {
      console.warn('⚠️ Redis not available for message queue, using in-memory only:', error.message);
    }
  }

  // Add job to queue
  async enqueue(queueName, jobData, options = {}) {
    const job = {
      id: this.generateJobId(),
      data: jobData,
      attempts: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      delay: options.delay || 0,
      priority: options.priority || 0,
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + (options.delay || 0))
    };

    try {
      // Try Redis first
      if (this.redisClient) {
        try {
          await this.redisClient.lpush(`queue:${queueName}`, JSON.stringify(job));
          console.log(`✅ Job ${job.id} added to Redis queue: ${queueName}`);
          return job.id;
        } catch (redisError) {
          console.warn('Redis queue push failed, falling back to memory:', redisError.message);
        }
      }

      // Fallback to in-memory
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }
      
      const queue = this.queues.get(queueName);
      
      // Insert job based on priority and schedule
      const insertIndex = queue.findIndex(existingJob => 
        existingJob.priority < job.priority || 
        (existingJob.priority === job.priority && existingJob.scheduledFor > job.scheduledFor)
      );
      
      if (insertIndex === -1) {
        queue.push(job);
      } else {
        queue.splice(insertIndex, 0, job);
      }
      
      console.log(`✅ Job ${job.id} added to memory queue: ${queueName}`);
      return job.id;
      
    } catch (error) {
      console.error('Failed to enqueue job:', error);
      throw new Error('Failed to add job to queue');
    }
  }

  // Process jobs from queue
  async dequeue(queueName) {
    try {
      // Try Redis first
      if (this.redisClient) {
        try {
          const jobData = await this.redisClient.brpop(`queue:${queueName}`, 1);
          if (jobData && jobData[1]) {
            const job = JSON.parse(jobData[1]);
            job.createdAt = new Date(job.createdAt);
            job.scheduledFor = new Date(job.scheduledFor);
            return job;
          }
        } catch (redisError) {
          console.warn('Redis queue pop failed, trying memory:', redisError.message);
        }
      }

      // Fallback to in-memory
      const queue = this.queues.get(queueName);
      if (!queue || queue.length === 0) {
        return null;
      }

      // Find next job that's ready to process
      const now = new Date();
      const jobIndex = queue.findIndex(job => job.scheduledFor <= now);
      
      if (jobIndex === -1) {
        return null; // No jobs ready yet
      }

      return queue.splice(jobIndex, 1)[0];
      
    } catch (error) {
      console.error('Failed to dequeue job:', error);
      return null;
    }
  }

  // Mark job as processing
  markProcessing(queueName, jobId) {
    const processingKey = `${queueName}:${jobId}`;
    this.processing.set(processingKey, {
      startedAt: new Date(),
      timeout: setTimeout(() => {
        this.handleTimeout(queueName, jobId);
      }, this.processingTimeout)
    });
  }

  // Mark job as completed
  markCompleted(queueName, jobId) {
    const processingKey = `${queueName}:${jobId}`;
    const processing = this.processing.get(processingKey);
    
    if (processing) {
      clearTimeout(processing.timeout);
      this.processing.delete(processingKey);
    }
    
    this.retryAttempts.delete(jobId);
  }

  // Handle job failure and retry logic
  async handleFailure(queueName, job, error) {
    const processingKey = `${queueName}:${job.id}`;
    const processing = this.processing.get(processingKey);
    
    if (processing) {
      clearTimeout(processing.timeout);
      this.processing.delete(processingKey);
    }

    job.attempts++;
    job.lastError = error.message;
    job.lastAttemptAt = new Date();

    if (job.attempts < job.maxRetries) {
      // Retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, job.attempts - 1);
      job.scheduledFor = new Date(Date.now() + delay);
      
      console.log(`⚠️ Job ${job.id} failed (attempt ${job.attempts}/${job.maxRetries}), retrying in ${delay}ms`);
      
      // Re-enqueue for retry
      await this.enqueue(queueName, job.data, {
        delay,
        maxRetries: job.maxRetries,
        priority: job.priority
      });
    } else {
      console.error(`❌ Job ${job.id} failed permanently after ${job.attempts} attempts:`, error.message);
      
      // Move to dead letter queue
      await this.enqueue(`${queueName}:failed`, {
        ...job.data,
        originalJob: job,
        finalError: error.message
      });
    }
  }

  // Handle processing timeout
  async handleTimeout(queueName, jobId) {
    console.warn(`⏰ Job ${jobId} timed out in queue ${queueName}`);
    
    const processingKey = `${queueName}:${jobId}`;
    this.processing.delete(processingKey);
    
    // Could re-enqueue here if needed
  }

  // Start processing queues
  startProcessing() {
    // Process each queue type
    this.processQueue('email', this.processEmailJob.bind(this));
    this.processQueue('notification', this.processNotificationJob.bind(this));
    this.processQueue('cleanup', this.processCleanupJob.bind(this));
    
    console.log('✅ Message queue processing started');
  }

  // Generic queue processor
  async processQueue(queueName, processor) {
    const processNext = async () => {
      try {
        const job = await this.dequeue(queueName);
        
        if (job) {
          this.markProcessing(queueName, job.id);
          
          try {
            await processor(job);
            this.markCompleted(queueName, job.id);
            console.log(`✅ Job ${job.id} completed successfully`);
          } catch (error) {
            await this.handleFailure(queueName, job, error);
          }
        }
      } catch (error) {
        console.error(`Queue processing error for ${queueName}:`, error);
      }
      
      // Continue processing
      setTimeout(processNext, 1000); // 1 second interval
    };

    processNext();
  }

  // Email job processor
  async processEmailJob(job) {
    const { to, subject, html, text } = job.data;
    
    // Import nodemailer dynamically
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      html,
      text
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${subject}`);
  }

  // Notification job processor
  async processNotificationJob(job) {
    const { type, userId, data } = job.data;
    
    // Process different notification types
    switch (type) {
      case 'comment':
        await this.processCommentNotification(userId, data);
        break;
      case 'upload_complete':
        await this.processUploadNotification(userId, data);
        break;
      case 'subscription_update':
        await this.processSubscriptionNotification(userId, data);
        break;
      default:
        console.warn(`Unknown notification type: ${type}`);
    }
  }

  // Cleanup job processor
  async processCleanupJob(job) {
    const { type, data } = job.data;
    
    switch (type) {
      case 'expired_sessions':
        await this.cleanupExpiredSessions(data);
        break;
      case 'old_cache_entries':
        await this.cleanupOldCacheEntries(data);
        break;
      case 'temp_files':
        await this.cleanupTempFiles(data);
        break;
      default:
        console.warn(`Unknown cleanup type: ${type}`);
    }
  }

  // Helper methods for specific notification types
  async processCommentNotification(userId, data) {
    // Add comment notification logic here
    console.log(`📝 Processing comment notification for user ${userId}`);
  }

  async processUploadNotification(userId, data) {
    // Add upload notification logic here
    console.log(`📤 Processing upload notification for user ${userId}`);
  }

  async processSubscriptionNotification(userId, data) {
    // Add subscription notification logic here
    console.log(`💳 Processing subscription notification for user ${userId}`);
  }

  async cleanupExpiredSessions(data) {
    // Add session cleanup logic here
    console.log('🧹 Cleaning up expired sessions');
  }

  async cleanupOldCacheEntries(data) {
    // Add cache cleanup logic here
    console.log('🧹 Cleaning up old cache entries');
  }

  async cleanupTempFiles(data) {
    // Add temp file cleanup logic here
    console.log('🧹 Cleaning up temporary files');
  }

  // Generate unique job ID
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get queue statistics
  getStats() {
    const stats = {
      queues: {},
      processing: this.processing.size,
      redis: !!this.redisClient
    };

    for (const [queueName, queue] of this.queues) {
      stats.queues[queueName] = {
        pending: queue.length,
        ready: queue.filter(job => job.scheduledFor <= new Date()).length
      };
    }

    return stats;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down message queue...');
    
    // Clear all processing timeouts
    for (const processing of this.processing.values()) {
      clearTimeout(processing.timeout);
    }
    
    // Close Redis connection
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    console.log('✅ Message queue shutdown complete');
  }
}

// Create singleton instance
export const messageQueue = new MessageQueue();

// Convenience methods for common operations
export const queueEmail = (to, subject, html, text, options = {}) => {
  return messageQueue.enqueue('email', { to, subject, html, text }, options);
};

export const queueNotification = (type, userId, data, options = {}) => {
  return messageQueue.enqueue('notification', { type, userId, data }, options);
};

export const queueCleanup = (type, data, options = {}) => {
  return messageQueue.enqueue('cleanup', { type, data }, options);
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await messageQueue.shutdown();
});

process.on('SIGINT', async () => {
  await messageQueue.shutdown();
});

export default messageQueue;