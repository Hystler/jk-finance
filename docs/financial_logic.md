# Financial Logic

Модель разделена на четыре слоя:

1. `INPUTS`: меню, рецептуры, закупочные цены, упаковка, store inputs, OPEX, CAPEX, taxes, franchise settings.
2. `CALCS`: SKU unit economics, P&L, cashflow, depreciation, break-even, ROI/payback, sensitivity.
3. `OUTPUTS`: dashboard, SKU таблица, карточка SKU, store model, XLSX export.
4. `CHECKS`: warnings и critical errors.

## Product mix

В MVP используется равномерный SKU mix, если пользователь не загрузил продажи по SKU. Это явно ограничено и должно быть заменено на sales mix в следующем этапе.

## EBITDA

EBITDA считается как revenue минус COGS, variable costs и fixed OPEX. Амортизация показывается отдельно для управленческого анализа и allocated per item, но не вычитается из EBITDA.

## Cashflow

Operating cashflow = EBITDA минус расчетные налоги, loan payments, owner withdrawals и working capital changes.

Opening cashflow = отрицательный initial investment по CAPEX, где `paid_before_opening = true`.

## Franchise

Franchise mode в MVP является заготовкой. Он считает royalty и marketing fee поверх модели точки, но расширение до полноценной экономики франчайзера запланировано следующим этапом.
