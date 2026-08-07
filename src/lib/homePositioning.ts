const replacements: ReadonlyArray<readonly [string, string]> = [
  [
    'цифровые продукты<br>для растущих брендов',
    'product · software · ai<br>для растущих компаний',
  ],
  [
    'Растущему бренду быстро становится тесно в шаблонах и подрядчиках по кусочкам. Собираю цифровую часть — магазин, приложение, внутренние системы — так, чтобы она держала ту же планку, что и ваш продукт. И оставляю команде то, что можно развивать дальше без меня.',
    'Беру на себя digital-часть бизнеса: нахожу, что имеет смысл улучшить или построить, быстро проверяю это рабочим прототипом и довожу до запуска. Это может быть магазин, приложение, внутренняя система или AI — формат следует за задачей.',
  ],
  [
    'Ниже — то, что я беру на себя. Разное по жанру, но это один продукт и одно решение.',
    'Беру на себя и решение, и реализацию: разобраться в бизнесе, выбрать точку приложения software или AI, проверить её и довести до работающего продукта.',
  ],
  [
    `<article class="mode">
              <h3>Чтобы проверять, а не спорить</h3>
              <ul class="mode-list">
                <li>Тулинг и внутренние библиотеки</li>
                <li>Архитектура, код-ревью, стандарты</li>
                <li>CI/CD и инфраструктура</li>
                <li>Техлид-консалтинг и найм</li>
                <li>AI в разработке и в продукте</li>
              </ul>
            </article>
            <article class="mode">
              <h3>То, чем пользуются каждый день</h3>
              <ul class="mode-list">
                <li>Магазин, каталог, подписка, лояльность</li>
                <li>Личные кабинеты и приложения</li>
                <li>Заказы, склад, производство, поставщики</li>
                <li>Интеграции и аналитика</li>
                <li>Сервисы вокруг основного продукта</li>
              </ul>
            </article>
            <article class="mode">
              <h3>Как это выглядит и ощущается</h3>
              <ul class="mode-list">
                <li>UX: сценарии, структура, состояния</li>
                <li>Интерфейс и дизайн-система</li>
                <li>Прототип до начала разработки</li>
                <li>Тексты, по которым понятно, что делать</li>
                <li>Один язык на сайте, в приложении, в точке</li>
              </ul>
            </article>`,
    `<article class="mode">
              <h3>Найти</h3>
              <ul class="mode-list">
                <li>Разобрать продукт и процессы</li>
                <li>Найти дорогие потери и возможности</li>
                <li>Проверить цифры и ограничения</li>
                <li>Выбрать, где software или AI дадут эффект</li>
                <li>Отбросить то, что делать не стоит</li>
              </ul>
            </article>
            <article class="mode">
              <h3>Проверить</h3>
              <ul class="mode-list">
                <li>Рабочий прототип на реальных данных</li>
                <li>UX и критические сценарии</li>
                <li>Технический эксперимент</li>
                <li>Экономика решения</li>
                <li>Решение go / no-go</li>
              </ul>
            </article>
            <article class="mode">
              <h3>Запустить</h3>
              <ul class="mode-list">
                <li>Web, mobile, backend и AI</li>
                <li>Интеграции и инфраструктура</li>
                <li>Аналитика и production</li>
                <li>Команда и подрядчики</li>
                <li>Дальнейшее развитие продукта</li>
              </ul>
            </article>`,
  ],
  [
    'Проверка на весь список одна: продукт вырос, бизнес-модель сошлась. От работ, которые к этому не ведут, я отговариваю — даже когда за них готовы платить.',
    'У работы должен быть измеримый эффект: больше продаж, ниже стоимость операции, быстрее процесс, меньше ошибок или новая выручка. Если связи с результатом не нахожу — предлагаю не делать.',
  ],
  [
    'Экраны сегодня рисует и модель — это перестало быть работой. Работа в том, чтобы прототип стоял на ваших данных и показывал состояния, в которых всё ломается: пустой список, отвал связи, остановленная линия. По такому уже принимают решения.',
    'До договора стараюсь дойти дальше презентации. Если задачу можно проверить без доступа к закрытым данным — собираю рабочий прототип на материалах компании. Первый разговор начинается уже с конкретного продукта, а не с обещаний когда-нибудь его сделать.',
  ],
  [
    'Один инженер<br>на весь стек.',
    'Одна ответственность<br>на весь продукт.',
  ],
  [
    'От того, что видит покупатель, до бэкенда, инфраструктуры и AI — закрываю продукт целиком, без цепочки подрядчиков и стыков между ними. Инструмент выбираю под задачу и под то, кому это потом поддерживать.',
    'Могу сам закрыть большую часть стека, подключить нужных специалистов или работать с вашей командой. Для бизнеса это остаётся одной зоной ответственности: продукт, архитектура, интерфейс, AI, инфраструктура и запуск.',
  ],
  [
    'Зачем откладывать на потом, если с AI можно сделать это <span class="pen-mark">уже сегодня</span>?',
    'Не обязательно приходить с техническим заданием. Достаточно показать <span class="pen-mark">бизнес и задачу</span>, которую давно хочется решить.',
  ],
  [
    'software engineer · AI-native builder · hands-on CTO',
    'digital product partner · software · AI · fractional CTO',
  ],
  [
    'ЦИФРОВЫЕ ПРОДУКТЫ ДЛЯ РАСТУЩИХ БРЕНДОВ',
    'PRODUCT · SOFTWARE · AI ДЛЯ РАСТУЩИХ КОМПАНИЙ',
  ],
];

const engagement = `
      <section class="engagement ruled-section band" id="engagement" aria-labelledby="engagement-title">
        <span class="coordinate">E</span>
        <div class="section-intro">
          <h2 id="engagement-title">Можно начать с продукта.<br>И не останавливаться на нём.</h2>
          <div class="section-lead">
            <p>Формат зависит от того, насколько задача уже определена. От одного запуска до постоянной product/software/AI-функции внутри компании.</p>
          </div>
        </div>
        <div class="engagement-body band-body">
          <div class="engagement-track">
            <article class="engagement-card">
              <span class="engagement-index">01</span>
              <h3>Один продукт</h3>
              <p>Когда задача уже понятна. Беру её целиком — от решения и прототипа до production-запуска.</p>
              <b>PROJECT</b>
            </article>
            <article class="engagement-card engagement-card-accent">
              <span class="engagement-index">02</span>
              <h3>Digital Partner</h3>
              <p>Когда возможностей много, но неизвестно, за какую браться первой. Работаем кварталами: выбираю, проверяю и запускаю digital- и AI-инициативы.</p>
              <b>QUARTER</b>
            </article>
            <article class="engagement-card">
              <span class="engagement-index">03</span>
              <h3>Fractional CTO</h3>
              <p>Когда нужна постоянная техническая функция: стратегия, архитектура, команда, подрядчики и развитие software/AI без найма отдельного CTO.</p>
              <b>ONGOING</b>
            </article>
          </div>
        </div>
      </section>

`;

function replaceExactlyOnce(html: string, before: string, after: string): string {
  const first = html.indexOf(before);
  if (first === -1) throw new Error(`Homepage positioning anchor not found: ${before.slice(0, 90)}`);
  if (html.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Homepage positioning anchor is ambiguous: ${before.slice(0, 90)}`);
  }
  return html.slice(0, first) + after + html.slice(first + before.length);
}

export function repositionHome(source: string): string {
  let html = source;
  for (const [before, after] of replacements) html = replaceExactlyOnce(html, before, after);

  const footer = '<footer class="footer ruled-section" id="contacts">';
  html = replaceExactlyOnce(html, footer, engagement + footer);
  return html;
}
