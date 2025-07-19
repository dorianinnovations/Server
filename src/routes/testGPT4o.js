import express from 'express';
import { protect } from '../middleware/auth.js';
import { createLLMService } from '../services/llmService.js';
import logger from '../utils/logger.js';

const router = express.Router();
const llmService = createLLMService();

/**
 * Test GPT-4o model endpoint
 */
router.post('/test-gpt4o', protect, async (req, res) => {
  try {
    const { message = "Hello! Please respond with your model name and a brief creative response." } = req.body;
    
    console.log('🧪 Testing GPT-4o model integration...');
    
    const messages = [
      { 
        role: 'system', 
        content: 'You are GPT-4o, an advanced AI assistant. Please identify yourself as GPT-4o in your response and demonstrate your capabilities with creative and insightful responses.' 
      },
      { 
        role: 'user', 
        content: message 
      }
    ];

    const startTime = Date.now();
    
    const response = await llmService.makeLLMRequest(messages, {
      temperature: 0.8,
      n_predict: 300
    });

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      model: "GPT-4o via OpenRouter",
      response: response.content,
      metadata: {
        responseTime: `${responseTime}ms`,
        usage: response.usage,
        stop_reason: response.stop_reason,
        timestamp: new Date()
      },
      test_results: {
        model_identified: response.content.toLowerCase().includes('gpt-4o') || response.content.toLowerCase().includes('gpt'),
        response_quality: response.content.length > 50 ? 'good' : 'minimal',
        creative_elements: /[!?]/.test(response.content) ? 'detected' : 'none'
      }
    });

  } catch (error) {
    logger.error('Error testing GPT-4o:', error);
    res.status(500).json({
      success: false,
      error: 'GPT-4o test failed',
      details: error.message,
      model: "GPT-4o via OpenRouter"
    });
  }
});

/**
 * Test GPT-4o streaming endpoint
 */
router.post('/test-gpt4o-stream', protect, async (req, res) => {
  try {
    const { message = "Write a creative short story in exactly 3 sentences." } = req.body;
    
    console.log('🌊 Testing GPT-4o streaming...');
    
    const messages = [
      { 
        role: 'system', 
        content: 'You are GPT-4o. Please write creatively and demonstrate your advanced capabilities.' 
      },
      { 
        role: 'user', 
        content: message 
      }
    ];

    const streamResponse = await llmService.makeStreamingRequest(messages, {
      temperature: 0.9,
      n_predict: 400
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let buffer = '';
    let fullContent = '';
    let chunkBuffer = ''; // Buffer for natural streaming pace
    let startTime = Date.now();
    
    // Send initial test message
    res.write(`data: ${JSON.stringify({ 
      content: "[GPT-4o Stream Test Started]\\n\\n",
      test: true,
      timestamp: new Date()
    })}\\n\\n`);
    
    streamResponse.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6).trim();
          
          if (data === '[DONE]') {
            // Send any remaining buffered content before ending
            if (chunkBuffer) {
              res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\\n\\n`);
            }
            
            const responseTime = Date.now() - startTime;
            res.write(`data: ${JSON.stringify({ 
              content: "\\n\\n[Test Complete]",
              test_summary: {
                total_time: `${responseTime}ms`,
                content_length: fullContent.length,
                model: "GPT-4o",
                status: "success"
              }
            })}\\n\\n`);
            res.write('data: [DONE]\\n\\n');
            res.end();
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              
              // NATURAL READING PACE: Buffer content like main AI endpoint
              chunkBuffer += content;
              
              if (chunkBuffer.length >= 15 || 
                  (chunkBuffer.length >= 8 && (content.includes(' ') || content.includes('\n'))) ||
                  content.includes('.') || content.includes('!') || content.includes('?')) {
                res.write(`data: ${JSON.stringify({ content: chunkBuffer })}\\n\\n`);
                chunkBuffer = '';
              }
            }
          } catch (e) {
            console.error('Error parsing GPT-4o streaming data:', e);
          }
        }
      }
    });
    
    streamResponse.data.on("end", () => {
      console.log(`✅ GPT-4o streaming test completed, content length: ${fullContent.length}`);
    });

    streamResponse.data.on("error", (error) => {
      console.error('❌ GPT-4o streaming error:', error);
      res.write(`data: ${JSON.stringify({ 
        error: "Stream error occurred",
        details: error.message 
      })}\\n\\n`);
      res.end();
    });

  } catch (error) {
    logger.error('Error in GPT-4o streaming test:', error);
    res.status(500).json({
      success: false,
      error: 'GPT-4o streaming test failed',
      details: error.message
    });
  }
});

/**
 * Compare response styles between different temperature settings
 */
router.post('/test-gpt4o-temperatures', protect, async (req, res) => {
  try {
    const { prompt = "Describe the concept of consciousness in a creative way." } = req.body;
    
    console.log('🌡️ Testing GPT-4o temperature variations...');
    
    const temperatures = [0.3, 0.7, 1.0];
    const results = [];

    for (const temp of temperatures) {
      const messages = [
        { 
          role: 'system', 
          content: `You are GPT-4o. Respond with creativity level appropriate to temperature ${temp}.` 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ];

      try {
        const startTime = Date.now();
        const response = await llmService.makeLLMRequest(messages, {
          temperature: temp,
          n_predict: 200
        });
        const responseTime = Date.now() - startTime;

        results.push({
          temperature: temp,
          response: response.content,
          responseTime: `${responseTime}ms`,
          wordCount: response.content.split(' ').length,
          uniqueWords: new Set(response.content.toLowerCase().match(/\\b\\w+\\b/g) || []).size,
          usage: response.usage
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        results.push({
          temperature: temp,
          error: error.message,
          status: 'failed'
        });
      }
    }

    res.json({
      success: true,
      model: "GPT-4o via OpenRouter",
      prompt,
      temperature_tests: results,
      analysis: {
        total_tests: results.length,
        successful_tests: results.filter(r => !r.error).length,
        average_response_time: results
          .filter(r => r.responseTime)
          .reduce((sum, r) => sum + parseInt(r.responseTime), 0) / 
          results.filter(r => r.responseTime).length + 'ms',
        creativity_variation: 'Check word diversity across temperatures',
        timestamp: new Date()
      }
    });

  } catch (error) {
    logger.error('Error testing GPT-4o temperatures:', error);
    res.status(500).json({
      success: false,
      error: 'GPT-4o temperature test failed',
      details: error.message
    });
  }
});

/**
 * Health check specifically for GPT-4o
 */
router.get('/gpt4o-health', async (req, res) => {
  try {
    const healthResult = await llmService.healthCheck();
    
    res.json({
      success: true,
      model: "GPT-4o",
      health: healthResult,
      openrouter_status: healthResult.status,
      service: healthResult.service,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('GPT-4o health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'GPT-4o health check failed',
      details: error.message,
      timestamp: new Date()
    });
  }
});

console.log("✓ GPT-4o test routes initialized");

export default router;