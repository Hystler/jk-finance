# Assumptions

Все неизвестные финансовые значения хранятся как editable assumptions. Приложение не подставляет рыночные ставки, аренду, ФОТ, налоги, food cost, упаковку или CAPEX без ввода пользователя.

## Источники чисел

- `USER_INPUT`: пользователь внес значение вручную или через CSV/XLSX.
- `IMPORTED_MENU`: значение импортировано из публичного меню сайта, например название SKU, категория, описание, цена, image URL, product URL.
- `CALCULATED`: значение является результатом формулы.
- `ASSUMPTION`: расчетное допущение, которое пользователь обязан проверить.

## Основные assumptions

- Store inputs: рабочие дни, заказы в день, средний чек, SKU в заказе, доли доставки и агрегаторов.
- Комиссии: acquiring rate, aggregator commission rate, logistics cost.
- Налоги: tax system, revenue tax rate, profit tax rate, payroll tax rate, VAT rate, other taxes. Это расчетные параметры, не юридический вывод.
- OPEX: аренда, ФОТ, коммунальные расходы, маркетинг, accounting, software, repairs и прочие расходы.
- CAPEX: ремонт, оборудование, IT/POS, вывеска, стартовый склад, депозит, обучение, непредвиденные расходы.
- Franchise settings: паушальный взнос, royalty, marketing fee, supply-chain markup, support costs.

## Missing assumptions

Checks подсвечивают отсутствующие рецептуры, налоговые assumptions и сроки амортизации. До заполнения этих полей результаты считаются неполными.
