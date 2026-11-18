import { Fragment, type ReactNode } from 'react';
import Box from '@mui/material/Box';

/**
 * Rendu Markdown minimal et SÛR (aucun HTML injecté) pour les contenus
 * éditables par l'admin : ## titres, listes « - » / « 1. », **gras**, *italique*,
 * [liens](https://…), paragraphes.
 */
export function Markdown({ source }: { source: string }) {
  return (
    <Box
      sx={{
        color: 'text.primary',
        lineHeight: 1.7,
        '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 5, mb: 2 },
        '& h3': { fontSize: '1.0625rem', fontWeight: 600, mt: 4, mb: 1.5 },
        '& > :first-of-type': { mt: 0 },
        '& p': { my: 2 },
        '& ul, & ol': { pl: 5, my: 2 },
        '& li': { my: 1 },
        '& a': { color: 'primary.main', fontWeight: 500 },
      }}
    >
      {renderBlocks(source)}
    </Box>
  );
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(' '))}</p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
      out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      out.push(h[1].length === 2 ? <h2 key={out.length}>{inline(h[2])}</h2> : <h3 key={out.length}>{inline(h[2])}</h3>);
    } else if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out;
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4]) {
      parts.push(
        <a key={m.index} href={m[5]} target="_blank" rel="noopener noreferrer">
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
