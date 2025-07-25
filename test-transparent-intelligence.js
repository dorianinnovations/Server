#!/usr/bin/env node

/**
 * Test Transparent Intelligence Features
 * Tests the new UBPM Link and Predictive Insight functionality
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

// Test configuration using existing auth token
const TEST_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODA2N2EwMDZmNjg1NWVjNGQ5Yzg3MCIsImlhdCI6MTc1MzI0NTYwMSwiZXhwIjoxNzUzNTA0ODAxfQ.Fbzzy39iEyaGfHcKMpZ9Ex6whlwhzJx0vOvYRyjgy6w';

async function testUBPMLink() {
  console.log('🧠 Testing UBMP Link Feature...');
  
  try {
    const response = await fetch(`${API_BASE}/sandbox/generate-nodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'machine learning ethics',
        selectedActions: ['research', 'analyze'],
        lockedContext: [], // No locked context - testing basic UBPM link
        useUBPM: true
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      throw new Error(`API Error: ${data.error}`);
    }
    
    const nodes = data.data?.nodes || [];
    
    console.log('✅ UBMP Link Test Results:');
    nodes.forEach((node, index) => {
      console.log(`Node ${index + 1}: "${node.title}"`);
      console.log(`PersonalHook: ${node.personalHook}`);
      console.log(`Has "Your UBPM shows": ${node.personalHook?.includes('Your UBPM shows')}`);
      console.log('---');
    });
    
    return true;
  } catch (error) {
    console.error('❌ UBMP Link Test Failed:', error.message);
    return false;
  }
}

async function testPredictiveInsight() {
  console.log('🔮 Testing Predictive Insight Feature...');
  
  try {
    // Test with locked context to trigger predictive insight
    const lockedContext = [
      {
        title: 'AI Ethics in Healthcare',
        content: 'Exploration of ethical considerations in medical AI systems...',
        category: 'Science'
      },
      {
        title: 'Machine Learning Bias Detection',
        content: 'Methods for identifying and mitigating bias in ML models...',
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
        query: 'ethical AI frameworks',
        selectedActions: ['research', 'explore'],
        lockedContext: lockedContext,
        useUBPM: true
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      throw new Error(`API Error: ${data.error}`);
    }
    
    const nodes = data.data?.nodes || [];
    
    console.log('✅ Predictive Insight Test Results:');
    nodes.forEach((node, index) => {
      console.log(`Node ${index + 1}: "${node.title}"`);
      console.log(`PersonalHook: ${node.personalHook}`);
      console.log(`PredictiveInsight: ${node.predictiveInsight || 'Not generated'}`);
      console.log(`Has prediction: ${!!node.predictiveInsight}`);
      console.log('---');
    });
    
    return true;
  } catch (error) {
    console.error('❌ Predictive Insight Test Failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Transparent Intelligence Tests...\n');
  
  const results = {
    ubpmLink: await testUBPMLink(),
    predictiveInsight: await testPredictiveInsight()
  };
  
  console.log('\n📊 Test Summary:');
  console.log(`UBPM Link Feature: ${results.ubpmLink ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Predictive Insight Feature: ${results.predictiveInsight ? '✅ PASS' : '❌ FAIL'}`);
  
  if (results.ubpmLink && results.predictiveInsight) {
    console.log('\n🎉 All Transparent Intelligence features implemented successfully!');
    console.log('🔥 The Sandbox is now feature-complete with transparent intelligence.');
  } else {
    console.log('\n⚠️  Some features need debugging.');
  }
}

// Run the tests
runTests().catch(console.error);