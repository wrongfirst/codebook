import yaml from 'yaml';
import type { CheatsheetFrontmatter, CheatsheetItem } from './types';

function extractFrontmatter(content: string): { frontmatter: CheatsheetFrontmatter; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: { language: 'general', badge: 'txt', aliases: [] },
      body: content,
    };
  }

  try {
    const parsed = yaml.parse(match[1]) || {};
    const language = String(parsed.language || 'general').trim().toLowerCase();
    const badge = String(parsed.badge || language).trim().toLowerCase();
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.map((a: unknown) => String(a).trim().toLowerCase())
      : [];

    return {
      frontmatter: { language, badge, aliases },
      body: match[2],
    };
  } catch {
    return {
      frontmatter: { language: 'general', badge: 'txt', aliases: [] },
      body: match[2] || content,
    };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

export function parseCheatsheet(rawContent: string): CheatsheetItem[] {
  const { frontmatter, body } = extractFrontmatter(rawContent);
  const sections = body.split(/(?:^|\r?\n)##\s+/);
  const items: CheatsheetItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const newlineIndex = section.indexOf('\n');
    let title = '';
    let sectionBody = '';

    if (newlineIndex === -1) {
      title = section.trim();
      sectionBody = '';
    } else {
      title = section.slice(0, newlineIndex).trim();
      sectionBody = section.slice(newlineIndex + 1).trim();
    }

    if (!title) continue;

    const baseSlug = slugify(title) || `item-${i}`;
    let id = `${frontmatter.language}:${baseSlug}`;
    let counter = 1;
    while (seenIds.has(id)) {
      id = `${frontmatter.language}:${baseSlug}-${counter++}`;
    }
    seenIds.add(id);

    const fenceMatch = sectionBody.match(/```([a-zA-Z0-9_+-]+)/);
    const codeLang = fenceMatch ? fenceMatch[1].toLowerCase() : frontmatter.language;
    const aliases = frontmatter.aliases || [];
    const searchableText = `${title} ${frontmatter.language} ${aliases.join(' ')} ${sectionBody}`.toLowerCase();

    items.push({
      id,
      title,
      language: frontmatter.language,
      badge: frontmatter.badge,
      aliases,
      codeLang,
      rawMarkdown: sectionBody,
      searchableText,
    });
  }

  return items;
}
