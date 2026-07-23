# edge-feed-site
Edge Feed Website

## Generate Quant Lab static pages

Quant Lab articles are generated from local Markdown files in `apps/website/articles/`.

Run from `apps/website`:

```bash
node scripts/generate-quant-static.mjs
```

This will:

- read `articles/*.md`
- generate article pages under `quant-lab/`
- regenerate `quant-lab/index.html`
- update `sitemap.xml`

Useful options:

```bash
# Use another Markdown directory
node scripts/generate-quant-static.mjs --articles-dir articles

# Generate pages without touching sitemap.xml
node scripts/generate-quant-static.mjs --no-sitemap

# Keep existing quant-lab output files instead of cleaning first
node scripts/generate-quant-static.mjs --no-clean
```

Article front matter example:

```md
---
date: 2026-07-13
tags: 引力流指标, 技术分析
summary: 这里写列表页和 SEO 使用的短摘要。
---

# 文章标题

正文内容...
```

Supported metadata:

- `date`: publish date, used for sorting and structured data
- `tag`: one tag, kept for compatibility
- `tags`: multiple tags, comma-separated or array syntax
- `summary`: short excerpt for the article list and meta description
- `title`: optional title override
- `author`: optional author, defaults to `KairAlert`
- `draft: true`: skip generation

After editing any article Markdown, run the generator again before deploying.
