import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import User from '../models/User.js';
import websocketService from './websocketService.js';
import logger from '../utils/logger.js';

/**
 * Intelligent Connection Engine
 * Facilitates meaningful connections between users based on deep behavioral analysis
 */
class ConnectionEngine {
  constructor() {
    this.connectionTypes = this.initializeConnectionTypes();
    this.matchingAlgorithms = this.initializeMatchingAlgorithms();
  }

  /**
   * Initialize connection types and their criteria
   */
  initializeConnectionTypes() {
    return {
      soul_resonance: {
        name: 'Soul Resonance',
        description: 'Deep emotional and spiritual compatibility',
        criteria: {
          personality_alignment: 0.8,
          emotional_compatibility: 0.7,
          value_alignment: 0.8,
          communication_harmony: 0.6
        },
        rarity: 'rare'
      },
      growth_companion: {
        name: 'Growth Companion',
        description: 'Partners in personal development journey',
        criteria: {
          lifecycle_compatibility: 0.7,
          goal_alignment: 0.6,
          learning_style: 0.5,
          challenge_orientation: 0.6
        },
        rarity: 'uncommon'
      },
      intellectual_peer: {
        name: 'Intellectual Peer',
        description: 'Stimulating mental connection and idea exchange',
        criteria: {
          interest_overlap: 0.7,
          complexity_level: 0.8,
          curiosity_match: 0.7,
          knowledge_complementarity: 0.5
        },
        rarity: 'common'
      },
      emotional_support: {
        name: 'Emotional Support',
        description: 'Mutual understanding and emotional validation',
        criteria: {
          empathy_level: 0.8,
          emotional_stability: 0.6,
          support_capacity: 0.7,
          vulnerability_comfort: 0.6
        },
        rarity: 'common'
      },
      creative_collaborator: {
        name: 'Creative Collaborator',
        description: 'Artistic and innovative partnership',
        criteria: {
          creativity_score: 0.7,
          artistic_interests: 0.6,
          innovation_mindset: 0.7,
          collaboration_style: 0.6
        },
        rarity: 'uncommon'
      },
      wisdom_exchange: {
        name: 'Wisdom Exchange',
        description: 'Mentorship and knowledge sharing relationship',
        criteria: {
          experience_differential: 0.3, // Different experience levels
          teaching_inclination: 0.7,
          learning_openness: 0.8,
          respect_foundation: 0.8
        },
        rarity: 'rare'
      },
      adventure_buddy: {
        name: 'Adventure Buddy',
        description: 'Exploration and new experience companion',
        criteria: {
          openness_score: 0.7,
          risk_tolerance: 0.6,
          exploration_drive: 0.7,
          spontaneity_level: 0.5
        },
        rarity: 'common'
      },
      philosophical_ally: {
        name: 'Philosophical Ally',
        description: 'Deep conversations about life and meaning',
        criteria: {
          philosophical_interests: 0.8,
          abstract_thinking: 0.7,
          meaning_seeking: 0.8,
          discussion_depth: 0.7
        },
        rarity: 'uncommon'
      }
    };
  }

  /**
   * Initialize matching algorithms for different connection types
   */
  initializeMatchingAlgorithms() {
    return {
      soul_resonance: this.calculateSoulResonance.bind(this),
      growth_companion: this.calculateGrowthCompatibility.bind(this),
      intellectual_peer: this.calculateIntellectualAlignment.bind(this),
      emotional_support: this.calculateEmotionalSupport.bind(this),
      creative_collaborator: this.calculateCreativeCompatibility.bind(this),
      wisdom_exchange: this.calculateWisdomExchange.bind(this),
      adventure_buddy: this.calculateAdventureCompatibility.bind(this),
      philosophical_ally: this.calculatePhilosophicalAlignment.bind(this)
    };
  }

  /**
   * Find potential connections for a user
   */
  async findConnections(userId, connectionType = 'all', limit = 10) {
    try {
      const userProfile = await UserBehaviorProfile.findOne({ userId });
      if (!userProfile) {
        return { success: false, message: 'User profile not found' };
      }

      // Get all potential matches
      const potentialMatches = await UserBehaviorProfile.find({
        userId: { $ne: userId },
        'privacySettings.allowConnections': true
      });

      let connections = [];

      if (connectionType === 'all') {
        // Calculate all connection types
        for (const [type, algorithm] of Object.entries(this.matchingAlgorithms)) {
          const typeConnections = await this.calculateConnectionsForType(
            userProfile, 
            potentialMatches, 
            type, 
            algorithm,
            Math.ceil(limit / Object.keys(this.matchingAlgorithms).length)
          );
          connections.push(...typeConnections);
        }
      } else {
        // Calculate specific connection type
        const algorithm = this.matchingAlgorithms[connectionType];
        if (algorithm) {
          connections = await this.calculateConnectionsForType(
            userProfile, 
            potentialMatches, 
            connectionType, 
            algorithm, 
            limit
          );
        }
      }

      // Remove duplicates and sort by overall compatibility
      const uniqueConnections = this.removeDuplicateConnections(connections);
      const sortedConnections = uniqueConnections
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, limit);

      return {
        success: true,
        connections: sortedConnections,
        totalFound: sortedConnections.length,
        searchCriteria: { connectionType, limit },
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error finding connections:', error);
      return { success: false, message: 'Error finding connections' };
    }
  }

  /**
   * Create a connection between two users
   */
  async createConnection(userId1, userId2, connectionType, message = '') {
    try {
      // Check if connection already exists
      const existingConnection = await this.checkExistingConnection(userId1, userId2);
      if (existingConnection) {
        return { success: false, message: 'Connection already exists' };
      }

      // Create connection record
      const connection = {
        users: [userId1, userId2],
        connectionType,
        initiatedBy: userId1,
        message,
        status: 'pending',
        createdAt: new Date(),
        compatibilityScore: await this.calculateDetailedCompatibility(userId1, userId2)
      };

      // Store connection (you might want to create a Connection model)
      // For now, we'll use the websocket to notify users

      // Notify the target user via websocket
      websocketService.sendToUser(userId2, 'connection_request', {
        fromUserId: userId1,
        connectionType,
        message,
        compatibilityScore: connection.compatibilityScore
      });

      return {
        success: true,
        connection,
        message: 'Connection request sent'
      };

    } catch (error) {
      logger.error('Error creating connection:', error);
      return { success: false, message: 'Error creating connection' };
    }
  }

  /**
   * Get connection insights for a user pair
   */
  async getConnectionInsights(userId1, userId2) {
    try {
      const profile1 = await UserBehaviorProfile.findOne({ userId: userId1 });
      const profile2 = await UserBehaviorProfile.findOne({ userId: userId2 });

      if (!profile1 || !profile2) {
        return { success: false, message: 'One or more profiles not found' };
      }

      const insights = {
        compatibility: this.calculateDetailedCompatibility(profile1, profile2),
        connectionTypes: this.identifyPossibleConnectionTypes(profile1, profile2),
        sharedInterests: this.findSharedInterests(profile1, profile2),
        complementaryTraits: this.findComplementaryTraits(profile1, profile2),
        communicationStyle: this.analyzeCommunicationCompatibility(profile1, profile2),
        growthPotential: this.analyzeGrowthPotential(profile1, profile2),
        challenges: this.identifyPotentialChallenges(profile1, profile2),
        recommendations: this.generateConnectionRecommendations(profile1, profile2)
      };

      return {
        success: true,
        insights,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error getting connection insights:', error);
      return { success: false, message: 'Error analyzing connection' };
    }
  }

  // Connection Type Calculation Methods

  calculateSoulResonance(profile1, profile2) {
    const personalityAlignment = this.calculatePersonalityAlignment(profile1, profile2);
    const emotionalCompatibility = this.calculateEmotionalCompatibility(profile1, profile2);
    const valueAlignment = this.calculateValueAlignment(profile1, profile2);
    const communicationHarmony = this.calculateCommunicationHarmony(profile1, profile2);

    const score = (
      personalityAlignment * 0.3 +
      emotionalCompatibility * 0.3 +
      valueAlignment * 0.3 +
      communicationHarmony * 0.1
    );

    return {
      score,
      components: {
        personalityAlignment,
        emotionalCompatibility,
        valueAlignment,
        communicationHarmony
      },
      explanation: this.generateSoulResonanceExplanation(score, {
        personalityAlignment,
        emotionalCompatibility,
        valueAlignment,
        communicationHarmony
      })
    };
  }

  calculateGrowthCompatibility(profile1, profile2) {
    const lifecycleAlignment = this.calculateLifecycleAlignment(profile1, profile2);
    const goalAlignment = this.calculateGoalAlignment(profile1, profile2);
    const learningStyleMatch = this.calculateLearningStyleMatch(profile1, profile2);
    const challengeOrientation = this.calculateChallengeOrientation(profile1, profile2);

    const score = (
      lifecycleAlignment * 0.4 +
      goalAlignment * 0.3 +
      learningStyleMatch * 0.2 +
      challengeOrientation * 0.1
    );

    return {
      score,
      components: {
        lifecycleAlignment,
        goalAlignment,
        learningStyleMatch,
        challengeOrientation
      },
      explanation: this.generateGrowthCompatibilityExplanation(score)
    };
  }

  calculateIntellectualAlignment(profile1, profile2) {
    const interestOverlap = this.calculateInterestOverlap(profile1, profile2);
    const complexityMatch = this.calculateComplexityMatch(profile1, profile2);
    const curiosityAlignment = this.calculateCuriosityAlignment(profile1, profile2);
    const knowledgeComplementarity = this.calculateKnowledgeComplementarity(profile1, profile2);

    const score = (
      interestOverlap * 0.4 +
      complexityMatch * 0.3 +
      curiosityAlignment * 0.2 +
      knowledgeComplementarity * 0.1
    );

    return {
      score,
      components: {
        interestOverlap,
        complexityMatch,
        curiosityAlignment,
        knowledgeComplementarity
      },
      explanation: this.generateIntellectualAlignmentExplanation(score)
    };
  }

  calculateEmotionalSupport(profile1, profile2) {
    const empathyLevel = this.calculateEmpathyCompatibility(profile1, profile2);
    const emotionalStability = this.calculateEmotionalStabilityMatch(profile1, profile2);
    const supportCapacity = this.calculateSupportCapacity(profile1, profile2);
    const vulnerabilityComfort = this.calculateVulnerabilityComfort(profile1, profile2);

    const score = (
      empathyLevel * 0.3 +
      emotionalStability * 0.2 +
      supportCapacity * 0.3 +
      vulnerabilityComfort * 0.2
    );

    return {
      score,
      components: {
        empathyLevel,
        emotionalStability,
        supportCapacity,
        vulnerabilityComfort
      },
      explanation: this.generateEmotionalSupportExplanation(score)
    };
  }

  calculateCreativeCompatibility(profile1, profile2) {
    const creativityScore = this.calculateCreativityAlignment(profile1, profile2);
    const artisticInterests = this.calculateArtisticInterests(profile1, profile2);
    const innovationMindset = this.calculateInnovationMindset(profile1, profile2);
    const collaborationStyle = this.calculateCollaborationStyle(profile1, profile2);

    const score = (
      creativityScore * 0.3 +
      artisticInterests * 0.3 +
      innovationMindset * 0.2 +
      collaborationStyle * 0.2
    );

    return {
      score,
      components: {
        creativityScore,
        artisticInterests,
        innovationMindset,
        collaborationStyle
      },
      explanation: this.generateCreativeCompatibilityExplanation(score)
    };
  }

  calculateWisdomExchange(profile1, profile2) {
    const experienceDifferential = this.calculateExperienceDifferential(profile1, profile2);
    const teachingInclination = this.calculateTeachingInclination(profile1, profile2);
    const learningOpenness = this.calculateLearningOpenness(profile1, profile2);
    const respectFoundation = this.calculateRespectFoundation(profile1, profile2);

    const score = (
      experienceDifferential * 0.2 +
      teachingInclination * 0.3 +
      learningOpenness * 0.3 +
      respectFoundation * 0.2
    );

    return {
      score,
      components: {
        experienceDifferential,
        teachingInclination,
        learningOpenness,
        respectFoundation
      },
      explanation: this.generateWisdomExchangeExplanation(score)
    };
  }

  calculateAdventureCompatibility(profile1, profile2) {
    const opennessScore = this.calculateOpennessAlignment(profile1, profile2);
    const riskTolerance = this.calculateRiskTolerance(profile1, profile2);
    const explorationDrive = this.calculateExplorationDrive(profile1, profile2);
    const spontaneityLevel = this.calculateSpontaneityLevel(profile1, profile2);

    const score = (
      opennessScore * 0.3 +
      riskTolerance * 0.2 +
      explorationDrive * 0.3 +
      spontaneityLevel * 0.2
    );

    return {
      score,
      components: {
        opennessScore,
        riskTolerance,
        explorationDrive,
        spontaneityLevel
      },
      explanation: this.generateAdventureCompatibilityExplanation(score)
    };
  }

  calculatePhilosophicalAlignment(profile1, profile2) {
    const philosophicalInterests = this.calculatePhilosophicalInterests(profile1, profile2);
    const abstractThinking = this.calculateAbstractThinking(profile1, profile2);
    const meaningSeekingAlignment = this.calculateMeaningSeekingAlignment(profile1, profile2);
    const discussionDepth = this.calculateDiscussionDepth(profile1, profile2);

    const score = (
      philosophicalInterests * 0.3 +
      abstractThinking * 0.2 +
      meaningSeekingAlignment * 0.3 +
      discussionDepth * 0.2
    );

    return {
      score,
      components: {
        philosophicalInterests,
        abstractThinking,
        meaningSeekingAlignment,
        discussionDepth
      },
      explanation: this.generatePhilosophicalAlignmentExplanation(score)
    };
  }

  // Helper Methods

  async calculateConnectionsForType(userProfile, potentialMatches, connectionType, algorithm, limit) {
    const connections = [];
    const criteria = this.connectionTypes[connectionType].criteria;

    for (const matchProfile of potentialMatches) {
      const result = algorithm(userProfile, matchProfile);
      
      if (result.score >= Math.min(...Object.values(criteria))) {
        connections.push({
          userId: matchProfile.userId,
          connectionType,
          score: result.score,
          overallScore: result.score,
          explanation: result.explanation,
          components: result.components,
          rarity: this.connectionTypes[connectionType].rarity,
          profile: matchProfile.profileSummary
        });
      }
    }

    return connections.slice(0, limit);
  }

  removeDuplicateConnections(connections) {
    const seen = new Set();
    return connections.filter(conn => {
      if (seen.has(conn.userId)) return false;
      seen.add(conn.userId);
      return true;
    });
  }

  calculatePersonalityAlignment(profile1, profile2) {
    if (!profile1.personalityTraits.length || !profile2.personalityTraits.length) return 0.5;

    const traits1 = new Map(profile1.personalityTraits.map(t => [t.trait, t.score]));
    const traits2 = new Map(profile2.personalityTraits.map(t => [t.trait, t.score]));

    let alignment = 0;
    let comparisons = 0;

    for (const [trait, score1] of traits1) {
      if (traits2.has(trait)) {
        const score2 = traits2.get(trait);
        alignment += 1 - Math.abs(score1 - score2);
        comparisons++;
      }
    }

    return comparisons > 0 ? alignment / comparisons : 0.5;
  }

  calculateEmotionalCompatibility(profile1, profile2) {
    const emotional1 = profile1.emotionalProfile;
    const emotional2 = profile2.emotionalProfile;

    if (!emotional1 || !emotional2) return 0.5;

    let compatibility = 0;
    let factors = 0;

    // Compare emotional range
    if (emotional1.emotionalRange && emotional2.emotionalRange) {
      const rangeDiff = Math.abs(emotional1.emotionalRange - emotional2.emotionalRange);
      compatibility += (1 - rangeDiff);
      factors++;
    }

    // Compare baseline emotions
    if (emotional1.baselineEmotion && emotional2.baselineEmotion) {
      const emotionMatch = emotional1.baselineEmotion === emotional2.baselineEmotion ? 1 : 0.5;
      compatibility += emotionMatch;
      factors++;
    }

    return factors > 0 ? compatibility / factors : 0.5;
  }

  calculateValueAlignment(profile1, profile2) {
    const values1 = profile1.goals?.values || [];
    const values2 = profile2.goals?.values || [];

    if (values1.length === 0 || values2.length === 0) return 0.5;

    const sharedValues = values1.filter(v => values2.includes(v));
    const totalUniqueValues = new Set([...values1, ...values2]).size;

    return totalUniqueValues > 0 ? sharedValues.length / totalUniqueValues : 0.5;
  }

  calculateCommunicationHarmony(profile1, profile2) {
    const comm1 = profile1.communicationStyle;
    const comm2 = profile2.communicationStyle;

    if (!comm1 || !comm2) return 0.5;

    let harmony = 0;
    let factors = 0;

    // Compare preferred tones
    if (comm1.preferredTone && comm2.preferredTone) {
      const toneMatch = comm1.preferredTone === comm2.preferredTone ? 1 : 0.7;
      harmony += toneMatch;
      factors++;
    }

    // Compare complexity levels
    if (comm1.complexityLevel && comm2.complexityLevel) {
      const complexityLevels = ['simple', 'intermediate', 'advanced', 'expert'];
      const diff = Math.abs(
        complexityLevels.indexOf(comm1.complexityLevel) - 
        complexityLevels.indexOf(comm2.complexityLevel)
      );
      harmony += Math.max(0, 1 - (diff / 3));
      factors++;
    }

    return factors > 0 ? harmony / factors : 0.5;
  }

  calculateInterestOverlap(profile1, profile2) {
    const interests1 = profile1.interests.map(i => i.category);
    const interests2 = profile2.interests.map(i => i.category);

    if (interests1.length === 0 || interests2.length === 0) return 0;

    const sharedInterests = interests1.filter(i => interests2.includes(i));
    const totalUniqueInterests = new Set([...interests1, ...interests2]).size;

    return totalUniqueInterests > 0 ? sharedInterests.length / totalUniqueInterests : 0;
  }

  generateSoulResonanceExplanation(score, components) {
    if (score > 0.8) {
      return "Profound soul connection detected. Your fundamental natures resonate at the deepest level, suggesting a rare and meaningful bond.";
    } else if (score > 0.6) {
      return "Strong emotional and spiritual compatibility. You share core values and emotional understanding that could foster deep connection.";
    } else {
      return "Some spiritual alignment present. There are areas of resonance that could be explored further.";
    }
  }

  generateGrowthCompatibilityExplanation(score) {
    if (score > 0.7) {
      return "Excellent growth partnership potential. You're both on similar developmental journeys and could accelerate each other's progress.";
    } else if (score > 0.5) {
      return "Good potential for mutual growth. Some alignment in goals and learning approaches creates opportunities for shared development.";
    } else {
      return "Limited growth synergy. Different developmental paths might offer learning opportunities through contrast.";
    }
  }

  // Additional calculation methods would be implemented here...
  // For brevity, I'm including placeholder implementations

  calculateLifecycleAlignment(profile1, profile2) {
    const stage1 = profile1.lifecycleStage?.stage;
    const stage2 = profile2.lifecycleStage?.stage;
    if (!stage1 || !stage2) return 0.5;
    return stage1 === stage2 ? 1 : 0.6;
  }

  calculateGoalAlignment(profile1, profile2) {
    // Implementation for goal alignment calculation
    return 0.7; // Placeholder
  }

  calculateLearningStyleMatch(profile1, profile2) {
    // Implementation for learning style matching
    return 0.6; // Placeholder
  }

  calculateChallengeOrientation(profile1, profile2) {
    // Implementation for challenge orientation calculation
    return 0.8; // Placeholder
  }

  // Continue with other calculation methods...
  // (Additional methods would be implemented similarly)

  async checkExistingConnection(userId1, userId2) {
    // Implementation to check if connection already exists
    // This would query a Connection model if it existed
    return false; // Placeholder
  }

  async calculateDetailedCompatibility(userId1, userId2) {
    // Implementation for detailed compatibility calculation
    return 0.75; // Placeholder
  }

  identifyPossibleConnectionTypes(profile1, profile2) {
    const possibleTypes = [];
    
    for (const [type, algorithm] of Object.entries(this.matchingAlgorithms)) {
      const result = algorithm(profile1, profile2);
      if (result.score > 0.6) {
        possibleTypes.push({
          type,
          score: result.score,
          description: this.connectionTypes[type].description
        });
      }
    }

    return possibleTypes.sort((a, b) => b.score - a.score);
  }

  findSharedInterests(profile1, profile2) {
    const interests1 = profile1.interests.map(i => i.category);
    const interests2 = profile2.interests.map(i => i.category);
    return interests1.filter(i => interests2.includes(i));
  }

  findComplementaryTraits(profile1, profile2) {
    // Implementation for finding complementary personality traits
    return ['analytical-creative', 'structured-spontaneous']; // Placeholder
  }

  analyzeCommunicationCompatibility(profile1, profile2) {
    // Implementation for communication compatibility analysis
    return {
      compatibility: 0.8,
      strengths: ['similar complexity level', 'compatible tones'],
      challenges: ['different response length preferences']
    }; // Placeholder
  }

  analyzeGrowthPotential(profile1, profile2) {
    // Implementation for growth potential analysis
    return {
      potential: 0.7,
      areas: ['mutual learning', 'complementary strengths'],
      timeline: '3-6 months'
    }; // Placeholder
  }

  identifyPotentialChallenges(profile1, profile2) {
    // Implementation for identifying potential relationship challenges
    return ['different communication styles', 'varying energy levels']; // Placeholder
  }

  generateConnectionRecommendations(profile1, profile2) {
    // Implementation for generating connection recommendations
    return [
      'Start with shared interests in technology',
      'Respect different communication paces',
      'Focus on collaborative problem-solving'
    ]; // Placeholder
  }

  // Additional placeholder methods for completeness
  calculateComplexityMatch(profile1, profile2) { return 0.7; }
  calculateCuriosityAlignment(profile1, profile2) { return 0.6; }
  calculateKnowledgeComplementarity(profile1, profile2) { return 0.5; }
  calculateEmpathyCompatibility(profile1, profile2) { return 0.8; }
  calculateEmotionalStabilityMatch(profile1, profile2) { return 0.7; }
  calculateSupportCapacity(profile1, profile2) { return 0.8; }
  calculateVulnerabilityComfort(profile1, profile2) { return 0.6; }
  calculateCreativityAlignment(profile1, profile2) { return 0.7; }
  calculateArtisticInterests(profile1, profile2) { return 0.6; }
  calculateInnovationMindset(profile1, profile2) { return 0.8; }
  calculateCollaborationStyle(profile1, profile2) { return 0.7; }
  calculateExperienceDifferential(profile1, profile2) { return 0.4; }
  calculateTeachingInclination(profile1, profile2) { return 0.7; }
  calculateLearningOpenness(profile1, profile2) { return 0.8; }
  calculateRespectFoundation(profile1, profile2) { return 0.9; }
  calculateOpennessAlignment(profile1, profile2) { return 0.7; }
  calculateRiskTolerance(profile1, profile2) { return 0.6; }
  calculateExplorationDrive(profile1, profile2) { return 0.8; }
  calculateSpontaneityLevel(profile1, profile2) { return 0.5; }
  calculatePhilosophicalInterests(profile1, profile2) { return 0.8; }
  calculateAbstractThinking(profile1, profile2) { return 0.7; }
  calculateMeaningSeekingAlignment(profile1, profile2) { return 0.9; }
  calculateDiscussionDepth(profile1, profile2) { return 0.8; }

  generateIntellectualAlignmentExplanation(score) {
    return score > 0.7 ? "Strong intellectual compatibility detected" : "Some intellectual overlap present";
  }

  generateEmotionalSupportExplanation(score) {
    return score > 0.7 ? "Excellent emotional support potential" : "Moderate support compatibility";
  }

  generateCreativeCompatibilityExplanation(score) {
    return score > 0.7 ? "High creative collaboration potential" : "Some creative synergy possible";
  }

  generateWisdomExchangeExplanation(score) {
    return score > 0.7 ? "Strong mentorship potential identified" : "Some learning exchange possible";
  }

  generateAdventureCompatibilityExplanation(score) {
    return score > 0.7 ? "Great adventure partnership potential" : "Some shared exploration interests";
  }

  generatePhilosophicalAlignmentExplanation(score) {
    return score > 0.7 ? "Deep philosophical connection possible" : "Some meaningful discussion potential";
  }
}

// Export singleton instance
export default new ConnectionEngine();