/**
 * Из чего сделан предмет: реестр канцелярии и геометрия одной вещи.
 *
 * Каждый предмет описан двумя концами и тем, что делает хват в трёх зонах
 * между ними, — как настоящий карандаш, который держат по-разному в
 * зависимости от того, что собираются им делать:
 *
 *   ГОЛОВА ──────── СЕРЕДИНА ──────── ХВОСТ
 *   пишет           переносят         вращают вокруг головы
 *
 * Зоны считаются проекцией точки хвата на ось «голова → хвост», а не по
 * длинной стороне окна фигуры: ось — это сам предмет, и работает она при любом
 * повороте и на любом расстоянии от схождения перспективы.
 */

import type { Pt } from './space';

export type Units = readonly [number, number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Точка предмета в единицах его viewBox: числом или выведенная из окна. */
export type Anchor = Units | ((box: Box) => Units);

/** Что делает хват. */
export type Grip = 'move' | 'write' | 'spin' | 'pin';

export interface Tool {
  /** Рабочий конец: им пишут и вокруг него вращают, держа за хвост. */
  head?: Anchor;
  /** Противоположный конец. */
  foot?: Anchor;
  /** Хват в трёх зонах вдоль оси: [у головы, посередине, у хвоста]. */
  zones: readonly [Grip, Grip, Grip];
  /** Границы зон — доли длины, считая от головы. */
  splits?: readonly [number, number];
  /** Радиус стирания в пикселях листа. Ноль — предмет не стирает. */
  erases?: number;
}

/** Кончик пишет, хвост вращает, между ними — перенос. */
const WRITER = ['write', 'move', 'spin'] as const;
const CARRY = ['move', 'move', 'move'] as const;

const DEFAULT_SPLITS = [0.32, 0.62] as const;

export const KIT: Record<string, Tool> = {
  pencil: { head: [6, 15], foot: [310, 15], zones: WRITER },
  stub: { head: [5, 14], foot: [145, 14], zones: WRITER },
  pen: { head: [4, 13], foot: [292, 13], zones: WRITER },
  marker: { head: [8, 21], foot: [242, 21], zones: WRITER },
  // У линейки пишущего конца нет, поэтому концы равноправны: держишь за
  // любой — вращается вокруг противоположного.
  ruler: { head: [22, 8], foot: [22, 412], zones: ['spin', 'move', 'spin'] },
  eraser: { zones: CARRY, erases: 26 },
  // Скрепку не кладут на стол, а надевают на кромку листа — хват у неё один
  // на всю длину. Концы выводим из окна фигуры: скрепки разной длины.
  clip: {
    head: (b) => [b.x + b.w / 2, b.y + 6],
    foot: (b) => [b.x + b.w / 2, b.y + b.h - 6],
    zones: ['pin', 'pin', 'pin'],
  },
};

/** Всё, что в реестре не описано (часы, стикер, биндер), просто переносится. */
const PLAIN: Tool = { zones: CARRY };

/** Живой предмет на столе: разметка плюс всё, что нужно для жестов. */
export interface Prop {
  cast: HTMLElement;
  svg: SVGSVGElement;
  id: string;
  /** Вид следа: `pencil`, `pencil-red` — красный грифель пишет своим цветом. */
  ink: string;
  box: Box;
  tool: Tool;
  /** Пикселей стола на единицу viewBox. */
  k: number;
  deg: number;
  /** Центр фигуры в координатах стола. */
  centre: Pt;
  /** Размер слоя: `--x`/`--y` записаны в его процентах. */
  layerW: number;
  layerH: number;
}

const varNum = (el: Element, name: string) =>
  parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

export function readProp(cast: HTMLElement, layer: HTMLElement): Prop | null {
  const svg = cast.querySelector('svg');
  if (!svg) return null;

  const n = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/\s+/).map(Number);
  const box: Box = { x: n[0], y: n[1], w: n[2], h: n[3] };
  const id = cast.dataset.prop ?? '';

  // Оттенок предмета задан классом `tone-*`: красный карандаш — тот же
  // карандаш, но и след у него должен быть красным.
  const tone = Array.from(svg.classList)
    .find((c) => c.startsWith('tone-'))
    ?.slice(5);

  const prop: Prop = {
    cast,
    svg: svg as SVGSVGElement,
    id,
    ink: tone ? `${id}-${tone}` : id,
    box,
    tool: KIT[id] ?? PLAIN,
    k: 0,
    deg: 0,
    centre: { x: 0, y: 0 },
    layerW: 0,
    layerH: 0,
  };
  remeasure(prop, layer);
  return prop;
}

/**
 * Пересчитать всё, что зависит от размера экрана: масштаб фигуры и центр в
 * пикселях. Предмет при этом остаётся тем же объектом — на него ссылаются
 * и текущий жест, и указатель «какая вещь под курсором».
 */
export function remeasure(p: Prop, layer: HTMLElement) {
  p.layerW = layer.offsetWidth;
  p.layerH = layer.offsetHeight;
  p.k = p.cast.offsetWidth / p.box.w;
  p.deg = varNum(p.svg, '--r');
  p.centre = {
    x: (varNum(p.cast, '--x') / 100) * p.layerW,
    y: (varNum(p.cast, '--y') / 100) * p.layerH,
  };
}

/* ── Геометрия ─────────────────────────────────────────────────────────
   Предмет и слой стола лежат в одной плоскости, поэтому здесь обычная
   двумерная математика: никакой перспективы, её уже сняли в `space`. */

export const rotate = (o: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: o.x * c - o.y * s, y: o.x * s + o.y * c };
};

export function anchorOf(p: Prop, which: 'head' | 'foot'): Units | null {
  const a = p.tool[which];
  if (!a) return null;
  return typeof a === 'function' ? a(p.box) : a;
}

/** Смещение точки фигуры от её центра — в пикселях стола и до поворота. */
const offsetOf = (p: Prop, u: Units): Pt => ({
  x: (u[0] - (p.box.x + p.box.w / 2)) * p.k,
  y: (u[1] - (p.box.y + p.box.h / 2)) * p.k,
});

/** Точка фигуры → координаты стола, с учётом поворота. */
export const pointAt = (p: Prop, u: Units): Pt => {
  const r = rotate(offsetOf(p, u), p.deg);
  return { x: p.centre.x + r.x, y: p.centre.y + r.y };
};

/** Обратно: какая точка фигуры лежит под этой точкой стола. */
export function unitsAt(p: Prop, at: Pt): Units {
  const r = rotate({ x: at.x - p.centre.x, y: at.y - p.centre.y }, -p.deg);
  return [p.box.x + p.box.w / 2 + r.x / p.k, p.box.y + p.box.h / 2 + r.y / p.k];
}

/** Куда встанет центр, чтобы точка `u` фигуры оказалась в точке `at` стола. */
export const centreFor = (p: Prop, u: Units, at: Pt): Pt => {
  const r = rotate(offsetOf(p, u), p.deg);
  return { x: at.x - r.x, y: at.y - r.y };
};

/** Зона хвата: доля вдоль оси «голова → хвост» и что она делает. */
export function zoneAt(p: Prop, at: Pt): { index: 0 | 1 | 2; grip: Grip } {
  const head = anchorOf(p, 'head');
  const foot = anchorOf(p, 'foot');
  if (!head || !foot) return { index: 1, grip: p.tool.zones[1] };

  const ax = foot[0] - head[0];
  const ay = foot[1] - head[1];
  const len2 = ax * ax + ay * ay;
  if (!len2) return { index: 1, grip: p.tool.zones[1] };

  const u = unitsAt(p, at);
  const t = ((u[0] - head[0]) * ax + (u[1] - head[1]) * ay) / len2;

  const [a, b] = p.tool.splits ?? DEFAULT_SPLITS;
  const index = t < a ? 0 : t > b ? 2 : 1;
  return { index, grip: p.tool.zones[index] };
}

/* ── Запись обратно в разметку ───────────────────────────────────────── */

export function place(p: Prop, at: Pt) {
  p.centre = at;
  p.cast.style.setProperty('--x', `${((at.x / p.layerW) * 100).toFixed(3)}%`);
  p.cast.style.setProperty('--y', `${((at.y / p.layerH) * 100).toFixed(3)}%`);
}

export function turn(p: Prop, deg: number) {
  p.deg = deg;
  p.svg.style.setProperty('--r', `${deg.toFixed(1)}deg`);
}
