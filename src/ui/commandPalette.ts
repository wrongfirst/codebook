import { elements } from '../core/elements';
import { store } from '../core/store';
import { focusEditor } from '../core/editor';
import { ICONS } from './icons';
import { getActiveLanguageId } from '../language';
import { getAllCheatsheets } from '../core/cheatsheets/loader';
import { searchCheatsheets, formatHighlightedTitle } from '../core/cheatsheets/search';
import { renderCheatsheetPreview } from '../core/cheatsheets/highlighter';
import { escapeHtml } from '../core/markdown';
import type { CheatsheetSearchResult } from '../core/cheatsheets/types';

let isOpen = false;
let selectedIndex = 0;
let currentResults: CheatsheetSearchResult[] = [];
let isMouseDownOnBackdrop = false;
let previouslyFocusedElement: HTMLElement | null = null;

export function initCommandPalette(): void {
  const el = elements.commandPalette;
  if (!el.modal) return;

  if (el.searchIcon) {
    el.searchIcon.innerHTML = ICONS.SEARCH;
  }
  if (el.closeBtn) {
    el.closeBtn.innerHTML = ICONS.CLOSE;
  }

  // Eagerly populate cheatsheet cache
  getAllCheatsheets();

  el.closeBtn?.addEventListener('click', closeCommandPalette);

  el.modal.addEventListener('mousedown', (e) => {
    isMouseDownOnBackdrop = (e.target === el.modal);
  });

  el.modal.addEventListener('click', (e) => {
    if (isMouseDownOnBackdrop && e.target === el.modal) {
      closeCommandPalette();
    }
    isMouseDownOnBackdrop = false;
  });

  el.modal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeCommandPalette();
    }
  });

  el.input?.addEventListener('input', () => {
    selectedIndex = 0;
    executeSearch();
  });

  el.input?.addEventListener('keydown', handleInputKeyDown);
  el.preview?.addEventListener('keydown', handlePreviewKeyDown);
}

export function openCommandPalette(): void {
  const el = elements.commandPalette;
  if (!el.modal) return;

  previouslyFocusedElement = document.activeElement as HTMLElement | null;

  // Dismiss other active modals
  elements.shortcuts.modal?.classList.add('hidden');
  elements.shortcuts.modal?.classList.remove('flex');
  elements.settings.modal?.classList.add('hidden');
  elements.settings.modal?.classList.remove('flex');
  elements.speedrun.modal?.classList.add('hidden');
  elements.speedrun.modal?.classList.remove('flex');

  selectedIndex = 0;
  if (el.input) {
    el.input.value = '';
  }

  executeSearch();

  el.modal.classList.remove('hidden');
  el.modal.classList.add('flex');
  isOpen = true;

  renderFooterHints();
  setTimeout(() => el.input?.focus(), 20);
}

export function closeCommandPalette(): void {
  const el = elements.commandPalette;
  if (!el.modal || !isOpen) return;

  el.modal.classList.add('hidden');
  el.modal.classList.remove('flex');
  isOpen = false;

  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function' && document.body.contains(previouslyFocusedElement)) {
    previouslyFocusedElement.focus();
  } else {
    focusEditor();
  }
  previouslyFocusedElement = null;
}

export function toggleCommandPalette(): void {
  if (isOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function executeSearch(): void {
  const query = elements.commandPalette.input?.value || '';
  const currentLang = getActiveLanguageId();

  currentResults = searchCheatsheets(query, currentLang);
  if (selectedIndex >= currentResults.length) {
    selectedIndex = Math.max(0, currentResults.length - 1);
  }

  renderResultsList();
  renderPreview();
}

function renderResultsList(): void {
  const container = elements.commandPalette.results;
  if (!container) return;

  if (currentResults.length === 0) {
    const query = elements.commandPalette.input?.value || '';
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center p-6 text-center text-fg-muted">
        <p class="text-xs">No cheatsheets found matching <span class="font-medium text-fg-primary">"${escapeHtml(query)}"</span>.</p>
        <p class="text-[11px] mt-1.5 opacity-70">Try searching for concepts like "comprehension", "nullish", or filter with "python", "ts".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentResults.map((res, idx) => {
    const isSelected = idx === selectedIndex;
    const highlightedTitle = formatHighlightedTitle(res.item.title, res.positions);
    const rowClass = isSelected
      ? 'bg-brand/10 border-l-2 border-brand text-fg-primary font-medium'
      : 'hover:bg-bg-app text-fg-primary/85 border-l-2 border-transparent';

    return `
      <div data-index="${idx}" class="flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors text-xs ${rowClass}">
        <span class="truncate pr-2">${highlightedTitle}</span>
        <span class="shrink-0 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-bg-app border border-border-default text-fg-muted">${res.item.badge}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('div[data-index]').forEach(row => {
    row.addEventListener('click', () => {
      const idx = Number(row.getAttribute('data-index'));
      if (!isNaN(idx)) {
        selectedIndex = idx;
        renderResultsList();
        renderPreview();
        scrollToSelectedRow();
      }
    });
  });

  scrollToSelectedRow();
}

function scrollToSelectedRow(): void {
  const container = elements.commandPalette.results;
  if (!container) return;
  const row = container.querySelector(`div[data-index="${selectedIndex}"]`) as HTMLElement | null;
  row?.scrollIntoView({ block: 'nearest' });
}

function renderPreview(): void {
  const container = elements.commandPalette.preview;
  if (!container) return;

  if (currentResults.length === 0 || !currentResults[selectedIndex]) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center text-fg-muted">
        <p class="text-xs">No entry selected</p>
      </div>
    `;
    return;
  }

  const result = currentResults[selectedIndex];
  const query = elements.commandPalette.input?.value || '';
  container.innerHTML = renderCheatsheetPreview(
    result.item.title,
    result.item.rawMarkdown,
    query
  );
}

function handleInputKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeCommandPalette();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentResults.length > 0) {
      selectedIndex = (selectedIndex + 1) % currentResults.length;
      renderResultsList();
      renderPreview();
    }
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentResults.length > 0) {
      selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
      renderResultsList();
      renderPreview();
    }
    return;
  }

  if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    return;
  }
}

function handlePreviewKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Tab') {
    e.preventDefault();
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeCommandPalette();
    return;
  }

  // Arrow keys and page scrolling handled natively by overflow scroll,
  // but if user types any alphanumeric key, shift focus back to search input
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
    elements.commandPalette.input?.focus();
  }
}

function renderFooterHints(): void {
  const footer = elements.commandPalette.footer;
  if (!footer) return;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘K' : 'Ctrl+K';

  const kbd = (key: string) =>
    `<kbd class="bg-bg-app border border-border-default rounded px-1.5 py-0.5 text-[10px] font-mono text-fg-muted inline-block mr-1">${key}</kbd>`;

  footer.innerHTML = `
    <div class="flex items-center gap-3">
      <span>${kbd('↑/↓')} Navigate</span>
    </div>
    <div>${kbd('Esc')} or ${kbd(modKey)} Close</div>
  `;
}
