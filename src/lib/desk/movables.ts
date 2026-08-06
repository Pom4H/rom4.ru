/**
 * То, что лежит на самом листе: фотокарточка и заметка на полях.
 *
 * Отличие от канцелярии только в способе крепления — эти вещи сдвигаются
 * трансляцией внутри бумаги (`--dx`/`--dy`), а не позиционируются на столе.
 * Всё остальное общее: та же проекция, тот же принцип «взятая точка едет за
 * курсором», та же устойчивость к прокрутке во время перетаскивания.
 */

import { deskSpace, type Pt } from './space';
import { readJson, writeJson } from './store';

const KEY = 'rom4:movables:v2';

/** Дрожь руки на клике не должна сдвигать карточку. */
const DEAD_ZONE = 3;

/** Двойной щелчок доворачивает карточку — мелочь, но оживляет. */
const TURN_STEP = 4;
const TURN_LIMIT = 12;

interface Saved {
  x: number;
  y: number;
  r: number;
}

interface Hold {
  el: HTMLElement;
  /** Точка листа, за которую взяли, и сдвиг карточки в этот момент. */
  from: Pt;
  dx: number;
  dy: number;
  /** Экранная точка нажатия — от неё отмеряется мёртвая зона. */
  sx: number;
  sy: number;
  /** Последняя точка курсора: по ней жест пересчитывается при прокрутке. */
  cx: number;
  cy: number;
  live: boolean;
  save(): void;
}

export function initMovables() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-movable]'));
  if (!els.length) return;

  const space = deskSpace();
  const saved = readJson<Record<string, Partial<Saved>>>(KEY, {});

  const num = (el: HTMLElement, name: string) =>
    parseFloat(el.style.getPropertyValue(name)) || 0;

  let hold: Hold | null = null;

  function apply(h: Hold, clientX: number, clientY: number) {
    h.cx = clientX;
    h.cy = clientY;
    if (!h.live) {
      if (Math.hypot(clientX - h.sx, clientY - h.sy) < DEAD_ZONE) return;
      h.live = true;
    }
    const now = space.toPaper(clientX, clientY);
    if (!now) return;
    // Сдвиг считается от точки нажатия заново каждый кадр, а не копится по
    // шагам, — поэтому длинный ход не уводит карточку из-под курсора.
    h.el.style.setProperty('--dx', `${(h.dx + now.x - h.from.x).toFixed(1)}px`);
    h.el.style.setProperty('--dy', `${(h.dy + now.y - h.from.y).toFixed(1)}px`);
  }

  for (const el of els) {
    const id = el.dataset.movable ?? '';
    const was = saved[id];
    if (was) {
      el.style.setProperty('--dx', `${was.x ?? 0}px`);
      el.style.setProperty('--dy', `${was.y ?? 0}px`);
      if (was.r) el.style.setProperty('--dr', `${was.r}deg`);
    }

    const save = () => {
      saved[id] = {
        x: +num(el, '--dx').toFixed(1),
        y: +num(el, '--dy').toFixed(1),
        r: +num(el, '--dr').toFixed(1),
      };
      writeJson(KEY, saved);
    };

    el.addEventListener('pointerdown', (event) => {
      // Рука одна: пока карточку не отпустили, вторую не берём.
      if (hold || event.button !== 0) return;
      const from = space.toPaper(event.clientX, event.clientY);
      if (!from) return;
      hold = {
        el,
        from,
        dx: num(el, '--dx'),
        dy: num(el, '--dy'),
        sx: event.clientX,
        sy: event.clientY,
        cx: event.clientX,
        cy: event.clientY,
        live: false,
        save,
      };
      el.dataset.held = 'on';
      el.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    el.addEventListener('pointermove', (event) => {
      if (hold?.el === el) apply(hold, event.clientX, event.clientY);
    });

    const release = (event: PointerEvent) => {
      const h = hold;
      if (!h || h.el !== el) return;
      hold = null;
      delete el.dataset.held;
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {}
      if (h.live) h.save();
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    el.addEventListener('dblclick', () => {
      const next = num(el, '--dr') + TURN_STEP;
      el.style.setProperty('--dr', `${next > TURN_LIMIT ? -TURN_LIMIT : next}deg`);
      save();
    });
  }

  /* Прокрутка во время перетаскивания — не помеха: карточка остаётся под
     курсором, а лист проезжает под ней. */
  window.addEventListener(
    'scroll',
    () => {
      if (hold) apply(hold, hold.cx, hold.cy);
    },
    { passive: true },
  );
}
