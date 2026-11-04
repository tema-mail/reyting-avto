// Блог (владелец 03–04.11.2026): общий /blog/<slug>/ и блоги городов /<город>/blog/<slug>/. Статьи – src/data/blog/<slug>.md,
// ТЗ авторам – ~/Sites/reytingi/docs/seo/blog/BRIEF.md. В frontmatter: gorod – статья города (нет – общий блог),
// nisha – в тексте метка <!-- reyting --> под живую таблицу рейтинга ниши города, partner – статья «Выбор редакции».
import { u } from './url';

export const RUBRIKI = ['Как выбрать', 'Цены', 'Законы и документы', 'Сезон', 'Исследования', 'Выбор редакции'] as const;

export interface BlogFm {
  title: string;
  description: string;
  h1: string;
  lead: string;
  date: string;
  updated?: string;
  rubrika: (typeof RUBRIKI)[number];
  gorod?: string;
  nisha?: string;
  partner?: string;
  faq: { q: string; a: string }[];
}

export interface BlogPost {
  slug: string;
  url: string;
  fm: BlogFm;
  parts: [string, string]; // html до таблицы рейтинга и после
  headings: { depth: number; slug: string; text: string }[];
  words: number;
}

const files = import.meta.glob<any>('../data/blog/*.md', { eager: true });

export const BLOG: BlogPost[] = (
  await Promise.all(
    Object.entries(files).map(async ([path, m]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const fm = m.frontmatter as BlogFm;
      if (!RUBRIKI.includes(fm.rubrika)) throw new Error(`blog/${slug}.md: рубрика «${fm.rubrika}» не из списка`);
      // внутренние ссылки от корня – с base (Pages); внешние – в новой вкладке
      const html: string = (await m.compiledContent())
        .replace(/href="(\/[^"\/][^"]*|\/)"/g, (_: string, h: string) => `href="${u(h)}"`)
        .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
      const [a, b = ''] = html.split('<!-- reyting -->');
      if (fm.nisha && !b) throw new Error(`blog/${slug}.md: указана ниша, но нет метки <!-- reyting -->`);
      const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      const url = fm.gorod ? `/${fm.gorod}/blog/${slug}/` : `/blog/${slug}/`;
      return { slug, url, fm, parts: [a, b] as [string, string], headings: m.getHeadings(), words };
    }),
  )
).sort((x, y) => y.fm.date.localeCompare(x.fm.date) || x.slug.localeCompare(y.slug));

/** Статьи блога города (без общих). */
export const blogOf = (gorod: string) => BLOG.filter((p) => p.fm.gorod === gorod);
/** Общий блог. */
export const BLOG_OBSHCHIY = BLOG.filter((p) => !p.fm.gorod);
/** Города, где есть хотя бы одна статья: только у них страница блога и ссылка на неё. */
export const BLOG_GORODA = [...new Set(BLOG.map((p) => p.fm.gorod).filter(Boolean))] as string[];
