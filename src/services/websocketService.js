import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { log } from '../utils/logger.js';
import User from '../models/User.js';

/**
 * WebSocket Service for Real-time Communication
 * Handles chat rooms, user presence, and live updates
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.userRooms = new Map();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30000, // Reduced from 60s for faster detection
      pingInterval: 15000, // Reduced from 25s for more frequent checks
      // Performance optimizations
      allowEIO3: true,
      maxHttpBufferSize: 1e6, // 1MB max message size
      httpCompression: true, // Enable compression
      perMessageDeflate: {
        threshold: 1024, // Compress messages > 1KB
        concurrencyLimit: 10,
        memLevel: 3 // Lower memory usage
      },
      // Connection limits for performance
      connectTimeout: 5000, // 5 second connection timeout
      upgradeTimeout: 3000, // 3 second upgrade timeout
      allowRequest: (req, callback) => {
        // Basic rate limiting for connection attempts
        const clientIP = req.socket.remoteAddress;
        const now = Date.now();
        
        if (!this.connectionAttempts) {
          this.connectionAttempts = new Map();
        }
        
        const attempts = this.connectionAttempts.get(clientIP) || { count: 0, resetTime: now + 60000 };
        
        if (now > attempts.resetTime) {
          attempts.count = 1;
          attempts.resetTime = now + 60000;
        } else {
          attempts.count++;
        }
        
        this.connectionAttempts.set(clientIP, attempts);
        
        // Allow max 10 connection attempts per minute per IP
        if (attempts.count > 10) {
          log.warn('WebSocket connection rate limit exceeded', { ip: clientIP, attempts: attempts.count });
          callback('Rate limit exceeded', false);
          return;
        }
        
        callback(null, true);
      }
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          log.warn('WebSocket connection attempt without token', {
            ip: socket.request.connection.remoteAddress,
            userAgent: socket.request.headers['user-agent']
          });
          return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Handle both userId and id fields for backward compatibility (same as auth middleware)
        const userId = decoded.userId || decoded.id;
        if (!userId) {
          log.warn('WebSocket token missing user ID', { decoded });
          return next(new Error('Invalid token format'));
        }
        
        const user = await User.findById(userId);
        
        if (!user) {
          log.warn('WebSocket connection attempt with invalid user', {
            userId: userId,
            ip: socket.request.connection.remoteAddress
          });
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.userData = {
          id: user._id.toString(),
          email: user.email,
          username: user.username || user.email.split('@')[0]
        };
        
        log.debug('WebSocket authentication successful', { userId: socket.userId });
        next();
      } catch (error) {
        log.error('WebSocket authentication error', error, {
          ip: socket.request.connection.remoteAddress,
          userAgent: socket.request.headers['user-agent']
        });
        next(new Error('Authentication failed'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      log.system(`WebSocket connection established for user: ${socket.userId}`);
      this.handleConnection(socket);
    });

    // Error handling
    this.io.on('connect_error', (error) => {
      log.error('WebSocket connection error', error);
    });

    this.io.engine.on('connection_error', (err) => {
      log.error('WebSocket engine connection error', err, {
        req: err.req,
        code: err.code,
        message: err.message,
        context: err.context
      });
    });

    // WebSocket service initialized successfully
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    log.system(`User connected: ${userId}`);

    // Store user connection with connection pooling awareness
    this.connectedUsers.set(userId, {
      socket,
      userData: socket.userData,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0, // Track message volume
      connectionId: `${userId}_${Date.now()}` // Unique connection identifier
    });
    
    // Clean up old connections for the same user (prevent connection leaks)
    this.cleanupOldUserConnections(userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      timestamp: new Date(),
      message: 'Connected successfully'
    });

    // Handle chat events
    this.setupChatHandlers(socket);
    
    // Handle room events
    this.setupRoomHandlers(socket);
    
    // Handle user presence
    this.setupPresenceHandlers(socket);
    
    // Handle emotional state updates
    this.setupEmotionalHandlers(socket);
    
    // Handle social posts events
    this.setupPostsHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Update user activity
    socket.on('activity', () => {
      this.updateUserActivity(userId);
    });
  }

  /**
   * Setup chat-related event handlers
   */
  setupChatHandlers(socket) {
    const userId = socket.userId;

    // Join chat room
    socket.on('join_chat', (data) => {
      const { roomId, roomType = 'general' } = data;
      socket.join(roomId);
      
      // Track user room membership
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId).add(roomId);

      log.debug(`User ${userId} joined room ${roomId}`);
      
      // Notify others in room
      socket.to(roomId).emit('user_joined', {
        userId,
        userData: socket.userData,
        timestamp: new Date()
      });
    });

    // Leave chat room
    socket.on('leave_chat', (data) => {
      const { roomId } = data;
      socket.leave(roomId);
      
      if (this.userRooms.has(userId)) {
        this.userRooms.get(userId).delete(roomId);
      }

      // Notify others in room
      socket.to(roomId).emit('user_left', {
        userId,
        userData: socket.userData,
        timestamp: new Date()
      });
    });

    // Handle real-time chat messages
    socket.on('chat_message', (data) => {
      const { roomId, message, messageType = 'text' } = data;
      
      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userData: socket.userData,
        message,
        messageType,
        timestamp: new Date(),
        roomId
      };

      // Broadcast to room
      this.io.to(roomId).emit('new_message', messageData);
      
      log.debug(`Message sent in room ${roomId} by user ${userId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user_typing', {
        userId,
        userData: socket.userData,
        timestamp: new Date()
      });
    });

    socket.on('typing_stop', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user_stopped_typing', {
        userId,
        timestamp: new Date()
      });
    });
  }

  /**
   * Setup room-related event handlers
   */
  setupRoomHandlers(socket) {
    const userId = socket.userId;

    // Create new room
    socket.on('create_room', (data) => {
      const { roomName, roomType = 'public', maxUsers = 50 } = data;
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      socket.join(roomId);
      
      const roomData = {
        id: roomId,
        name: roomName,
        type: roomType,
        createdBy: userId,
        createdAt: new Date(),
        maxUsers,
        currentUsers: 1
      };

      socket.emit('room_created', roomData);
      log.debug(`Room created: ${roomId} by user ${userId}`);
    });

    // Get room info
    socket.on('get_room_info', async (data) => {
      const { roomId } = data;
      const room = this.io.sockets.adapter.rooms.get(roomId);
      
      if (room) {
        const roomInfo = {
          id: roomId,
          userCount: room.size,
          users: Array.from(room).map(socketId => {
            const socket = this.io.sockets.sockets.get(socketId);
            return socket?.userData || null;
          }).filter(Boolean)
        };
        
        socket.emit('room_info', roomInfo);
      } else {
        socket.emit('room_not_found', { roomId });
      }
    });
  }

  /**
   * Setup presence-related event handlers
   */
  setupPresenceHandlers(socket) {
    const userId = socket.userId;

    // Update user status
    socket.on('update_status', (data) => {
      const { status, customMessage } = data;
      
      if (this.connectedUsers.has(userId)) {
        const userConnection = this.connectedUsers.get(userId);
        userConnection.status = status;
        userConnection.customMessage = customMessage;
        userConnection.lastActivity = new Date();
        
        // Broadcast status update to user's rooms
        if (this.userRooms.has(userId)) {
          this.userRooms.get(userId).forEach(roomId => {
            socket.to(roomId).emit('user_status_update', {
              userId,
              status,
              customMessage,
              timestamp: new Date()
            });
          });
        }
      }
    });

    // Get online users
    socket.on('get_online_users', () => {
      const onlineUsers = Array.from(this.connectedUsers.entries()).map(([uid, connection]) => ({
        userId: uid,
        userData: connection.userData,
        status: connection.status || 'online',
        customMessage: connection.customMessage,
        lastActivity: connection.lastActivity
      }));

      socket.emit('online_users', onlineUsers);
    });
  }

  /**
   * Setup social posts event handlers
   */
  setupPostsHandlers(socket) {
    const userId = socket.userId;

    // Join global posts room for live updates
    socket.join('posts:global');

    // Join community-specific posts rooms
    socket.on('join_community', (data) => {
      const { community } = data;
      if (community) {
        socket.join(`posts:${community}`);
        log.debug(`User ${userId} joined community room: ${community}`);
      }
    });

    // Leave community posts room
    socket.on('leave_community', (data) => {
      const { community } = data;
      if (community) {
        socket.leave(`posts:${community}`);
        log.debug(`User ${userId} left community room: ${community}`);
      }
    });

    // Real-time post engagement (likes, reactions)
    socket.on('post_reaction', (data) => {
      const { postId, reactionType, action } = data; // action: 'add' or 'remove'
      
      const reactionData = {
        postId,
        userId,
        userData: socket.userData,
        reactionType,
        action,
        timestamp: new Date()
      };

      // Broadcast to all users viewing posts
      this.io.to('posts:global').emit('post_reaction_update', reactionData);
      log.debug(`Post reaction ${action} by user ${userId}: ${reactionType} on post ${postId}`);
    });

    // Real-time comment notifications
    socket.on('comment_notification', (data) => {
      const { postId, postAuthorId, commentContent } = data;
      
      // Notify the post author if they're online
      if (postAuthorId && postAuthorId !== userId) {
        this.sendToUser(postAuthorId, 'new_comment_notification', {
          postId,
          commenterId: userId,
          commenterData: socket.userData,
          commentContent: commentContent.slice(0, 100) + (commentContent.length > 100 ? '...' : ''),
          timestamp: new Date()
        });
      }
    });

    // Live post viewing (for real-time engagement metrics)
    socket.on('view_post', (data) => {
      const { postId } = data;
      
      // Update viewing metrics - could be stored in Redis for real-time analytics
      const viewData = {
        postId,
        userId,
        timestamp: new Date()
      };

      // Broadcast view count updates to other users viewing the same post
      socket.to(`post:${postId}`).emit('post_view_update', {
        postId,
        viewerCount: 1 // You could implement actual counting logic
      });
    });

    // Join specific post room for detailed view
    socket.on('join_post', (data) => {
      const { postId } = data;
      socket.join(`post:${postId}`);
      log.debug(`User ${userId} joined post room: ${postId}`);
    });

    // Leave specific post room
    socket.on('leave_post', (data) => {
      const { postId } = data;
      socket.leave(`post:${postId}`);
      log.debug(`User ${userId} left post room: ${postId}`);
    });
  }

  /**
   * Setup emotional state event handlers
   */
  setupEmotionalHandlers(socket) {
    const userId = socket.userId;

    // Real-time emotion updates
    socket.on('emotion_update', (data) => {
      const { emotion, intensity, context } = data;
      
      const emotionData = {
        userId,
        emotion,
        intensity,
        context,
        timestamp: new Date()
      };

      // Broadcast to user's personal room and any group rooms if opted in
      socket.to(`user:${userId}`).emit('emotion_updated', emotionData);
      
      // If user is in cloud events, broadcast to those rooms
      if (this.userRooms.has(userId)) {
        this.userRooms.get(userId).forEach(roomId => {
          if (roomId.startsWith('cloud_event_')) {
            socket.to(roomId).emit('user_emotion_update', {
              userId,
              userData: socket.userData,
              emotion,
              intensity,
              timestamp: new Date()
            });
          }
        });
      }

      log.debug(`Emotion update from user ${userId}: ${emotion} (${intensity})`);
    });

    // Live emotional sharing with trusted contacts
    socket.on('share_emotional_state', async (data) => {
      const { targetUserId, emotion, intensity, message, shareType } = data;
      
      // Validate sharing permission (you could add a friends/trust system)
      const shareData = {
        fromUserId: userId,
        fromUser: socket.userData,
        emotion,
        intensity,
        message,
        shareType, // 'check_in', 'support_request', 'celebration'
        timestamp: new Date()
      };

      // Send to specific user
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('emotional_share_received', shareData);
        log.debug(`Emotional state shared from ${userId} to ${targetUserId}: ${emotion}`);
      }

      // Confirm sharing to sender
      socket.emit('emotional_share_sent', {
        targetUserId,
        emotion,
        timestamp: new Date()
      });
    });

    // Support request broadcasting
    socket.on('request_support', (data) => {
      const { intensity, context, anonymous } = data;
      
      const supportRequest = {
        userId: anonymous ? null : userId,
        userData: anonymous ? null : socket.userData,
        intensity,
        context,
        timestamp: new Date(),
        id: `support_${Date.now()}_${userId.slice(-4)}`
      };

      // Broadcast to support network (could be moderators/volunteers)
      this.io.to('support_network').emit('support_request', supportRequest);
      
      socket.emit('support_request_sent', {
        message: 'Your support request has been sent to available helpers',
        timestamp: new Date()
      });

      log.system(`Support request from user ${userId} (anonymous: ${anonymous})`);
    });

    // Real-time growth milestone celebrations
    socket.on('celebrate_milestone', (data) => {
      const { milestoneId, title, shareWithCommunity } = data;
      
      const celebration = {
        userId,
        userData: socket.userData,
        milestoneId,
        title,
        timestamp: new Date()
      };

      if (shareWithCommunity) {
        // Broadcast to community celebration room
        this.io.to('community_celebrations').emit('milestone_achieved', celebration);
      }

      // Send back to user for confirmation
      socket.emit('milestone_celebrated', {
        milestoneId,
        timestamp: new Date(),
        message: shareWithCommunity ? 'Milestone shared with community!' : 'Milestone celebrated privately!'
      });

      log.debug(`Milestone celebrated by user ${userId}: ${title}`);
    });
  }

  /**
   * Clean up old connections for a user (prevent memory leaks)
   */
  cleanupOldUserConnections(userId, currentSocketId) {
    // Check if user already has connections and disconnect old ones
    for (const [connectedUserId, connection] of this.connectedUsers.entries()) {
      if (connectedUserId === userId && connection.socket.id !== currentSocketId) {
        log.debug(`Cleaning up old connection for user ${userId}`);
        connection.socket.disconnect(true);
        this.connectedUsers.delete(connectedUserId);
      }
    }
  }

  /**
   * Handle user disconnection (optimized)
   */
  handleDisconnection(socket) {
    const userId = socket.userId;
    log.system(`User disconnected: ${userId}`);

    // Get connection info before cleanup
    const connection = this.connectedUsers.get(userId);
    const sessionDuration = connection ? Date.now() - connection.connectedAt.getTime() : 0;
    const messageCount = connection ? connection.messageCount : 0;

    // Remove from connected users
    this.connectedUsers.delete(userId);

    // Batch notify all rooms user was in (more efficient)
    if (this.userRooms.has(userId)) {
      const userRoomsList = Array.from(this.userRooms.get(userId));
      const disconnectionData = {
        userId,
        userData: socket.userData,
        timestamp: new Date(),
        sessionDuration,
        messageCount
      };
      
      // Single emit to all rooms
      userRoomsList.forEach(roomId => {
        socket.to(roomId).emit('user_disconnected', disconnectionData);
      });
      
      // Clean up user rooms
      this.userRooms.delete(userId);
    }
    
    log.debug(`Session stats for ${userId}: ${sessionDuration}ms duration, ${messageCount} messages`);
  }

  /**
   * Update user activity timestamp
   */
  updateUserActivity(userId) {
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).lastActivity = new Date();
    }
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, event, data) {
    if (this.isUserConnected(userId)) {
      this.io.to(`user:${userId}`).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Send message to room
   */
  sendToRoom(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }

  /**
   * Broadcast to all connected users
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Emit to all connected users (alias for broadcast)
   */
  emitToAll(event, data) {
    this.broadcast(event, data);
    log.debug(`Broadcasting event: ${event} to all users`);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get user connection info
   */
  getUserConnection(userId) {
    return this.connectedUsers.get(userId) || null;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get room members
   */
  getRoomMembers(roomId) {
    const room = this.io.sockets.adapter.rooms.get(roomId);
    if (!room) return [];
    
    return Array.from(room).map(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      return socket?.userData || null;
    }).filter(Boolean);
  }

  /**
   * Force disconnect user
   */
  disconnectUser(userId, reason = 'Server disconnect') {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.socket.disconnect(reason);
    }
  }

  /**
   * Get server statistics
   */
  getServerStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.io?.sockets?.adapter?.rooms?.size || 0,
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}

// Export singleton instance
export default new WebSocketService();