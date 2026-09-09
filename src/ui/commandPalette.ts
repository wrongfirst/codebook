import { elements, byId } from '../core/elements';
import { store } from '../core/store';
import { focusEditor } from '../core/editor';
import { ICONS } from './icons';
import { getAllCheatsheets, getDiscoveredLanguages } from '../core/cheatsheets/loader';
import { searchCheatsheets, formatHighlightedTitle } from '../core/cheatsheets/search';
import { renderCheatsheetPreview } from '../core/cheatsheets/highlighter';
import type { CheatsheetSearchResult } from '../core/cheatsheets/types';

let isOpen = false;
let activeScope = 'current';
let selectedIndex = 0;
let currentResults: CheatsheetSearchResult[] = [];
let isMouseDownOnBackdrop = false;

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

  el.input?.addEventListener('input', () => {
    selectedIndex = 0;
    executeSearch();
  });

  el.input?.addEventListener('keydown', handleInputKeyDown);
  el.preview?.addEventListener('keydown', handlePreviewKeyDown);

  el.input?.addEventListener('focus', () => renderFooterHints(false));
  el.preview?.addEventListener('focus', () => renderFooterHints(true));
}

export function openCommandPalette(): void {
  const el = elements.commandPalette;
  if (!el.modal) return;

  // Dismiss other active modals
  elements.shortcuts.modal?.classList.add('hidden');
  elements.shortcuts.modal?.classList.remove('flex');
  elements.settings.modal?.classList.add('hidden');
  elements.settings.modal?.classList.remove('flex');
  const speedrun = byId('speedrun-modal');
  if (speedrun) {
    speedrun.classList.add('hidden');
    speedrun.classList.remove('flex');
  }

  activeScope = 'current';
  selectedIndex = 0;
  if (el.input) {
    el.input.value = '';
  }

  renderScopePills();
  executeSearch();

  el.modal.classList.remove('hidden');
  el.modal.classList.add('flex');
  isOpen = true;

  renderFooterHints(false);
  setTimeout(() => el.input?.focus(), 20);
}

export function closeCommandPalette(): void {
  const el = elements.commandPalette;
  if (!el.modal || !isOpen) return;

  el.modal.classList.add('hidden');
  el.modal.classList.remove('flex');
  isOpen = false;

  focusEditor();
}

export function toggleCommandPalette(): void {
  if (isOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

export function isCommandPaletteOpen(): boolean {
  return isOpen;
}

function getCurrentLangId(): string {
  return store.getState().currentLanguageId || 'python';
}

function renderScopePills(): void {
  const container = elements.commandPalette.pills;
  if (!container) return;

  const currentLang = getCurrentLangId();
  const languages = getDiscoveredLanguages();

  const currentLangName = currentLang.charAt(0).toUpperCase() + currentLang.slice(1);
  const pills: { id: string; label: string }[] = [
    { id: 'current', label: `Current (${currentLangName})` },
    { id: 'all', label: 'All Languages' },
    ...languages
      .filter(l => l.id !== currentLang)
      .map(l => ({ id: l.id, label: l.label })),
  ];

  container.innerHTML = pills.map(p => {
    const isActive = activeScope === p.id;
    const baseClasses = 'px-2.5 py-1 rounded-full text-[11px] border transition-all cursor-pointer select-none whitespace-nowrap';
    const activeClasses = 'bg-brand text-white font-semibold border-brand shadow-xs';
    const inactiveClasses = 'bg-bg-surface text-fg-muted hover:text-fg-primary hover:bg-bg-app border-border-default';

    return `<button type="button" data-scope="${p.id}" class="${baseClasses} ${isActive ? activeClasses : inactiveClasses}">${p.label}</button>`;
  }).join('');

  container.querySelectorAll('button[data-scope]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScope = btn.getAttribute('data-scope');
      if (targetScope && targetScope !== activeScope) {
        activeScope = targetScope;
        selectedIndex = 0;
        renderScopePills();
        executeSearch();
        elements.commandPalette.input?.focus();
      }
    });
  });
}

function executeSearch(): void {
  const query = elements.commandPalette.input?.value || '';
  const currentLang = getCurrentLangId();

  currentResults = searchCheatsheets(query, activeScope, currentLang);
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
        <p class="text-xs">No cheatsheets found matching <span class="font-medium text-fg-primary">"${query}"</span>.</p>
        <p class="text-[11px] mt-1.5 opacity-70">Try switching to "All Languages" or check your spelling.</p>
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
    result.item.codeLang,
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

  if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
    if (currentResults.length > 0) {
      e.preventDefault();
      elements.commandPalette.preview?.focus();
    }
    return;
  }
}

function handlePreviewKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeCommandPalette();
    return;
  }

  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    elements.commandPalette.input?.focus();
    return;
  }

  // Arrow keys and page scrolling handled natively by overflow scroll,
  // but if user types any alphanumeric key, shift focus back to search input
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
    elements.commandPalette.input?.focus();
  }
}

function renderFooterHints(isPreviewFocused: boolean): void {
  const footer = elements.commandPalette.footer;
  if (!footer) return;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘K' : 'Ctrl+K';

  const kbd = (key: string) =>
    `<kbd class="bg-bg-app border border-border-default rounded px-1.5 py-0.5 text-[10px] font-mono text-fg-muted inline-block mr-1">${key}</kbd>`;

  if (isPreviewFocused) {
    footer.innerHTML = `
      <div class="flex items-center gap-3">
        <span>${kbd('↑/↓')} Scroll Doc</span>
        <span>${kbd('Shift+Tab')} Return to Search</span>
      </div>
      <div>${kbd('Esc')} or ${kbd(modKey)} Close</div>
    `;
  } else {
    footer.innerHTML = `
      <div class="flex items-center gap-3">
        <span>${kbd('↑/↓')} Navigate</span>
        <span>${kbd('↵ / Tab')} Focus Preview</span>
      </div>
      <div>${kbd('Esc')} or ${kbd(modKey)} Close</div>
    `;
  }
}
