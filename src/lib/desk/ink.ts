/**
 * След на бумаге.
 *
 * Слой лежит внутри самого листа, поэтому штрихи едут вместе с бумагой, живут
 * в её координатах и сохраняются как есть. Курсор он не ловит никогда —
 * рисованием управляют предметы.
 */

import type { Pt } from './space';
import { readJson, writeJson } from './store';

const INK_KEY = 'rom4:desk-ink:v1';
/** Потолок на хранимое: localStorage не резиновый, а рисовать можно вечно. */
const INK_BUDGET = 180_000;
/** Точки ближе этого расстояния (в пикселях листа) не записываются. */
const MIN_STEP = 2.5;
/** Короче этого штрих не след, а промах по кнопке. */
const MIN_STROKE = 2;

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Stroke {
  /** Вид следа: pencil | pencil-red | stub | pen | marker */
  t: string;
  /** Плоский список координат листа: [x, y, x, y, …] */
  p: number[];
}

/** Один штрих, пока его ведут. */
export interface Trace {
  push(at: Pt): void;
  /** Отпустили. Возвращает `true`, если след остался. */
  end(): boolean;
}

export interface Ink {
  begin(kind: string, at: Pt): Trace;
  /** Стирает всё, до чего дотянулись. Возвращает `true`, если что-то стёрлось. */
  erase(at: Pt, reach: number): boolean;
  save(): void;
}

function pathFor(s: Stroke) {
  const p = s.p;
  if (p.length < 4) return `M${p[0]} ${p[1]} L${p[0] + 0.1} ${p[1]}`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
  return d;
}

export function createInk(paper: HTMLElement): Ink {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'desk-ink');
  svg.setAttribute('aria-hidden', 'true');
  paper.appendChild(svg);

  let strokes: Stroke[] = readJson<Stroke[]>(INK_KEY, []);

  function render() {
    svg.replaceChildren();
    for (const s of strokes) svg.appendChild(nodeFor(s));
  }

  function nodeFor(s: Stroke) {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('class', `ink ink-${s.t}`);
    el.setAttribute('d', pathFor(s));
    return el;
  }

  render();

  return {
    begin(kind, at) {
      const stroke: Stroke = { t: kind, p: [+at.x.toFixed(1), +at.y.toFixed(1)] };
      const node = nodeFor(stroke);
      strokes.push(stroke);
      svg.appendChild(node);

      return {
        push(next) {
          const p = stroke.p;
          if (Math.hypot(p[p.length - 2] - next.x, p[p.length - 1] - next.y) < MIN_STEP) return;
          p.push(+next.x.toFixed(1), +next.y.toFixed(1));
          node.setAttribute('d', pathFor(stroke));
        },
        end() {
          if (stroke.p.length >= MIN_STROKE * 2) return true;
          // Просто щёлкнули кончиком — точку не оставляем, это чаще промах.
          strokes = strokes.filter((s) => s !== stroke);
          node.remove();
          return false;
        },
      };
    },

    erase(at, reach) {
      const before = strokes.length;
      strokes = strokes.filter((s) => {
        for (let i = 0; i < s.p.length; i += 2) {
          if (Math.hypot(s.p[i] - at.x, s.p[i + 1] - at.y) < reach) return false;
        }
        return true;
      });
      if (strokes.length === before) return false;
      render();
      return true;
    },

    save() {
      // Бюджет вышел — забываем самое старое, а не теряем всё.
      while (JSON.stringify(strokes).length > INK_BUDGET && strokes.length > 1) {
        strokes = strokes.slice(Math.ceil(strokes.length / 8));
      }
      writeJson(INK_KEY, strokes);
    },
  };
}
