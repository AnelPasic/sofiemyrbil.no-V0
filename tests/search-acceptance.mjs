import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4321';

async function testSearch() {
  console.log('Testing Pagefind search in browser...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  try {
    // 1. DESKTOP SEARCH TEST
    console.log('\n--- 1. DESKTOP SEARCH ---');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });

    const trigger = page.locator('.mws-chrome-search--desktop');
    assert.ok(await trigger.isVisible(), 'Desktop search trigger must be visible');
    console.log('✔ Desktop search trigger visible');

    await trigger.click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('pagefind-modal input, .pagefind-ui__search-input, input[type="search"]').first();
    assert.ok(await searchInput.isVisible(), 'Search modal input must be visible after click');
    console.log('✔ Search modal opened');

    await searchInput.fill('EU-kontroll');
    await page.waitForTimeout(500);
    console.log('✔ Search query executed');
    await page.close();

    // 2. MOBILE SEARCH TEST
    console.log('\n--- 2. MOBILE SEARCH ---');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.goto(origin + '/', { waitUntil: 'networkidle' });

    // Open mobile menu
    const burger = mobile.locator('[data-mws-mobile-toggle]');
    await burger.click();
    await mobile.waitForTimeout(400);

    const mobileSearch = mobile.locator('.mws-chrome-search--mobile');
    assert.ok(await mobileSearch.isVisible(), 'Mobile search trigger must be visible in menu');
    console.log('✔ Mobile search trigger visible in menu drawer');

    await mobileSearch.click();
    await mobile.waitForTimeout(500);

    const mobileInput = mobile.locator('pagefind-modal input, .pagefind-ui__search-input, input[type="search"]').first();
    assert.ok(await mobileInput.isVisible(), 'Mobile search modal input visible');
    console.log('✔ Mobile search modal opened');

    console.log('\n🎉 ALL PAGEFIND SEARCH TESTS PASSED (DESKTOP & MOBILE)!');
  } finally {
    await browser.close();
  }
}

testSearch().catch(err => {
  console.error('❌ Search test failed:', err);
  process.exit(1);
});
