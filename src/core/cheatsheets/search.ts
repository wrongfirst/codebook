import { Fzf } from 'fzf';
import { getAllCheatsheets } from './loader';
import { escapeHtml } from '../markdown';
import type { CheatsheetItem, CheatsheetSearchResult } from './types';

export function searchCheatsheets(
  query: string,
  scopeId: string,
  currentLangId: string
): CheatsheetSearchResult[] {
  const allItems = getAllCheatsheets();
  const normalizedCurrent = (currentLangId || '').trim().toLowerCase();
  const normalizedScope = (scopeId || 'current').trim().toLowerCase();

  let pool: CheatsheetItem[];
  if (normalizedScope === 'all') {
    pool = allItems;
  } else if (normalizedScope === 'current') {
    pool = allItems.filter(item => item.language === normalizedCurrent);
    if (pool.length === 0) {
      pool = allItems;
    }
  } else {
    pool = allItems.filter(item => item.language === normalizedScope);
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return pool.map(item => ({
      item,
      score: 0,
      positions: new Set<number>(),
    }));
  }

  const titleFzf = new Fzf(pool, {
    selector: (item: CheatsheetItem) => item.title,
    casing: 'smart-case',
  });
  const titleMatches = titleFzf.find(trimmedQuery);

  const matchedIds = new Set(titleMatches.map(m => m.item.id));
  const remaining = pool.filter(item => !matchedIds.has(item.id));

  let contentMatches: typeof titleMatches = [];
  if (remaining.length > 0) {
    const contentFzf = new Fzf(remaining, {
      selector: (item: CheatsheetItem) => item.searchableText,
      casing: 'smart-case',
    });
    contentMatches = contentFzf.find(trimmedQuery);
  }

  return [
    ...titleMatches.map(m => ({
      item: m.item,
      score: m.score + 1000,
      positions: m.positions,
    })),
    ...contentMatches.map(m => ({
      item: m.item,
      score: m.score,
      positions: new Set<number>(),
    })),
  ];
}

export function formatHighlightedTitle(title: string, positions: Set<number>): string {
  if (!positions || positions.size === 0) {
    return escapeHtml(title);
  }

  let html = '';
  let inMark = false;

  for (let i = 0; i < title.length; i++) {
    const isMatch = positions.has(i);
    if (isMatch && !inMark) {
      html += '<mark class="search-highlight">';
      inMark = true;
    } else if (!isMatch && inMark) {
      html += '</mark>';
      inMark = false;
    }
    html += escapeHtml(title[i]);
  }

  if (inMark) {
    html += '</mark>';
  }

  return html;
}
