import { createLLMService } from './llmService.js';
import Tool from '../models/Tool.js';
import CreditPool from '../models/CreditPool.js';
import Task from '../models/Task.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ToolExecutor {
  constructor() {
    this.llmService = createLLMService();
    this.toolCache = new Map();
    this.toolRateLimits = new Map(); // Per-tool rate limiting
    // loadTools() will be called from toolRegistry.initialize()
  }

  /**
   * Check per-tool rate limits (prevents rapid-fire expensive tool usage)
   */
  checkToolRateLimit(toolName, userId) {
    const key = `${toolName}:${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxCallsPerTool = 5; // 5 calls per tool per minute per user
    
    const limitData = this.toolRateLimits.get(key) || {
      count: 0,
      resetTime: now + windowMs
    };
    
    // Reset if window expired
    if (now > limitData.resetTime) {
      limitData.count = 0;
      limitData.resetTime = now + windowMs;
    }
    
    if (limitData.count >= maxCallsPerTool) {
      const remainingMs = limitData.resetTime - now;
      throw new Error(`Tool rate limit exceeded: ${toolName} limited to ${maxCallsPerTool} calls per minute. Try again in ${Math.ceil(remainingMs / 1000)} seconds.`);
    }
    
    // Increment counter
    limitData.count++;
    this.toolRateLimits.set(key, limitData);
    
    console.log(`🔧 Tool rate limit: ${toolName} - ${limitData.count}/${maxCallsPerTool} calls used`);
  }

  async loadTools() {
    try {
      // Wait for database connection to be ready
      const mongoose = await import('mongoose');
      while (mongoose.default.connection.readyState !== 1) {
        console.log('ToolExecutor waiting for database connection...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const tools = await Tool.find({ enabled: true });
      this.toolCache.clear();
      
      for (const tool of tools) {
        this.toolCache.set(tool.name, tool);
      }
      
      console.log(`🔧 TOOLS: ${tools.length} loaded`);
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  }

  getAvailableTools(userContext = {}) {
    const tools = [];
    
    for (const [name, tool] of this.toolCache) {
      if (this.isToolAvailable(tool, userContext)) {
        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.schema,
          },
        });
      }
    }
    
    return tools;
  }

  isToolAvailable(tool, userContext) {
    console.log(`🔍 TOOL AVAILABILITY CHECK: ${tool.name}`, {
      enabled: tool.enabled,
      requiresAuth: tool.requiresAuth,
      userId: userContext.userId,
      requiresPayment: tool.requiresPayment,
      hasCreditPool: !!userContext.creditPool
    });
    
    if (!tool.enabled) {
      console.log(`❌ Tool ${tool.name} is disabled`);
      return false;
    }
    
    if (tool.requiresAuth && !userContext.userId) {
      console.log(`❌ Tool ${tool.name} requires auth but no userId`);
      return false;
    }
    
    // TEMPORARILY DISABLED: Allow all tools for testing performance and UBPM analysis
    // Subscription gating completely disabled for premium speed testing
    // if (tool.name !== 'credit_management' && userContext.user && !userContext.user.hasActiveNuminaTrace()) {
    //   return false;
    // }
    
    // TEMPORARILY DISABLED: Payment requirements for testing
    // if (tool.requiresPayment && !userContext.creditPool) return false;
    
    console.log(`✅ Tool ${tool.name} is available`);
    return true;
  }

  async executeToolCall(toolCall, userContext) {
    const { name, arguments: args } = toolCall.function;
    const tool = this.toolCache.get(name);
    
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    // COST PROTECTION: Check per-tool rate limits
    if (userContext.userId) {
      this.checkToolRateLimit(name, userContext.userId);
    }

    if (!this.isToolAvailable(tool, userContext)) {
      // Check specific reason why tool is not available
      // TODO: Re-enable subscription error after subscription system is fixed
      // if (tool.name !== 'credit_management' && userContext.user && !userContext.user.hasActiveNuminaTrace()) {
      //   throw new Error(`This feature requires a Numina Trace subscription. Please subscribe in the wallet to unlock all AI tools and features.`);
      // }
      throw new Error(`Tool ${name} is not available for this user`);
    }

    const taskId = await this.createTask(name, args, userContext.userId);
    
    try {
      // TEMPORARILY DISABLED: Payment requirements for testing
      // if (tool.requiresPayment) {
      //   const creditPool = userContext.creditPool || await CreditPool.findOne({ userId: userContext.userId });
      //   if (!creditPool || !creditPool.canSpend(tool.costPerExecution)) {
      //     throw new Error('Insufficient credits or spending limit exceeded');
      //   }
      // }

      const result = await this.runToolImplementation(tool, args, userContext);
      
      // TEMPORARILY DISABLED: Credit deduction for testing
      // if (tool.requiresPayment && result.success) {
      //   await this.deductCredits(userContext.userId, tool.costPerExecution, tool.name, taskId);
      // }

      await this.updateTask(taskId, 'completed', result);
      // await this.updateToolMetrics(tool.name, true); // Temporarily disabled for optimization
      
      return {
        success: true,
        result: result,
        taskId: taskId,
      };
    } catch (error) {
      await this.updateTask(taskId, 'failed', { error: error.message });
      // await this.updateToolMetrics(tool.name, false); // Temporarily disabled for optimization
      
      throw error;
    }
  }

  async runToolImplementation(tool, args, userContext) {
    const toolsDir = path.join(__dirname, '..', 'tools');
    const toolPath = path.join(toolsDir, `${tool.implementation}.js`);
    
    if (!fs.existsSync(toolPath)) {
      throw new Error(`Tool implementation not found: ${tool.implementation}`);
    }

    const toolModule = await import(toolPath);
    const toolImplementation = toolModule.default || toolModule;
    
    if (typeof toolImplementation !== 'function') {
      throw new Error(`Invalid tool implementation: ${tool.implementation}`);
    }

    return await toolImplementation(args, userContext);
  }

  async createTask(toolName, args, userId) {
    const task = new Task({
      taskType: `tool_execution_${toolName}`,
      userId: userId,
      status: 'processing',
      priority: 5,
      parameters: new Map([
        ['toolName', toolName],
        ['arguments', args],
        ['executionType', 'tool_call'],
      ]),
    });

    await task.save();
    return task._id;
  }

  async updateTask(taskId, status, result = null) {
    const update = {
      status: status,
    };

    if (result) {
      update.result = JSON.stringify(result);
    }

    await Task.findByIdAndUpdate(taskId, update);
  }

  async updateToolMetrics(toolName, success) {
    const tool = await Tool.findOne({ name: toolName });
    if (!tool) return;

    const currentExecutionCount = tool.meta?.executionCount || 0;
    const currentSuccessRate = tool.meta?.successRate || 0;
    const totalExecutions = currentExecutionCount + 1;
    
    const previousSuccesses = Math.round(currentSuccessRate * currentExecutionCount);
    const newSuccesses = previousSuccesses + (success ? 1 : 0);
    const newSuccessRate = newSuccesses / totalExecutions;
    
    await Tool.findOneAndUpdate(
      { name: toolName },
      {
        'meta.executionCount': totalExecutions,
        'meta.successRate': newSuccessRate,
        'meta.lastUpdated': new Date()
      }
    );
  }

  async deductCredits(userId, amount, toolName, taskId) {
    const creditPool = await CreditPool.findOne({ userId: userId });
    if (!creditPool) {
      throw new Error('Credit pool not found');
    }

    await creditPool.deductBalance(
      amount,
      `Tool execution: ${toolName}`,
      toolName,
      taskId
    );
  }

  async processWithTools(messages, userContext, options = {}) {
    const tools = this.getAvailableTools(userContext);
    
    if (tools.length === 0) {
      return await this.llmService.makeLLMRequest(messages, options);
    }

    const response = await this.llmService.makeLLMRequest(messages, {
      ...options,
      tools: tools,
      tool_choice: options.tool_choice || 'auto',
    });

    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolResults = [];
      
      for (const toolCall of response.tool_calls) {
        try {
          const result = await this.executeToolCall(toolCall, userContext);
          toolResults.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({ error: error.message }),
          });
        }
      }

      const updatedMessages = [
        ...messages,
        response,
        ...toolResults.map(result => ({
          role: 'tool',
          content: result.output,
          tool_call_id: result.tool_call_id,
        })),
      ];

      return await this.llmService.makeLLMRequest(updatedMessages, {
        ...options,
        tools: undefined,
        tool_choice: undefined,
      });
    }

    return response;
  }

  async registerTool(toolConfig) {
    const tool = new Tool(toolConfig);
    await tool.save();
    this.toolCache.set(tool.name, tool);
    
    return tool;
  }

  async unregisterTool(toolName) {
    await Tool.findOneAndUpdate(
      { name: toolName },
      { enabled: false }
    );
    this.toolCache.delete(toolName);
  }

  getToolStatus() {
    return {
      totalTools: this.toolCache.size,
      tools: Array.from(this.toolCache.values()).map(tool => ({
        name: tool.name,
        category: tool.category,
        enabled: tool.enabled,
        executionCount: tool.meta?.executionCount || 0,
        successRate: tool.meta?.successRate || 0,
      })),
    };
  }
}

export default new ToolExecutor();