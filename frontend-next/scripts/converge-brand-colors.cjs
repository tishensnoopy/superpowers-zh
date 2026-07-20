#!/usr/bin/env node
/**
 * 一次性色值收敛脚本：品牌色 hex → CSS 变量（保留原值为 fallback）
 * 仅处理生产 .tsx（排除 __tests__），测试断言随后手工更新。
 */
const fs = require('fs');
const path = require('path');

const ROOTS = [path.join(__dirname, '../components'), path.join(__dirname, '../app')];
const REPLACEMENTS = [
  [/rgba\(245,\s*133,\s*31,/g, 'rgba(var(--brand-primary-rgb,245,133,31),'],
  [/rgba\(28,\s*43,\s*58,/g, 'rgba(var(--brand-dark-rgb,28,43,58),'],
  [/#F5851F/g, 'var(--brand-primary,#F5851F)'],
  [/#1C2B3A/g, 'var(--brand-dark,#1C2B3A)'],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      yield* walk(full);
    } else if (entry.name.endsWith('.tsx')) {
      yield full;
    }
  }
}

let totalFiles = 0;
let totalReplacements = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = 0;
    for (const [re, to] of REPLACEMENTS) {
      content = content.replace(re, () => {
        changed++;
        return to;
      });
    }
    if (changed > 0) {
      fs.writeFileSync(file, content);
      totalFiles++;
      totalReplacements += changed;
      console.log(`${path.relative(process.cwd(), file)}: ${changed} 处`);
    }
  }
}
console.log(`\n共 ${totalFiles} 个文件，${totalReplacements} 处替换`);
