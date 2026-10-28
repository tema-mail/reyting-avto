// Статьи-гиды «куда обратиться и как выбрать» к рейтингам ниш: src/data/stati/<ключ ниши>.md.
// Адрес – /novosibirsk/<ниша>/guide/. В тексте метка <!-- reyting --> – сюда встаёт живая таблица рейтинга.
import { u } from './url';

export interface StatyaFm {
  title: string;
  description: string;
  h1: string;
  lead: string;
  date: string;
  updated?: string;
  faq: { q: string; a: string }[];
}

export interface Statya {
  key: string;
  url: string;
  fm: StatyaFm;
  parts: [string, string]; // html до таблицы рейтинга и после
  headings: { depth: number; slug: string; text: string }[];
  words: number;
}

const files = import.meta.glob<any>('../data/stati/*.md', { eager: true });

export const STATI: Statya[] = (
  await Promise.all(
    Object.entries(files).map(async ([path, m]) => {
    const key = path.split('/').pop()!.replace(/\.md$/, '');
    // внутренние ссылки в тексте пишем от корня сайта – добавляем base (Pages: /reyting-avto)
    const html: string = (await m.compiledContent()).replace(/href="(\/[^"\/][^"]*|\/)"/g, (_: string, h: string) => `href="${u(h)}"`);
    const [a, b = ''] = html.split('<!-- reyting -->');
    const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return { key, url: `/novosibirsk/${key}/guide/`, fm: m.frontmatter as StatyaFm, parts: [a, b] as [string, string], headings: m.getHeadings(), words };
    }),
  )
).sort((x, y) => x.key.localeCompare(y.key));

export const statyaOf = (key: string) => STATI.find((s) => s.key === key);
