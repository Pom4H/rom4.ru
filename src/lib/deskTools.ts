/**
 * Стол как рабочая поверхность: канцелярию можно двигать, вращать и писать ею
 * по газете. Всё, что пользователь наделал, лежит в localStorage и переживает
 * перезагрузку.
 *
 * Предмет держат за одну из трёх зон вдоль его длинной оси, и от места хвата
 * зависит жест — как с настоящим карандашом:
 *
 *  • ЗА ХВОСТ  — вращение вокруг пишущего кончика (кончик стоит на месте);
 *  • ЗА СЕРЕДИНУ — перенос;
 *  • ЗА КОНЧИК — письмо: предмет едет за курсором и оставляет след, причём
 *    след идёт из самого кончика, а не из-под курсора.
 *
 * Линейка не пишет, зато у неё равноправны оба конца: держишь за любой —
 * вращается вокруг противоположного. Ластик стирает всё, над чем его проносят.
 * Скрепка не лежит на столе, а надевается на кромку газеты и ездит по её
 * периметру. Стикер и биндер просто переносятся.
 *
 * Работает только в режиме наклона: канцелярия существует лишь там.
 */

const PROPS_KEY = 'rom4:desk-props:v1';
const INK_KEY = 'rom4:desk-ink:v1';

/** Потолок на хранимое: localStorage не резиновый, а рисовать можно вечно. */
const INK_BUDGET = 180_000;
/** Точки ближе этого расстояния (в координатах листа) не записываются. */
const MIN_STEP = 2.5;
/** Границы зон вдоль длинной оси, считая от кончика. */
const TIP_ZONE = 0.32;
const TAIL_ZONE = 0.62;

interface Stroke {
  /** Идентификатор инструмента: pencil | stub | pen | marker */
  t: string;
  /** Плоский список координат листа: [x, y, x, y, …] */
  p: number[];
}

interface Kit {
  /** Пишущий кончик в единицах viewBox — вокруг него идёт вращение за хвост. */
  tip?: [number, number];
  /** Второй конец. Есть только у линейки: её крутят с обеих сторон. */
  tail?: [number, number];
  writes?: boolean;
  erases?: boolean;
  /** Радиус стирания в координатах листа. */
  reach?: number;
  /** Скрепка: надевается на кромку листа, если поднести достаточно близко. */
  pins?: boolean;
  /** Концы берутся из viewBox: у скрепок он разной высоты, длина у каждой своя. */
  endsFromBox?: boolean;
}

/** Ближе этого расстояния до кромки скрепка защёлкивается, дальше — снимается. */
const PIN_REACH = 46;

const KIT: Record<string, Kit> = {
  pencil: { tip: [6, 15], writes: true },
  stub: { tip: [5, 14], writes: true },
  pen: { tip: [4, 13], writes: true },
  marker: { tip: [8, 21], writes: true },
  // У линейки пишущего конца нет, поэтому оба края равноправны: держишь за
  // один — вращается вокруг другого.
  ruler: { tip: [22, 8], tail: [22, 412] },
  eraser: { erases: true, reach: 26 },
  clip: { pins: true, endsFromBox: true },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим или переполнение — молча теряем, это украшение */
  }
}

export function initDeskTools() {
  const stage = document.querySelector<HTMLElement>('[data-hexfloat]');
  const plane = document.querySelector<HTMLElement>('[data-hexfloat-plane]');
  const paper = document.querySelector<HTMLElement>('[data-hexfloat-content]');
  const layer = document.querySelector<HTMLElement>('.desk-props');
  if (!stage || !plane || !paper || !layer) return;

  const casts = Array.from(layer.querySelectorAll<HTMLElement>('.prop-cast'));
  if (!casts.length) return;

  const varNum = (el: HTMLElement, name: string) =>
    parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;

  /* ── Экран → плоскость стола ──────────────────────────────────────────
     Точное обратное преобразование: масштаб и поворот вокруг оси X, а затем
     перспективная проекция относительно её origin. Всё остальное (лист,
     слой канцелярии) отличается от плоскости лишь вертикальным сдвигом. */
  function toPlane(clientX: number, clientY: number) {
    const box = stage!.getBoundingClientRect();
    const cs = getComputedStyle(stage!);
    const dist = parseFloat(cs.perspective) || 2000;
    const [pox, poy] = cs.perspectiveOrigin.split(' ').map(parseFloat);

    const pm = new DOMMatrix(getComputedStyle(plane!).transform);
    const scale = pm.m11 || 1;
    const cosA = pm.m22 / scale;
    const sinA = pm.m23 / scale;

    const ox = box.width / 2;
    const oy = box.height / 2;
    const ys = clientY - box.top;

    const m = ys - poy;
    const denom = scale * (cosA + (m * sinA) / dist);
    if (!denom) return null;
    const v = (m - (oy - poy)) / denom;

    const k = dist / (dist - scale * v * sinA);
    if (!isFinite(k) || k <= 0) return null;
    const u = ((clientX - box.left - pox) / k - (ox - pox)) / scale;

    return { x: ox + u, y: oy + v };
  }

  const deskShift = () => varNum(document.documentElement, '--desk-shift');
  const paperShift = () =>
    new DOMMatrix(getComputedStyle(paper!).transform).m42;

  /** Слой канцелярии сдвинут прокруткой, лист — своей трансляцией. */
  const planeToLayer = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + deskShift() });
  const layerToPaper = (p: { x: number; y: number }) => ({
    x: p.x,
    y: p.y - deskShift() - paperShift(),
  });

  /* ── Геометрия предмета ──────────────────────────────────────────────
     Позиция задана процентами слоя, поворот — переменной на самой фигуре.
     Кончик считается в координатах слоя, без всякой перспективы: слой и
     предмет живут в одной плоскости. */
  interface Geom {
    id: string;
    svg: SVGSVGElement;
    /** viewBox целиком: у скрепки начало координат смещено, центр не w/2. */
    vb: { x: number; y: number; w: number; h: number };
    kit: Kit;
    /** Пикселей слоя на единицу viewBox. */
    k: number;
    deg: number;
    centre: { x: number; y: number };
  }

  function geom(cast: HTMLElement): Geom | null {
    const svg = cast.querySelector('svg');
    if (!svg) return null;
    const n = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/\s+/).map(Number);
    const vb = { x: n[0], y: n[1], w: n[2], h: n[3] };
    const id = cast.dataset.prop ?? '';
    let kit = KIT[id] ?? {};
    if (kit.endsFromBox) {
      // Скрепка вытянута по вертикали, и её длина у каждой своя — концы
      // выводим из окна фигуры, а не прописываем числами.
      const cx = vb.x + vb.w / 2;
      kit = { ...kit, tip: [cx, vb.y + 6], tail: [cx, vb.y + vb.h - 6] };
    }
    return {
      id,
      svg: svg as SVGSVGElement,
      vb,
      kit,
      k: cast.offsetWidth / vb.w,
      deg: varNum(svg as unknown as HTMLElement, '--r'),
      centre: {
        x: (varNum(cast, '--x') / 100) * layer!.offsetWidth,
        y: (varNum(cast, '--y') / 100) * layer!.offsetHeight,
      },
    };
  }

  /** Смещение точки фигуры от её центра, в пикселях слоя и до поворота. */
  const offsetOf = (g: Geom, units: [number, number]) => ({
    x: (units[0] - (g.vb.x + g.vb.w / 2)) * g.k,
    y: (units[1] - (g.vb.y + g.vb.h / 2)) * g.k,
  });

  const rotated = (o: { x: number; y: number }, deg: number) => {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: o.x * c - o.y * s, y: o.x * s + o.y * c };
  };

  /** Точка фигуры (в единицах viewBox) в координатах слоя, с учётом поворота. */
  const pointOf = (g: Geom, units: [number, number]) => {
    const r = rotated(offsetOf(g, units), g.deg);
    return { x: g.centre.x + r.x, y: g.centre.y + r.y };
  };

  /** Пишущий кончик — он же точка, из которой идёт след. */
  const tipOf = (g: Geom) => pointOf(g, g.kit.tip ?? [g.vb.x + g.vb.w / 2, g.vb.y + g.vb.h / 2]);

  const setCentre = (cast: HTMLElement, x: number, y: number) => {
    cast.style.setProperty('--x', `${(x / layer!.offsetWidth) * 100}%`);
    cast.style.setProperty('--y', `${(y / layer!.offsetHeight) * 100}%`);
  };

  /** Доля вдоль длинной оси, считая от кончика: 0 — кончик, 1 — хвост. */
  function grabZone(g: Geom, clientX: number, clientY: number) {
    if (!g.kit.tip) return 'move' as const;
    const ctm = g.svg.getScreenCTM();
    if (!ctm) return 'move' as const;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const wide = g.vb.w >= g.vb.h;
    const span = wide ? g.vb.w : g.vb.h;
    const from = wide ? g.vb.x : g.vb.y;
    const along = ((wide ? p.x : p.y) - from) / span;
    // Кончик может быть нарисован с любого края — считаем долю от него.
    const fromTip = (g.kit.tip[wide ? 0 : 1] - from) / span > 0.5 ? 1 - along : along;
    if (fromTip < TIP_ZONE) return 'tip' as const;
    if (fromTip > TAIL_ZONE) return 'tail' as const;
    return 'move' as const;
  }

  /* ── Скрепка на кромке ───────────────────────────────────────────────
     Скрепка надевается на край газеты: у кромки она защёлкивается на
     ближайшую точку периметра и разворачивается поперёк. Но только у кромки —
     если оттащить дальше, скрепка снимается и остаётся лежать на столе,
     сохраняя свой угол. Иначе её нельзя было бы открепить. */
  /**
   * Обрезает внутреннюю проволоку ровно по кромке листа.
   *
   * Резать по фиксированным 50% нельзя: середина проволоки не совпадает с
   * центром фигуры, а при сдвиге вдоль кромки или на верхнем/нижнем крае
   * расхождение растёт. Поэтому считаем точку пересечения отрезка проволоки
   * с линией кромки и рисуем только ту часть, что лежит на столе.
   * `pathLength="100"` в разметке нормирует путь, так что доли сразу
   * ложатся в `stroke-dasharray`.
   */
  function trimTongue(cast: HTMLElement, axis: 'x' | 'y', at: number, deskSide: number) {
    const tongue = cast.querySelector<SVGPathElement>('.clip-tongue');
    const g = geom(cast);
    if (!tongue || !g) return;

    const total = tongue.getTotalLength();
    const end = (len: number) => {
      const p = tongue.getPointAtLength(len);
      return pointOf(g, [p.x, p.y]);
    };
    const a = end(0);
    const b = end(total);
    const va = a[axis] - at;
    const vb = b[axis] - at;

    const show = (from: number, to: number) => {
      tongue.style.strokeDasharray = `${(to - from) * 100} 100`;
      tongue.style.strokeDashoffset = `${-from * 100}`;
    };

    if (va === vb) return;
    const t = Math.min(Math.max(va / (va - vb), 0), 1);
    // Рисуем ту половину, что осталась на столе; вторая ушла под лист.
    if (Math.sign(va) === deskSide) show(0, t);
    else show(t, 1);
  }

  /** Ось, координата и сторона стола для кромки, записанной буквой. */
  function edgeSpec(edge: string) {
    const left = 0;
    const right = layer!.offsetWidth;
    const top = paperShift() + deskShift();
    const bottom = top + paper!.offsetHeight;
    if (edge === 'l') return { axis: 'x' as const, at: left, deskSide: -1 };
    if (edge === 'r') return { axis: 'x' as const, at: right, deskSide: 1 };
    if (edge === 't') return { axis: 'y' as const, at: top, deskSide: -1 };
    return { axis: 'y' as const, at: bottom, deskSide: 1 };
  }

  /** Снятая скрепка снова показывает проволоку целиком. */
  function unpin(cast: HTMLElement) {
    delete cast.dataset.pinned;
    delete cast.dataset.edge;
    const tongue = cast.querySelector<SVGPathElement>('.clip-tongue');
    if (!tongue) return;
    tongue.style.strokeDasharray = 'none';
    tongue.style.strokeDashoffset = '0';
  }

  function pinToEdge(cast: HTMLElement, planePt: { x: number; y: number }) {
    const l = planeToLayer(planePt);
    const left = 0;
    const right = layer!.offsetWidth;
    const top = paperShift() + deskShift();
    const bottom = top + paper!.offsetHeight;
    const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

    /* Кромки листа: у каждой своя ось, координата и сторона, где стол.
       Угол не произвольный: скрепку надевают ЗАКРЫТЫМ сгибом вперёд, а
       открытые концы проволоки остаются снаружи. В рисунке широкий сгиб —
       наверху фигуры, то есть в её локальном −Y, и этот конец обязан смотреть
       НА лист. Отсюда разные углы у противоположных кромок: раньше слева и
       справа стояло одинаковое значение, и с одной стороны скрепка садилась
       наоборот — концами вперёд. */
    const d = [
      { v: Math.abs(l.x - left), x: left, y: clamp(l.y, top, bottom), deg: 90,
        edge: 'l', axis: 'x' as const, at: left, deskSide: -1 },
      { v: Math.abs(right - l.x), x: right, y: clamp(l.y, top, bottom), deg: -90,
        edge: 'r', axis: 'x' as const, at: right, deskSide: 1 },
      { v: Math.abs(l.y - top), x: clamp(l.x, left, right), y: top, deg: 180,
        edge: 't', axis: 'y' as const, at: top, deskSide: -1 },
      { v: Math.abs(bottom - l.y), x: clamp(l.x, left, right), y: bottom, deg: 0,
        edge: 'b', axis: 'y' as const, at: bottom, deskSide: 1 },
    ].reduce((a, b) => (b.v < a.v ? b : a));

    if (d.v > PIN_REACH) {
      // Далеко от кромки — скрепка снята: просто лежит там, куда её принесли,
      // и снова видна целиком.
      setCentre(cast, l.x, l.y);
      unpin(cast);
      return;
    }

    setCentre(cast, d.x, d.y);
    cast.querySelector('svg')?.style.setProperty('--r', `${d.deg}deg`);
    cast.dataset.pinned = 'on';
    cast.dataset.edge = d.edge;
    trimTongue(cast, d.axis, d.at, d.deskSide);
  }

  /* ── Сохранение ──────────────────────────────────────────────────────── */
  function saveProps() {
    writeJson(
      PROPS_KEY,
      casts.map((cast) => {
        const svg = cast.querySelector('svg') as unknown as HTMLElement | null;
        return {
          x: +varNum(cast, '--x').toFixed(2),
          y: +varNum(cast, '--y').toFixed(2),
          r: svg ? +varNum(svg, '--r').toFixed(1) : 0,
          pin: cast.dataset.pinned ? cast.dataset.edge ?? '' : '',
        };
      }),
    );
  }

  readJson<Array<{ x: number; y: number; r?: number; pin?: string }>>(PROPS_KEY, []).forEach((pos, i) => {
    const cast = casts[i];
    if (!cast || !pos) return;
    cast.style.setProperty('--x', `${pos.x}%`);
    cast.style.setProperty('--y', `${pos.y}%`);
    if (typeof pos.r === 'number') {
      cast.querySelector('svg')?.style.setProperty('--r', `${pos.r}deg`);
    }
    if (pos.pin) {
      cast.dataset.pinned = 'on';
      cast.dataset.edge = pos.pin;
    } else {
      delete cast.dataset.pinned;
      delete cast.dataset.edge;
    }
  });

  /* Разрез проволоки у уже надетых скрепок считаем сразу: разметка приходит
     с грубым делением пополам, а точная кромка известна только в браузере.
     И пересчитываем при изменении размеров — доля зависит и от ширины слоя,
     и от размера самой фигуры, а он привязан к ширине экрана. */
  function retrimAll() {
    casts.forEach((cast) => {
      if (!cast.dataset.pinned) return;
      const e = edgeSpec(cast.dataset.edge ?? 'l');
      trimTongue(cast, e.axis, e.at, e.deskSide);
    });
  }

  retrimAll();
  window.addEventListener('resize', retrimAll, { passive: true });

  /* ── Слой чернил ─────────────────────────────────────────────────────
     SVG внутри самого листа: штрихи едут вместе с бумагой, живут в её
     координатах и поэтому сохраняются как есть. Курсор он не ловит никогда —
     рисованием управляют сами предметы. */
  const ink = document.createElementNS(SVG_NS, 'svg');
  ink.setAttribute('class', 'desk-ink');
  ink.setAttribute('aria-hidden', 'true');
  paper.appendChild(ink);

  let strokes: Stroke[] = readJson<Stroke[]>(INK_KEY, []);

  function pathFor(s: Stroke) {
    const p = s.p;
    if (p.length < 4) return `M${p[0]} ${p[1]} L${p[0] + 0.1} ${p[1]}`;
    let d = `M${p[0]} ${p[1]}`;
    for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
    return d;
  }

  function render() {
    ink.replaceChildren();
    for (const s of strokes) {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('class', `ink ink-${s.t}`);
      el.setAttribute('d', pathFor(s));
      ink.appendChild(el);
    }
  }

  function saveInk() {
    // Бюджет вышел — забываем самое старое, а не теряем всё.
    while (JSON.stringify(strokes).length > INK_BUDGET && strokes.length > 1) {
      strokes = strokes.slice(Math.ceil(strokes.length / 8));
    }
    writeJson(INK_KEY, strokes);
  }

  function eraseAt(x: number, y: number, reach: number) {
    const before = strokes.length;
    strokes = strokes.filter((s) => {
      for (let i = 0; i < s.p.length; i += 2) {
        if (Math.hypot(s.p[i] - x, s.p[i + 1] - y) < reach) return false;
      }
      return true;
    });
    if (strokes.length !== before) render();
    return strokes.length !== before;
  }

  render();

  /* ── Жесты ───────────────────────────────────────────────────────────── */
  interface Drag {
    cast: HTMLElement;
    g: Geom;
    mode: 'move' | 'rotate' | 'tip';
    /** Узел, вокруг которого идёт вращение, в единицах viewBox. */
    pivotUnits?: [number, number] | null;
    /** Экранная точка нажатия — от неё считается перенос. */
    sx: number;
    sy: number;
    /** Матрица «проценты → пиксели экрана» для переноса. */
    basis?: { a: number; b: number; c: number; d: number; x0: number; y0: number };
    /** Для вращения: неподвижный кончик и угол в момент нажатия. */
    pivot?: { x: number; y: number };
    deg0?: number;
    ang0?: number;
    stroke?: Stroke;
    live?: SVGPathElement;
    dirty?: boolean;
    /** Жест начался: курсор ушёл дальше мёртвой зоны. */
    active?: boolean;
  }

  /** Дрожь руки на клике не должна ни двигать предмет, ни срывать скрепку. */
  const DEAD_ZONE = 3;

  let drag: Drag | null = null;

  const centreOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /** Локальная матрица «1% слоя → пиксели экрана» для текущего положения. */
  function basisOf(cast: HTMLElement) {
    const x0 = varNum(cast, '--x');
    const y0 = varNum(cast, '--y');
    const c0 = centreOf(cast);
    cast.style.setProperty('--x', `${x0 + 1}%`);
    const cx = centreOf(cast);
    cast.style.setProperty('--x', `${x0}%`);
    cast.style.setProperty('--y', `${y0 + 1}%`);
    const cy = centreOf(cast);
    cast.style.setProperty('--y', `${y0}%`);
    return { x0, y0, a: cx.x - c0.x, b: cx.y - c0.y, c: cy.x - c0.x, d: cy.y - c0.y };
  }

  function pushPoint(d: Drag) {
    if (!d.stroke || !d.live) return;
    const g = geom(d.cast);
    if (!g) return;
    const t = layerToPaper(tipOf(g));
    const p = d.stroke.p;
    if (Math.hypot(p[p.length - 2] - t.x, p[p.length - 1] - t.y) < MIN_STEP) return;
    p.push(+t.x.toFixed(1), +t.y.toFixed(1));
    d.live.setAttribute('d', pathFor(d.stroke));
  }

  layer.addEventListener('pointerdown', (event) => {
    const prop = (event.target as Element | null)?.closest?.('.prop');
    const cast = prop?.closest<HTMLElement>('.prop-cast');
    if (!cast) return;
    const g = geom(cast);
    if (!g) return;
    event.preventDefault();

    /* Что делает хват, зависит от предмета:
       за хвост — вращение вокруг кончика; за кончик — письмо, если предмет
       пишет, а если нет, но у него описан второй конец (линейка), то вращение
       вокруг ЭТОГО конца; всё прочее — перенос. */
    const zone = grabZone(g, event.clientX, event.clientY);
    let mode: Drag['mode'] = 'move';
    let pivotUnits: [number, number] | null = null;
    if (zone === 'tail' && g.kit.tip) {
      mode = 'rotate';
      pivotUnits = g.kit.tip;
    } else if (zone === 'tip') {
      if (g.kit.writes) mode = 'tip';
      else if (g.kit.tail) {
        mode = 'rotate';
        pivotUnits = g.kit.tail;
      }
    }

    drag = { cast, g, mode, sx: event.clientX, sy: event.clientY, pivotUnits };
    cast.classList.add('is-held');
    cast.dataset.grab = mode;
    try {
      cast.setPointerCapture(event.pointerId);
    } catch {}

    if (mode === 'rotate' && pivotUnits) {
      const pivot = pointOf(g, pivotUnits);
      const p = toPlane(event.clientX, event.clientY);
      if (!p) return;
      const l = planeToLayer(p);
      drag.pivot = pivot;
      drag.deg0 = g.deg;
      drag.ang0 = Math.atan2(l.y - pivot.y, l.x - pivot.x);
      return;
    }

    drag.basis = basisOf(cast);

    if (mode === 'tip' && g.kit.writes) {
      const t = layerToPaper(tipOf(g));
      drag.stroke = { t: g.id, p: [+t.x.toFixed(1), +t.y.toFixed(1)] };
      strokes.push(drag.stroke);
      drag.live = document.createElementNS(SVG_NS, 'path');
      drag.live.setAttribute('class', `ink ink-${g.id}`);
      drag.live.setAttribute('d', pathFor(drag.stroke));
      ink.appendChild(drag.live);
    }
  });

  layer.addEventListener('pointermove', (event) => {
    if (!drag) {
      hint(event);
      return;
    }
    const d = drag;
    if (!d.active) {
      if (Math.hypot(event.clientX - d.sx, event.clientY - d.sy) < DEAD_ZONE) return;
      d.active = true;
    }

    if (d.mode === 'rotate') {
      const p = toPlane(event.clientX, event.clientY);
      if (!p || !d.pivot || !d.pivotUnits || d.deg0 === undefined || d.ang0 === undefined) return;
      const l = planeToLayer(p);
      const ang = Math.atan2(l.y - d.pivot.y, l.x - d.pivot.x);
      const deg = d.deg0 + ((ang - d.ang0) * 180) / Math.PI;
      const svg = d.cast.querySelector('svg');
      svg?.style.setProperty('--r', `${deg.toFixed(1)}deg`);
      // Повёрнутая скрепка уже не сидит поперёк кромки — значит, снята,
      // и проволока обязана вернуться целиком.
      if (d.g.kit.pins) unpin(d.cast);
      // Ось обязана остаться на месте: сдвигаем центр на разницу поворотов.
      const g = geom(d.cast);
      if (g) {
        const r = rotated(offsetOf(g, d.pivotUnits), deg);
        setCentre(d.cast, d.pivot.x - r.x, d.pivot.y - r.y);
      }
      d.dirty = true;
      return;
    }

    if (d.g.kit.pins) {
      const p = toPlane(event.clientX, event.clientY);
      if (p) {
        pinToEdge(d.cast, p);
        d.dirty = true;
      }
      return;
    }

    const b = d.basis;
    if (!b) return;
    const dx = event.clientX - d.sx;
    const dy = event.clientY - d.sy;
    const det = b.a * b.d - b.b * b.c;
    if (!det) return;
    d.cast.style.setProperty('--x', `${b.x0 + (b.d * dx - b.c * dy) / det}%`);
    d.cast.style.setProperty('--y', `${b.y0 + (b.a * dy - b.b * dx) / det}%`);
    d.dirty = true;

    if (d.stroke) pushPoint(d);

    if (d.g.kit.erases) {
      const g = geom(d.cast);
      if (g) {
        const c = layerToPaper(g.centre);
        if (eraseAt(c.x, c.y, g.kit.reach ?? 24)) d.dirty = true;
      }
    }
  });

  function endDrag(event: PointerEvent) {
    if (!drag) return;
    const d = drag;
    d.cast.classList.remove('is-held');
    delete d.cast.dataset.grab;
    try {
      d.cast.releasePointerCapture(event.pointerId);
    } catch {}
    if (d.stroke && d.stroke.p.length < 4) {
      // Просто щёлкнули кончиком — точки не оставляем, это чаще промах.
      strokes = strokes.filter((s) => s !== d.stroke);
      d.live?.remove();
    }
    if (d.dirty) saveProps();
    if (d.stroke || d.g.kit.erases) saveInk();
    drag = null;
  }

  layer.addEventListener('pointerup', endDrag);
  layer.addEventListener('pointercancel', endDrag);

  /* Подсказка курсором: у пишущих предметов кончик пишет, хвост вращает. */
  function hint(event: PointerEvent) {
    const prop = (event.target as Element | null)?.closest?.('.prop');
    const cast = prop?.closest<HTMLElement>('.prop-cast');
    if (!cast) return;
    const g = geom(cast);
    if (!g) return;
    const zone = grabZone(g, event.clientX, event.clientY);
    cast.dataset.zone = zone === 'tip' && !g.kit.writes ? 'move' : zone;
  }

  layer.addEventListener('pointerleave', () => {
    casts.forEach((cast) => delete cast.dataset.zone);
  });
}
