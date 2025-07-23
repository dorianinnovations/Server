import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import User from '../models/User.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import SandboxSession from '../models/SandboxSession.js';
import LockedNode from '../models/LockedNode.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import { checkTierLimits, requireFeature } from '../middleware/tierLimiter.js';
import logger from '../utils/logger.js';
import chainOfThoughtEngine from '../services/chainOfThoughtEngine.js';
import aiActivityMonitor from '../services/aiActivityMonitor.js';

const router = express.Router();
const llmService = createLLMService();

// Simple test route to verify sandbox routes are loading
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Sandbox routes are working!' });
});

// Test route with auth to debug the auth issue
router.get('/auth-test', protect, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sandbox auth working!',
    user: { id: req.user?.id || req.user?._id }
  });
});

/**
 * POST /sandbox/generate-nodes
 * Generate AI-powered discovery nodes based on user query and context
 */
router.post('/generate-nodes', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { query, selectedActions, lockedContext, useUBPM, userData } = req.body;

    logger.debug('Sandbox generate-nodes request', { 
      userId, 
      query: query?.substring(0, 100),
      actionsCount: selectedActions?.length,
      lockedNodesCount: lockedContext?.length,
      useUBPM 
    });

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    if (!selectedActions || !Array.isArray(selectedActions) || selectedActions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selected actions are required'
      });
    }

    // Get user data for personalization
    const user = await User.findById(userId);
    let userBehaviorProfile = null;
    
    if (useUBPM) {
      try {
        userBehaviorProfile = await UserBehaviorProfile.findOne({ userId });
      } catch (error) {
        logger.warn('Failed to fetch user behavior profile', { userId, error: error.message });
      }
    }

    // Build context for AI
    let contextPrompt = `User is exploring: "${query}"\n\nSelected actions: ${selectedActions.join(', ')}\n\n`;
    
    if (lockedContext && lockedContext.length > 0) {
      contextPrompt += `Locked context nodes:\n`;
      lockedContext.forEach((node, index) => {
        contextPrompt += `${index + 1}. ${node.title}: ${node.content}\n`;
        if (node.personalHook) {
          contextPrompt += `   Personal connection: ${node.personalHook}\n`;
        }
      });
      contextPrompt += '\n';
    }

    // Add user behavior context if available
    if (userBehaviorProfile) {
      contextPrompt += `User preferences: ${userBehaviorProfile.preferences?.interests?.join(', ') || 'None specified'}\n`;
      contextPrompt += `Learning style: ${userBehaviorProfile.behaviorMetrics?.learningStyle || 'Not determined'}\n\n`;
    }

    // Create enhanced AI prompt for node generation
    const aiPrompt = `${contextPrompt}Generate 4-5 discovery nodes that help the user explore "${query}" in meaningful and interconnected ways. Focus on ${selectedActions.join(' and ')} aspects. Each node should offer a unique perspective that builds toward deeper understanding.

REQUIREMENTS:
- Title: Compelling, specific, max 60 chars
- Content: 2-3 informative sentences with actionable insights
- Category: Relevant domain (Technology, Science, Philosophy, Art, etc.)
- Confidence: 0.7-0.95 based on factual accuracy
- PersonalHook: Connection to user interests/learning style (when applicable)

FOCUS ON:
- Practical applications and real-world impact
- Emerging trends and cutting-edge developments  
- Interdisciplinary connections and synthesis
- Actionable insights and learning opportunities

Return ONLY valid JSON array:
[
  {
    "title": "Specific, Compelling Title",
    "content": "Rich, informative content with concrete examples and actionable insights that inspire further exploration.",
    "category": "Relevant Category",
    "confidence": 0.85,
    "personalHook": "How this connects to your exploration style and interests"
  }
]

Ensure JSON is valid - no trailing commas, proper escaping.`;

    // Generate nodes using LLM with optimized parameters
    const response = await llmService.makeLLMRequest([
      { role: 'system', content: 'You are an expert knowledge discovery assistant. Generate insightful, accurate discovery nodes in valid JSON format. Always respond with valid JSON array.' },
      { role: 'user', content: aiPrompt }
    ], {
      n_predict: 1500,
      temperature: 0.7, // Slightly higher for more creative responses
      stop: ['\n\n\n', '```', 'Human:', 'Assistant:'],
      max_tokens: 1500,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });
    
    const aiResponse = response.content;

    let generatedNodes;
    try {
      // Clean and parse the AI response
      let cleanResponse = aiResponse.trim();
      
      // Remove code blocks if present
      cleanResponse = cleanResponse.replace(/```json\n?|\n?```/g, '').trim();
      
      // Try to extract JSON array if wrapped in other text
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      generatedNodes = JSON.parse(cleanResponse);
      
      // Validate it's an array
      if (!Array.isArray(generatedNodes)) {
        throw new Error('Response is not an array');
      }
      
      logger.debug('Successfully parsed AI response', { nodeCount: generatedNodes.length });
      
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON', { 
        response: aiResponse.substring(0, 300),
        error: parseError.message 
      });
      
      // Intelligent fallback: extract key information from text response
      const sentences = aiResponse.split('.').filter(s => s.trim().length > 10);
      generatedNodes = sentences.slice(0, 3).map((sentence, index) => ({
        title: `${query} - Aspect ${index + 1}`,
        content: sentence.trim() + (sentence.endsWith('.') ? '' : '.'),
        category: 'Discovery',
        confidence: 0.75,
        personalHook: index === 0 ? 'This foundational concept connects to your exploration journey.' : null
      }));
    }

    // Validate and sanitize generated nodes
    const validNodes = (Array.isArray(generatedNodes) ? generatedNodes : [generatedNodes])
      .filter(node => node && typeof node.title === 'string' && typeof node.content === 'string')
      .slice(0, 5) // Limit to 5 nodes max
      .map(node => ({
        title: String(node.title).substring(0, 100),
        content: String(node.content).substring(0, 500),
        category: String(node.category || 'Discovery').substring(0, 50),
        confidence: Math.min(1.0, Math.max(0.0, parseFloat(node.confidence) || 0.7)),
        personalHook: node.personalHook ? String(node.personalHook).substring(0, 200) : null
      }));

    if (validNodes.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate valid nodes'
      });
    }

    logger.info('Successfully generated sandbox nodes', { 
      userId, 
      nodeCount: validNodes.length,
      query: query.substring(0, 50)
    });

    res.json({
      success: true,
      data: {
        nodes: validNodes
      }
    });

  } catch (error) {
    logger.error('Error in sandbox generate-nodes', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate nodes'
    });
  }
});

/**
 * POST /sandbox/enhance-node
 * Enhance a node with user context and personalized insights
 */
router.post('/enhance-node', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { node, userContext } = req.body;

    logger.debug('Sandbox enhance-node request', { 
      userId,
      nodeTitle: node?.title?.substring(0, 50)
    });

    // Validate required fields
    if (!node || !node.title || !node.content) {
      return res.status(400).json({
        success: false,
        error: 'Node with title and content is required'
      });
    }

    // Get user data for enhancement
    const user = await User.findById(userId);
    const userBehaviorProfile = await UserBehaviorProfile.findOne({ userId });

    // Build enhancement context
    let enhancementData = {
      relevantUserData: {},
      personalizedContext: '',
      dataConnections: [],
      suggestedConnections: []
    };

    // Add user behavior data if available
    if (userBehaviorProfile) {
      enhancementData.relevantUserData = {
        preferences: userBehaviorProfile.preferences,
        learningStyle: userBehaviorProfile.behaviorMetrics?.learningStyle,
        interests: userBehaviorProfile.preferences?.interests || []
      };

      // Generate personalized context
      const contextPrompt = `Given this discovery node:
Title: ${node.title}
Content: ${node.content}
Category: ${node.category}

And this user profile:
Interests: ${userBehaviorProfile.preferences?.interests?.join(', ') || 'None'}
Learning Style: ${userBehaviorProfile.behaviorMetrics?.learningStyle || 'Not determined'}

Provide a 1-2 sentence personalized insight about how this node connects to the user's profile.`;

      try {
        const personalizedResponse = await llmService.makeLLMRequest([
          { role: 'system', content: 'You are a personalization expert. Generate concise, insightful connections between concepts and user profiles.' },
          { role: 'user', content: contextPrompt }
        ], {
          n_predict: 200,
          temperature: 0.5
        });
        
        enhancementData.personalizedContext = personalizedResponse.content.trim();
      } catch (error) {
        logger.warn('Failed to generate personalized context', { userId, error: error.message });
        enhancementData.personalizedContext = 'This discovery connects to your exploration patterns.';
      }

      // Create data connections
      enhancementData.dataConnections = [
        {
          type: 'personality',
          value: userBehaviorProfile.behaviorMetrics || {},
          source: 'UBPM',
          relevanceScore: 0.8
        }
      ];

      // Generate suggested connections based on user interests
      if (userBehaviorProfile.preferences?.interests) {
        enhancementData.suggestedConnections = userBehaviorProfile.preferences.interests
          .slice(0, 3)
          .map(interest => interest.toLowerCase());
      }
    } else {
      enhancementData.personalizedContext = 'This discovery offers new insights for your exploration.';
      enhancementData.suggestedConnections = ['exploration', 'learning', 'discovery'];
    }

    logger.info('Successfully enhanced sandbox node', { 
      userId,
      nodeTitle: node.title.substring(0, 50)
    });

    res.json({
      success: true,
      data: enhancementData
    });

  } catch (error) {
    logger.error('Error in sandbox enhance-node', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to enhance node'
    });
  }
});

/**
 * POST /sandbox/analyze-connections
 * Analyze connections between nodes for relationship insights
 */
router.post('/analyze-connections', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { nodes, connections } = req.body;

    logger.debug('Sandbox analyze-connections request', { 
      userId,
      nodeCount: nodes?.length,
      connectionCount: connections?.length
    });

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Nodes array is required for connection analysis'
      });
    }
    
    if (nodes.length < 2) {
      // Return a helpful response instead of error for single node
      return res.json({
        success: true,
        data: {
          connections: [],
          insights: ['Add more nodes to discover meaningful connections between ideas.'],
          message: 'Need at least 2 nodes for connection analysis'
        }
      });
    }

    // Analyze connections using AI
    const connectionPrompt = `Analyze the relationships between these discovery nodes:

${nodes.map((node, index) => `${index + 1}. ${node.title}: ${node.content}`).join('\n')}

Identify:
1. Thematic connections between nodes
2. Conceptual relationships
3. Potential synthesis opportunities

Return insights about how these concepts connect and build upon each other.`;

    const analysisResponse = await llmService.makeLLMRequest([
      { role: 'user', content: connectionPrompt }
    ], {
      n_predict: 400,
      temperature: 0.6
    });

    // Generate connection strength scores
    const connectionAnalysis = {
      insights: analysisResponse.content.trim(),
      connectionStrengths: [],
      synthesisOpportunities: []
    };

    // Calculate connection strengths between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const strength = Math.random() * 0.4 + 0.6; // Mock scoring 0.6-1.0
        connectionAnalysis.connectionStrengths.push({
          nodeA: nodes[i].title,
          nodeB: nodes[j].title,
          strength: parseFloat(strength.toFixed(2))
        });
      }
    }

    // Generate synthesis opportunities
    connectionAnalysis.synthesisOpportunities = [
      'Explore the intersection of these concepts',
      'Consider practical applications across domains',
      'Investigate historical connections'
    ];

    logger.info('Successfully analyzed sandbox connections', { 
      userId,
      nodeCount: nodes.length
    });

    res.json({
      success: true,
      data: connectionAnalysis
    });

  } catch (error) {
    logger.error('Error in sandbox analyze-connections', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to analyze connections'
    });
  }
});

/**
 * POST /sandbox/save-session
 * Save a sandbox session with nodes and connections
 */
router.post('/save-session', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { sessionId, nodes, connections, userQuery, metadata } = req.body;

    logger.debug('Sandbox save-session request', { userId, sessionId, nodeCount: nodes?.length });

    if (!sessionId || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and nodes array are required'
      });
    }

    // Create session data structure
    const sessionData = {
      userId,
      sessionId,
      nodes: nodes.map(node => ({
        id: node.id,
        title: String(node.title || '').substring(0, 100),
        content: String(node.content || '').substring(0, 1000),
        position: node.position || { x: 0, y: 0 },
        connections: Array.isArray(node.connections) ? node.connections : [],
        category: String(node.category || 'Discovery').substring(0, 50),
        confidence: Math.min(1.0, Math.max(0.0, parseFloat(node.confidence) || 0.7)),
        isLocked: Boolean(node.isLocked),
        lockTimestamp: node.lockTimestamp || null,
        personalHook: node.personalHook ? String(node.personalHook).substring(0, 200) : null
      })),
      connections: Array.isArray(connections) ? connections : [],
      userQuery: String(userQuery || '').substring(0, 500),
      timestamp: new Date(),
      metadata: {
        completenessScore: metadata?.completenessScore || 0.5,
        dataQuality: metadata?.dataQuality || 'basic',
        nodeCount: nodes.length,
        ...metadata
      }
    };

    // Save to MongoDB
    const existingSession = await SandboxSession.findOne({ sessionId, userId });
    
    if (existingSession) {
      // Update existing session
      existingSession.nodes = sessionData.nodes;
      existingSession.connections = sessionData.connections;
      existingSession.userQuery = sessionData.userQuery;
      existingSession.metadata = sessionData.metadata;
      existingSession.lastAccessed = new Date();
      await existingSession.save();
      
      logger.info('Updated existing sandbox session', { 
        userId, 
        sessionId,
        nodeCount: sessionData.nodes.length 
      });
    } else {
      // Create new session
      const newSession = new SandboxSession(sessionData);
      await newSession.save();
      
      logger.info('Created new sandbox session', { 
        userId, 
        sessionId,
        nodeCount: sessionData.nodes.length 
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: sessionData.sessionId,
        timestamp: sessionData.timestamp,
        nodeCount: sessionData.nodes.length,
        metadata: sessionData.metadata
      }
    });

  } catch (error) {
    logger.error('Error in sandbox save-session', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to save session'
    });
  }
});

/**
 * GET /sandbox/sessions
 * Get user's saved sandbox sessions
 */
router.get('/sessions', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = parseInt(req.query.offset) || 0;

    logger.debug('Sandbox sessions request', { userId, limit, offset });

    // Fetch real sessions from MongoDB
    const totalSessions = await SandboxSession.countDocuments({ userId, isActive: true });
    
    const sessions = await SandboxSession.find({ 
      userId, 
      isActive: true 
    })
    .select('sessionId userQuery createdAt updatedAt metadata nodes connections')
    .sort({ lastAccessed: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
    
    // Format sessions for response
    const formattedSessions = sessions.map(session => ({
      sessionId: session.sessionId,
      userQuery: session.userQuery,
      timestamp: session.updatedAt || session.createdAt,
      nodeCount: session.nodes?.length || 0,
      connectionCount: session.connections?.length || 0,
      metadata: session.metadata || { completenessScore: 0.5, dataQuality: 'basic' },
      lastAccessed: session.lastAccessed || session.updatedAt
    }));

    logger.info('Successfully retrieved sandbox sessions', { 
      userId,
      sessionCount: formattedSessions.length,
      totalSessions
    });

    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        total: totalSessions,
        limit,
        offset
      }
    });

  } catch (error) {
    logger.error('Error in sandbox sessions', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions'
    });
  }
});

/**
 * POST /sandbox/contextual-search  
 * Perform contextual search within sandbox nodes
 */
router.post('/contextual-search', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { searchQuery, context, nodes } = req.body;

    logger.debug('Sandbox contextual-search request', { 
      userId,
      query: searchQuery?.substring(0, 50),
      nodeCount: nodes?.length 
    });

    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Perform semantic search across user's sandbox data
    let searchResults = [];
    
    if (nodes && nodes.length > 0) {
      // Search within provided nodes
      searchResults = nodes
        .map(node => {
          let relevanceScore = 0;
          const queryLower = searchQuery.toLowerCase();
          
          // Title match (highest weight)
          if (node.title?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.4;
          }
          
          // Content match
          if (node.content?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.3;
          }
          
          // Category match
          if (node.category?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.2;
          }
          
          // Personal hook match
          if (node.personalHook?.toLowerCase().includes(queryLower)) {
            relevanceScore += 0.1;
          }
          
          return {
            ...node,
            relevanceScore: Math.min(relevanceScore, 1.0)
          };
        })
        .filter(node => node.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);
    } else {
      // Search across user's saved sessions
      const searchRegex = new RegExp(searchQuery, 'i');
      const matchingSessions = await SandboxSession.find({
        userId,
        isActive: true,
        $or: [
          { userQuery: searchRegex },
          { 'nodes.title': searchRegex },
          { 'nodes.content': searchRegex },
          { 'nodes.category': searchRegex }
        ]
      })
      .select('sessionId userQuery nodes')
      .limit(5)
      .lean();
      
      // Extract matching nodes from sessions
      for (const session of matchingSessions) {
        const matchingNodes = session.nodes.filter(node =>
          node.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        searchResults.push(...matchingNodes.map(node => ({
          ...node,
          sessionId: session.sessionId,
          sessionQuery: session.userQuery,
          relevanceScore: 0.8 // Base score for saved nodes
        })));
      }
      
      searchResults = searchResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10);
    }

    logger.info('Successfully performed contextual search', { 
      userId,
      searchQuery: searchQuery.substring(0, 50),
      resultCount: searchResults.length 
    });

    res.json({
      success: true,
      data: {
        searchQuery,
        results: searchResults,
        resultCount: searchResults.length
      }
    });

  } catch (error) {
    logger.error('Error in sandbox contextual-search', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform contextual search'
    });
  }
});

/**
 * POST /sandbox/lock-node
 * Lock a node for persistent use across sessions
 */
router.post('/lock-node', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { node, reason, priority, tags } = req.body;

    logger.debug('Sandbox lock-node request', { userId, nodeTitle: node?.title });

    if (!node || !node.title || !node.content) {
      return res.status(400).json({
        success: false,
        error: 'Node with title and content is required'
      });
    }

    // Generate unique node ID if not provided
    const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if node is already locked
    const existingLocked = await LockedNode.findOne({ userId, nodeId });
    
    if (existingLocked) {
      // Update existing locked node
      existingLocked.title = node.title;
      existingLocked.content = node.content;
      existingLocked.category = node.category || 'Discovery';
      existingLocked.personalHook = node.personalHook;
      existingLocked.confidence = node.confidence || 0.7;
      existingLocked.lockData.reason = reason;
      existingLocked.lockData.priority = priority || 'medium';
      existingLocked.lockData.tags = Array.isArray(tags) ? tags : [];
      await existingLocked.updateUsage();
      
      logger.info('Updated existing locked node', { userId, nodeId });
    } else {
      // Create new locked node
      const lockedNode = new LockedNode({
        userId,
        nodeId,
        title: node.title,
        content: node.content,
        category: node.category || 'Discovery',
        personalHook: node.personalHook,
        confidence: node.confidence || 0.7,
        lockData: {
          reason: reason || 'User locked for future use',
          priority: priority || 'medium',
          tags: Array.isArray(tags) ? tags : [],
          relatedSessions: []
        },
        contextualData: {
          originalQuery: node.originalQuery,
          relatedNodes: [],
          userContext: {},
          enhancementData: {
            personalizedContext: '',
            dataConnections: [],
            suggestedConnections: []
          }
        }
      });
      
      await lockedNode.save();
      logger.info('Created new locked node', { userId, nodeId });
    }

    // PATTERN ENGINE ACTIVATION: Check for pattern analysis triggers
    try {
      const { default: triggerSystem } = await import('../services/triggerSystem.js');
      
      // Trigger 1: Check for category clustering (3+ nodes in same category)
      await triggerSystem.checkNodeLockingPattern(userId, {
        title: node.title,
        content: node.content,
        category: node.category || 'Discovery'
      });
      
      logger.debug('Pattern engine triggers checked', { userId, nodeId });
    } catch (triggerError) {
      logger.warn('Pattern trigger check failed (non-critical)', { 
        userId, 
        nodeId, 
        error: triggerError.message 
      });
    }

    res.json({
      success: true,
      data: {
        nodeId,
        message: 'Node successfully locked'
      }
    });

  } catch (error) {
    logger.error('Error in sandbox lock-node', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to lock node'
    });
  }
});

/**
 * GET /sandbox/locked-nodes
 * Get user's locked nodes
 */
router.get('/locked-nodes', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const priority = req.query.priority;
    const tags = req.query.tags ? req.query.tags.split(',') : null;

    logger.debug('Sandbox locked-nodes request', { userId, limit, priority, tags });

    // Build query
    const query = { userId, isActive: true };
    if (priority) query['lockData.priority'] = priority;
    if (tags) query['lockData.tags'] = { $in: tags };

    const lockedNodes = await LockedNode.find(query)
      .select('-__v')
      .sort({ 'usageStats.lastUsed': -1, createdAt: -1 })
      .limit(limit)
      .lean();

    logger.info('Successfully retrieved locked nodes', { 
      userId,
      nodeCount: lockedNodes.length 
    });

    res.json({
      success: true,
      data: {
        lockedNodes,
        count: lockedNodes.length
      }
    });

  } catch (error) {
    logger.error('Error in sandbox locked-nodes', {
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve locked nodes'
    });
  }
});

/**
 * POST /sandbox/node/:nodeId/window-query
 * Node Windows - Collaborative Research Environment
 * Performs deep AI-assisted research within a node's context
 */
router.post('/node/:nodeId/window-query', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { nodeId } = req.params;
    const { userQuery, nodeContext } = req.body;

    logger.debug('Node Window query request', { 
      userId, 
      nodeId,
      query: userQuery?.substring(0, 100)
    });

    // Validate required fields
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'User query is required and must be a string'
      });
    }

    if (!nodeContext || !nodeContext.title) {
      return res.status(400).json({
        success: false,
        error: 'Node context with title is required'
      });
    }

    // Import the LLM service
    const { createLLMService } = await import('../services/llmService.js');
    const llmService = createLLMService();

    // Execute the Window Query research workflow
    logger.info('Starting Window Query research workflow', { 
      userId, 
      nodeId,
      nodeTitle: nodeContext.title.substring(0, 50),
      query: userQuery.substring(0, 100)
    });

    const researchResults = await llmService.handleWindowQuery(nodeContext, userQuery);

    if (!researchResults.success) {
      return res.status(500).json({
        success: false,
        error: 'Research workflow failed',
        details: researchResults.error
      });
    }

    // TODO: Implement memory scoping for Window sessions
    // This will be handled in enhancedMemoryService.js
    
    logger.info('Window Query research completed successfully', { 
      userId, 
      nodeId,
      tidBitsCount: researchResults.data.tidBits.length,
      hasWebResults: researchResults.data.webSearchResults?.success,
      hasAcademicResults: researchResults.data.academicSearchResults?.success
    });

    res.json({
      success: true,
      data: {
        nodeId,
        research: {
          userQuery: researchResults.data.userQuery,
          synthesis: researchResults.data.synthesis,
          tidBits: researchResults.data.tidBits,
          webSearchCount: researchResults.data.webSearchResults?.results?.length || 0,
          academicSearchCount: researchResults.data.academicSearchResults?.data?.papers?.length || 0,
          timestamp: researchResults.data.timestamp
        }
      }
    });

  } catch (error) {
    logger.error('Error in sandbox window-query', { 
      userId: req.user?._id,
      nodeId: req.params.nodeId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform window research'
    });
  }
});

/**
 * POST /sandbox/chain-of-thought
 * Execute chain-of-thought reasoning with real-time streaming updates
 */
router.post('/chain-of-thought', protect, checkTierLimits, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { query, options = {}, sessionId, stream = true } = req.body;

    logger.info('Chain of thought request received', { 
      userId, 
      query: query?.substring(0, 100),
      sessionId,
      hasOptions: !!options,
      stream 
    });

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    if (!stream) {
      return res.status(400).json({
        success: false,
        error: 'Only streaming mode is supported for chain of thought'
      });
    }

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      message: 'Chain of thought process starting...',
      sessionId: sessionId || `cot_${Date.now()}`
    })}\n\n`);

    // Set up streaming callbacks
    const streamCallbacks = {
      onStepUpdate: (step, message) => {
        try {
          const updateData = {
            type: 'step_update',
            currentStep: step.id,
            steps: step.allSteps,
            message: message || '',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(updateData)}\n\n`);
          
          logger.debug('Step update sent', { 
            userId, 
            stepId: step.id,
            hasMessage: !!message 
          });
        } catch (writeError) {
          logger.error('Error writing step update', { 
            userId, 
            error: writeError.message 
          });
        }
      },

      onComplete: (result) => {
        try {
          const completionData = {
            type: 'final_result',
            data: result,
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(completionData)}\n\n`);
          res.write('data: [DONE]\n\n');
          
          logger.info('Chain of thought completed successfully', { 
            userId, 
            nodesCount: result.nodes?.length || 0,
            sessionId: result.sessionId 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing completion data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      },

      onError: (error) => {
        try {
          const errorData = {
            type: 'error',
            message: error.message || 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          
          logger.error('Chain of thought error sent to client', { 
            userId, 
            error: error.message 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing error data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      logger.info('Chain of thought client disconnected', { userId, sessionId });
    });

    req.on('aborted', () => {
      logger.info('Chain of thought request aborted', { userId, sessionId });
    });

    // Start AI activity monitoring for transparency
    const processId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    aiActivityMonitor.startProcess(userId.toString(), processId, query);

    // Enhanced callbacks that integrate monitoring with real AI processing
    const enhancedCallbacks = {
      onStepUpdate: (stepData, progressMessage) => {
        try {
          // Convert chainOfThoughtEngine format to frontend expected format
          const frontendFormat = {
            type: 'step_update',
            currentStep: stepData.id,
            steps: stepData.allSteps || [],
            message: progressMessage || '',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(frontendFormat)}\n\n`);
          
          logger.debug('Enhanced step update sent', { 
            userId, 
            stepId: stepData.id,
            hasMessage: !!progressMessage,
            stepsCount: stepData.allSteps?.length || 0
          });
        } catch (writeError) {
          logger.error('Error writing step update', { 
            userId, 
            error: writeError.message 
          });
        }
      },

      onComplete: (result) => {
        try {
          aiActivityMonitor.completeProcess(userId.toString());
          
          const completionData = {
            type: 'final_result',
            data: result,
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(completionData)}\n\n`);
          res.write('data: [DONE]\n\n');
          
          logger.info('Chain of thought completed with AI transparency', { 
            userId, 
            nodesCount: result.nodes?.length || 0,
            sessionId: result.sessionId 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing completion data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      },

      onError: (error) => {
        try {
          aiActivityMonitor.handleProcessError(userId.toString(), error);
          
          const errorData = {
            type: 'error',
            message: error.message || 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(errorData)}\n\n`);
          
          logger.error('Chain of thought error with monitoring cleanup', { 
            userId, 
            error: error.message 
          });
          
          res.end();
        } catch (writeError) {
          logger.error('Error writing error data', { 
            userId, 
            error: writeError.message 
          });
          res.end();
        }
      }
    };

    // Start the REAL chain of thought process with AI transparency
    await chainOfThoughtEngine.processQuery(
      userId.toString(),
      query,
      {
        ...options,
        fastModel: 'meta-llama/llama-3.1-8b-instruct', // Llama for intelligent narration
        mainModel: 'openai/gpt-4o', // GPT-4o for heavy reasoning
        context: {
          actions: options.actions || [],
          useUBPM: options.useUBPM || false,
          includeUserData: options.includeUserData || true,
          sessionId: sessionId || `cot_${Date.now()}`,
          enableTransparency: true, // Enable AI transparency features
          aiActivityMonitor // Pass monitor for integration
        }
      },
      enhancedCallbacks
    );

  } catch (error) {
    logger.error('Chain of thought endpoint error', { 
      userId: req.user?.id || req.user?._id,
      error: error.message,
      stack: error.stack
    });

    // If response hasn't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to process chain of thought request'
      });
    } else {
      // If streaming has started, send error through stream
      try {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Internal server error during processing'
        })}\n\n`);
        res.end();
      } catch (writeError) {
        logger.error('Failed to send streaming error', { 
          userId: req.user?.id || req.user?._id,
          error: writeError.message 
        });
      }
    }
  }
});


export default router;