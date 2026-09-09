import { parseCheatsheet } from './parser';
import type { CheatsheetItem } from './types';

const cheatsheetModules = import.meta.glob<string>(
  '../../languages/*/cheatsheet.md',
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

  for (const path in cheatsheetModules) {
    const raw = cheatsheetModules[path];
    const content = typeof raw === 'string' ? raw : (raw as { default?: string })?.default || '';
    if (!content.trim()) continue;

    const parsed = parseCheatsheet(content);
    if (parsed.length > 0) {
      items.push(...parsed);

      const sample = parsed[0];
      if (!languageMap.has(sample.language)) {
        languageMap.set(sample.language, {
          id: sample.language,
          badge: sample.badge,
          label: capitalize(sample.language),
        });
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
