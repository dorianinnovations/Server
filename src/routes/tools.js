import express from 'express';
import toolExecutor from '../services/toolExecutor.js';
import toolRegistry from '../services/toolRegistry.js';
import triggerSystem from '../services/triggerSystem.js';
import CreditPool from '../models/CreditPool.js';
import User from '../models/User.js';
import { protect as authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/available', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const creditPool = await CreditPool.findOne({ userId: req.user.id });
    
    const userContext = {
      userId: req.user.id,
      user: user,
      creditPool: creditPool,
    };
    
    const tools = toolExecutor.getAvailableTools(userContext);
    
    res.json({
      success: true,
      tools: tools,
      userContext: {
        hasAuth: !!user,
        hasCreditPool: !!creditPool,
        creditBalance: creditPool?.balance || 0,
      },
    });
  } catch (error) {
    console.error('Error getting available tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available tools',
    });
  }
});

router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const { toolName, arguments: args, userContext: clientUserContext } = req.body;
    
    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
      });
    }
    
    const user = await User.findById(req.user.id);
    const creditPool = await CreditPool.findOne({ userId: req.user.id });
    
    // Merge server userContext with client-provided userContext (e.g., location data)
    const userContext = {
      userId: req.user.id,
      user: user,
      creditPool: creditPool,
      ...clientUserContext, // Include location and other client context
    };
    
    const toolCall = {
      function: {
        name: toolName,
        arguments: args || {},
      },
    };
    
    // Use mocked tool executor in test environment
    const executor = req.app.locals.toolExecutor || toolExecutor;
    const result = await executor.executeToolCall(toolCall, userContext);
    
    res.json({
      success: true,
      result: result,
    });
  } catch (error) {
    console.error('Error executing tool:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute tool',
    });
  }
});

router.post('/chat-with-tools', authMiddleware, async (req, res) => {
  try {
    const { messages, options = {} } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
      });
    }
    
    const user = await User.findById(req.user.id);
    const creditPool = await CreditPool.findOne({ userId: req.user.id });
    
    const userContext = {
      userId: req.user.id,
      user: user,
      creditPool: creditPool,
    };
    
    const response = await toolExecutor.processWithTools(messages, userContext, options);
    
    res.json({
      success: true,
      response: response,
    });
  } catch (error) {
    console.error('Error in chat with tools:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat with tools',
    });
  }
});

router.post('/trigger-event', authMiddleware, async (req, res) => {
  try {
    const { eventType, data, metadata = {} } = req.body;
    
    if (!eventType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Event type and data are required',
      });
    }
    
    const event = await triggerSystem.addUserEvent(
      req.user.id,
      eventType,
      data,
      metadata
    );
    
    res.json({
      success: true,
      event: event,
      message: 'Event added to trigger system',
    });
  } catch (error) {
    console.error('Error triggering event:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger event',
    });
  }
});

router.get('/registry', authMiddleware, async (req, res) => {
  try {
    const tools = await toolRegistry.getAllTools();
    
    res.json({
      success: true,
      tools: tools,
    });
  } catch (error) {
    console.error('Error getting tool registry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tool registry',
    });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const toolStats = await toolRegistry.getToolStats();
    const executorStats = toolExecutor.getToolStatus();
    const triggerStats = triggerSystem.getStats();
    
    res.json({
      success: true,
      stats: {
        registry: toolStats,
        executor: executorStats,
        triggers: triggerStats,
      },
    });
  } catch (error) {
    console.error('Error getting tool stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tool stats',
    });
  }
});

router.put('/registry/:toolName/enable', authMiddleware, async (req, res) => {
  try {
    const { toolName } = req.params;
    await toolRegistry.enableTool(toolName);
    
    res.json({
      success: true,
      message: `Tool ${toolName} enabled`,
    });
  } catch (error) {
    console.error('Error enabling tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable tool',
    });
  }
});

router.put('/registry/:toolName/disable', authMiddleware, async (req, res) => {
  try {
    const { toolName } = req.params;
    await toolRegistry.disableTool(toolName);
    
    res.json({
      success: true,
      message: `Tool ${toolName} disabled`,
    });
  } catch (error) {
    console.error('Error disabling tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable tool',
    });
  }
});

router.put('/registry/:toolName/cost', authMiddleware, async (req, res) => {
  try {
    const { toolName } = req.params;
    const { cost } = req.body;
    
    if (typeof cost !== 'number' || cost < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid cost amount is required',
      });
    }
    
    await toolRegistry.updateToolCost(toolName, cost);
    
    res.json({
      success: true,
      message: `Tool ${toolName} cost updated to $${cost}`,
    });
  } catch (error) {
    console.error('Error updating tool cost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tool cost',
    });
  }
});

router.get('/credit-pool', authMiddleware, async (req, res) => {
  try {
    let creditPool = await CreditPool.findOne({ userId: req.user.id });
    
    if (!creditPool) {
      creditPool = new CreditPool({
        userId: req.user.id,
        balance: 0,
        isActive: true,
        isVerified: false,
      });
      await creditPool.save();
    }
    
    res.json({
      success: true,
      creditPool: {
        balance: creditPool.balance,
        currency: creditPool.currency,
        isActive: creditPool.isActive,
        isVerified: creditPool.isVerified,
        settings: creditPool.settings,
        recentTransactions: creditPool.transactions
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Error getting credit pool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit pool',
    });
  }
});

export default router;