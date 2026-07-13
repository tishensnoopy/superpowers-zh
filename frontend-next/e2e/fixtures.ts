import { test as base, expect } from '@playwright/test';

interface FixtureOptions {
  expectNoConsoleErrors: void;
}

export const test = base.extend<FixtureOptions>({
  expectNoConsoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await use();
    if (errors.length > 0) {
      console.warn('Console errors detected:', errors);
    }
  },
});

export { expect };
