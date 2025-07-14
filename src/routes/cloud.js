import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import Event from '../models/Event.js';
import User from '../models/User.js';

const router = express.Router();
const llmService = createLLMService();

const analyzeCompatibility = async (event, userEmotionalState) => {
  try {
    const systemPrompt = `You are a compatibility analysis expert. Analyze how well an event matches a user's emotional state and personality.

Return JSON in this format:
{
  "compatibilityScore": number (0-100),
  "moodBoostPrediction": number (0-10),
  "reasons": ["reason1", "reason2"],
  "energyMatch": number (0-10),
  "socialFit": number (0-10),
  "recommendationStrength": "low" | "medium" | "high"
}`;

    const userPrompt = `Analyze compatibility between:
Event: ${JSON.stringify({
  title: event.title,
  category: event.category,
  emotionalContext: event.emotionalContext,
  compatibilityData: event.compatibilityData
})}
User Emotional State: ${JSON.stringify(userEmotionalState)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 256
    });

    return JSON.parse(response.content);
  } catch (error) {
    console.error('Compatibility analysis error:', error);
    return {
      compatibilityScore: 75,
      moodBoostPrediction: 6,
      reasons: ["Good category match", "Suitable timing"],
      energyMatch: 7,
      socialFit: 7,
      recommendationStrength: "medium"
    };
  }
};

router.get('/events', protect, async (req, res) => {
  try {
    const { category, location, date, mood, limit = 20, page = 1 } = req.query;
    
    let query = { status: 'published', isPublic: true };
    
    if (category) query.category = category;
    if (location) {
      query.$or = [
        { 'location.city': new RegExp(location, 'i') },
        { 'location.state': new RegExp(location, 'i') }
      ];
    }
    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query['dateTime.start'] = {
        $gte: targetDate,
        $lt: nextDay
      };
    }
    if (mood) {
      query['emotionalContext.targetMood'] = mood;
    }

    query['dateTime.start'] = { $gte: new Date() };

    const events = await Event.find(query)
      .populate('organizer', 'email profile')
      .populate('participants.user', 'email profile')
      .sort({ 'dateTime.start': 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch events'
    });
  }
});

router.post('/events', protect, async (req, res) => {
  try {
    const { emotionalState, preferences = {}, filters = {} } = req.body;
    
    let query = { status: 'published', isPublic: true };
    
    if (filters.category) query.category = filters.category;
    if (filters.location) {
      query.$or = [
        { 'location.city': new RegExp(filters.location, 'i') },
        { 'location.state': new RegExp(filters.location, 'i') }
      ];
    }
    if (filters.maxParticipants) {
      query.maxParticipants = { $gte: filters.maxParticipants };
    }

    query['dateTime.start'] = { $gte: new Date() };

    const events = await Event.find(query)
      .populate('organizer', 'email profile')
      .populate('participants.user', 'email profile')
      .sort({ 'dateTime.start': 1 })
      .limit(50);

    const enhancedEvents = await Promise.all(events.map(async (event) => {
      const compatibility = await analyzeCompatibility(event.toObject(), emotionalState);
      return {
        ...event.toObject(),
        compatibility
      };
    }));

    enhancedEvents.sort((a, b) => b.compatibility.compatibilityScore - a.compatibility.compatibilityScore);

    res.json({
      success: true,
      data: enhancedEvents.slice(0, 20)
    });

  } catch (error) {
    console.error('Enhanced events fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch enhanced events'
    });
  }
});

router.post('/events/:id/compatibility', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { emotionalState } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const compatibility = await analyzeCompatibility(event.toObject(), emotionalState);

    res.json({
      success: true,
      data: {
        eventId: id,
        compatibility
      }
    });

  } catch (error) {
    console.error('Event compatibility error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze event compatibility'
    });
  }
});

router.post('/compatibility/users', protect, async (req, res) => {
  try {
    const { userEmotionalState, targetUserIds, compatibilityContext } = req.body;
    
    const currentUserId = req.user.id;
    const userIds = targetUserIds || [];

    if (userIds.length === 0) {
      const recentUsers = await User.find({
        _id: { $ne: currentUserId }
      }).limit(10).select('email profile emotionalLog');
      
      userIds.push(...recentUsers.map(u => u._id.toString()));
    }

    const users = await User.find({
      _id: { $in: userIds, $ne: currentUserId }
    }).select('email profile emotionalLog');

    const compatibilityResults = await Promise.all(users.map(async (user) => {
      try {
        const systemPrompt = `You are a social compatibility expert. Analyze compatibility between two users based on their emotional states and profiles.

Return JSON in this format:
{
  "compatibilityScore": number (0-100),
  "compatibilityFactors": {
    "emotionalHarmony": number (0-10),
    "communicationStyle": number (0-10),
    "sharedInterests": number (0-10),
    "energyLevel": number (0-10)
  },
  "strengths": ["strength1", "strength2"],
  "considerations": ["consideration1", "consideration2"],
  "recommendationLevel": "low" | "medium" | "high",
  "suggestedActivities": ["activity1", "activity2"]
}`;

        const userPrompt = `Analyze compatibility between:
User 1 Emotional State: ${JSON.stringify(userEmotionalState)}
User 2 Profile: ${JSON.stringify({
  profile: user.profile,
  recentEmotions: user.emotionalLog?.slice(-5) || []
})}
Context: ${JSON.stringify(compatibilityContext)}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];

        const response = await llmService.makeLLMRequest(messages, {
          temperature: 0.3,
          n_predict: 512
        });

        const compatibility = JSON.parse(response.content);
        
        return {
          userId: user._id,
          userEmail: user.email,
          userProfile: user.profile,
          compatibility
        };
      } catch (error) {
        console.error(`Compatibility analysis error for user ${user._id}:`, error);
        return {
          userId: user._id,
          userEmail: user.email,
          userProfile: user.profile,
          compatibility: {
            compatibilityScore: 70,
            compatibilityFactors: {
              emotionalHarmony: 7,
              communicationStyle: 7,
              sharedInterests: 6,
              energyLevel: 7
            },
            strengths: ["Similar values", "Complementary traits"],
            considerations: ["Different communication styles"],
            recommendationLevel: "medium",
            suggestedActivities: ["Coffee chat", "Group activities"]
          }
        };
      }
    }));

    compatibilityResults.sort((a, b) => 
      b.compatibility.compatibilityScore - a.compatibility.compatibilityScore
    );

    res.json({
      success: true,
      data: compatibilityResults
    });

  } catch (error) {
    console.error('User compatibility error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze user compatibility'
    });
  }
});

router.post('/events/:id/join', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    if (event.maxParticipants && event.participantCount >= event.maxParticipants) {
      return res.status(400).json({
        success: false,
        error: 'Event is at maximum capacity'
      });
    }

    const existingParticipant = event.participants.find(
      p => p.user.toString() === userId
    );

    if (existingParticipant) {
      existingParticipant.status = 'joined';
      existingParticipant.joinedAt = new Date();
    } else {
      event.participants.push({
        user: userId,
        status: 'joined',
        joinedAt: new Date()
      });
    }

    await event.save();
    await event.populate('participants.user', 'email profile');

    res.json({
      success: true,
      data: {
        eventId: id,
        participantCount: event.participantCount,
        userStatus: 'joined'
      }
    });

  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to join event'
    });
  }
});

router.post('/events/:id/leave', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const participantIndex = event.participants.findIndex(
      p => p.user.toString() === userId
    );

    if (participantIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'User is not a participant of this event'
      });
    }

    event.participants.splice(participantIndex, 1);
    await event.save();

    res.json({
      success: true,
      data: {
        eventId: id,
        participantCount: event.participantCount,
        userStatus: 'left'
      }
    });

  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to leave event'
    });
  }
});

export default router;