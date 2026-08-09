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

    // Defaults to the Local (this-device) tab
    const localTab = page.locator('.leaderboard-tab[data-tab="local"]');
    await expect(localTab).toHaveClass(/is-active/);
    await expect(page.locator('#lb-panel-local')).toBeVisible();

    // Switch to Global: the board must render (rows or empty state),
    // NOT stay stuck on the "Loading leaderboard…" placeholder.
    await page.locator('.leaderboard-tab[data-tab="global"]').click();
    await expect(page.locator('#lb-modal-list .leaderboard-row, #lb-modal-list .leaderboard-placeholder').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#lb-modal-list')).not.toContainText('Loading leaderboard');

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

  test('quitting mid-run records the run locally and prompts for a name', async ({ page }) => {
    await page.goto('/');

    // Start a run and let wave 1 start
    await page.locator('#btn-play').click();
    await expect(page.locator('#hud')).toBeVisible();
    await page.waitForTimeout(3500);

    // Pause -> QUIT TO MENU (fresh context: no saved name -> prompt)
    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-menu')).toBeVisible();
    await page.locator('#btn-quit').click();

    // Name prompt appears, and we're back at the menu
    await expect(page.locator('#name-prompt')).toBeVisible();
    await expect(page.locator('#main-menu')).toBeVisible();

    // Skip -> prompt closes, run stays recorded locally
    await page.locator('#np-skip').click();
    await expect(page.locator('#name-prompt')).toHaveClass(/hidden/);

    // Open the modal: Local tab now shows the recorded run
    await page.locator('#btn-leaderboard-menu').click();
    await expect(page.locator('#lb-panel-local .leaderboard-row').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#lb-panel-local')).toContainText('recorded');
  });
});