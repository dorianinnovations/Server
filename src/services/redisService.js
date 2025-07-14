import Redis from 'ioredis';
import logger from '../utils/logger.js';

/**
 * Redis Service for Caching and Session Management
 * Handles distributed caching, session storage, and real-time data
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      // Skip Redis initialization if disabled or in production without Redis URL
      if (process.env.REDIS_DISABLED === 'true' || 
          (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL)) {
        logger.info('Redis disabled, using in-memory fallback');
        this.isConnected = false;
        this.client = new Map();
        return false;
      }

      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 2000,
        commandTimeout: 1000,
        family: 4,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          // Stop retrying after 3 attempts
          if (times > 3) {
            return null;
          }
          return Math.min(times * 1000, 3000);
        }
      };

      // Add Redis URL support for cloud deployment
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          keepAlive: 30000,
          connectTimeout: 2000,
          commandTimeout: 1000,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 1000, 3000);
          }
        });
      } else {
        this.client = new Redis(redisConfig);
      }

      // Connection event handlers
      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.client.on('error', (error) => {
        if (this.retryCount === 0) {
          logger.error('Redis connection failed, switching to in-memory fallback');
        }
        this.isConnected = false;
        this.retryCount++;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        // Suppress reconnection logs to avoid spam
      });

      // Test connection
      await this.client.ping();
      logger.info('Redis service initialized successfully');
      
    } catch (error) {
      logger.warn('Redis unavailable, using in-memory cache fallback');
      
      // Clean up any existing client to prevent further reconnection attempts
      if (this.client && typeof this.client.disconnect === 'function') {
        this.client.disconnect();
      }
      
      // Fallback to in-memory cache if Redis fails
      this.client = new Map();
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected() {
    return this.isConnected && this.client && typeof this.client.ping === 'function';
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      if (!this.isRedisConnected()) {
        return this.client instanceof Map ? this.client.get(key) : null;
      }
      
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key, value, ttlSeconds = null) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          this.client.set(key, value);
          if (ttlSeconds) {
            setTimeout(() => this.client.delete(key), ttlSeconds * 1000);
          }
        }
        return true;
      }
      
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key) {
    try {
      if (!this.isRedisConnected()) {
        return this.client instanceof Map ? this.client.delete(key) : false;
      }
      
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (!this.isRedisConnected()) {
        return this.client instanceof Map ? this.client.has(key) : false;
      }
      
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          return keys.map(key => this.client.get(key));
        }
        return [];
      }
      
      const values = await this.client.mget(...keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error(`Redis MGET error:`, error);
      return [];
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          Object.entries(keyValuePairs).forEach(([key, value]) => {
            this.client.set(key, value);
          });
        }
        return true;
      }
      
      const serializedPairs = {};
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        serializedPairs[key] = JSON.stringify(value);
      });
      
      await this.client.mset(serializedPairs);
      return true;
    } catch (error) {
      logger.error(`Redis MSET error:`, error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key, amount = 1) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const current = this.client.get(key) || 0;
          const newValue = current + amount;
          this.client.set(key, newValue);
          return newValue;
        }
        return 0;
      }
      
      if (amount === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, amount);
      }
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set expiration time for key
   */
  async expire(key, seconds) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          setTimeout(() => this.client.delete(key), seconds * 1000);
        }
        return true;
      }
      
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get time to live for key
   */
  async ttl(key) {
    try {
      if (!this.isRedisConnected()) {
        return -1; // No TTL support in Map fallback
      }
      
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Add to set
   */
  async sadd(key, ...members) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const set = this.client.get(key) || new Set();
          members.forEach(member => set.add(member));
          this.client.set(key, set);
          return members.length;
        }
        return 0;
      }
      
      return await this.client.sadd(key, ...members);
    } catch (error) {
      logger.error(`Redis SADD error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all members of set
   */
  async smembers(key) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const set = this.client.get(key);
          return set ? Array.from(set) : [];
        }
        return [];
      }
      
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Remove from set
   */
  async srem(key, ...members) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const set = this.client.get(key);
          if (set) {
            members.forEach(member => set.delete(member));
            this.client.set(key, set);
          }
          return members.length;
        }
        return 0;
      }
      
      return await this.client.srem(key, ...members);
    } catch (error) {
      logger.error(`Redis SREM error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key, member) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const set = this.client.get(key);
          return set ? set.has(member) : false;
        }
        return false;
      }
      
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      logger.error(`Redis SISMEMBER error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Add to sorted set
   */
  async zadd(key, score, member) {
    try {
      if (!this.isRedisConnected()) {
        // Simple fallback for sorted sets
        if (this.client instanceof Map) {
          const sortedSet = this.client.get(key) || [];
          const existing = sortedSet.find(item => item.member === member);
          if (existing) {
            existing.score = score;
          } else {
            sortedSet.push({ score, member });
          }
          sortedSet.sort((a, b) => b.score - a.score);
          this.client.set(key, sortedSet);
          return 1;
        }
        return 0;
      }
      
      return await this.client.zadd(key, score, member);
    } catch (error) {
      logger.error(`Redis ZADD error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get range from sorted set
   */
  async zrange(key, start, stop, withScores = false) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          const sortedSet = this.client.get(key) || [];
          const slice = sortedSet.slice(start, stop + 1);
          return withScores ? slice.flatMap(item => [item.member, item.score]) : slice.map(item => item.member);
        }
        return [];
      }
      
      if (withScores) {
        return await this.client.zrange(key, start, stop, 'WITHSCORES');
      } else {
        return await this.client.zrange(key, start, stop);
      }
    } catch (error) {
      logger.error(`Redis ZRANGE error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern) {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          return Array.from(this.client.keys()).filter(key => 
            key.includes(pattern.replace('*', ''))
          );
        }
        return [];
      }
      
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Flush all data
   */
  async flushall() {
    try {
      if (!this.isRedisConnected()) {
        if (this.client instanceof Map) {
          this.client.clear();
        }
        return true;
      }
      
      await this.client.flushall();
      return true;
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  /**
   * Get database size
   */
  async dbsize() {
    try {
      if (!this.isRedisConnected()) {
        return this.client instanceof Map ? this.client.size : 0;
      }
      
      return await this.client.dbsize();
    } catch (error) {
      logger.error('Redis DBSIZE error:', error);
      return 0;
    }
  }

  /**
   * Close connection
   */
  async close() {
    try {
      if (this.isRedisConnected()) {
        await this.client.quit();
      }
      this.isConnected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      client: this.client ? 'Redis' : 'Map fallback'
    };
  }
}

// Export singleton instance
export default new RedisService();