# Design polish plan

Цель: довести Media CDN Service от функциональной админки до цельного, дорогого и удобного media file manager. Не украшать ради украшений, а собрать рабочий интерфейс с сильной визуальной системой.

## Дизайн-направление

- Quiet professional SaaS: ближе к Linear, Dropbox, Cloudflare dashboard.
- Desktop-app feeling: плотные строки, быстрые hover/focus states, command palette, drag/drop, right inspector.
- Media-first: preview, CDN URL, file status и storage должны читаться сразу.
- Меньше декоративных карточек, больше цельных рабочих поверхностей.

## Что нужно сделать

1. **Пересобрать главный layout**
   - Сделать file manager главным рабочим полотном.
   - Header сделать компактнее и полезнее.
   - Правую панель оформить как inspector panel.
   - Убрать ощущение отдельных случайных блоков.

2. **Сделать единую toolbar**
   - Upload, New folder, Search, View toggle, Command palette, Select собрать в одну аккуратную панель.
   - Использовать иконки там, где команда очевидна.
   - Уменьшить визуальный шум от текстовых кнопок.

3. **Унифицировать spacing**
   - Page padding: 24-32px.
   - Panel gap: 16px.
   - Toolbar height: 40px.
   - Row height: 44-48px.
   - Card radius: максимум 8px.
   - Все панели должны иметь одинаковую border/background логику.

4. **Улучшить typography**
   - Filename: 13-14px medium.
   - Metadata: 12px muted.
   - Section labels: compact muted labels.
   - Убрать крупный текст из рабочих панелей.
   - Сделать hierarchy: файл важнее MIME/size/status.

5. **Переделать right inspector panel**
   - Preview сверху с фиксированным aspect ratio.
   - Ниже inline filename edit.
   - Потом compact metadata grid.
   - Потом CDN lifecycle.
   - Потом Public URL и snippets.
   - Панель должна ощущаться как главный control center выбранного файла.

6. **Сделать list rows богаче**
   - Стабильная колонка иконки типа файла.
   - Filename + secondary metadata.
   - CDN status аккуратным pill.
   - Size/date справа.
   - Hover показывает actions.
   - Selected row должен выглядеть как selected state, не как alert.

7. **Улучшить grid cards**
   - Preview area крупнее.
   - Filename снизу, без overflow.
   - Status pill в стабильном месте.
   - Uniform card height.
   - Чёткое отличие folder/image/video/audio/pdf.

8. **Сделать smart empty states**
   - Пустая папка: большая drop zone, Upload, New folder.
   - Пустой search: текст `No results for ...` и clear search.
   - Empty state должен помогать следующему действию.

9. **Добавить microinteractions**
   - Hover для row/card.
   - Selected transition.
   - Copy feedback.
   - Smooth upload tray collapse.
   - Понятная drag target подсветка.

10. **Уменьшить визуальный шум**
    - Убрать повторяющиеся действия.
    - Спрятать вторичные details.
    - Сократить лишние borders.
    - Не плодить cards внутри cards.

11. **Собрать цветовую систему**
    - Neutral background.
    - One primary accent.
    - Semantic colors для public/private/warning/error.
    - Умеренные accents для file types.
    - Единый selected state для list/grid/context menu.

## Приоритет работ

1. Redesign file manager surface + toolbar.
2. Redesign right inspector panel.
3. Polish list rows and grid cards.
4. Add smart empty states.
5. Polish microinteractions and visual states.
6. Mobile/tablet adaptation.
7. Activity feed visual integration.

## Acceptance criteria

- Первый экран выглядит как цельный продукт, а не набор компонентов.
- File manager читается быстрее без объяснений.
- Правый inspector показывает реальный preview и главные действия без хаоса.
- List и Grid выглядят как два режима одной системы.
- Пустые состояния помогают действовать.
- Все hover, selected, drag, copy, upload states выглядят согласованно.
- Интерфейс остаётся плотным и рабочим, без landing-page эстетики.

## Shipped progress

- 2026-07-03: First polish slice implemented locally: compact dashboard header, Upload moved into the file-manager toolbar, unified file surface styling, stable list row height, uniform grid card dimensions, and sticky inspector framing. Local `bun run check` and `bun run typecheck` passed.
- 2026-07-03: Second polish slice implemented locally: right inspector now has a compact header, fixed preview area, inline filename section, compact metadata grid, adjacent download action, and flatter CDN controls. Local `bun run check` and `bun run typecheck` passed.
- 2026-07-03: Third polish slice implemented locally: list rows now have stable hover/focus actions for preview, copy URL, open, and delete; grid cards have fixed status placement over preview and richer bottom metadata. Local `bun run check` and `bun run typecheck` passed.
- 2026-07-03: Fourth polish slice implemented locally: empty folder and empty search states now render as action-oriented drop-zone surfaces with clear primary actions and supported media hints. Local `bun run check` and `bun run typecheck` passed.
- 2026-07-03: Fifth polish slice implemented locally: copy actions now show toast feedback and folder drop targets highlight in both list and grid views during drag-over. Local `bun run check` and `bun run typecheck` passed.
