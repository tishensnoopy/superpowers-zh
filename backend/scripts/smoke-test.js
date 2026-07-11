#!/usr/bin/env node

const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:1337';
const TIMEOUT = 5000;

let passed = 0;
let failed = 0;

function test(name, url, method = 'GET', expectedStatus = 200) {
  return new Promise((resolve) => {
    const options = {
      hostname: new URL(url).hostname,
      port: new URL(url).port || 80,
      path: new URL(url).pathname + new URL(url).search,
      method,
      timeout: TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === expectedStatus) {
          console.log(`✅ ${name}`);
          passed++;
        } else {
          console.log(`❌ ${name} - Expected ${expectedStatus}, got ${res.statusCode}`);
          failed++;
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`❌ ${name} - ${e.message}`);
      failed++;
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ ${name} - Timeout`);
      failed++;
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting smoke tests...\n');

  await test('Site Settings', `${BASE_URL}/api/site-settings`);
  await test('Navigation', `${BASE_URL}/api/navigation`);
  await test('Navigation Tree', `${BASE_URL}/api/navigation/tree`);
  await test('Footer', `${BASE_URL}/api/footer`);
  await test('Pages', `${BASE_URL}/api/pages`);
  await test('Homepage', `${BASE_URL}/api/pages/homepage`);
  await test('Products', `${BASE_URL}/api/products`);
  await test('Featured Products', `${BASE_URL}/api/products/featured`);
  await test('Product Categories', `${BASE_URL}/api/product-categories`);
  await test('Category Tree', `${BASE_URL}/api/product-categories/tree`);
  await test('Product Specs', `${BASE_URL}/api/product-specs`);
  await test('FAQ Items', `${BASE_URL}/api/faq-items`);
  await test('Knowledge Bases', `${BASE_URL}/api/knowledge-bases`);

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
    process.exit(0);
  }
}

runTests();
