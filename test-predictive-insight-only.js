#!/usr/bin/env node

/**
 * Focused test for Predictive Insight functionality
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
const TEST_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODA2N2EwMDZmNjg1NWVjNGQ5Yzg3MCIsImlhdCI6MTc1MzI0NTYwMSwiZXhwIjoxNzUzNTA0ODAxfQ.Fbzzy39iEyaGfHcKMpZ9Ex6whlwhzJx0vOvYRyjgy6w';

async function testPredictiveInsight() {
  console.log('🔮 Testing Predictive Insight with Locked Context...\n');
  
  try {
    // Test with 2 locked nodes to trigger predictive insight
    const lockedContext = [
      {
        title: 'Machine Learning Bias in Healthcare',
        content: 'Exploring how bias in ML models affects medical diagnoses and patient outcomes.',
        category: 'Science'
      },
      {
        title: 'Ethical AI Governance Frameworks', 
        content: 'Analysis of regulatory approaches to ensuring responsible AI development.',
        category: 'Technology'
      }
    ];

    const response = await fetch(`${API_BASE}/sandbox/generate-nodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'future of ethical AI development',
        selectedActions: ['research', 'explore'],
        lockedContext: lockedContext,
        useUBPM: true
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API Error: ${data.error}`);
    }
    
    const nodes = data.data?.nodes || [];
    
    console.log('✅ Predictive Insight Test Results:\n');
    
    let hasQuantifiedPrediction = false;
    
    nodes.forEach((node, index) => {
      console.log(`Node ${index + 1}: "${node.title}"`);
      console.log(`PersonalHook: ${node.personalHook}`);
      console.log(`PredictiveInsight: ${node.predictiveInsight || 'Not generated'}`);
      
      // Check for quantified prediction (should contain percentage)
      if (node.predictiveInsight && node.predictiveInsight.includes('%')) {
        hasQuantifiedPrediction = true;
        console.log('🎯 FOUND QUANTIFIED PREDICTION!');
      }
      
      console.log('---\n');
    });
    
    console.log(`📊 Summary:`);
    console.log(`- Nodes generated: ${nodes.length}`);
    console.log(`- Nodes with predictive insight: ${nodes.filter(n => n.predictiveInsight).length}`);
    console.log(`- Has quantified prediction: ${hasQuantifiedPrediction ? '✅ YES' : '❌ NO'}`);
    
    return hasQuantifiedPrediction;
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    return false;
  }
}

// Run the focused test
testPredictiveInsight()
  .then(success => {
    if (success) {
      console.log('\n🎉 Predictive Insight feature is working with quantified predictions!');
    } else {
      console.log('\n⚠️ Predictive Insight needs further debugging.');
    }
  })
  .catch(console.error);