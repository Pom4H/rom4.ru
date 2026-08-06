/**
 * Скрепка на кромке.
 *
 * Скрепку не кладут на стол, а надевают на край газеты: у кромки она
 * защёлкивается и разворачивается поперёк, дальше — снимается и остаётся
 * лежать там, куда её принесли. Иначе её нельзя было бы открепить.
 *
 * Место хвата при этом сохраняется: поперёк кромки скрепку держит сама кромка,
 * а вдоль — курсор, за который её и тянут.
 */

import type { DeskSpace, Pt } from './space';
import { centreFor, place, pointAt, turn, type Prop } from './kit';

/**
 * Ближе этого расстояния скрепка защёлкивается на кромку, дальше этого —
 * снимается. Пороги разные намеренно: расстояние меряется в пикселях СТОЛА, а
 * у дальней кромки перспектива сжимает стол вчетверо, и там дрожь курсора в
 * десяток пикселей — это уже полсотни пикселей стола. С одним порогом надетая
 * скрепка срывалась от любого поперечного движения; снять её теперь можно
 * только осознанным рывком в сторону.
 */
const PIN_REACH = 46;
const UNPIN_REACH = 130;

export interface Edge {
  key: string;
  axis: 'x' | 'y';
  /** Координата кромки по своей оси, в пикселях стола. */
  at: number;
  /** С какой стороны от кромки стол: −1 или +1. */
  deskSide: number;
  /** Угол, под которым скрепка садится на эту кромку. */
  deg: number;
  /** Отрезок кромки по второй оси. */
  from: number;
  to: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Кромки листа в координатах стола.
 *
 * Угол не произвольный: скрепку надевают ЗАКРЫТЫМ сгибом вперёд, открытые
 * концы проволоки остаются снаружи. В рисунке широкий сгиб — наверху фигуры,
 * то есть в её локальном −Y, и этот конец обязан смотреть НА лист. Отсюда
 * разные углы у противоположных кромок.
 */
export function edgesOf(layer: HTMLElement, paper: HTMLElement, space: DeskSpace): Edge[] {
  const left = 0;
  const right = layer.offsetWidth;
  const top = space.paperTop();
  const bottom = top + paper.offsetHeight;
  return [
    { key: 'l', axis: 'x', at: left, deskSide: -1, deg: 90, from: top, to: bottom },
    { key: 'r', axis: 'x', at: right, deskSide: 1, deg: -90, from: top, to: bottom },
    { key: 't', axis: 'y', at: top, deskSide: -1, deg: 180, from: left, to: right },
    { key: 'b', axis: 'y', at: bottom, deskSide: 1, deg: 0, from: left, to: right },
  ];
}

export const edgeByKey = (edges: Edge[], key: string) =>
  edges.find((e) => e.key === key) ?? edges[0];

/** Ближайшая кромка к точке стола и расстояние до неё. */
export function nearestEdge(edges: Edge[], at: Pt) {
  return edges
    .map((edge) => ({ edge, dist: Math.abs((edge.axis === 'x' ? at.x : at.y) - edge.at) }))
    .reduce((a, b) => (b.dist < a.dist ? b : a));
}


/**
 * Обрезает внутреннюю проволоку ровно по кромке листа.
 *
 * Резать по фиксированным 50% нельзя: середина проволоки не совпадает с
 * центром фигуры, а при сдвиге вдоль кромки расхождение растёт. Считаем точку
 * пересечения отрезка проволоки с линией кромки и рисуем только ту часть, что
 * лежит на столе. `pathLength="100"` в разметке нормирует путь, так что доли
 * сразу ложатся в `stroke-dasharray`.
 */
export function trimTongue(prop: Prop, edge: Edge) {
  const tongue = prop.cast.querySelector<SVGPathElement>('.clip-tongue');
  if (!tongue) return;

  const total = tongue.getTotalLength();
  const end = (len: number) => {
    const p = tongue.getPointAtLength(len);
    return pointAt(prop, [p.x, p.y]);
  };
  const a = end(0)[edge.axis] - edge.at;
  const b = end(total)[edge.axis] - edge.at;
  if (a === b) return;

  const t = clamp(a / (a - b), 0, 1);
  // Рисуем ту половину, что осталась на столе; вторая ушла под лист.
  const [from, to] = Math.sign(a) === edge.deskSide ? [0, t] : [t, 1];
  tongue.style.strokeDasharray = `${(to - from) * 100} 100`;
  tongue.style.strokeDashoffset = `${-from * 100}`;
}

/** Снятая скрепка снова показывает проволоку целиком. */
export function unpin(prop: Prop) {
  delete prop.cast.dataset.pinned;
  delete prop.cast.dataset.edge;
  const tongue = prop.cast.querySelector<SVGPathElement>('.clip-tongue');
  if (!tongue) return;
  tongue.style.strokeDasharray = 'none';
  tongue.style.strokeDashoffset = '0';
}

/**
 * Сажает скрепку на кромку так, чтобы взятая точка осталась под курсором.
 * Возвращает `false`, если кромка слишком далеко и скрепку сняли.
 */
export function pinTo(prop: Prop, edges: Edge[], grabbed: readonly [number, number], at: Pt) {
  const { edge, dist } = nearestEdge(edges, at);
  if (dist > (prop.cast.dataset.pinned ? UNPIN_REACH : PIN_REACH)) {
    unpin(prop);
    place(prop, centreFor(prop, grabbed, at));
    return false;
  }

  turn(prop, edge.deg);
  const centre = centreFor(prop, grabbed, at);
  // Поперёк кромки скрепку держит кромка, вдоль — курсор.
  if (edge.axis === 'x') {
    centre.x = edge.at;
    centre.y = clamp(centre.y, edge.from, edge.to);
  } else {
    centre.y = edge.at;
    centre.x = clamp(centre.x, edge.from, edge.to);
  }
  place(prop, centre);

  prop.cast.dataset.pinned = 'on';
  prop.cast.dataset.edge = edge.key;
  trimTongue(prop, edge);
  return true;
}

/** Пересчитать разрез проволоки у всех надетых скрепок. */
export function retrim(props: Prop[], edges: Edge[]) {
  for (const prop of props) {
    if (!prop.cast.dataset.pinned) continue;
    trimTongue(prop, edgeByKey(edges, prop.cast.dataset.edge ?? 'l'));
  }
}
