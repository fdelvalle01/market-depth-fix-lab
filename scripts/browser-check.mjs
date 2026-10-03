import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const output = resolve('preview');
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /submit buy order/i }).click();
  await page.getByText('3 TRADES').waitFor();
  await page.getByText('✓ VALID').waitFor();
  const darkScroll = await page.evaluate(() => ({
    page: getComputedStyle(document.documentElement).scrollbarColor,
    inspector: getComputedStyle(document.querySelector('.field-table')).scrollbarColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
  if (darkScroll.page === 'auto' || darkScroll.inspector === 'auto' || darkScroll.scheme !== 'dark') throw new Error('Obsidiana scrollbars are not themed.');
  await page.screenshot({ path: resolve(output, 'desktop-obsidiana.png'), fullPage: true });
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (desktopOverflow) throw new Error('Desktop has horizontal overflow.');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  if (await page.locator('.app-shell').getAttribute('data-theme') !== 'light') throw new Error('Light theme did not activate.');
  const lightScroll = await page.evaluate(() => ({
    page: getComputedStyle(document.documentElement).scrollbarColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
  if (lightScroll.page === 'auto' || lightScroll.page === darkScroll.page || lightScroll.scheme !== 'light') throw new Error('Claro scrollbars did not update with theme.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, 'mobile-claro.png'), fullPage: true });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (mobileOverflow) throw new Error('Mobile has horizontal overflow.');
  console.log('Browser check passed: trade, FIX validation, themed scrollbars, desktop/mobile overflow.');
} finally {
  await browser.close();
}
