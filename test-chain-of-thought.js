#!/usr/bin/env node

/**
 * Test script for Chain of Thought AI Transparency System
 * Tests the complete flow from frontend request to backend AI processing
 */

import fetch from 'node-fetch';
import readline from 'readline';

const SERVER_URL = 'http://localhost:5000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODA2N2EwMDZmNjg1NWVjNGQ5Yzg3MCIsImlhdCI6MTc1MzI0NTYwMSwiZXhwIjoxNzUzNTA0ODAxfQ.Fbzzy39iEyaGfHcKMpZ9Ex6whlwhzJx0vOvYRyjgy6w';

// ANSI colors for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}${colors.bright}🧠 Chain of Thought AI Transparency Test${colors.reset}\n`);

async function testChainOfThought() {
  const testQueries = [
    {
      name: 'Creative Exploration', 
      query: 'how can I improve my creative thinking and generate more innovative ideas',
      actions: ['explore', 'discover', 'connect'],
      useUBPM: true
    },
    {
      name: 'Productivity Analysis',
      query: 'what are the best strategies for managing time and staying focused',
      actions: ['analyze', 'optimize'],
      useUBPM: false
    }
  ];

  for (const testCase of testQueries) {
    console.log(`${colors.blue}${colors.bright}Testing: ${testCase.name}${colors.reset}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Actions: [${testCase.actions.join(', ')}]`);
    console.log(`UBPM: ${testCase.useUBPM ? 'Enabled' : 'Disabled'}\n`);

    try {
      const response = await fetch(`${SERVER_URL}/sandbox/chain-of-thought`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          query: testCase.query,
          options: {
            actions: testCase.actions,
            useUBPM: testCase.useUBPM,
            includeUserData: true,
            generateConnections: true
          },
          sessionId: `test_${Date.now()}`,
          stream: true
        })
      });

      if (!response.ok) {
        console.log(`${colors.red}❌ HTTP Error: ${response.status} ${response.statusText}${colors.reset}\n`);
        continue;
      }

      console.log(`${colors.green}✅ Connection established - Processing stream...${colors.reset}\n`);

      // Process Server-Sent Events
      const reader = response.body;
      let buffer = '';
      let stepCount = 0;
      let llmCallCount = 0;
      let startTime = Date.now();

      reader.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              const duration = Date.now() - startTime;
              console.log(`${colors.magenta}🏁 Process completed in ${duration}ms${colors.reset}`);
              console.log(`${colors.cyan}📊 Steps processed: ${stepCount}${colors.reset}`);
              console.log(`${colors.cyan}🤖 LLM calls made: ${llmCallCount}${colors.reset}\n`);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'step_update') {
                stepCount++;
                const step = parsed.steps?.find(s => s.id === parsed.currentStep);
                const status = step?.status || 'unknown';
                const stepTitle = step?.title || 'Unknown step';
                const message = parsed.message || '';
                
                // AI Transparency Display
                console.log(`${colors.yellow}⚡ Step ${parsed.currentStep}: ${stepTitle}${colors.reset}`);
                console.log(`   Status: ${status === 'active' ? colors.green + '🔄 Processing' : colors.blue + '✅ Complete'}${colors.reset}`);
                
                if (message) {
                  console.log(`   ${colors.cyan}🧠 Llama Narration: "${message}"${colors.reset}`);
                  llmCallCount++;
                }
                console.log('');
                
              } else if (parsed.type === 'final_result') {
                console.log(`${colors.green}${colors.bright}🎉 Final Results:${colors.reset}`);
                
                if (parsed.data.nodes) {
                  console.log(`${colors.cyan}📝 Generated Nodes: ${parsed.data.nodes.length}${colors.reset}`);
                  
                  parsed.data.nodes.forEach((node, index) => {
                    console.log(`\n   ${colors.bright}Node ${index + 1}: ${node.title}${colors.reset}`);
                    console.log(`   Content: ${node.content.substring(0, 100)}...`);
                    console.log(`   Category: ${node.category} | Confidence: ${node.confidence}`);
                    if (node.personalHook) {
                      console.log(`   ${colors.magenta}🎯 Personal Hook: ${node.personalHook.substring(0, 80)}...${colors.reset}`);
                    }
                  });
                }
                
                if (parsed.data.insights) {
                  console.log(`\n${colors.yellow}💡 Insights:${colors.reset}`);
                  parsed.data.insights.forEach(insight => {
                    console.log(`   • ${insight}`);
                  });
                }
                
              } else if (parsed.type === 'error') {
                console.log(`${colors.red}❌ Error: ${parsed.message}${colors.reset}\n`);
              }
              
            } catch (parseError) {
              console.log(`${colors.red}⚠️  Failed to parse: ${data.substring(0, 50)}...${colors.reset}`);
            }
          }
        }
      });

      reader.on('end', () => {
        console.log(`${colors.green}📡 Stream ended${colors.reset}\n`);
      });

      reader.on('error', (error) => {
        console.log(`${colors.red}❌ Stream error: ${error.message}${colors.reset}\n`);
      });

      // Wait for stream to complete
      await new Promise((resolve) => {
        reader.on('end', resolve);
        reader.on('error', resolve);
      });

    } catch (error) {
      console.log(`${colors.red}❌ Test failed: ${error.message}${colors.reset}\n`);
    }

    // Pause between tests
    if (testQueries.indexOf(testCase) < testQueries.length - 1) {
      console.log(`${colors.yellow}⏳ Waiting 3 seconds before next test...${colors.reset}\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// Interactive mode for custom queries
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`${colors.cyan}🎯 Interactive Mode - Enter your own queries${colors.reset}`);
  console.log(`${colors.bright}Type 'exit' to quit${colors.reset}\n`);

  while (true) {
    const query = await new Promise(resolve => {
      rl.question('Enter your query: ', resolve);
    });

    if (query.toLowerCase() === 'exit') {
      break;
    }

    if (query.trim()) {
      await testChainOfThought([{
        name: 'Custom Query',
        query: query.trim(),
        actions: ['explore', 'analyze'],
        useUBPM: true
      }]);
    }
  }

  rl.close();
}

// Main execution
async function main() {
  if (process.argv.includes('--interactive')) {
    await interactiveMode();
  } else {
    await testChainOfThought();
  }
  
  console.log(`${colors.cyan}${colors.bright}🧠 Chain of Thought AI Transparency Test Complete${colors.reset}`);
}

main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});