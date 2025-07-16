import { createLLMService } from '../services/llmService.js';

export default async function codeGenerator(args, userContext) {
  try {
    const { language, description, framework, complexity = 'simple' } = args;
    
    if (!language || !description) {
      throw new Error('Language and description are required');
    }

    const llmService = createLLMService();
    
    let prompt = `Generate ${complexity} ${language} code for: ${description}`;
    if (framework) prompt += ` using ${framework}`;
    prompt += '\n\nRequirements:\n- Write clean, well-commented code\n- Include example usage\n- Follow best practices\n- Explain what the code does\n\nProvide the complete code with explanations:';

    const messages = [
      { role: 'system', content: 'You are an expert programmer. Generate high-quality, production-ready code with clear explanations.' },
      { role: 'user', content: prompt }
    ];

    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.3,
      n_predict: 800
    });

    return {
      success: true,
      data: {
        language,
        description,
        framework,
        complexity,
        generatedCode: response.content,
        prompt: prompt
      },
      message: `Generated ${language} code for: "${description}"`,
      instructions: [
        'Review the generated code carefully',
        'Test the code in your development environment',
        'Modify as needed for your specific use case'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to generate code'
    };
  }
}