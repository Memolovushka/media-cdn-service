# UI/UX план: следующий уровень Media CDN Service

Цель: после базового polish сделать продукт понятнее для новых пользователей, сильнее как CDN-инструмент и удобнее для командной production-работы.

## Статус выполнения

- 2026-07-03: начат приоритет 1. Добавлены upload drop assistant и pre-upload review перед постановкой файлов в очередь: папка назначения, лимит 250 MB, приватность по умолчанию, общий размер, ошибки типа/размера и предупреждение о совпадающих именах.

## 20 пунктов

1. **Guided first-run onboarding**
   Первый вход должен вести пользователя по короткому пути: создать workspace, загрузить первый файл, опубликовать в CDN, скопировать URL. Без отдельной landing-страницы внутри продукта.

2. **Demo workspace для пустого аккаунта**
   Добавить опциональный demo-набор ассетов: image, SVG, video, PDF. Это позволит сразу увидеть list/grid, preview, CDN URL и snippets без ручной загрузки.

3. **Upload drop assistant**
   При первом drag-and-drop показать компактный overlay с понятным смыслом: куда попадут файлы, какой лимит размера, приватный ли upload по умолчанию.

4. **Pre-upload review**
   Перед массовой загрузкой показывать список файлов с типом, размером, конфликтами имен и выбранной папкой. Пользователь должен понимать, что именно отправляет.

5. **Filename conflict UX**
   Если в папке уже есть похожее имя, предложить варианты: keep both, rename new, replace as new version. Технически storage безопасен, но display-layer должен быть ясным.

6. **Version history panel**
   В inspector добавить вкладку Versions: текущая версия, старые версии, размер, дата, public/private статус, copy URL для опубликованных версий.

7. **Replace file flow**
   Добавить явное действие Replace: загрузить новые байты как новую immutable version, показать новый CDN URL и предупредить, что старый URL не меняется.

8. **CDN publish checklist**
   Перед публикацией показывать компактную проверку: ready version, MIME allowed, SVG safety, cache policy, public URL path. Это снизит риск случайной публичной выдачи.

9. **Public asset health**
   Для опубликованного файла показывать last checked статус: URL доступен, content-type корректный, cache-control выставлен. Кнопка refresh check рядом.

10. **Copy menu для интеграций**
   Вместо одного copy URL добавить меню: Public URL, HTML img/video, Next.js Image, CSS background, Markdown, JSON metadata.

11. **API token creation wizard**
   Сделать отдельный flow для токенов: имя, scope, workspace, expiry, preview прав. После создания показать token один раз и сразу дать curl/example.

12. **Integration snippets page**
   Добавить страницу Integrations с готовыми примерами: browser upload, server upload, private download, CDN embed, Next.js config.

13. **Activity timeline с фильтрами**
   Расширить Activity до полноценного журнала: фильтр по asset, actor, event type, date. В file inspector показывать только события выбранного файла.

14. **Permission-aware UI states**
   Если роль не позволяет upload/delete/publish, кнопки должны быть disabled с коротким reason, а не просто исчезать. Это важно для team UX.

15. **Workspace members screen**
   Добавить экран Members: список участников, роли, invite flow, pending invites, remove member. В MVP можно начать с read-only roles и invite placeholder.

16. **Quota forecasting**
   Storage meter должен показывать не только used/limit, но и прогноз после выбранного upload batch: `After upload: 742 MB / 1 GB`.

17. **Large upload resilience UI**
   Для больших файлов показывать явные состояния: preparing, uploading, verifying, ready. Ошибки должны объяснять, можно ли retry без повторного выбора файла.

18. **Search upgrade**
   Добавить быстрые фильтры: type, public/private, size range, uploaded by, date. Search bar должен поддерживать tokens, но оставаться простой для обычного поиска.

19. **Saved views**
   Дать сохранить частые фильтры: Public images, Recent uploads, Large videos, Private SVG. Это полезно для рабочих workspace с сотнями файлов.

20. **Production status drawer**
   Добавить компактный diagnostics drawer для owner/admin: DB/R2 bindings, migrations, Google auth, current deploy commit, setup status. Не показывать обычным пользователям.

## Приоритет

1. First-run onboarding + pre-upload review.
2. Version history + replace file flow.
3. CDN publish checklist + public asset health.
4. API token wizard + integration snippets.
5. Activity filters + permission-aware states.
6. Quota forecasting + large upload resilience.
7. Search filters + saved views.
8. Members screen + production status drawer.

## Acceptance criteria

- Новый пользователь за 2-3 минуты понимает полный путь от upload до CDN URL.
- Replace/versioning невозможно спутать с перезаписью старого публичного URL.
- Публикация в CDN выглядит как осознанный production-действие, а не случайный toggle.
- Командные ограничения и роли читаются прямо в UI.
- Интеграционный путь для разработчика не требует искать API вручную.
- Диагностика production-состояния доступна owner/admin без похода в логи.
