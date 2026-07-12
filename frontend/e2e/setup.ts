import { test as setup } from '@playwright/test';
import { setupApiMocks } from './mocks/routeHandlers';

setup('setup api mocks', async ({ page }) => {
  await setupApiMocks(page);
});