import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from '../markdown';
import { highlightCodeSnippet } from '../highlighter';

export function highlightSearchTerms(html: string, query: string): string {
  if (!query || query.trim().length === 0) return html;
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return html;
  const regex = new RegExp(`(<[^>]+>)|(${terms.join('|')})`, 'gi');
  return html.replace(regex, (match, tag, term) => {
    if (tag) return tag;
    return `<mark class="search-highlight">${term}</mark>`;
  });
}

const previewMarked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const highlighted = highlightCodeSnippet(text, lang || '');
      return `<pre class="palette-preview-code my-2.5"><code class="hljs">${highlighted}</code></pre>`;
    },
    heading({ text, depth }: { text: string; depth: number }) {
      const sizeClass = depth === 1 ? 'text-lg font-bold' : depth === 2 ? 'text-base font-bold' : 'text-sm font-semibold';
      return `<h${depth} class="${sizeClass} text-fg-primary my-2">${text}</h${depth}>`;
    },
    link({ href, text }: { href: string; text: string }) {
      return `<a href="${escapeHtml(href)}" class="text-brand underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

export function renderCheatsheetPreview(
  title: string,
  rawMarkdown: string,
  searchQuery?: string
): string {
  const parsed = previewMarked.parse(rawMarkdown || '') as string;
  const cleanHtml = DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'strong', 'b', 'em', 'i', 's', 'del', 'mark',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
  });

  const highlightedBody = searchQuery ? highlightSearchTerms(cleanHtml, searchQuery) : cleanHtml;
  const headerHtml = title
    ? `<div class="mb-3 pb-2 border-b border-border-default"><h3 class="text-base font-bold text-fg-primary">${highlightSearchTerms(escapeHtml(title), searchQuery || '')}</h3></div>`
    : '';

  return `<div class="prose prose-sm max-w-none text-fg-primary">${headerHtml}${highlightedBody}</div>`;
}
