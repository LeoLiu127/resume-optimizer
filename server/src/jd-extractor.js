/**
 * JD 链接提取器
 *
 * 方案：Playwright 持久化上下文（Cookie 自动保存/复用）
 * - Boss直聘：专用选择器解析
 * - 通用站点：fallback 全文提取
 * - 登录辅助：拉起可见浏览器让用户手动登录，Cookie 自动持久化
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { assertPublicHttpUrl } from './url-policy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = resolve(__dirname, '..', 'data', 'browser-profile');

// 确保 profile 目录存在
mkdirSync(USER_DATA_DIR, { recursive: true });

/**
 * 获取持久化浏览器上下文（Cookie 自动保存）
 */
async function getPersistentContext(options = {}) {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: options.headless ?? true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'zh-CN',
    timeout: 30000,
  });
  return context;
}

/**
 * 从 URL 提取 JD 内容
 * @param {string} url - 招聘链接
 * @returns {{ success, title, company, jdContent, sourceSite, message? }}
 */
export async function extractJdFromUrl(url) {
  const sourceSite = detectSite(url);
  let context;
  try {
    context = await getPersistentContext({ headless: true });
    const page = await context.newPage();
    const validatedHosts = new Set();

    // 页面内所有公网请求都经过同一边界，避免公开链接重定向或引用内网资源。
    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url();
      if (!/^https?:/i.test(requestUrl)) {
        return route.continue();
      }
      try {
        const hostname = new URL(requestUrl).hostname.toLowerCase();
        if (!validatedHosts.has(hostname)) {
          await assertPublicHttpUrl(requestUrl);
          validatedHosts.add(hostname);
        }
        return route.continue();
      } catch (err) {
        console.warn(`[jd/extract] 已拦截非公网请求：${requestUrl}（${err.message}）`);
        return route.abort('blockedbyclient');
      }
    });

    // 设置额外请求头模拟正常浏览器
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // 等待页面基本渲染（JS 动态内容）
    await page.waitForTimeout(3000);

    // 根据站点选择不同提取策略
    let result;
    switch (sourceSite) {
      case 'boss':
        result = await extractBoss(page);
        break;
      case 'lagou':
        result = await extractLagou(page);
        break;
      case 'liepin':
        result = await extractLiepin(page);
        break;
      default:
        result = await extractGeneric(page);
        break;
    }

    return { ...result, sourceSite, url };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Boss直聘专用提取
 */
async function extractBoss(page) {
  // 检查是否被拦截（安全验证/登录弹窗）
  const blocked = await page.$('.sign-wrap, .verify-page, [class*="captcha"]');
  if (blocked) {
    return {
      success: false,
      title: '',
      company: '',
      jdContent: '',
      message: 'Boss直聘需要登录或安全验证。请先使用「登录辅助」功能完成登录。',
    };
  }

  // 尝试等待 JD 内容区域加载
  try {
    await page.waitForSelector('.job-detail, .job-sec, [class*="job-detail"]', { timeout: 8000 });
  } catch {
    // 选择器未出现，尝试通用提取
    return extractGeneric(page);
  }

  const data = await page.evaluate(() => {
    // 岗位名称
    const titleEl =
      document.querySelector('.name h1, .job-banner .name, [class*="job-name"], .info-primary .name h1');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // 公司名
    const companyEl = document.querySelector(
      '.company-info a, .job-banner .company, [class*="company-name"], .info-company .name',
    );
    const company = companyEl ? companyEl.textContent.trim() : '';

    // JD 正文
    const detailEl = document.querySelector(
      '.job-detail .job-sec-text, .job-sec .text, [class*="job-detail-section"] .text, .job-detail',
    );
    let jdContent = '';
    if (detailEl) {
      jdContent = detailEl.innerText.trim();
    } else {
      // fallback: 找所有包含"岗位职责"或"任职要求"的段落
      const allText = document.body.innerText;
      const startIdx = allText.indexOf('岗位职责');
      const endIdx = allText.indexOf('公司信息');
      if (startIdx > -1) {
        jdContent = allText.slice(startIdx, endIdx > startIdx ? endIdx : startIdx + 2000).trim();
      }
    }

    return { title, company, jdContent };
  });

  if (!data.jdContent && !data.title) {
    return {
      success: false,
      title: data.title,
      company: data.company,
      jdContent: '',
      message: 'Boss直聘页面结构变化或需要登录，未能提取到 JD 内容。',
    };
  }

  return { success: true, ...data };
}

/**
 * 拉勾专用提取
 */
async function extractLagou(page) {
  try {
    await page.waitForSelector('.job-detail, .position-content, [class*="job"]', { timeout: 8000 });
  } catch {
    return extractGeneric(page);
  }

  const data = await page.evaluate(() => {
    const titleEl = document.querySelector('.position-content .position-content-l h1, .job-detail h1, .position-name');
    const title = titleEl ? titleEl.textContent.trim() : '';
    const companyEl = document.querySelector('.position-content .company h2, .company-name, .job-company');
    const company = companyEl ? companyEl.textContent.trim() : '';
    const detailEl = document.querySelector('.job-detail .job-detail-content, .position-content-l .job-detail');
    const jdContent = detailEl ? detailEl.innerText.trim() : '';
    return { title, company, jdContent };
  });

  return data.jdContent ? { success: true, ...data } : { success: false, ...data, message: '拉勾提取失败，请手动粘贴。' };
}

/**
 * 猎聘专用提取
 */
async function extractLiepin(page) {
  try {
    await page.waitForSelector('.job-detail, .position-detail, [class*="job-content"]', { timeout: 8000 });
  } catch {
    return extractGeneric(page);
  }

  const data = await page.evaluate(() => {
    const titleEl = document.querySelector('.job-detail h1, .position-title, [class*="job-title"]');
    const title = titleEl ? titleEl.textContent.trim() : '';
    const companyEl = document.querySelector('.company-info a, [class*="company-name"]');
    const company = companyEl ? companyEl.textContent.trim() : '';
    const detailEl = document.querySelector('.job-detail .job-content, .position-detail .content, [class*="job-duty"]');
    const jdContent = detailEl ? detailEl.innerText.trim() : '';
    return { title, company, jdContent };
  });

  return data.jdContent ? { success: true, ...data } : { success: false, ...data, message: '猎聘提取失败，请手动粘贴。' };
}

/**
 * 通用提取：尝试从任意页面提取 JD 内容
 */
async function extractGeneric(page) {
  const data = await page.evaluate(() => {
    // 策略1：找 <title> 作为岗位名
    const title = document.title ? document.title.split(/[-_|–—]/)[0].trim() : '';

    // 策略2：找 meta description 或 og:description
    const metaDesc =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      '';

    // 策略3：在正文中定位 JD 关键段落
    const bodyText = document.body.innerText || '';
    const keywords = ['岗位职责', '工作职责', '职位描述', 'Job Description', 'Responsibilities', '任职要求', '岗位要求', 'Requirements'];
    let jdContent = '';
    for (const kw of keywords) {
      const idx = bodyText.indexOf(kw);
      if (idx > -1) {
        // 截取关键词后 3000 字符作为 JD 正文
        jdContent = bodyText.slice(idx, idx + 3000).trim();
        break;
      }
    }

    // 策略4：如果没找到关键词，用 meta description 兜底
    if (!jdContent && metaDesc && metaDesc.length > 50) {
      jdContent = metaDesc;
    }

    // 公司名：尝试从页面中提取
    const companyEl = document.querySelector('[class*="company-name"], .company a, [class*="companyName"]');
    const company = companyEl ? companyEl.textContent.trim() : '';

    return { title, company, jdContent };
  });

  return data.jdContent
    ? { success: true, ...data }
    : { success: false, ...data, message: '无法从该页面自动提取 JD，请手动粘贴。' };
}

/**
 * 拉起可见浏览器辅助登录
 * 用户手动登录后关闭浏览器，Cookie 自动保存到 USER_DATA_DIR
 * @param {string} site - 站点标识
 */
export async function launchLoginBrowser(site = 'boss') {
  const loginUrls = {
    boss: 'https://www.zhipin.com/web/user/?ka=header-login',
    lagou: 'https://passport.lagou.com/login/login.html',
    liepin: 'https://www.liepin.com/user/login',
    linkedin: 'https://www.linkedin.com/login',
  };

  const targetUrl = loginUrls[site] || loginUrls.boss;

  // 使用非持久化的可见浏览器（但共享同一 profile 目录以保存 Cookie）
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--start-maximized'],
    viewport: null, // 使用最大化窗口
    locale: 'zh-CN',
    timeout: 60000,
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 等待用户关闭浏览器（最长 5 分钟）
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      await context.close().catch(() => {});
      resolve();
    }, 5 * 60 * 1000);

    context.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function detectSite(url) {
  if (/zhipin\.com/i.test(url)) return 'boss';
  if (/lagou\.com/i.test(url)) return 'lagou';
  if (/liepin\.com/i.test(url)) return 'liepin';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/51job\.com/i.test(url)) return '51job';
  if (/zhaopin\.com/i.test(url)) return 'zhaopin';
  return 'other';
}
