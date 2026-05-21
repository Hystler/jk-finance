# Жуй Кайфуй: SKU Unit Economics Constructor

Локальное Next.js-приложение для финансовой модели фастфуд-франшизы: ручное меню SKU, рецептуры, ингредиенты, упаковка, unit-economics по каждой позиции, Store P&L, CAPEX, OPEX, checks, sensitivity и XLSX-export.

## Принцип данных

Проект не выдумывает реальные себестоимости. Каждое число должно иметь источник:

- `IMPORTED_MENU` — импортировано из публичного меню;
- `MANUAL` — введено пользователем вручную;
- `IMPORTED` — импортировано из справочника/шаблона;
- `ASSUMPTION` — допущение для проверки модели;
- `CALCULATED` — рассчитано формулой.

Без рецептуры gross margin может выглядеть как 100%, но это не реальная экономика. Это означает, что ingredient cost и packaging еще не заполнены.

## Запуск

Проект использует Prisma + PostgreSQL. Для production нужен `DATABASE_URL`; SQLite больше не используется как runtime database.

Создайте `.env` для Prisma CLI и локального запуска:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
NEXT_PUBLIC_APP_NAME="JK Finance"
```

Локально можно использовать Neon, Supabase, Vercel Postgres или свой PostgreSQL. Затем:

```bash
cd app
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Откройте `http://localhost:3000`. Если порт занят, Next.js предложит следующий.

Seed создаёт базовые `StoreInput`, `TaxSettings`, `FranchiseSettings`, импортирует SKU из `public/scrape_artifacts/scraped_menu.json` как `IMPORTED_MENU` и не создаёт фейковые рецептуры или закупочные себестоимости.

## SKU

Страница `/menu` теперь работает как таблица управления SKU.

Можно:

- добавить SKU кнопкой `Добавить SKU`;
- изменить название, категорию, описание, цену, ссылки, `isActive` и `source`;
- редактировать цену прямо в строке таблицы;
- удалить SKU с подтверждением;
- перейти в карточку SKU по названию или action-кнопке.

После изменения цены, рецептуры или упаковки пересчитываются строка SKU, Dashboard, Checks и XLSX-export.

Таблица имеет три режима:

- `Basic` — категория, SKU, цена, ingredient cost, packaging, gross margin, status, actions;
- `Unit economics` — цена, ingredient cost, packaging, variable cost, contribution, EBITDA/item, status;
- `Full finance` — полный набор колонок: комиссии, налоги, fixed allocation, depreciation, total cost/item и маржинальность.

Широкая таблица имеет horizontal scroll, sticky header, sticky SKU-column и pinned actions справа.

## Ингредиенты

Страница `/ingredients` содержит справочник ингредиентов и упаковки.

Для ингредиента задаются:

- name;
- category;
- supplier;
- purchasePrice, ₽;
- purchaseUnit: `kg`, `g`, `liter`, `ml`, `piece`;
- edibleYieldPercent, %;
- storageLossPercent, %;
- comment;
- source.

Приложение считает базовую стоимость:

- `kg` -> cost per gram;
- `liter` -> cost per ml;
- `piece` -> cost per piece.

Примеры для теста можно добавить как `ASSUMPTION`, но реальные закупочные цены нужно ввести вручную.

## Рецептура SKU

Откройте `/sku/:id` и в блоке `Рецептура` нажмите `Добавить ингредиент`.

Можно:

- выбрать ингредиент из searchable select;
- создать новый ингредиент прямо из модалки;
- указать quantity;
- выбрать unit: `g`, `ml`, `piece`;
- указать recipe yield loss;
- редактировать или удалить строку рецептуры.

Формула:

```text
effectiveYield =
  edibleYieldPercent / 100
  * (1 - storageLossPercent / 100)
  * (1 - recipeYieldLossPercent / 100)

ingredientCost =
  quantity * costPerBaseUnit / effectiveYield
```

Если yield неизвестен, используйте 100% и помечайте строку как `ASSUMPTION`.

## Упаковка

На `/ingredients` добавьте упаковку: name, costPerUnit, supplier, comment.

В карточке SKU блок `Упаковка` позволяет привязать одну или несколько упаковок к SKU и указать quantity.

```text
packagingCost = sum(packaging.costPerUnit * quantity)
```

## Unit Economics

В каждой строке SKU считаются:

- ingredient cost;
- packaging;
- gross profit и gross margin;
- acquiring, aggregator commission, delivery logistics, marketing, revenue tax;
- total variable cost;
- contribution и contribution margin;
- allocated fixed cost/item;
- depreciation/item;
- EBITDA/item и EBITDA margin.

Если `monthlyItems = 0`, fixed costs и depreciation не делятся на 0. В предупреждениях появится текст: `Для распределения fixed costs укажите заказы/день и SKU/заказ в Store Model.`

## Статусы SKU

Статус больше не превращает missing data в обычный `bad`.

Основные статусы:

- `missing recipe` — нет рецептуры;
- `missing packaging` — нет упаковки или стоимость упаковки = 0;
- `negative contribution` — SKU продается ниже переменных расходов;
- `negative EBITDA` — после fixed allocation/depreciation SKU отрицательный;
- `high food cost` — ingredient cost / price > 40%;
- `low margin` — низкая contribution margin;
- `good` — заполнены данные и EBITDA margin > 15%.

Как исправить:

- `missing recipe` -> добавьте ингредиенты и количества в карточке SKU;
- `missing packaging` -> создайте упаковку и привяжите ее к SKU;
- `ingredient cost = 0` -> проверьте закупочную цену, unit и quantity;
- `price below variable costs` -> поднимите цену или снизьте ингредиенты, упаковку, комиссии, логистику.

## Dashboard и графики

Главная `JK Finance` — это рабочий dashboard, а не только навигация. На первом экране есть KPI: monthly revenue, gross profit, EBITDA, EBITDA margin, operating cashflow, opening investment, payback, break-even orders/day, active SKU count, SKU with missing recipe и SKU with negative EBITDA.

Dashboard показывает:

- Revenue / EBITDA / Cashflow chart на 12 месяцев;
- Cost structure donut;
- SKU economics chart: top SKU по EBITDA/item;
- Break-even chart с нулевой линией;
- Franchise payback preview, если Franchise Mode заполнен;
- Alerts / Checks;
- Quick Actions;
- Data completeness по SKU prices, recipes, packaging, CAPEX, OPEX, Store Model и Franchise Mode.

Dashboard не строит бессмысленный SKU chart, если у SKU нет себестоимости. Вместо графика показывается empty state.

Для длинных SKU названия обрезаются до короткого варианта, а полное название доступно в tooltip. Если SKU больше 10, рейтинг показывает top 10, а полный список смотрите в `/menu`.

Sensitivity tornado использует читаемые подписи, tooltip и разные цвета для негативного и позитивного влияния.

## Franchise Mode

Страница `/franchise` считает две разные экономики:

- экономика франчайзи — P&L точки после royalty, marketing fee, supply-chain markup, налогов, loan payments и owner withdrawals;
- экономика франчайзера — royalty, marketing fee, supply-chain markup, разовые fees, support cost и fixed team costs управляющей компании.

Franchise Mode считает новую точку франчайзи. Store Model не используется автоматически для revenue. У франчайзинговой точки есть собственный блок `Franchisee Store Inputs`:

- working days / month;
- avg orders / day;
- SKU / order;
- avg check;
- delivery share;
- aggregator share;
- acquiring;
- aggregator commission;
- logistics per order;
- marketing per SKU;
- revenue tax, profit tax, VAT reference, other taxes;
- loan payments и owner withdrawals.

Можно нажать `Скопировать inputs из Store Model`: текущие Store Model, Tax settings и OPEX values будут перенесены в Franchise Mode. После этого значения редактируются независимо. Если модель использует скопированные значения, checks покажут warning, чтобы проверить, подходят ли они для новой точки.

Franchise OPEX хранится отдельно внутри Franchise Mode: rent, payroll, utilities, software, accounting, repairs и other fixed OPEX. Opening investment собирается из CAPEX и franchise additions.

Royalty считается так:

```text
percent_of_revenue = revenue * royaltyRate / 100
fixed_monthly = fixedMonthlyRoyalty
hybrid = revenue * royaltyRate / 100 + fixedMonthlyRoyalty
```

Marketing fee:

```text
marketingFee = revenue * marketingFeeRate / 100
```

Opening investment:

```text
openingInvestment =
  CAPEX paid before opening
  + lumpSumFee
  + trainingFee
  + openingSupportFee
  + openingInventory
  + launchMarketing
  + rentDeposit
  + contingency
```

Contingency берется как рублевая сумма, если она больше 0. Если сумма равна 0, используется `contingencyPercent` от CAPEX.

Payback считается по cumulative cashflow:

```text
Month 0 = -openingInvestment
Month N = previous cumulative cashflow + netOperatingCashflow
```

Payback month — первый месяц, где cumulative cashflow становится >= 0. На графике показывается горизонт 24 месяца; для checks дополнительно смотрится горизонт 36 месяцев. ROI считается как `yearOneNetCashflow / openingInvestment` и отображается в процентах.

### Revenue Trend

Блок `Revenue Trend` управляет выручкой новой точки по месяцам:

- `flat` — каждый месяц равен base revenue;
- `growth` — monthlyGrowthRatePercent применяется как помесячный рост;
- `decline` — monthlyDeclineRatePercent применяется как помесячное падение;
- `ramp_up` — месяц 1 стартует с `rampUpStartPercent`, к `rampUpMonths` выходит на 100%;
- `custom` зарезервирован под будущий ручной ввод.

Base monthly revenue:

```text
franchiseWorkingDaysPerMonth
* franchiseAvgOrdersPerDay
* franchiseAvgCheck
```

Seasonality можно включить чекбоксом. Тогда применяются простые месячные коэффициенты: январь 0.9, февраль 0.95, март 1, апрель 1, май 1.05, июнь 1.1, июль 1.1, август 1.05, сентябрь 1, октябрь 1, ноябрь 1.05, декабрь 1.15.

Cashflow считается помесячно: revenue, orders, items, COGS, variable costs, fixed Franchise OPEX, franchise fees, taxes, loan payments, owner withdrawals, net cashflow и cumulative cashflow пересчитываются для каждого месяца.

Окупаемость не гарантирована: она ломается, если opening investment слишком высокий, revenue низкая, food cost / rent / payroll / franchise fees съедают маржу, EBITDA after fees отрицательная или taxes/loan/withdrawals забирают cashflow.

В первую очередь смотрите checks:

- `Franchisee EBITDA after fees < 0`;
- `Cumulative cashflow never becomes positive in 36 months`;
- `Royalty + marketing fee > 15% revenue`;
- `Franchisee EBITDA margin after fees < 10%`;
- `Payback > 24 months`;
- `ROI < 30%`;
- `Support cost per franchisee > royalty + marketing fee`;
- missing CAPEX / OPEX / SKU себестоимость / taxes.

На странице есть Revenue trend chart, EBITDA / Net cashflow chart, payback chart, margin chart, franchisor revenue donut, Base / Downside / Upside scenarios и sensitivity. Payback chart читается так: линия ниже нуля показывает еще не окупившийся cumulative cashflow, пересечение нуля — месяц окупаемости.

## Checks

Страница `/checks` имеет фильтры:

- All;
- Critical;
- Warning;
- Missing data;
- SKU;
- Store Model;
- CAPEX;
- OPEX.

Проверяются SKU без рецептуры/упаковки, цена 0, ingredient cost 0, fake high margin, negative contribution, negative EBITDA, food cost > 40%, packaging > 10% от цены и total cost > price.

## Экспорт

`/api/export/full` выгружает XLSX с листами:

- `SKU List`
- `SKU Unit Economics`
- `Recipes`
- `Ingredients`
- `Packaging`
- `Product Packaging`
- `Store P&L`
- `CAPEX`
- `OPEX`
- `Checks`
- `Assumptions`
- `Charts Data`
- `Cashflow`
- `Input Units`
- `Franchise Inputs`
- `Franchise Store Inputs`
- `Franchise Revenue Trend`
- `Franchise 24M Forecast`
- `Franchise Payback`
- `Franchisee P&L`
- `Franchise P&L Month 1`
- `Franchise P&L Month 12`
- `Franchisee Cashflow 24M`
- `Franchise Charts Data`
- `Franchisor Model`
- `Franchise Scenarios`
- `Franchise Sensitivity`
- `Franchise Checks`

В `SKU Unit Economics` есть price, ingredient cost, packaging, gross profit, gross margin, variable costs, contribution, allocated fixed cost, depreciation, EBITDA/item, status и warnings.
В franchise-листах есть inputs, P&L франчайзи, 24-месячный cashflow, модель франчайзера, сценарии, sensitivity и checks.

XLSX генерируется в памяти и отдаётся response без записи файлов на диск, поэтому route совместим с serverless.

## Healthcheck

`GET /api/health` возвращает:

```json
{ "status": "ok", "db": "connected", "timestamp": "..." }
```

Если база недоступна, route отвечает `503`:

```json
{ "status": "error", "db": "disconnected", "timestamp": "..." }
```

Секреты и connection string в ответ не попадают.

## Импорт

На странице `/import` доступны CSV/XLSX-шаблоны:

- `menu_template.csv`
- `recipes_template.csv`
- `ingredients_template.csv`
- `capex_template.csv`
- `opex_template.csv`
- `tax_settings_template.csv`

Меню можно импортировать с сайта через:

```bash
npm run scrape
```

Scraper — локальный script. Он пишет artifacts в `public/scrape_artifacts` и не запускается на Vercel автоматически. Для production seed используется JSON-выгрузка меню, а все пользовательские данные хранятся в PostgreSQL.

Импортированные SKU не теряются при повторном импорте или `npm run db:seed`: seed обновляет существующие позиции по `productUrl` или паре `category + name`.

## Проценты

Все процентные поля вводятся именно в процентах:

- `1` = 1%;
- `6` = 6%;
- `22` = 22%;
- `50` = 50%.

Не используйте смешанный формат `0.22 = 22%`.

Шаг стрелок в процентных `input type="number"` равен `1`, поэтому `6` меняется на `7`, а не на `6.01`. Дробные шаги оставлены только там, где это действительно дробная величина, например `SKU / заказ`.

Read-only числа, KPI, таблицы, chart tooltips и export preview форматируются через русскую локаль с пробелами в тысячах:

```text
1350000 -> 1 350 000
1350000 ₽ -> 1 350 000 ₽
28.234 -> 28,2 %
```

## Тесты

```bash
npm run db:generate
npm test
npm run build
```

Тестируются format helpers, financial calculations, franchise calculations, XLSX workbook, export route без filesystem write, `/api/health` и отсутствие локального absolute path в runtime/project text files.

## Deploy to Vercel

1. Создайте GitHub repo и залейте проект:

```bash
git init
git add .
git commit -m "Initial JK Finance MVP"
git branch -M main
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

2. Создайте PostgreSQL database. Подойдут:

- Vercel Postgres;
- Neon;
- Supabase.

3. Добавьте env variable в Vercel:

```text
Project -> Settings -> Environment Variables -> DATABASE_URL
```

Значение должно быть PostgreSQL URL, например:

```bash
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

4. Импортируйте GitHub repo в Vercel.

Build settings:

```text
Framework: Next.js
Build command: npm run build
Install command: npm install
```

Кастомный `vercel.json` не нужен: Vercel корректно определяет Next.js, а `postinstall` запускает `prisma generate`.

5. Примените Prisma migrations и seed. Рекомендуемый ручной вариант:

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env
npm run db:migrate
npm run db:seed
```

Если вы предпочитаете `.env.local`, убедитесь, что Prisma CLI получает тот же `DATABASE_URL` через `.env` или shell env перед запуском `npm run db:migrate`.

6. Задеплойте:

```bash
vercel
vercel --prod
```

DATABASE_URL можно добавить и через CLI:

```bash
vercel env add DATABASE_URL
```

7. После production deploy откройте публичный URL и проверьте:

- `/`
- `/menu`
- `/sku`
- `/store-model`
- `/franchise`
- `/api/health`
- `/api/export/full`

Если `/api/health` показывает `db: disconnected`, проверьте `DATABASE_URL`, доступность PostgreSQL и применение миграций.

## Deployment notes

- Production database provider: PostgreSQL через `DATABASE_URL`.
- SQLite-файл не используется на Vercel.
- `postinstall` выполняет `prisma generate`.
- `npm run db:migrate` выполняет `prisma migrate deploy`.
- `npm run db:seed` запускает `prisma/seed.ts`.
- Не запускайте Playwright scraper как часть production build/deploy.
- Если `DATABASE_URL` отсутствует в production, приложение падает с понятной ошибкой: `DATABASE_URL is required for production deployment.`
