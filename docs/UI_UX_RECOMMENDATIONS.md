# UI/UX рекомендации для Media CDN Service

Цель: сделать продукт визуально современным, быстрым в работе и ощущающимся как профессиональный файловый менеджер для медиа-CDN, а не как обычная таблица с кнопками.

## 20 рекомендаций

1. **Command palette для быстрых действий**
   Добавить `Cmd/Ctrl + K` с командами: загрузить файлы, создать папку, найти файл, опубликовать в CDN, скопировать URL, открыть настройки workspace. Это даст ощущение современного power-user продукта и ускорит работу без мыши. **Done:** file manager имеет command palette с Upload, New folder, Search, Select, Rename, Publish current/selected и Copy public URL.

2. **Два режима просмотра: список и медиа-сетка**
   Сейчас файловый менеджер ближе к таблице. Для изображений и видео нужен grid-view с крупными превью, размером, CDN-статусом и быстрым выбором. Список оставить для документов, больших наборов файлов и точной работы.

3. **Preview-first правую панель**
   Сделать правую панель главным местом работы с выбранным ассетом: крупное превью сверху, ниже имя, размер, MIME, CDN URL, действия. Для изображений, видео, аудио и PDF панель должна показывать реальный контент, а не только метаданные.

4. **Breadcrumb как интерактивная навигационная строка**
   Путь папки должен ощущаться как адресная строка: каждый сегмент кликабельный, рядом компактная кнопка копирования пути, поддержка перехода клавиатурой. Это усиливает ощущение OS-like file browser.

5. **Drag selection рамкой**
   Добавить выделение прямоугольной рамкой по области файлов, как в Finder/Explorer. Это современнее чекбоксов и хорошо сочетается с уже выбранным направлением: row highlight + Shift-range. **Done:** пустая область файлов поддерживает pointer-drag рамку, которая выделяет пересеченные файлы и папки.

6. **Умная зона drop-target при переносе**
   При drag файлов или папок показывать подсветку доступных папок, root-зоны и недоступных целей. Для запретных целей показывать короткий inline reason: `Cannot move folder into itself`.

7. **Batch action bar вместо отдельного select-mode блока**
   Когда выбрано несколько элементов, снизу или над списком должна появляться плавающая action bar: Move, Publish, Download, Delete, Clear. Она должна быть компактной, sticky и не ломать высоту таблицы. **Done:** Select mode теперь использует floating action bar для Select all, Publish, Move и Clear.

8. **Undo toast для destructive actions**
   После удаления файла/папки показывать toast с `Undo` на 5-10 секунд. Это снижает страх перед быстрыми действиями и делает интерфейс более зрелым. Backend уже использует soft-delete, поэтому UX хорошо ложится на модель.

9. **Инлайн-переименование без отдельной кнопки Save**
   Переименование можно сделать как в файловых менеджерах: `F2` или клик по имени, Enter сохраняет, Escape отменяет, blur сохраняет. Кнопку Save в правой панели лучше заменить на нативный inline editing pattern.

10. **CDN publish как понятный lifecycle**
    Вместо простого `CDN published / Not published` показать lifecycle: `Private`, `Publishing`, `Public`, `Disabled`, `Blocked`. Для каждого состояния дать визуальный цвет, короткий смысл и доступные действия. **Done:** правая панель показывает CDN lifecycle card с Private, Publishing, Public и Blocked состояниями.

11. **Public URL card с live snippet**
    В правой панели сделать compact-блок: публичный URL, кнопка copy, Next.js snippet, HTML snippet. После копирования показывать микро-feedback `Copied`. Это превращает CDN в главный продуктовый value, а не вторичную настройку. **Done:** основной видимый блок показывает Public CDN URL, а Next.js и HTML snippets скрыты в раскрываемом `Embed snippets`.

12. **Smart empty states по контексту**
    Для пустой папки показывать не общий текст, а контекстные действия: Upload, Create folder, Drop files here. Для пустого поиска: `No results for "..."` + кнопка очистки поиска. Empty state должен помогать следующему действию. **Done:** list/grid empty states показывают Upload, New folder и drop hint для пустой папки, а пустой поиск показывает запрос и Clear search.

13. **Глобальный upload tray**
    При загрузке нескольких файлов показать небольшой tray в углу: текущий файл, общий progress, ошибки, кнопка свернуть. Это лучше, чем только overlay, потому что пользователь может продолжать работать во время загрузки. **Done:** header Upload и drop-upload используют compact tray с общим progress, per-file статусами, сворачиванием и очисткой завершенных файлов.

14. **Upload queue с retry**
    Для каждого файла в очереди показывать статус: waiting, uploading, ready, failed. Для failed дать retry. Это особенно важно для медиа-сервиса, где файлы могут быть большими и сеть нестабильной. **Done:** каждый файл в очереди получает waiting/uploading/ready/failed status, failed uploads остаются в tray и могут быть запущены повторно через Retry.

15. **Storage usage как тонкий quota meter**
    Текущий компактный формат сохранить, но добавить тонкую progress-line: used / limit, warning при 80%, danger при 95%. Не делать большой card: метрика должна быть видимой, но не доминировать. **Done:** header storage summary сохранил компактный текст и получил тонкий quota meter с warning при 80% и danger при 95%.

16. **Recent activity / audit feed в правой панели workspace**
    Добавить вкладку Activity: uploaded, renamed, moved, published, downloaded, deleted. Для MVP можно показать последние 20 событий. Это делает продукт более профессиональным для командной работы и debugging. **Done:** правая панель получила Activity view с последними 20 audit events workspace: uploads, moves, publish/unpublish, previews/downloads, deletes, folder events и workspace changes.

17. **Профессиональная адаптация под mobile/tablet**
    На mobile список должен превращаться в плотные rows/cards, а правая панель - в bottom sheet. Главные действия: upload, search, select, details. Не пытаться просто сжать desktop grid.

18. **Keyboard-first workflow**
    Добавить горячие клавиши: `/` search, `N` new folder, `U` upload, `F2` rename, `Delete` delete, `Enter` open, `Space` preview/select, `Esc` clear. Показывать их в tooltip/menu, но не перегружать экран подсказками. **Done:** `Cmd/Ctrl+K`, `/`, `N`, `U`, `F2` и `Esc` работают без перехвата ввода в текстовых полях; command palette показывает основные shortcuts.

19. **Context menu как основной action surface**
    Расширить правый клик: Rename, Move to, Copy public URL, Publish/Unpublish, Download, Delete, Show details. Для папок: Open, Rename, Move, Delete. Это соответствует ожиданию "как в Google Drive", но остается lightweight. **Done:** right-click menu теперь работает в list и grid: файлы поддерживают Show details, Rename, Preview, Publish to CDN, Copy public URL, Download и Select for move; list-view также сохраняет Delete через существующий confirm flow. Папки поддерживают Open и Select for move, а list-view также сохраняет Delete.

20. **Визуальная система статусов и типов файлов**
    Ввести единый набор иконок/цветов для folders, images, videos, audio, documents, SVG, private/public, warning/blocked. Сейчас интерфейс функционален, но единая визуальная семантика сделает его быстрее для чтения и современнее.

## Приоритетный порядок

1. Grid-view + preview-first правую панель. **Done:** добавлен переключатель List/Grid и preview-first asset details panel.
2. Batch action bar + drag selection рамкой. **Done:** batch action bar и drag selection рамкой shipped.
3. CDN lifecycle + public URL snippets. **Done:** lifecycle card, compact Public CDN URL, and hidden optional snippets shipped.
4. Upload tray + retry queue. **Done:** compact upload tray and per-file retry queue shipped.
5. Keyboard shortcuts + command palette. **Done:** Cmd/Ctrl+K palette and keyboard workflow shipped.
6. Activity/audit feed. **Done:** recent workspace activity shipped in the right panel.

## Дизайн-направление

- Больше ощущения desktop app: плотные строки, быстрые hover/focus состояния, контекстные меню, клавиатура, drag/drop.
- Меньше декоративных карточек: dashboard должен быть рабочим инструментом, а не landing page.
- Главный продуктовый смысл показывать постоянно: где файл, приватный он или CDN-public, какой URL использовать, сколько storage осталось.
- Все массовые операции должны быть reversible или хотя бы уверенно подтвержденные: undo для soft-delete, понятные ошибки для move/publish.
