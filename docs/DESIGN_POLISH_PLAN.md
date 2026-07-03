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
   - **Done:** dashboard header стал компактнее, file manager оформлен как главное рабочее полотно, desktop inspector закреплен справа, а mobile inspector вынесен в bottom sheet.

2. **Сделать единую toolbar**
   - Upload, New folder, Search, View toggle, Command palette, Select собрать в одну аккуратную панель.
   - Использовать иконки там, где команда очевидна.
   - Уменьшить визуальный шум от текстовых кнопок.
   - **Done:** Upload, New folder, Search, List/Grid, Command palette и Select собраны в единую toolbar внутри файловой области.

3. **Унифицировать spacing**
   - Page padding: 24-32px.
   - Panel gap: 16px.
   - Toolbar height: 40px.
   - Row height: 44-48px.
   - Card radius: максимум 8px.
   - Все панели должны иметь одинаковую border/background логику.
   - **Mostly done:** file surface, rows, grid cards, inspector и toolbar получили более стабильные размеры, radius и border/background логику.

4. **Улучшить typography**
   - Filename: 13-14px medium.
   - Metadata: 12px muted.
   - Section labels: compact muted labels.
   - Убрать крупный текст из рабочих панелей.
   - Сделать hierarchy: файл важнее MIME/size/status.
   - **Mostly done:** list/grid/inspector используют более плотную hierarchy: filename впереди, metadata и MIME приглушены.

5. **Переделать right inspector panel**
   - Preview сверху с фиксированным aspect ratio.
   - Ниже inline filename edit.
   - Потом compact metadata grid.
   - Потом CDN lifecycle.
   - Потом Public URL и snippets.
   - Панель должна ощущаться как главный control center выбранного файла.
   - **Done:** inspector стал preview-first, получил inline rename, compact metadata grid, download action, CDN lifecycle, Public URL и скрытые embed snippets.

6. **Сделать list rows богаче**
   - Стабильная колонка иконки типа файла.
   - Filename + secondary metadata.
   - CDN status аккуратным pill.
   - Size/date справа.
   - Hover показывает actions.
   - Selected row должен выглядеть как selected state, не как alert.
   - **Done:** list rows получили стабильную высоту, type markers, richer metadata, CDN pill, hover/focus actions и согласованный selected state.

7. **Улучшить grid cards**
   - Preview area крупнее.
   - Filename снизу, без overflow.
   - Status pill в стабильном месте.
   - Uniform card height.
   - Чёткое отличие folder/image/video/audio/pdf.
   - **Done:** grid cards получили фиксированную высоту, стабильное место CDN/status pill, thumbnails, file type markers и контролируемый overflow filename.

8. **Сделать smart empty states**
   - Пустая папка: большая drop zone, Upload, New folder.
   - Пустой search: текст `No results for ...` и clear search.
   - Empty state должен помогать следующему действию.
   - **Done:** empty folder/search states показывают контекстные действия Upload, New folder, drop hint и Clear search.

9. **Добавить microinteractions**
   - Hover для row/card.
   - Selected transition.
   - Copy feedback.
   - Smooth upload tray collapse.
   - Понятная drag target подсветка.
   - **Done:** добавлены hover/focus actions, toast feedback для copy/delete undo, upload tray collapse, drag target highlight и blocked move reasons.

10. **Уменьшить визуальный шум**
   - Убрать повторяющиеся действия.
   - Спрятать вторичные details.
   - Сократить лишние borders.
   - Не плодить cards внутри cards.
   - **Mostly done:** secondary snippets спрятаны за disclosure, redundant preview action убран, основные действия уплотнены в toolbar/context menu/inspector.

11. **Собрать цветовую систему**
    - Neutral background.
    - One primary accent.
   - Semantic colors для public/private/warning/error.
   - Умеренные accents для file types.
   - Единый selected state для list/grid/context menu.
   - **Done:** list/grid используют единые colored type markers и CDN/blocked/private/public states; header получил White/Black/System theme switcher.

## Приоритет работ

1. Redesign file manager surface + toolbar.
2. Redesign right inspector panel.
3. Polish list rows and grid cards.
4. Add smart empty states.
5. Polish microinteractions and visual states.
6. Mobile/tablet adaptation.
7. Activity feed visual integration.

Status: priorities 1-7 are shipped. Remaining design work is now refinement: tighter mobile rows/cards, deeper typography pass, and any future visual QA feedback from real usage.

## Acceptance criteria

- Первый экран выглядит как цельный продукт, а не набор компонентов.
- File manager читается быстрее без объяснений.
- Правый inspector показывает реальный preview и главные действия без хаоса.
- List и Grid выглядят как два режима одной системы.
- Пустые состояния помогают действовать.
- Все hover, selected, drag, copy, upload states выглядят согласованно.
- Интерфейс остаётся плотным и рабочим, без landing-page эстетики.

## Shipped progress

- 2026-07-03: First polish slice shipped and deployed: compact dashboard header, Upload moved into the file-manager toolbar, unified file surface styling, stable list row height, uniform grid card dimensions, and sticky inspector framing. `bun run check`, `bun run typecheck`, GitHub Actions deploy, and production setup check passed.
- 2026-07-03: Second polish slice shipped and deployed: right inspector now has a compact header, fixed preview area, inline filename section, compact metadata grid, adjacent download action, and flatter CDN controls. `bun run check`, `bun run typecheck`, GitHub Actions deploy, and production setup check passed.
- 2026-07-03: Third polish slice shipped and deployed: list rows now have stable hover/focus actions for preview, copy URL, open, and delete; grid cards have fixed status placement over preview and richer bottom metadata. `bun run check`, `bun run typecheck`, GitHub Actions deploy, and production setup check passed.
- 2026-07-03: Fourth polish slice shipped and deployed: empty folder and empty search states now render as action-oriented drop-zone surfaces with clear primary actions and supported media hints. `bun run check`, `bun run typecheck`, GitHub Actions deploy, and production setup check passed.
- 2026-07-03: Fifth polish slice shipped and deployed: copy actions show toast feedback and folder drop targets highlight in both list and grid views during drag-over. `bun run check`, `bun run typecheck`, GitHub Actions deploy, and production setup check passed.
- 2026-07-03: Sixth polish slice shipped and deployed: mobile/tablet Details and Activity open in a bottom sheet, selected files raise the mobile details surface, and the header has a persisted White/Black/System theme switcher.
