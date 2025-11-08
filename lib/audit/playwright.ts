import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright-core';

import { PLAYWRIGHT_TIMEOUT_MS, USER_AGENT } from './constants';

export type JsRenderPayload = {
  html: string;
  visibleText: string;
  screenshotPath?: string;
  consoleErrors: string[];
};

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const formatSandboxPath = (filePath: string) => `sandbox:${filePath}`;

export const renderWithJs = async (url: string, artifactId: string): Promise<JsRenderPayload | null> => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: PLAYWRIGHT_TIMEOUT_MS });

    const html = await page.content();
    const visibleText = await page.evaluate(() => document.body.innerText || '');

    const dir = path.join(process.cwd(), '.geo-artifacts');
    await ensureDir(dir);
    const screenshotPath = path.join(dir, `${artifactId}-js.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await browser.close();
    return {
      html,
      visibleText,
      screenshotPath: formatSandboxPath(screenshotPath),
      consoleErrors
    };
  } catch (error) {
    if (browser) await browser.close();
    console.error('Playwright render failed', error);
    return null;
  }
};

export const captureHtmlOnlyScreenshot = async (url: string, artifactId: string) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 720 },
      userAgent: USER_AGENT
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PLAYWRIGHT_TIMEOUT_MS });
    const dir = path.join(process.cwd(), '.geo-artifacts');
    await ensureDir(dir);
    const screenshotPath = path.join(dir, `${artifactId}-base.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();
    return formatSandboxPath(screenshotPath);
  } catch (error) {
    if (browser) await browser.close();
    console.error('Playwright base screenshot failed', error);
    return undefined;
  }
};
