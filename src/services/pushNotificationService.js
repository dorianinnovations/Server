import admin from 'firebase-admin';
import logger from '../utils/logger.js';
import redisService from './redisService.js';
import User from '../models/User.js';

/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging for mobile push notifications
 */
class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.messaging = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  async initialize() {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        // Initialize with service account key or environment variables
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        
        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        } else {
          // Fallback to environment variables
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID
          });
        }
      }

      this.messaging = admin.messaging();
      this.isInitialized = true;
      // Push notification service initialized successfully
      
    } catch (error) {
      logger.error('Failed to initialize push notification service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Send notification to single user
   */
  async sendToUser(userId, notification, data = {}) {
    try {
      if (!this.isInitialized) {
        logger.warn('Push notification service not initialized');
        return { success: false, error: 'Service not initialized' };
      }

      // Get user's push token
      const pushToken = await this.getUserPushToken(userId);
      if (!pushToken) {
        logger.warn(`No push token found for user ${userId}`);
        return { success: false, error: 'No push token' };
      }

      // Prepare message
      const message = {
        token: pushToken.token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: {
          ...data,
          userId: userId,
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'numina_notifications',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body
              }
            }
          }
        }
      };

      // Send notification
      const response = await this.messaging.send(message);
      
      // Log success
      logger.info(`Push notification sent to user ${userId}: ${response}`);
      
      // Cache notification for history
      await this.cacheNotification(userId, notification, data, response);
      
      return { success: true, response };

    } catch (error) {
      logger.error(`Failed to send push notification to user ${userId}:`, error);
      
      // Handle invalid token error
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        await this.removeInvalidToken(userId);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds, notification, data = {}) {
    try {
      if (!this.isInitialized) {
        logger.warn('Push notification service not initialized');
        return { success: false, error: 'Service not initialized' };
      }

      const results = [];
      const batchSize = 100; // FCM multicast limit

      // Process users in batches
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const tokens = [];
        const userTokenMap = new Map();

        // Get push tokens for this batch
        for (const userId of batch) {
          const pushToken = await this.getUserPushToken(userId);
          if (pushToken) {
            tokens.push(pushToken.token);
            userTokenMap.set(pushToken.token, userId);
          }
        }

        if (tokens.length === 0) {
          continue;
        }

        // Prepare multicast message
        const multicastMessage = {
          tokens,
          notification: {
            title: notification.title,
            body: notification.body,
            imageUrl: notification.imageUrl
          },
          data: {
            ...data,
            timestamp: new Date().toISOString()
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'numina_notifications',
              priority: 'high',
              defaultSound: true,
              defaultVibrateTimings: true
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                alert: {
                  title: notification.title,
                  body: notification.body
                }
              }
            }
          }
        };

        // Send multicast
        const response = await this.messaging.sendMulticast(multicastMessage);
        
        // Process responses
        response.responses.forEach((res, index) => {
          const token = tokens[index];
          const userId = userTokenMap.get(token);
          
          if (res.success) {
            results.push({ userId, success: true, messageId: res.messageId });
          } else {
            results.push({ userId, success: false, error: res.error });
            
            // Handle invalid tokens
            if (res.error && (
              res.error.code === 'messaging/invalid-registration-token' ||
              res.error.code === 'messaging/registration-token-not-registered'
            )) {
              this.removeInvalidToken(userId);
            }
          }
        });

        logger.info(`Multicast sent to ${tokens.length} tokens: ${response.successCount} successful, ${response.failureCount} failed`);
      }

      return { success: true, results };

    } catch (error) {
      logger.error('Failed to send multicast push notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to topic
   */
  async sendToTopic(topic, notification, data = {}) {
    try {
      if (!this.isInitialized) {
        logger.warn('Push notification service not initialized');
        return { success: false, error: 'Service not initialized' };
      }

      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'numina_notifications',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body
              }
            }
          }
        }
      };

      const response = await this.messaging.send(message);
      logger.info(`Topic notification sent to ${topic}: ${response}`);
      
      return { success: true, response };

    } catch (error) {
      logger.error(`Failed to send topic notification to ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe user to topic
   */
  async subscribeToTopic(userId, topic) {
    try {
      const pushToken = await this.getUserPushToken(userId);
      if (!pushToken) {
        return { success: false, error: 'No push token' };
      }

      await this.messaging.subscribeToTopic([pushToken.token], topic);
      
      // Cache subscription
      await redisService.sadd(`topic:${topic}:subscribers`, userId);
      await redisService.sadd(`user:${userId}:topics`, topic);
      
      logger.info(`User ${userId} subscribed to topic ${topic}`);
      return { success: true };

    } catch (error) {
      logger.error(`Failed to subscribe user ${userId} to topic ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe user from topic
   */
  async unsubscribeFromTopic(userId, topic) {
    try {
      const pushToken = await this.getUserPushToken(userId);
      if (!pushToken) {
        return { success: false, error: 'No push token' };
      }

      await this.messaging.unsubscribeFromTopic([pushToken.token], topic);
      
      // Remove from cache
      await redisService.srem(`topic:${topic}:subscribers`, userId);
      await redisService.srem(`user:${userId}:topics`, topic);
      
      logger.info(`User ${userId} unsubscribed from topic ${topic}`);
      return { success: true };

    } catch (error) {
      logger.error(`Failed to unsubscribe user ${userId} from topic ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's push token
   */
  async getUserPushToken(userId) {
    try {
      // Check cache first
      const cachedToken = await redisService.get(`push:${userId}`);
      if (cachedToken) {
        return cachedToken;
      }

      // Get from database
      const user = await User.findById(userId).select('pushToken platform pushTokenUpdatedAt');
      if (!user || !user.pushToken) {
        return null;
      }

      const tokenData = {
        token: user.pushToken,
        platform: user.platform,
        updatedAt: user.pushTokenUpdatedAt
      };

      // Cache for 1 hour
      await redisService.set(`push:${userId}`, tokenData, 3600);
      
      return tokenData;

    } catch (error) {
      logger.error(`Failed to get push token for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Remove invalid token
   */
  async removeInvalidToken(userId) {
    try {
      // Remove from database
      await User.findByIdAndUpdate(userId, {
        $unset: { pushToken: 1, platform: 1, pushTokenUpdatedAt: 1 }
      });

      // Remove from cache
      await redisService.del(`push:${userId}`);
      
      logger.info(`Removed invalid push token for user ${userId}`);

    } catch (error) {
      logger.error(`Failed to remove invalid token for user ${userId}:`, error);
    }
  }

  /**
   * Cache notification for history
   */
  async cacheNotification(userId, notification, data, response) {
    try {
      const notificationRecord = {
        userId,
        notification,
        data,
        response,
        timestamp: new Date(),
        sent: true
      };

      // Cache individual notification
      const notificationId = `notification:${userId}:${Date.now()}`;
      await redisService.set(notificationId, notificationRecord, 86400 * 7); // 7 days

      // Add to user's notification list
      await redisService.zadd(`notifications:${userId}`, Date.now(), notificationId);
      
      // Keep only last 100 notifications per user
      await redisService.client.zremrangebyrank(`notifications:${userId}`, 0, -101);

    } catch (error) {
      logger.error('Failed to cache notification:', error);
    }
  }

  /**
   * Get user's notification history
   */
  async getNotificationHistory(userId, limit = 50) {
    try {
      const notificationIds = await redisService.zrange(`notifications:${userId}`, -limit, -1);
      
      if (notificationIds.length === 0) {
        return [];
      }

      const notifications = await redisService.mget(notificationIds);
      return notifications.filter(Boolean);

    } catch (error) {
      logger.error(`Failed to get notification history for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Send real-time analytics notification
   */
  async sendAnalyticsNotification(userId, analyticsData) {
    const notification = {
      title: 'Weekly Insights Ready',
      body: `Your emotional insights are ready! You've had ${analyticsData.weeklyMood} mood this week.`,
      imageUrl: null
    };

    return this.sendToUser(userId, notification, {
      type: 'analytics',
      analyticsData: JSON.stringify(analyticsData)
    });
  }

  /**
   * Send cloud event notification
   */
  async sendCloudEventNotification(userId, eventData) {
    const notification = {
      title: 'New Cloud Event',
      body: `"${eventData.title}" matches your interests!`,
      imageUrl: null
    };

    return this.sendToUser(userId, notification, {
      type: 'cloud_event',
      eventId: eventData.id,
      eventData: JSON.stringify(eventData)
    });
  }

  /**
   * Send chat message notification
   */
  async sendChatNotification(userId, messageData) {
    const notification = {
      title: 'New Message',
      body: messageData.preview || 'You have a new message',
      imageUrl: null
    };

    return this.sendToUser(userId, notification, {
      type: 'chat',
      messageId: messageData.id,
      roomId: messageData.roomId
    });
  }

  /**
   * Send emotional state notification
   */
  async sendEmotionalStateNotification(userId, emotionData) {
    const notification = {
      title: 'Emotional Check-in',
      body: `Time for a quick emotional check-in! Your last mood was ${emotionData.lastEmotion}`,
      imageUrl: null
    };

    return this.sendToUser(userId, notification, {
      type: 'emotional_checkin',
      emotionData: JSON.stringify(emotionData)
    });
  }

  /**
   * Get service statistics
   */
  async getStats() {
    try {
      const stats = {
        isInitialized: this.isInitialized,
        usersWithTokens: 0,
        totalNotificationsSent: 0,
        recentNotifications: 0
      };

      // Get users with push tokens
      const usersWithTokens = await redisService.keys('push:*');
      stats.usersWithTokens = usersWithTokens.length;

      // Get total notifications (approximate)
      const notificationKeys = await redisService.keys('notification:*');
      stats.totalNotificationsSent = notificationKeys.length;

      // Get recent notifications (last 24 hours)
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentNotifications = await redisService.keys(`notification:*:${twentyFourHoursAgo}*`);
      stats.recentNotifications = recentNotifications.length;

      return stats;

    } catch (error) {
      logger.error('Failed to get push notification stats:', error);
      return {
        isInitialized: this.isInitialized,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new PushNotificationService();