import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { extractJdFromUrl, launchLoginBrowser } from '../jd-extractor.js';
import { translateAndExtract } from '../jd-translator.js';
import { assertPublicHttpUrl } from '../url-policy.js';

const router = Router();
router.use(requireAuth);

/**
 * 直接翻译手工粘贴或历史保存的 JD。
 * POST /api/jd/translate
 * body: { title, jdContent }
 */
router.post('/translate', async (req, res) => {
  const { title, jdContent } = req.body || {};
  const safeJd = String(jdContent || '').trim();
  if (!safeJd) {
    return res.status(400).json({ error: 'jdContent 必填' });
  }

  const translated = await translateAndExtract(safeJd, String(title || '').trim());
  return res.json({
    success: true,
    ...translated,
  });
});

/**
 * JD 链接提取（自动翻译 + 抽取结构化字段）
 * POST /api/jd/extract
 * body: { url }
 * 响应: {
 *   success, title, company, jdContent, sourceSite,
 *   translatedJd, extractedFields, language, translated, translateReason,
 *   message?
 * }
 */
router.post('/extract', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !String(url).trim()) {
    return res.status(400).json({ error: 'url 必填' });
  }
  let trimmedUrl;
  try {
    trimmedUrl = await assertPublicHttpUrl(String(url).trim());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const result = await extractJdFromUrl(trimmedUrl);
    const sourceSite = result.sourceSite || detectSite(trimmedUrl);

    // 抓取失败：返回抓取结果，不调用 AI
    if (!result.success || !result.jdContent) {
      return res.json({
        ...result,
        sourceSite,
        translatedJd: result.jdContent || '',
        extractedFields: {
          targetIndustry: '',
          targetCompanyType: '',
          jobStage: '',
          highlightSkills: '',
        },
        language: 'other',
        translated: false,
        translateReason: 'no_jd_content',
      });
    }

    // 抓取成功：调用 AI 翻译 + 抽取（失败降级，不中断主流程）
    const translated = await translateAndExtract(result.jdContent, result.title);
    return res.json({
      ...result,
      sourceSite,
      title: translated.bilingualTitle || result.title,
      originalTitle: translated.originalTitle || result.title,
      translatedTitle: translated.translatedTitle || result.title,
      bilingualTitle: translated.bilingualTitle || result.title,
      jdContent: translated.bilingualJd || result.jdContent,
      originalJd: translated.originalJd || result.jdContent,
      translatedJd: translated.translatedJd,
      bilingualJd: translated.bilingualJd || result.jdContent,
      extractedFields: translated.extractedFields,
      language: translated.language,
      translated: translated.translated,
      translateReason: translated.reason || '',
    });
  } catch (err) {
    console.error('[jd/extract] 提取失败:', err.message);
    return res.json({
      success: false,
      title: '',
      company: '',
      jdContent: '',
      translatedJd: '',
      extractedFields: {
        targetIndustry: '',
        targetCompanyType: '',
        jobStage: '',
        highlightSkills: '',
      },
      sourceSite: detectSite(trimmedUrl),
      language: 'other',
      translated: false,
      message: `自动提取失败：${err.message}。请手动粘贴 JD 内容。`,
    });
  }
});

/**
 * 拉起可见浏览器协助登录（保存 Cookie）
 * POST /api/jd/login-assist
 * body: { site?: string }  -- 默认 boss
 * 响应: { message }
 */
router.post('/login-assist', async (req, res) => {
  const { site } = req.body || {};
  try {
    await launchLoginBrowser(site || 'boss');
    return res.json({ message: '浏览器已打开，请完成登录后关闭浏览器窗口。Cookie 已自动保存。' });
  } catch (err) {
    return res.status(500).json({ error: `登录辅助失败：${err.message}` });
  }
});

function detectSite(url) {
  if (/zhipin\.com/i.test(url)) return 'boss';
  if (/lagou\.com/i.test(url)) return 'lagou';
  if (/liepin\.com/i.test(url)) return 'liepin';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/51job\.com/i.test(url)) return '51job';
  if (/zhaopin\.com/i.test(url)) return 'zhaopin';
  return 'other';
}

export default router;
