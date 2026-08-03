#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtmlAttr, escapeHtmlText, renderMarkdown } from './quant-md.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_DIR = path.resolve(__dirname, '..');

const DEFAULT_API_BASE = 'https://app.kairalert.pro/api';
const DEFAULT_SITE_BASE = 'https://kairalert.pro';
const ASSET_VERSION = '20260713-dialog-buttons';

function parseArgs(argv) {
  const args = {
    apiBase: process.env.KAIRALERT_API_BASE || DEFAULT_API_BASE,
    siteBase: process.env.KAIRALERT_SITE_BASE || DEFAULT_SITE_BASE,
    out: 'quant-lab',
    source: '',
    articlesDir: 'articles',
    useApi: false,
    updateSitemap: true,
    clean: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--api-base' && next) args.apiBase = next, i++;
    else if (arg === '--site-base' && next) args.siteBase = next, i++;
    else if (arg === '--out' && next) args.out = next, i++;
    else if (arg === '--source' && next) args.source = next, i++;
    else if (arg === '--articles-dir' && next) args.articlesDir = next, i++;
    else if (arg === '--api') args.useApi = true;
    else if (arg === '--no-sitemap') args.updateSitemap = false;
    else if (arg === '--no-clean') args.clean = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Generate static Quant Lab pages.

Usage:
  node scripts/generate-quant-static.mjs
  node scripts/generate-quant-static.mjs --source ../web-app-new/migrations/quant_articles.json
  node scripts/generate-quant-static.mjs --articles-dir articles
  node scripts/generate-quant-static.mjs --api

Options:
  --api                 Fetch published articles from the API instead of local Markdown
  --api-base <url>      API base, default: ${DEFAULT_API_BASE}
  --site-base <url>     Public site base, default: ${DEFAULT_SITE_BASE}
  --out <dir>           Output directory under apps/website, default: quant-lab
  --source <json>       Read articles from a JSON file instead of the API
  --articles-dir <dir>  Read local .md files as articles, default: articles
  --no-sitemap          Do not update sitemap.xml
  --no-clean            Do not clear the output directory before generation
`);
}

function resolveSitePath(input) {
  return path.isAbsolute(input) ? input : path.resolve(SITE_DIR, input);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function normalizeArticle(row) {
  const fallbackTs = Date.parse(row.publish_time || row.created_at || '');
  const tags = normalizeTags(row.tags || row.tag || row.category);
  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    subtitle: String(row.subtitle || '').trim(),
    summary: String(row.summary || '').trim(),
    tag: tags[0] || '',
    tags,
    lang: String(row.lang || 'zh').trim(),
    author: String(row.author || 'KairAlert').trim(),
    ts: Number(row.ts) || (Number.isFinite(fallbackTs) ? fallbackTs : 0),
    publish_time: String(row.publish_time || row.created_at || '').trim(),
    content: String(row.content || '').trim(),
    is_draft: row.is_draft === true || row.is_draft === 1,
  };
}

async function loadFromApi(apiBase) {
  const base = apiBase.replace(/\/+$/, '');
  const listBody = await fetchJson(`${base}/quant/articles`);
  const list = Array.isArray(listBody.articles) ? listBody.articles : [];
  const articles = [];

  for (const item of list) {
    const detailBody = await fetchJson(`${base}/quant/articles/${encodeURIComponent(item.id)}`);
    if (detailBody?.article) articles.push(normalizeArticle(detailBody.article));
  }

  return articles;
}

async function loadFromJson(source) {
  const raw = await readJson(resolveSitePath(source));
  const list = Array.isArray(raw) ? raw : raw.articles || raw.results || [];
  return list.map(normalizeArticle);
}

async function loadFromMarkdownDir(articlesDir) {
  const dir = resolveSitePath(articlesDir);
  const files = (await readdir(dir)).filter(name => name.endsWith('.md')).sort();
  const articles = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const rawContent = await readFile(fullPath, 'utf8');
    const { meta, content } = parseFrontMatter(rawContent);
    const firstHeading = /^#\s+(.+)$/m.exec(content);
    const title = String(meta.title || (firstHeading ? firstHeading[1].trim() : path.basename(file, '.md'))).trim();
    const body = firstHeading ? content.replace(/^#\s+.+\n?/, '').trim() : content.trim();
    const publishTime = String(meta.date || meta.publish_time || meta.published || '').trim();

    articles.push(normalizeArticle({
      id: meta.slug || slugify(path.basename(file, '.md')),
      title,
      subtitle: meta.subtitle || '',
      summary: meta.summary || meta.description || '',
      tag: meta.tag || meta.category || '',
      tags: meta.tags || meta.tag || meta.category || '',
      author: meta.author || 'KairAlert',
      lang: meta.lang || 'zh',
      content: body,
      publish_time: publishTime,
      created_at: publishTime,
      is_draft: meta.draft === true || meta.draft === 'true',
    }));
  }

  return articles;
}

function parseFrontMatter(markdown) {
  const text = String(markdown || '').replace(/^\uFEFF/, '');
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { meta: {}, content: text };
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { meta: {}, content: text };

  const rawMeta = normalized.slice(4, end);
  const content = normalized.slice(end + 5).trimStart();

  return { meta: parseSimpleYaml(rawMeta), content };
}

function parseSimpleYaml(source) {
  const meta = {};
  let currentKey = '';

  for (const line of String(source || '').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const continuation = /^\s+(.+)$/.exec(line);
    if (continuation && currentKey) {
      meta[currentKey] = `${meta[currentKey] || ''}\n${continuation[1].trim()}`;
      continue;
    }

    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;

    currentKey = match[1].trim();
    meta[currentKey] = parseYamlValue(match[2].trim());
  }

  return meta;
}

function parseYamlValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(item => parseYamlValue(item.trim()))
      .filter(Boolean);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，]/);
  return [...new Set(raw
    .map(item => String(item || '').trim())
    .filter(Boolean))];
}

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, 'percent')
    .replace(/[\s_]+/g, '-')
    .replace(/[\\/?:#[\]@!$&'()*+,;=.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `article-${Date.now()}`;
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/%2F/gi, '/');
}

function stripMarkdown(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(article) {
  const text = article.summary || article.subtitle || stripMarkdown(article.content);
  return text.slice(0, 96);
}

function displayDate(article) {
  if (!article.publish_time && !article.ts) return '';
  const date = article.publish_time ? new Date(article.publish_time) : new Date(article.ts);
  if (Number.isNaN(date.getTime())) return article.publish_time || '';
  return date.toISOString().slice(0, 10);
}

function urlJoin(base, ...parts) {
  const pathPart = parts
    .map(part => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .map(encodePathSegment)
    .join('/');
  return `${base.replace(/\/+$/, '')}/${pathPart}/`;
}

function pageShell({ title, description, canonical, body, lang = 'zh-Hans', jsonLd = '', assetPrefix = '../' }) {
  return `<!DOCTYPE html>
<html lang="${escapeHtmlAttr(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>${escapeHtmlText(title)}</title>
  <meta name="description" content="${escapeHtmlAttr(description)}">
  <link rel="canonical" href="${escapeHtmlAttr(canonical)}">
  <link rel="icon" type="image/png" href="${assetPrefix}assets/logo_circle.png">
  <link rel="stylesheet" href="${assetPrefix}style.css?v=${ASSET_VERSION}">
  <style>${articleCss()}</style>
  <script type="module" src="${assetPrefix}assets/quant-charts.js"></script>
  ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body class="quant-static-page">
  ${body}
</body>
</html>
`;
}

function articleCss() {
  return `
    .quant-static-page{background:#070707;color:#fff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;min-height:100vh;}
    .quant-static-header{position:sticky;top:0;z-index:20;background:rgba(7,7,7,.84);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.08);}
    .quant-static-nav{max-width:860px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:20px;}
    .quant-static-logo{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;}
    .quant-static-logo img{width:34px;height:34px;border-radius:8px;}
    .quant-static-links{display:flex;gap:16px;align-items:center;font-size:14px;}
    .quant-static-links a{color:rgba(255,255,255,.72);text-decoration:none;}
    .quant-static-main{max-width:860px;margin:0 auto;padding:52px 20px 72px;}
    .quant-static-kicker{display:inline-flex;margin-bottom:18px;padding:7px 10px;border:1px solid rgba(45,212,191,.3);border-radius:999px;background:rgba(45,212,191,.1);color:#5eead4;font-size:12px;font-weight:800;}
    .quant-static-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
    .quant-static-tags .quant-static-kicker{margin-bottom:0;}
    .quant-static-title{margin:0;color:#fff;font-size:clamp(30px,5vw,52px);line-height:1.12;font-weight:850;letter-spacing:0;}
    .quant-static-subtitle{margin:18px 0 0;max-width:720px;color:rgba(226,232,240,.76);font-size:18px;line-height:1.65;}
    .quant-static-meta{margin-top:20px;color:rgba(160,160,160,.78);font-size:13px;font-weight:650;}
    .quant-static-card{margin-top:34px;padding-top:26px;border-top:1px solid rgba(255,255,255,.08);}
    .quant-list{display:grid;gap:0;margin-top:38px;border-top:1px solid rgba(255,255,255,.1);}
    .quant-list-card{display:block;padding:24px 0;border-bottom:1px solid rgba(255,255,255,.1);color:#fff;text-decoration:none;}
    .quant-list-card:hover h2{color:#5eead4;}
    .quant-list-meta{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:12px;}
    .quant-list-date{color:rgba(226,232,240,.58);font-size:13px;font-weight:750;line-height:1;}
    .quant-list-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
    .quant-list-tag{display:inline-flex;max-width:100%;padding:5px 8px;border:1px solid rgba(45,212,191,.26);border-radius:999px;background:rgba(45,212,191,.08);color:#5eead4;font-size:12px;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .quant-list-body{min-width:0;}
    .quant-list-card h2{margin:0;font-size:22px;line-height:1.35;letter-spacing:0;transition:color .16s ease;}
    .quant-list-card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:9px 0 0;color:rgba(226,232,240,.68);font-size:15px;line-height:1.65;}
    .md-root{display:flex;flex-direction:column;align-items:stretch;}
    .md-block{margin-bottom:18px;}
    .md-spacer{height:14px;}
    .md-h1{color:#fff;font-size:21px;font-weight:820;line-height:1.4;}
    .md-h2{position:relative;padding-left:13px;color:#fff;font-size:17px;font-weight:800;line-height:1.5;}
    .md-h2::before{position:absolute;top:.24em;bottom:.22em;left:0;width:3px;border-radius:999px;background:linear-gradient(180deg,#3b82f6,#2dd4bf);content:"";}
    .md-h3{color:#fff;font-size:15px;font-weight:760;line-height:1.5;}
    .md-para,.md-blockquote,.md-ul,.md-ol{color:rgba(226,232,240,.86);font-size:17px;line-height:1.85;}
    .md-para{margin:0;}
    .md-bold{color:rgba(255,255,255,.96);font-weight:760;}
    .md-colored{font-weight:760;}
    .md-italic{font-style:italic;}
    .md-del{text-decoration:line-through;opacity:.65;}
    .md-link{color:#60a5fa;font-weight:650;text-decoration:underline;text-underline-offset:2px;}
    .md-code{padding:2px 6px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(15,23,42,.7);color:#a5f3fc;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;}
    .md-pre{margin:0;overflow-x:auto;border:1px solid rgba(148,163,184,.12);border-radius:12px;background:rgba(2,6,23,.62);}
    .md-codeblock{display:block;padding:15px 16px;color:#e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.6;white-space:pre;}
    .md-table-wrap{overflow-x:auto;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.04);}
    .md-table{width:100%;border-collapse:collapse;table-layout:fixed;}
    .md-table thead tr{background:rgba(96,165,250,.12);}
    .md-table th,.md-table td{padding:10px 12px;text-align:left;font-size:13px;}
    .md-table th{color:#fff;font-weight:750;}
    .md-table td{color:rgba(226,232,240,.74);font-weight:500;}
    .md-table td+td,.md-table th+th{border-left:1px solid rgba(255,255,255,.08);}
    .md-table tbody tr+tr td{border-top:1px solid rgba(255,255,255,.08);}
    .md-image-wrap{overflow:hidden;border-radius:12px;text-align:center;}
    .md-image-wrap img{display:block;width:auto;max-width:100%;max-height:720px;margin:0 auto;object-fit:contain;}
    .md-image-alt{display:block;padding:8px 10px;color:rgba(160,160,160,.82);font-size:12px;line-height:1.4;}
    .md-chart-placeholder{display:block;min-height:84px;padding:16px;border:1px dashed rgba(45,212,191,.25);border-radius:12px;background:rgba(45,212,191,.055);color:rgba(226,232,240,.72);font-size:13px;text-align:center;}
    .md-chart-placeholder>span{display:block;padding:24px 16px;}
    .md-blockquote{margin:0;padding:14px 16px;border:1px solid rgba(96,165,250,.16);border-left:3px solid rgba(96,165,250,.72);border-radius:12px;background:rgba(96,165,250,.075);font-style:italic;}
    .md-hr{border:0;border-top:1px solid rgba(255,255,255,.09);margin:8px 0;}
    @media (max-width:640px){.quant-static-links{display:none}.quant-static-main{padding-top:34px}.md-para,.md-blockquote,.md-ul,.md-ol{font-size:16px}.quant-static-card{margin-top:26px}}
  `;
}

function articlePage(article, slug, siteBase, outRoot) {
  const canonical = urlJoin(siteBase, outRoot, slug);
  const description = excerpt(article);
  const date = displayDate(article);
  const articleHtml = renderMarkdown(article.content);
  const tags = article.tags?.length ? article.tags : ['量化实验室'];
  const tagHtml = tags.map(tag => `<span class="quant-static-kicker">${escapeHtmlText(tag)}</span>`).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description,
    author: { '@type': 'Organization', name: article.author || 'KairAlert' },
    publisher: { '@type': 'Organization', name: 'KairAlert' },
    keywords: tags,
    datePublished: article.publish_time || undefined,
    dateModified: article.publish_time || undefined,
    mainEntityOfPage: canonical,
  }).replace(/</g, '\\u003c');

  return pageShell({
    title: `${article.title} | KairAlert 量化实验室`,
    description,
    canonical,
    jsonLd,
    assetPrefix: '../../',
    body: `
  <header class="quant-static-header">
    <nav class="quant-static-nav">
      <a class="quant-static-logo" href="../../zh/"><img src="../../assets/logo_circle.png" alt="">KairAlert</a>
      <div class="quant-static-links"><a href="../">量化实验室</a><a href="../../zh/">官网</a></div>
    </nav>
  </header>
  <main class="quant-static-main">
    <div class="quant-static-tags">${tagHtml}</div>
    <h1 class="quant-static-title">${escapeHtmlText(article.title)}</h1>
    ${article.subtitle ? `<p class="quant-static-subtitle">${escapeHtmlText(article.subtitle)}</p>` : ''}
    <div class="quant-static-meta">${[date, article.author].filter(Boolean).map(escapeHtmlText).join(' · ')}</div>
    <article class="quant-static-card md-root">${articleHtml}</article>
  </main>`,
  });
}

function indexPage(articles, siteBase, outRoot) {
  const canonical = urlJoin(siteBase, outRoot);
  const cards = articles.map(article => {
    const slug = article.slug;
    const date = displayDate(article);
    const tags = article.tags?.length ? article.tags : ['量化实验室'];
    const tagHtml = tags.map(tag => `<span class="quant-list-tag">${escapeHtmlText(tag)}</span>`).join('');
    return `<a class="quant-list-card" href="./${escapeHtmlAttr(encodePathSegment(slug))}/">
      <div class="quant-list-body">
        <h2>${escapeHtmlText(article.title)}</h2>
        <p>${escapeHtmlText(excerpt(article))}</p>
        <div class="quant-list-meta">
          ${date ? `<span class="quant-list-date">${escapeHtmlText(date)}</span>` : ''}
          <span class="quant-list-tags">${tagHtml}</span>
        </div>
      </div>
    </a>`;
  }).join('\n');

  return pageShell({
    title: 'KairAlert 量化实验室文章',
    description: 'KairAlert 量化实验室发布的数据研究、信号复盘、市场微观结构观察和交易框架文章。',
    canonical,
    body: `
  <header class="quant-static-header">
    <nav class="quant-static-nav">
      <a class="quant-static-logo" href="../zh/"><img src="../assets/logo_circle.png" alt="">KairAlert</a>
      <div class="quant-static-links"><a href="../zh/">官网</a><a href="../">English</a></div>
    </nav>
  </header>
  <main class="quant-static-main">
    <span class="quant-static-kicker">Quant Lab</span>
    <h1 class="quant-static-title">量化实验室</h1>
    <p class="quant-static-subtitle">数据研究、信号复盘、市场微观结构观察，以及面向主动交易者的实战框架。</p>
    <section class="quant-list">${cards}</section>
  </main>`,
  });
}

async function updateSitemap(articles, siteBase, outRoot) {
  const sitemapPath = path.join(SITE_DIR, 'sitemap.xml');
  const urls = [
    { loc: `${siteBase.replace(/\/+$/, '')}/`, priority: '1.0' },
    { loc: urlJoin(siteBase, 'zh'), priority: '0.9' },
    { loc: urlJoin(siteBase, outRoot), priority: '0.8' },
    ...articles.map(article => ({ loc: urlJoin(siteBase, outRoot, article.slug), priority: '0.7' })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
   xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(item => `   <url>
      <loc>${escapeHtmlText(item.loc)}</loc>
      ${item.loc.endsWith('/zh/') || item.loc === `${siteBase.replace(/\/+$/, '')}/`
    ? `<xhtml:link rel="alternate" hreflang="en" href="${siteBase.replace(/\/+$/, '')}/" />
      <xhtml:link rel="alternate" hreflang="zh-Hans" href="${urlJoin(siteBase, 'zh')}" />
      <xhtml:link rel="alternate" hreflang="x-default" href="${siteBase.replace(/\/+$/, '')}/" />`
    : ''}
      <lastmod>${today}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>${item.priority}</priority>
   </url>`).join('\n')}
</urlset>
`;
  await writeFile(sitemapPath, xml, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let articles;

  if (args.source) articles = await loadFromJson(args.source);
  else if (args.useApi) articles = await loadFromApi(args.apiBase);
  else if (args.articlesDir) articles = await loadFromMarkdownDir(args.articlesDir);
  else articles = [];

  articles = articles
    .filter(article => !article.is_draft && article.title && article.content)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0) || a.title.localeCompare(b.title, 'zh-Hans'))
    .map(article => ({ ...article, slug: slugify(article.id || article.title) }));

  const outDir = resolveSitePath(args.out);
  if (args.clean && existsSync(outDir)) await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const article of articles) {
    const articleDir = path.join(outDir, article.slug);
    await mkdir(articleDir, { recursive: true });
    await writeFile(path.join(articleDir, 'index.html'), articlePage(article, article.slug, args.siteBase, args.out), 'utf8');
  }

  await writeFile(path.join(outDir, 'index.html'), indexPage(articles, args.siteBase, args.out), 'utf8');

  if (args.updateSitemap) await updateSitemap(articles, args.siteBase, args.out);

  console.log(`Generated ${articles.length} Quant Lab article page(s) in ${path.relative(SITE_DIR, outDir)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
