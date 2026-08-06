/**
 * Стол как рабочая поверхность: канцелярию можно двигать, вращать и писать ею
 * по газете. Всё, что пользователь наделал, лежит в localStorage и переживает
 * перезагрузку. Работает только в режиме наклона: канцелярия существует лишь
 * там.
 *
 * Система собрана из четырёх частей, и каждая отвечает ровно за одно:
 *
 *   space — экран → плоскость стола (единственное место, где есть перспектива)
 *   kit   — из чего сделан предмет: концы, зоны хвата, его геометрия
 *   ink   — след на бумаге
 *   clip  — скрепка на кромке листа
 *
 * Здесь остаются только жесты. Два правила, на которых всё держится:
 *
 *  1. Предмет держат ЗА ТОЧКУ. При нажатии считается, какая именно точка
 *     фигуры оказалась под курсором, и дальше эта точка едет за курсором —
 *     предмет не прыгает под руку и не уползает на длинном ходе.
 *
 *  2. Жест живёт в координатах стола, а не экрана. Никаких «сдвинулся на
 *     столько-то пикселей»: каждый кадр положение считается заново из текущей
 *     точки курсора. Поэтому прокрутка во время перетаскивания ничего не ломает
 *     — предмет остаётся под курсором, а стол проезжает под ним.
 */

import { deskSpace, type Pt } from './space';
import {
  anchorOf,
  centreFor,
  place,
  pointAt,
  readProp,
  remeasure,
  turn,
  unitsAt,
  zoneAt,
  type Grip,
  type Prop,
  type Units,
} from './kit';
import { createInk, type Trace } from './ink';
import { edgesOf, pinTo, retrim, unpin, type Edge } from './clip';
import { readJson, writeJson } from './store';

const PROPS_KEY = 'rom4:desk-props:v1';

/** Дрожь руки на клике не должна ни двигать предмет, ни срывать скрепку. */
const DEAD_ZONE = 3;

interface Saved {
  x: number;
  y: number;
  r?: number;
  pin?: string;
}

interface Hold {
  prop: Prop;
  grip: Grip;
  /** Точка фигуры, за которую взялись, — она и обязана ехать за курсором. */
  grabbed: Units;
  /** Для вращения: неподвижный узел и угол в момент нажатия. */
  pivot: Units | null;
  pivotAt: Pt | null;
  deg0: number;
  ang0: number;
  trace: Trace | null;
  pointerId: number;
  /** Экранная точка нажатия — от неё отмеряется мёртвая зона. */
  sx: number;
  sy: number;
  /** Последняя точка курсора: по ней жест пересчитывается при прокрутке. */
  cx: number;
  cy: number;
  /** Жест начался: курсор ушёл дальше мёртвой зоны. */
  live: boolean;
  /** Предмет сдвинулся / бумага изменилась — есть что сохранять. */
  moved: boolean;
  inked: boolean;
}

export function initDeskTools() {
  const layer = document.querySelector<HTMLElement>('.desk-props');
  const paper = document.querySelector<HTMLElement>('[data-hexfloat-content]');
  if (!layer || !paper) return;

  const casts = Array.from(layer.querySelectorAll<HTMLElement>('.prop-cast'));
  if (!casts.length) return;

  const space = deskSpace();
  const ink = createInk(paper);

  const props = casts
    .map((cast) => readProp(cast, layer))
    .filter((p): p is Prop => p !== null);
  const byCast = new Map(props.map((p) => [p.cast, p] as const));

  let edges: Edge[] | null = null;
  const edgeList = () => (edges ??= edgesOf(layer, paper, space));

  /* ── Что было в прошлый раз ─────────────────────────────────────────── */
  readJson<Saved[]>(PROPS_KEY, []).forEach((saved, i) => {
    const prop = props[i];
    if (!prop || !saved) return;
    place(prop, {
      x: (saved.x / 100) * prop.layerW,
      y: (saved.y / 100) * prop.layerH,
    });
    if (typeof saved.r === 'number') turn(prop, saved.r);
    if (saved.pin) {
      prop.cast.dataset.pinned = 'on';
      prop.cast.dataset.edge = saved.pin;
    } else {
      unpin(prop);
    }
  });

  function saveProps() {
    writeJson(
      PROPS_KEY,
      props.map((p) => ({
        x: +((p.centre.x / p.layerW) * 100).toFixed(2),
        y: +((p.centre.y / p.layerH) * 100).toFixed(2),
        r: +p.deg.toFixed(1),
        pin: p.cast.dataset.pinned ? p.cast.dataset.edge ?? '' : '',
      })),
    );
  }

  /* Размеры слоя и фигур привязаны к ширине экрана, а разрез проволоки у
     скрепок — ещё и к кромке листа. Разметка приходит с грубым делением
     пополам, точная точка известна только в браузере, поэтому режем сразу. */
  const relayout = () => {
    space.refresh();
    edges = null;
    for (const p of props) remeasure(p, layer);
    retrim(props, edgeList());
  };

  relayout();
  window.addEventListener('resize', relayout, { passive: true });
  // Высота листа меняется и без окна — от шрифтов, от раскрытых блоков,
  // а по ней проходит нижняя кромка, на которую садятся скрепки.
  new ResizeObserver(() => {
    edges = null;
    retrim(props, edgeList());
  }).observe(paper);

  /* ── Жест ───────────────────────────────────────────────────────────── */
  let hold: Hold | null = null;

  const propUnder = (target: EventTarget | null) => {
    const cast = (target as Element | null)?.closest?.<HTMLElement>('.prop-cast');
    return cast ? byCast.get(cast) ?? null : null;
  };

  layer.addEventListener('pointerdown', (event) => {
    // Рука одна: пока предмет не отпустили, второй не берём.
    if (hold || event.button !== 0) return;
    const prop = propUnder(event.target);
    if (!prop) return;
    const at = space.toDesk(event.clientX, event.clientY);
    if (!at) return;
    event.preventDefault();

    const zone = zoneAt(prop, at);
    // Вращают вокруг ПРОТИВОПОЛОЖНОГО конца: держишь за хвост — ось в кончике.
    const pivot = zone.index === 0 ? anchorOf(prop, 'foot') : anchorOf(prop, 'head');
    const head = anchorOf(prop, 'head');
    const grip: Grip = zone.grip === 'spin' && !pivot ? 'move' : zone.grip;

    const pivotAt = grip === 'spin' && pivot ? pointAt(prop, pivot) : null;

    hold = {
      prop,
      grip,
      grabbed: unitsAt(prop, at),
      pivot: pivotAt ? pivot : null,
      pivotAt,
      deg0: prop.deg,
      ang0: pivotAt ? Math.atan2(at.y - pivotAt.y, at.x - pivotAt.x) : 0,
      trace:
        grip === 'write' && head
          ? ink.begin(prop.ink, space.deskToPaper(pointAt(prop, head)))
          : null,
      pointerId: event.pointerId,
      sx: event.clientX,
      sy: event.clientY,
      cx: event.clientX,
      cy: event.clientY,
      live: false,
      moved: false,
      inked: false,
    };

    prop.cast.classList.add('is-held');
    prop.cast.dataset.grab = grip;
    try {
      prop.cast.setPointerCapture(event.pointerId);
    } catch {}
  });

  /** Пересчитать жест целиком из текущей точки курсора. */
  function apply(h: Hold, clientX: number, clientY: number) {
    h.cx = clientX;
    h.cy = clientY;
    if (!h.live) {
      if (Math.hypot(clientX - h.sx, clientY - h.sy) < DEAD_ZONE) return;
      h.live = true;
    }

    const at = space.toDesk(clientX, clientY);
    if (!at) return;
    const p = h.prop;

    if (h.grip === 'spin' && h.pivot && h.pivotAt) {
      const ang = Math.atan2(at.y - h.pivotAt.y, at.x - h.pivotAt.x);
      turn(p, h.deg0 + ((ang - h.ang0) * 180) / Math.PI);
      // Ось обязана остаться на месте: центр доводим под новый угол.
      place(p, centreFor(p, h.pivot, h.pivotAt));
    } else if (h.grip === 'pin') {
      pinTo(p, edgeList(), h.grabbed, at);
    } else {
      // Взятая точка встаёт ровно под курсор.
      place(p, centreFor(p, h.grabbed, at));
    }
    h.moved = true;

    if (h.trace) {
      // След идёт из самого кончика, а не из-под курсора.
      const head = anchorOf(p, 'head');
      if (head) h.trace.push(space.deskToPaper(pointAt(p, head)));
    }

    if (p.tool.erases && ink.erase(space.deskToPaper(p.centre), p.tool.erases)) {
      h.inked = true;
    }
  }

  layer.addEventListener('pointermove', (event) => {
    if (hold) apply(hold, event.clientX, event.clientY);
    else hint(event);
  });

  /* Прокрутка во время жеста — не помеха: предмет остаётся под курсором,
     а стол проезжает под ним. Пересчитываем по последней точке курсора. */
  window.addEventListener(
    'scroll',
    () => {
      if (hold) apply(hold, hold.cx, hold.cy);
    },
    { passive: true },
  );

  function release(event: PointerEvent) {
    const h = hold;
    if (!h || event.pointerId !== h.pointerId) return;
    hold = null;

    h.prop.cast.classList.remove('is-held');
    delete h.prop.cast.dataset.grab;
    try {
      h.prop.cast.releasePointerCapture(h.pointerId);
    } catch {}

    const drew = h.trace ? h.trace.end() : false;
    if (h.moved) saveProps();
    if (drew || h.inked) ink.save();
  }

  layer.addEventListener('pointerup', release);
  layer.addEventListener('pointercancel', release);

  /* Курсор подсказывает, что сделает хват: у пишущих предметов кончик пишет,
     хвост вращает, середина переносит. */
  function hint(event: PointerEvent) {
    const prop = propUnder(event.target);
    if (!prop) return;
    const at = space.toDesk(event.clientX, event.clientY);
    if (!at) return;
    prop.cast.dataset.zone = zoneAt(prop, at).grip;
  }

  /* `pointerleave` слою не приходит — он сам курсор не ловит, ловят фигуры.
     Уход с фигуры виден по всплывающему `pointerout`. */
  layer.addEventListener('pointerout', (event) => {
    if (hold) return;
    const prop = propUnder(event.target);
    if (prop) delete prop.cast.dataset.zone;
  });
}
