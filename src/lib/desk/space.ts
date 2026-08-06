/**
 * Координаты стола — одна система на всё, что можно взять руками.
 *
 * Лист и канцелярия лежат в наклонённой плоскости с перспективой, поэтому
 * пиксель экрана не равен пикселю предмета: у дальней кромки один и тот же
 * сдвиг курсора двигает вещь заметно сильнее, чем у ближней. Раньше это
 * обходили замером — «сдвинем на 100px и посмотрим, куда уехало». Такой базис
 * верен ровно в точке замера, плывёт на длинном ходе и врёт целиком, если во
 * время перетаскивания прокрутить страницу.
 *
 * Здесь считается точное обратное преобразование, а всё остальное отличается
 * от плоскости только вертикальным сдвигом:
 *
 *   экран ──обратная перспектива──▸ плоскость ──+ прокрутка──▸ слой стола
 *                                              ──− кромка листа──▸ лист
 *
 * Слой стола и лист едут вместе (`--desk-shift` и трансляция листа берут ту же
 * прокрутку), поэтому расстояние между ними — постоянная `paperTop`, и переход
 * «стол → лист» от прокрутки не зависит вовсе.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Снимок проекции. Меняется только с размером окна, но не с прокруткой. */
interface Lens {
  left: number;
  top: number;
  /** Центр плоскости в координатах сцены — начало её трансформации. */
  ox: number;
  oy: number;
  /** Тот же центр, но в собственных координатах слоя. На большом экране слой
   *  меньше сцены и увеличен масштабом, поэтому эти два центра не совпадают. */
  lx: number;
  ly: number;
  /** Масштаб сцены: пиксель прокрутки окна — это 1/k пикселя плоскости. */
  zoom: number;
  /** Схождение перспективы. */
  pox: number;
  poy: number;
  dist: number;
  scale: number;
  cos: number;
  sin: number;
  /** Дальняя кромка листа в координатах стола. */
  paperTop: number;
}

export interface DeskSpace {
  /** Наклон включён: работает перспектива. Иначе экран — это и есть документ. */
  tilted(): boolean;
  /** Прокрутка листа в пикселях плоскости. */
  shift(): number;
  /** Дальняя кромка листа в координатах стола (от прокрутки не зависит). */
  paperTop(): number;
  toPlane(clientX: number, clientY: number): Pt | null;
  /** Экран → слой канцелярии. Именно в этих координатах живут предметы. */
  toDesk(clientX: number, clientY: number): Pt | null;
  /** Экран → координаты листа. Работает и без наклона. */
  toPaper(clientX: number, clientY: number): Pt | null;
  deskToPaper(p: Pt): Pt;
  /** Забыть снимок проекции: размер окна или режим сменились. */
  refresh(): void;
}

let shared: DeskSpace | null = null;

/**
 * Проекция у стола одна на всех: и канцелярия снаружи листа, и то, что лежит
 * на самом листе, меряются одной линейкой, и сброс кэша у них общий.
 */
export const deskSpace = (): DeskSpace => (shared ??= createDeskSpace());

function createDeskSpace(): DeskSpace {
  const stage = document.querySelector<HTMLElement>('[data-hexfloat]');
  const plane = document.querySelector<HTMLElement>('[data-hexfloat-plane]');
  const paper = document.querySelector<HTMLElement>('[data-hexfloat-content]');

  let lens: Lens | null = null;

  const tilted = () => document.documentElement.dataset.paperTilt === 'on';

  /**
   * Прокрутка берётся из `window.scrollY`, а не из `--desk-shift`.
   * Число то же самое — переменную пишет HexFloat из этого же значения, — но
   * читать источник надёжнее: иначе результат зависел бы от того, чей
   * обработчик прокрутки успел отработать первым.
   */
  const shift = () => (tilted() ? window.scrollY / (view()?.zoom ?? 1) : 0);

  function measure(): Lens | null {
    if (!stage || !plane || !paper || !tilted()) return null;
    const box = stage.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    const dist = parseFloat(cs.perspective) || 2000;
    const [pox, poy] = cs.perspectiveOrigin.split(' ').map(parseFloat);

    // Плоскость повёрнута вокруг оси X и отмасштабирована: этого хватает,
    // чтобы вынуть угол и масштаб прямо из матрицы.
    const pm = new DOMMatrix(getComputedStyle(plane).transform);
    const scale = pm.m11 || 1;

    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;

    return {
      left: box.left,
      top: box.top,
      ox: box.width / 2,
      oy: box.height / 2,
      lx: plane.offsetWidth / 2,
      ly: plane.offsetHeight / 2,
      zoom,
      pox,
      poy,
      dist,
      scale,
      cos: pm.m22 / scale,
      sin: pm.m23 / scale,
      paperTop: new DOMMatrix(getComputedStyle(paper).transform).m42 + window.scrollY / zoom,
    };
  }

  const view = () => (lens ??= measure());

  function toPlane(clientX: number, clientY: number): Pt | null {
    const v = view();
    if (!v) return null;

    // Вертикаль решается первой: по ней идёт и поворот, и схождение.
    const m = clientY - v.top - v.poy;
    const denom = v.scale * (v.cos + (m * v.sin) / v.dist);
    if (!denom) return null;
    const y = (m - (v.oy - v.poy)) / denom;

    // Глубина найдена — известно и во сколько раз сжата горизонталь.
    const k = v.dist / (v.dist - v.scale * y * v.sin);
    if (!isFinite(k) || k <= 0) return null;
    const x = ((clientX - v.left - v.pox) / k - (v.ox - v.pox)) / v.scale;

    // Смещения посчитаны от центра плоскости — переводим их в её собственные
    // координаты, а там центр свой (слой меньше сцены ровно в --k раз).
    return { x: v.lx + x, y: v.ly + y };
  }

  function toDesk(clientX: number, clientY: number): Pt | null {
    const p = toPlane(clientX, clientY);
    return p && { x: p.x, y: p.y + shift() };
  }

  function paperTop() {
    return view()?.paperTop ?? 0;
  }

  const deskToPaper = (p: Pt): Pt => ({ x: p.x, y: p.y - paperTop() });

  function toPaper(clientX: number, clientY: number): Pt | null {
    // Без наклона лист лежит в обычном потоке: координаты документа и есть
    // координаты листа с точностью до постоянного сдвига, а пользуются
    // отсюда только разностями.
    if (!tilted()) return { x: clientX + window.scrollX, y: clientY + window.scrollY };
    const p = toDesk(clientX, clientY);
    return p && deskToPaper(p);
  }

  const refresh = () => {
    lens = null;
  };

  window.addEventListener('resize', refresh, { passive: true });

  return { tilted, shift, paperTop, toPlane, toDesk, toPaper, deskToPaper, refresh };
}
