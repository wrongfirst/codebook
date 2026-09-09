import { parseCheatsheet } from './parser';
import type { CheatsheetItem } from './types';
import { enabledLanguageIds } from '../../languages/language-registry';

const cheatsheetModules = import.meta.glob<string>(
  '../../../cheatsheets/**/*.{md,markdown}',
  { query: '?raw', eager: true, import: 'default' }
);

export interface DiscoveredLanguage {
  id: string;
  badge: string;
  label: string;
}

let cachedItems: CheatsheetItem[] | null = null;
let cachedLanguages: DiscoveredLanguage[] | null = null;

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function loadAllCheatsheets(): CheatsheetItem[] {
  if (cachedItems !== null) {
    return cachedItems;
  }

  const items: CheatsheetItem[] = [];
  const languageMap = new Map<string, DiscoveredLanguage>();
  const enabledSet = new Set(enabledLanguageIds.map(id => id.toLowerCase()));

  for (const path in cheatsheetModules) {
    const raw = cheatsheetModules[path];
    const content = typeof raw === 'string' ? raw : (raw as { default?: string })?.default || '';
    if (!content.trim()) continue;

    const filename = path.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || '';
    const fallbackLang = filename.toLowerCase() !== 'cheatsheet' ? filename.toLowerCase() : '';

    const parsed = parseCheatsheet(content, fallbackLang || undefined);
    const enabledParsed = parsed.filter(item => enabledSet.has(item.language.toLowerCase()));

    if (enabledParsed.length > 0) {
      items.push(...enabledParsed);

      for (const item of enabledParsed) {
        if (!languageMap.has(item.language)) {
          languageMap.set(item.language, {
            id: item.language,
            badge: item.badge,
            label: capitalize(item.language),
          });
        }
      }
    }
  }

  cachedItems = items;
  cachedLanguages = Array.from(languageMap.values());
  return cachedItems;
}

export function getAllCheatsheets(): CheatsheetItem[] {
  return cachedItems !== null ? cachedItems : loadAllCheatsheets();
}

export function getDiscoveredLanguages(): DiscoveredLanguage[] {
  if (cachedLanguages === null) {
    loadAllCheatsheets();
  }
  return cachedLanguages || [];
}

export function getCheatsheetsByLanguage(langId: string): CheatsheetItem[] {
  const normalized = (langId || '').trim().toLowerCase();
  return getAllCheatsheets().filter(item => item.language === normalized);
}
