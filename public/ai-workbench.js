/* Progressive enhancement only. No model, external request, or backend write. */
(() => {
  'use strict';
  const root = document.querySelector('.ai-sheet');
  if (!root || root.dataset.enhanced) return;
  root.dataset.enhanced = 'true';
  const descriptions = {
    research: ['Исследовать', 'Разобраться в незнакомой теме. Сопоставить источники. Найти вопрос, который ещё никто не задал.'],
    model: ['Моделировать', 'Собрать модель из своих допущений. Менять условия и проверять, от чего зависит результат.'],
    create: ['Создавать', 'Сделать рабочий прототип, исследование или инструмент. Проверить идею на практике и доработать её.'],
    verify: ['Проверять', 'Открыть первоисточник. Повторить расчёт. Найти противоречие и вернуть вывод на проверку.'],
  };
  root.querySelectorAll('[data-mode]').forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-mode');
      if (!key || !(key in descriptions)) return;
      root.querySelectorAll('[data-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      const orbit = root.querySelector('.a-orbit');
      const label = root.querySelector('[data-mode-label]');
      const copy = root.querySelector('[data-mode-copy]');
      if (orbit) orbit.setAttribute('data-capability', key);
      if (label) label.textContent = descriptions[key][0];
      if (copy) copy.textContent = descriptions[key][1];
    });
  });
  const themeButton = root.querySelector('[data-theme-toggle]');
  if (themeButton) {
    const syncTheme = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#142023' : '#f0efe8');
    };
    themeButton.removeAttribute('hidden');
    syncTheme();
    themeButton.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (_) { /* Storage can be disabled. */ }
      syncTheme();
    });
  }
  const evidence = root.querySelector('[data-evidence]');
  if (!evidence) return;
  const tabs = Array.from(evidence.querySelectorAll('[data-trace]'));
  const panes = Array.from(evidence.querySelectorAll('.a-trace-pane'));
  const nav = evidence.querySelector('.a-trace-nav');
  if (nav) nav.setAttribute('role', 'tablist');
  tabs.forEach((tab) => {
    tab.id = `trace-tab-${tab.getAttribute('data-trace')}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', tab.getAttribute('href').slice(1));
  });
  panes.forEach((pane) => {
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', `trace-tab-${pane.id.replace('trace-', '')}`);
    pane.setAttribute('tabindex', '0');
  });
  const select = (key, focus = false) => {
    if (!tabs.some((tab) => tab.getAttribute('data-trace') === key)) return;
    tabs.forEach((tab) => {
      const active = tab.getAttribute('data-trace') === key;
      tab.classList.toggle('is-selected', active);
      tab.setAttribute('aria-selected', String(active));
      tab.setAttribute('tabindex', active ? '0' : '-1');
      if (active && focus) tab.focus();
    });
    panes.forEach((pane) => { pane.hidden = pane.id !== `trace-${key}`; });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', (event) => { event.preventDefault(); select(tab.getAttribute('data-trace')); });
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      select(tabs[keys[event.key]].getAttribute('data-trace'), true);
    });
  });
  evidence.classList.add('a-evidence-ready');
  const hashKey = location.hash.replace('#trace-', '');
  select(tabs.some((tab) => tab.getAttribute('data-trace') === hashKey) ? hashKey : 'source');
  root.querySelectorAll('[data-open-source]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault(); select('source', true);
    evidence.querySelector('#trace-source').scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }));
  window.addEventListener('hashchange', () => select(location.hash.replace('#trace-', '')));

  // Read exactly the source rows shown to the reader. Export includes both forms.
  const dictionary = Object.freeze({
    'Помощь с пуском онлайн': 'remote', 'Удалённый пуск': 'remote',
    'Удалённая настройка запуска': 'remote', 'Удалённый ввод в эксплуатацию': 'remote',
    'Аудит на месте': 'audit', 'Выездной аудит': 'audit', 'Обучение команды': 'training',
  });
  const rows = Array.from(evidence.querySelectorAll('#trace-source tbody tr')).map((row) => {
    const cells = row.querySelectorAll('td');
    const raw = cells[1].textContent.trim();
    return { id: cells[0].textContent.trim(), raw, need: dictionary[raw] || 'unclassified' };
  });
  const counts = rows.reduce((acc, row) => { acc[row.need] = (acc[row.need] || 0) + 1; return acc; }, {});
  evidence.querySelectorAll('[data-count]').forEach((output) => {
    const count = counts[output.getAttribute('data-count')] || 0;
    output.textContent = String(count);
    const bar = output.parentElement.querySelector('i');
    if (bar) bar.style.setProperty('--length', `${rows.length ? count / rows.length * 100 : 0}%`);
  });
  let decision = 'pending';
  const events = [];
  const status = evidence.querySelector('[data-decision-state]');
  const audit = evidence.querySelector('[data-audit]');
  const accept = evidence.querySelector('[data-decision="accept"]');
  const review = evidence.querySelector('[data-decision="review"]');
  const reset = evidence.querySelector('[data-reset]');
  const download = evidence.querySelector('[data-export]');
  [accept, review, reset, download].forEach((button) => { if (button) button.disabled = false; });
  const render = () => {
    status.textContent = decision === 'accepted'
      ? 'Гипотеза сохранена только в этом демо. Услуга не запущена; сообщения не отправлены.'
      : decision === 'review'
        ? 'Гипотеза возвращена на проверку. Следующий шаг — уточнить категории и дополнить выборку.'
        : 'Решение не принято. Никакие действия во внешних системах не выполняются.';
    accept.disabled = decision === 'accepted';
    review.disabled = decision === 'review';
    audit.replaceChildren();
    events.forEach((event, i) => {
      const item = document.createElement('li');
      item.textContent = `${i + 1}. ${event.action === 'accepted' ? 'Сотрудник сохранил гипотезу' : 'Сотрудник вернул на проверку'} · interviews.demo/v1`;
      audit.appendChild(item);
    });
  };
  [accept, review].forEach((button) => button.addEventListener('click', () => {
    const next = button === accept ? 'accepted' : 'review';
    if (decision === next) return;
    decision = next;
    events.push({ action: next, actor: 'demo-user', sourceVersion: 'v1', at: new Date().toISOString() });
    render();
  }));
  reset.addEventListener('click', () => { decision = 'pending'; events.length = 0; render(); });
  download.addEventListener('click', () => {
    const report = { demo: true, scope: 'browser memory only; no model or external execution', source: { name: 'interviews.demo', version: 'v1', storage: 'browser-memory', rows }, transformation: { version: 'v1', dictionary }, query: evidence.querySelector('#trace-query code').textContent, execution: 'JavaScript grouping equivalent; SQL not executed', counts, claim: 'Проверить спрос на удалённый ввод в эксплуатацию', limitations: ['Synthetic sample of 12 responses', 'No evidence of willingness to pay', 'Grouping requires expert review'], decision, events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'rom4-evidence-demo.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
