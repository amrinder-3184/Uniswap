import { execSync } from 'child_process';
import fs from 'fs';

const tests = [
  'test-ai-copilot-eval.js',
  'test-ai-evaluation.js',
  'test-ai-listing-context.js',
  'test-ai-multi-turn.js',
  'test-ai-recs.js',
  'test-ai-similar.js',
  'test-audit.js',
  'test-embedding-pipeline.js',
  'test-hybrid-search-eval.js',
  'test-marketplace-flow.js',
  'test-production-hardening.js',
  'test-recommendation-api.js',
  'test-recommendation-eval.js',
  'test-recommendation.js',
  'test-similar-listings-api.js',
  'test-similar-listings.js'
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`\nRunning ${test}...`);
    execSync(`node ${test}`, { stdio: 'inherit' });
    console.log(`✅ ${test} PASSED`);
    passed++;
  } catch (err) {
    console.log(`❌ ${test} FAILED`);
    failed++;
  }
}

console.log(`\n=== Test Summary ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
