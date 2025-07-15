import toolExecutor from './toolExecutor.js';
import Tool from '../models/Tool.js';
import UserEvent from '../models/UserEvent.js';
import User from '../models/User.js';
import CreditPool from '../models/CreditPool.js';

class TriggerSystem {
  constructor() {
    this.eventQueue = [];
    this.processingInterval = null;
    this.isProcessing = false;
    this.startProcessing();
  }

  startProcessing() {
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, 5000); // Process every 5 seconds
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async addEvent(eventData) {
    const event = new UserEvent(eventData);
    await event.save();
    
    this.eventQueue.push(event);
    
    if (!this.isProcessing) {
      this.processEventQueue();
    }
    
    return event;
  }

  async processEventQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const event = this.eventQueue.shift();
      await this.processEvent(event);
    } catch (error) {
      console.error('Error processing event:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processEvent(event) {
    const tools = await Tool.find({ 
      enabled: true,
      'triggers.eventType': event.type 
    });

    for (const tool of tools) {
      const matchingTriggers = tool.triggers.filter(trigger => 
        trigger.eventType === event.type
      );

      for (const trigger of matchingTriggers) {
        if (await this.evaluateTriggerConditions(trigger, event)) {
          await this.executeTrigger(tool, trigger, event);
        }
      }
    }
  }

  async evaluateTriggerConditions(trigger, event) {
    const conditions = trigger.conditions;
    
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [key, condition] of Object.entries(conditions)) {
      const eventValue = this.getNestedValue(event, key);
      
      if (!this.evaluateCondition(eventValue, condition)) {
        return false;
      }
    }

    return true;
  }

  evaluateCondition(value, condition) {
    if (typeof condition === 'string' || typeof condition === 'number' || typeof condition === 'boolean') {
      return value === condition;
    }

    if (typeof condition === 'object' && condition !== null) {
      if (condition.$eq !== undefined) return value === condition.$eq;
      if (condition.$ne !== undefined) return value !== condition.$ne;
      if (condition.$gt !== undefined) return value > condition.$gt;
      if (condition.$gte !== undefined) return value >= condition.$gte;
      if (condition.$lt !== undefined) return value < condition.$lt;
      if (condition.$lte !== undefined) return value <= condition.$lte;
      if (condition.$in !== undefined) return condition.$in.includes(value);
      if (condition.$nin !== undefined) return !condition.$nin.includes(value);
      if (condition.$regex !== undefined) {
        const regex = new RegExp(condition.$regex, condition.$options || '');
        return regex.test(value);
      }
    }

    return false;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  async executeTrigger(tool, trigger, event) {
    try {
      const user = await User.findById(event.userId);
      if (!user) {
        console.error(`User not found for event: ${event._id}`);
        return;
      }

      const creditPool = await CreditPool.findOne({ userId: user._id });
      
      const userContext = {
        userId: user._id,
        user: user,
        creditPool: creditPool,
        event: event,
        trigger: trigger,
      };

      const toolCall = {
        function: {
          name: tool.name,
          arguments: this.generateToolArguments(tool, event, user),
        },
      };

      console.log(`Executing trigger for tool: ${tool.name}, event: ${event.type}`);
      
      const result = await toolExecutor.executeToolCall(toolCall, userContext);
      
      console.log(`Trigger executed successfully: ${tool.name}`, result);
      
      await this.recordTriggerExecution(tool, trigger, event, result, 'success');
      
    } catch (error) {
      console.error(`Error executing trigger for tool: ${tool.name}`, error);
      await this.recordTriggerExecution(tool, trigger, event, null, 'error', error.message);
    }
  }

  generateToolArguments(tool, event, user) {
    const args = {};
    
    if (tool.schema && tool.schema.properties) {
      for (const [propName, propSchema] of Object.entries(tool.schema.properties)) {
        if (propSchema.source === 'event') {
          args[propName] = this.getNestedValue(event, propSchema.path || propName);
        } else if (propSchema.source === 'user') {
          args[propName] = this.getNestedValue(user, propSchema.path || propName);
        } else if (propSchema.default !== undefined) {
          args[propName] = propSchema.default;
        }
      }
    }

    return args;
  }

  async recordTriggerExecution(tool, trigger, event, result, status, errorMessage = null) {
    const execution = {
      toolName: tool.name,
      triggerType: trigger.eventType,
      eventId: event._id,
      userId: event.userId,
      status: status,
      result: result,
      errorMessage: errorMessage,
      timestamp: new Date(),
    };

    await UserEvent.findByIdAndUpdate(event._id, {
      $push: { triggerExecutions: execution },
    });
  }

  async addUserEvent(userId, eventType, data, metadata = {}) {
    const eventData = {
      type: eventType,
      userId: userId,
      data: data,
      metadata: metadata,
      timestamp: new Date(),
    };

    return await this.addEvent(eventData);
  }

  async addUserAction(userId, action, context = {}) {
    return await this.addUserEvent(userId, 'user_action', {
      action: action,
      context: context,
    });
  }

  async addUserDataUpdate(userId, dataType, oldValue, newValue, metadata = {}) {
    return await this.addUserEvent(userId, 'user_data_update', {
      dataType: dataType,
      oldValue: oldValue,
      newValue: newValue,
    }, metadata);
  }

  async addUserPreferenceChange(userId, preference, value, metadata = {}) {
    return await this.addUserEvent(userId, 'user_preference_change', {
      preference: preference,
      value: value,
    }, metadata);
  }

  async addUserBehaviorPattern(userId, pattern, confidence, metadata = {}) {
    return await this.addUserEvent(userId, 'user_behavior_pattern', {
      pattern: pattern,
      confidence: confidence,
    }, metadata);
  }

  async registerCustomTrigger(toolName, triggerConfig) {
    const tool = await Tool.findOne({ name: toolName });
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    tool.triggers.push(triggerConfig);
    await tool.save();
    
    return tool;
  }

  async removeTrigger(toolName, triggerIndex) {
    const tool = await Tool.findOne({ name: toolName });
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    if (triggerIndex >= 0 && triggerIndex < tool.triggers.length) {
      tool.triggers.splice(triggerIndex, 1);
      await tool.save();
    }

    return tool;
  }

  getStats() {
    return {
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export default new TriggerSystem();