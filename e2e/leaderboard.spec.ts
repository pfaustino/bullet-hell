import { test, expect } from '@playwright/test';

test.describe('global leaderboard', () => {
  test('opens and closes from the main menu', async ({ page }) => {
    await page.goto('/');

    // Main menu LEADERBOARD button opens the full-screen modal
    const menuBtn = page.locator('#btn-leaderboard-menu');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const modal = page.locator('#leaderboard-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveClass(/active/);

    // CLOSE returns to the menu
    await page.locator('#lb-close').click();
    await expect(modal).toHaveClass(/hidden/);
    await expect(page.locator('#main-menu')).toBeVisible();
  });

  test('pauses mid-run and opens leaderboard without losing run state', async ({ page }) => {
    await page.goto('/');

    // Start a run
    await page.locator('#btn-play').click();
    await expect(page.locator('#hud')).toBeVisible();

    // Pause via Esc
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).toBeVisible();

    // Open leaderboard from the pause menu
    const pauseLbBtn = page.locator('#btn-leaderboard');
    await expect(pauseLbBtn).toBeVisible();
    await pauseLbBtn.click();

    const modal = page.locator('#leaderboard-modal');
    await expect(modal).toBeVisible();

    // Close -> back to pause menu, run still paused (not lost)
    await page.locator('#lb-close').click();
    await expect(modal).toHaveClass(/hidden/);
    await expect(page.locator('#pause-menu')).toBeVisible();

    // Resume works and HUD is back
    await page.locator('#btn-resume').click();
    await expect(page.locator('#hud')).toBeVisible();
  });
});