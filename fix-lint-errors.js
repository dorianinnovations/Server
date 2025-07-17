#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const replacements = [
  // Add underscore prefix to unused variables/parameters
  { pattern: /\bparseError\b/g, replacement: '_parseError' },
  { pattern: /\bpreferences\b(?=.*is assigned a value but never used)/g, replacement: '_preferences' },
  { pattern: /\bdate\b(?=.*is assigned a value but never used)/g, replacement: '_date' },
  { pattern: /\bfs\b(?=.*is defined but never used)/g, replacement: '_fs' },
  { pattern: /\bpath\b(?=.*is defined but never used)/g, replacement: '_path' },
  { pattern: /\bheaders\b(?=.*is assigned a value but never used)/g, replacement: '_headers' },
  { pattern: /\bcachedSync\b/g, replacement: '_cachedSync' },
  { pattern: /\bpriority\b(?=.*is assigned a value but never used)/g, replacement: '_priority' },
  { pattern: /\bdata\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_data' },
  { pattern: /\bmethod\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_method' },
  { pattern: /\berror\b(?=.*is defined but never used)/g, replacement: '_error' },
  { pattern: /\buser\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_user' },
  { pattern: /\bbehaviorProfile\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_behaviorProfile' },
  { pattern: /\buserContext\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_userContext' },
  { pattern: /\bnext\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_next' },
  { pattern: /\baxios\b(?=.*is defined but never used)/g, replacement: '_axios' },
  { pattern: /\bgroupSize\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_groupSize' },
  { pattern: /\bbudget\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_budget' },
  { pattern: /\bpaymentMethodId\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_paymentMethodId' },
  { pattern: /\bcontent\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_content' },
  { pattern: /\bincludePhonetic\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_includePhonetic' },
  { pattern: /\bdays\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_days' },
  { pattern: /\bunits\b(?=.*is defined but never used\. Allowed unused args)/g, replacement: '_units' },
  { pattern: /\bevalError\b/g, replacement: '_evalError' },
  { pattern: /\broomType\b(?=.*is assigned a value but never used)/g, replacement: '_roomType' },
  { pattern: /\bname\b(?=.*is assigned a value but never used)/g, replacement: '_name' },
  { pattern: /\btotalSavings\b(?=.*is assigned a value but never used)/g, replacement: '_totalSavings' },
  { pattern: /\buserProfile\b(?=.*is assigned a value but never used)/g, replacement: '_userProfile' }
];

console.log('Fixing lint errors...');

// Process each file
const filesToFix = [
  'src/routes/cascadingRecommendations.js',
  'src/routes/cloud.js',
  'src/routes/docs.js',
  'src/routes/emotions.js',
  'src/routes/mobile.js',
  // Add more files as needed
];

// Simple function to fix obvious unused variable patterns
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix common patterns
    const fixes = [
      // Function parameters that are unused
      [/\(([^,)]+), parseError\)/g, '($1, _parseError)'],
      [/\(([^,)]+), error\)/g, '($1, _error)'],
      [/\(([^,)]+), userContext\)/g, '($1, _userContext)'],
      [/catch \(parseError\)/g, 'catch (_parseError)'],
      [/catch \(error\)/g, 'catch (_error)'],
      
      // Remove unused imports
      [/import.*SECURITY_CONFIG.*from.*constants.*;\n/g, ''],
      [/import.*ShortTermMemory.*from.*;\n/g, ''],
      [/import fs from.*;\n/g, ''],
      [/import path from.*;\n/g, ''],
      [/import axios from.*;\n/g, ''],
      [/import.*User.*from.*models\/User.*;\n(?=.*User.*is defined but never used)/g, ''],
    ];
    
    fixes.forEach(([pattern, replacement]) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error fixing ${filePath}:`, err.message);
  }
}

// This is a helper script - we'll do the actual fixes manually for better control
console.log('This would be the automated approach, but let\'s continue manually for precision.');