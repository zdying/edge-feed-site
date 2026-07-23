function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function parseSize(size) {
  if (!size) return '';

  const match = /^([0-9%pxremvwvh]+)?(?:[xX*]([0-9%pxremvwvh]+))?$/i.exec(size.trim());
  if (!match) return '';

  const width = match[1];
  const height = match[2];
  const style = [];

  if (width) style.push(`width:${/^\d+$/.test(width) ? `${width}px` : width}`);
  if (height) style.push(`height:${/^\d+$/.test(height) ? `${height}px` : height}`);

  return style.join(';');
}

function safeColor(value) {
  const color = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^rgba?\([0-9.,% ]+\)$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return '';
}

function imageHtml(alt, src, size) {
  const sizeStyle = parseSize(size);
  const attrStyle = sizeStyle ? ` style="${sizeStyle};object-fit:contain;aspect-ratio:auto"` : '';
  const caption = alt ? `<span class="md-image-alt">${escapeHtml(alt)}</span>` : '';

  return `<div class="md-image-wrap"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy"${attrStyle}>${caption}</div>`;
}

function chartKind(lang) {
  return lang.replace(/^chart(?:\s+|-)?/i, '').trim().toLowerCase();
}

function inline(text) {
  const patterns = [
    {
      re: /<color:([^>]+)>(.*?)<\/color>/,
      build: match => {
        const color = safeColor(match[1]);
        return color ? `<span class="md-colored" style="color:${color}">${escapeHtml(match[2])}</span>` : escapeHtml(match[2]);
      },
    },
    { re: /\*\*([^*\n]+)\*\*/, build: match => `<span class="md-bold">${escapeHtml(match[1])}</span>` },
    { re: /~~([^~\n]+)~~/, build: match => `<del class="md-del">${escapeHtml(match[1])}</del>` },
    { re: /`([^`\n]+)`/, build: match => `<code class="md-code">${escapeHtml(match[1])}</code>` },
    { re: /!\[([^\]\n]*)\]\(([^)\n]+)\)(?:[ \t]*\{([^}]+)\})?/, build: match => imageHtml(match[1], match[2], match[3]) },
    { re: /\[([^\]\n]+)\]\(([^)\n]+)\)/, build: match => `<a class="md-link" href="${escapeAttr(match[2])}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[1])}</a>` },
    { re: /\*([^*\n]+)\*/, build: match => `<em class="md-italic">${escapeHtml(match[1])}</em>` },
    { re: /_([^_\n]+)_/, build: match => `<em class="md-italic">${escapeHtml(match[1])}</em>` },
  ];
  let rest = text;
  let html = '';

  while (rest.length > 0) {
    let best = null;

    for (const pattern of patterns) {
      const match = pattern.re.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { match, pattern };
    }

    if (!best) {
      html += escapeHtml(rest);
      break;
    }

    if (best.match.index > 0) html += escapeHtml(rest.slice(0, best.match.index));
    html += best.pattern.build(best.match);
    rest = rest.slice(best.match.index + best.match[0].length);
  }

  return html;
}

function table(lines) {
  if (lines.length < 2) return '';
  const cells = line => line.slice(1, -1).split('|').map(cell => cell.trim());
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  const head = `<thead><tr>${header.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;

  return `<div class="md-table-wrap"><table class="md-table">${head}${body}</table></div>`;
}

function list(lines, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const cls = ordered ? 'md-ol' : 'md-ul';
  const items = lines.map(line => {
    const text = ordered ? line.replace(/^\d+\.\s*/, '') : line.replace(/^[-*]\s*/, '');
    return `<li>${inline(text)}</li>`;
  });

  return `<${tag} class="${cls}">${items.join('')}</${tag}>`;
}

export function renderMarkdown(markdown) {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      let blanks = 0;
      while (i < lines.length && !lines[i].trim()) {
        blanks++;
        i++;
      }
      if (blanks >= 2) blocks.push('<div class="md-spacer"></div>');
      continue;
    }

    const imageMatch = /^!\[(.*?)\]\((.*?)\)(?:[ \t]*\{([^}]+)\})?[ \t]*$/.exec(trimmed);
    if (imageMatch) {
      blocks.push(imageHtml(imageMatch[1] || '', imageMatch[2] || '', imageMatch[3] || ''));
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      i++;
      if (/^chart\b/i.test(lang)) {
        const kind = chartKind(lang);
        const spec = body.join('\n').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        blocks.push(`<div class="md-chart-placeholder" data-chart-pending="${escapeAttr(kind)}" data-spec="${spec}"><span>图表加载中...</span></div>`);
      } else {
        blocks.push(`<pre class="md-pre"><code class="md-codeblock">${escapeHtml(body.join('\n'))}</code></pre>`);
      }
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(`<div class="md-h1">${inline(trimmed.slice(2).trim())}</div>`);
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(`<div class="md-h2">${inline(trimmed.slice(3).trim())}</div>`);
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(`<div class="md-h3">${inline(trimmed.slice(4).trim())}</div>`);
      i++;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push('<hr class="md-hr">');
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      blocks.push(table(tableLines));
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote class="md-blockquote">${quote.map(inline).join('<br>')}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim());
        i++;
      }
      blocks.push(list(items, false));
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim());
        i++;
      }
      blocks.push(list(items, true));
      continue;
    }

    const paragraph = [];
    while (i < lines.length) {
      const current = lines[i].trim();
      if (!current || current.startsWith('#') || current.startsWith('```') || current.startsWith('|') || current.startsWith('>') || /^[-*]\s/.test(current) || /^\d+\.\s/.test(current)) break;
      paragraph.push(lines[i].trimEnd());
      i++;
    }
    blocks.push(`<p class="md-para">${paragraph.map(inline).join('<br>')}</p>`);
  }

  return blocks.filter(Boolean).map(block => `<div class="md-block">${block}</div>`).join('');
}

export function escapeHtmlText(value) {
  return escapeHtml(value);
}

export function escapeHtmlAttr(value) {
  return escapeAttr(value);
}
