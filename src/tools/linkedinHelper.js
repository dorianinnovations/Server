export default async function linkedinHelper(args, _userContext) {
  try {
    const { type, topic, industry, tone = 'professional' } = args;
    
    if (!type || !topic) {
      throw new Error('Type and topic are required');
    }

    const templates = {
      post: {
        structure: [
          'Hook/Opening statement',
          'Personal insight or experience',
          'Value or lesson learned',
          'Call to action or question',
          'Relevant hashtags'
        ],
        tips: [
          'Keep it under 3000 characters',
          'Use line breaks for readability',
          'Include a clear call to action',
          'Add 3-5 relevant hashtags'
        ]
      },
      connection_message: {
        structure: [
          'Personalized greeting',
          'Connection reason/mutual interest',
          'Value proposition',
          'Soft call to action'
        ],
        tips: [
          'Keep under 200 characters',
          'Mention specific commonalities',
          'Avoid sales pitches',
          'Be genuine and specific'
        ]
      },
      comment: {
        structure: [
          'Acknowledge the post',
          'Add personal perspective',
          'Ask follow-up question or add value'
        ],
        tips: [
          'Be thoughtful and relevant',
          'Avoid generic responses',
          'Add genuine value to the conversation'
        ]
      },
      article_idea: {
        structure: [
          'Compelling headline',
          'Introduction with hook',
          'Main points with examples',
          'Conclusion with takeaways'
        ],
        tips: [
          'Choose trending industry topics',
          'Include personal experience',
          'Make it actionable',
          'Optimize for LinkedIn algorithm'
        ]
      }
    };

    const template = templates[type] || templates.post;
    
    const contentGuidance = {
      type,
      topic,
      industry: industry || 'General',
      tone,
      template,
      suggestedHashtags: generateHashtags(topic, industry),
      bestPractices: [
        'Post during business hours',
        'Engage with comments promptly',
        'Share valuable insights',
        'Be authentic and professional'
      ]
    };

    return {
      success: true,
      data: contentGuidance,
      message: `LinkedIn ${type} template for "${topic}" in ${industry || 'general'} industry`,
      instructions: [
        'Use the structure as a writing guide',
        'Customize based on your experience',
        'Review LinkedIn best practices'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to generate LinkedIn content'
    };
  }
}

function generateHashtags(topic, industry) {
  const topicTags = topic.toLowerCase().split(' ').map(word => `#${word}`);
  const industryTags = industry ? [`#${industry.toLowerCase().replace(' ', '')}`] : [];
  const generalTags = ['#leadership', '#innovation', '#growth', '#networking'];
  
  return [...topicTags.slice(0, 2), ...industryTags, ...generalTags.slice(0, 3)];
}