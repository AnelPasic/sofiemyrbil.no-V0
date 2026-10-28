import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4321';

async function runTests() {
  console.log('Launching browser (channel: chrome)...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  } catch (err) {
    console.log('Chrome channel failed, trying default bundled chromium...');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }

  try {
    // 1. DESKTOP TEST (1440x900)
    console.log('\n--- 1. DESKTOP (1440px) ---');
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(origin + '/', { waitUntil: 'domcontentloaded' });

    const brand = await desktop.locator('header').getByText('Sofiemyr Bil').first();
    assert.ok(await brand.isVisible(), 'Desktop brand visible');
    console.log('✔ Desktop brand visible');

    const overflowDesktop = await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(overflowDesktop, 'Desktop horizontal overflow check passed');
    console.log('✔ Desktop no horizontal overflow');

    // Check shared section on home
    const sharedSection = await desktop.locator('section#felles-eksempel');
    assert.ok(await sharedSection.isVisible(), 'Shared section visible on home');
    console.log('✔ Shared section visible on home');

    // 2. TABLET TEST (768x1024)
    console.log('\n--- 2. TABLET (768px) ---');
    const tablet = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await tablet.goto(origin + '/kontakt/', { waitUntil: 'domcontentloaded' });
    const overflowTablet = await tablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(overflowTablet, 'Tablet horizontal overflow check passed');
    console.log('✔ Tablet no horizontal overflow');

    // Check booking form in kontakt
    const regNrInput = await tablet.locator('#booking-regnr');
    assert.ok(await regNrInput.isVisible(), 'Booking form regnr input visible');
    console.log('✔ Booking form regnr input visible on tablet');

    // 3. MOBILE TEST (390x844)
    console.log('\n--- 3. MOBILE (390px) ---');
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await mobile.goto(origin + '/', { waitUntil: 'domcontentloaded' });

    const overflowMobile = await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(overflowMobile, 'Mobile horizontal overflow check passed');
    console.log('✔ Mobile no horizontal overflow');

    // Mobile menu toggle test
    const toggle = mobile.locator('[data-mws-mobile-toggle]');
    assert.ok(await toggle.isVisible(), 'Mobile toggle button visible');
    console.log('✔ Mobile burger toggle visible');

    const mobileNav = mobile.locator('[data-mws-mobile-nav]');
    let isHidden = await mobileNav.evaluate(el => el.hidden);
    assert.equal(isHidden, true, 'Mobile nav initially hidden');
    console.log('✔ Mobile nav initially hidden');

    // Tap mobile toggle
    await toggle.click();
    await mobile.waitForTimeout(300);
    const expanded = await toggle.getAttribute('aria-expanded');
    assert.equal(expanded, 'true', 'Mobile toggle aria-expanded is true after click');
    isHidden = await mobileNav.evaluate(el => el.hidden);
    assert.equal(isHidden, false, 'Mobile nav visible after toggle click');
    console.log('✔ Mobile menu opens on tap (hidden=false, aria-expanded=true)');

    // Close mobile toggle
    await toggle.click();
    await mobile.waitForTimeout(300);
    const expandedAfter = await toggle.getAttribute('aria-expanded');
    assert.equal(expandedAfter, 'false', 'Mobile toggle aria-expanded is false after second click');
    isHidden = await mobileNav.evaluate(el => el.hidden);
    assert.equal(isHidden, true, 'Mobile nav hidden after second click');
    console.log('✔ Mobile menu closes on second tap');

    // 4. TEST BOOKING FORM SUBMISSION
    console.log('\n--- 4. BOOKING FORM SUBMISSION ---');
    await mobile.goto(origin + '/bestilling/', { waitUntil: 'domcontentloaded' });
    await mobile.fill('#booking-regnr', 'EK 12345');
    await mobile.fill('#booking-tlf', '91234567');
    await mobile.fill('#booking-epost', 'kunde@example.com');
    await mobile.check('input[value="EU-Kontroll"]');
    await mobile.fill('#booking-melding', 'Ønsker time til uken');

    await mobile.click('button[type="submit"]');
    await mobile.waitForTimeout(300);

    const feedback = mobile.locator('#mws-form-feedback');
    const feedbackVisible = await feedback.isVisible();
    assert.ok(feedbackVisible, 'Booking feedback message visible after form submission');
    console.log('✔ Booking form submission displays feedback message');

    console.log('\n🎉 ALL RESPONSIVE & INTERACTION TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (browser) await browser.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
