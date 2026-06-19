# План Media CDN Service

## Цель продукта

Сервис для хранения медиафайлов, которые сайты смогут использовать как быстрое хранилище фото, видео, SVG, документов и других ассетов. По умолчанию файлы приватные, но отдельные файлы можно помечать как CDN-enabled и получать стабильные публичные URL с агрессивным кешированием.

## Стек

- Next.js в `apps/web`: dashboard, API routes, server actions.
- Turborepo + Bun из текущего шаблона.
- Cloudflare Workers deployment через Alchemy.
- Cloudflare R2 для объектного хранилища.
- Cloudflare CDN перед CDN-enabled файлами через custom domain.
- Cloudflare D1 как основная SQL-база.
- Drizzle ORM для схемы, миграций и типизированного доступа к D1.
- better-auth для пользователей, сессий, организаций/команд и владения API-токенами.

## Архитектура Cloudflare

1. `apps/web` деплоится как Next.js Worker через Alchemy.
2. R2 bucket хранит все загруженные объекты.
3. D1 хранит метаданные, права, upload state, CDN-флаги, audit events и API-токены.
4. CDN-enabled ассеты получают deterministic public key: `cdn/{workspaceId}/{assetId}/{filename}`.
5. Non-CDN ассеты остаются приватными и отдаются только через authenticated signed download routes.
6. Custom media domain, например `media.example.com`, ведет на R2/Worker delivery layer.
7. Cache policy зависит от состояния:
   - `cdnEnabled=false`: публичного URL нет, только авторизованный доступ.
   - `cdnEnabled=true`: публичный URL и immutable cache headers.
   - замена файла создает новый versioned key, а не меняет байты под старым CDN URL.

## Модель данных

Начальные таблицы D1:

- `users`, `sessions`, `accounts`, `verifications`: таблицы better-auth.
- `workspaces`: граница владения файлами.
- `workspace_members`: роли и доступ в workspace.
- `assets`: логическая запись файла: owner, workspace, filename, MIME type, size, checksum, dimensions/duration, CDN flag, current version, timestamps.
- `asset_versions`: immutable R2 object key, content hash, upload status, metadata, cache headers.
- `asset_tags`: метки для поиска.
- `api_tokens`: scoped tokens для server-to-server интеграций.
- `audit_events`: upload, delete, CDN enable/disable, token creation, permission changes.

## Upload Flow

1. Авторизованный пользователь создает upload intent.
2. API проверяет workspace permissions, MIME type, size limits и quota.
3. API создает `assets` и `asset_versions` со статусом `pending`.
4. Клиент загружает файл через app route или short-lived signed R2 upload URL.
5. Сервер проверяет объект в R2, записывает checksum/size и переводит версию в `ready`.
6. Если включен CDN, сервер публикует объект под public versioned key и сохраняет public URL.

## CDN Rules

- CDN URLs должны быть versioned и стабильными: новые байты = новый URL.
- Public ассеты получают `Cache-Control: public, max-age=31536000, immutable`.
- Private downloads получают `Cache-Control: private, no-store`.
- SVG требует sanitization или строгих serving headers.
- Content type хранится и выставляется явно из проверенных метаданных.
- Позже можно добавить image variants через Cloudflare Images или Worker transformations.

## API Surface

Dashboard:

- File browser: search, filters, preview, copy URL, upload, delete, CDN toggle.
- Asset detail: versions, metadata, usage snippet, audit history.
- API token management для интеграций.

HTTP API:

- `POST /api/assets/uploads` создает upload intent.
- `POST /api/assets/:id/complete` завершает upload.
- `GET /api/assets` возвращает список ассетов.
- `PATCH /api/assets/:id` обновляет имя, tags или CDN flag.
- `DELETE /api/assets/:id` soft-delete ассета и планирует R2 cleanup.
- `GET /cdn/:workspace/:asset/:version/:filename` публичная delivery route, если понадобится Worker fallback.

## Provisioning Через Alchemy

Ресурсы в `apps/web/alchemy.run.ts` или отдельном infra package:

- Next.js Worker deployment для `apps/web`.
- `R2Bucket` для медиафайлов с CORS, lifecycle rules, optional custom domain и stage-specific names.
- `D1Database` с migrations directory, сгенерированной Drizzle.
- Worker bindings: `DB`, `MEDIA_BUCKET`, auth secrets, public media base URL.
- Turborepo `deploy`, `dev`, `destroy` tasks; для `deploy`/`destroy` кеш выключен.

Планируемые scripts:

- Root `deploy`: `turbo deploy`
- Root `destroy`: `turbo destroy`
- Web `deploy`: `alchemy deploy --app web`
- Web `destroy`: `alchemy destroy --app web`
- Web `db:generate`: Drizzle migration generation
- Web `db:migrate`: применение D1 migrations через Alchemy/Wrangler-compatible flow

## Этапы реализации

### Progress

- Phase 1 foundation completed: Alchemy/OpenNext Cloudflare wiring, D1/R2 resource definitions, Drizzle schema/migration, Better Auth route skeleton and monorepo deploy scripts are in place.
- Phase 2 upload MVP started: authenticated dashboard shell, asset list query, upload intent API, app-mediated R2 object write route, upload completion route, and private download route are in place.
- Phase 2 upload UI path continued: first-workspace onboarding, workspace creation API, client upload dialog, upload progress/error states, dashboard refresh, and private download action are in place.
- Phase 2 Upload MVP completed: onboarding, upload happy path, drag-and-drop UI, friendly status labels, private downloads, and download audit events are in place.
- Production deploy path completed for current workflow: GitHub Actions builds on Ubuntu, applies D1 migrations, and deploys with Wrangler because local Windows OpenNext builds are unreliable.
- Better Auth Infra connected: Dash server plugin, Sentinel client plugin, `BETTER_AUTH_API_KEY` wiring, and production `BETTER_AUTH_SECRET` setup are confirmed.
- Auth UI continued: email/password auth page and Google sign-in button/provider wiring are in place.
- Production auth/setup unblocked: latest deployed commit reports healthy setup status, email signup works, workspace creation works, and dashboard render after workspace creation returns `200`.
- Phase 3 CDN backend started: public R2 key/URL helpers, authenticated asset PATCH route, ready-version publish copy, immutable cache metadata, MIME safety guard, and CDN audit events are in place.
- Phase 3 CDN product path continued: dashboard CDN switch, public URL display/copy button, not-ready disabled state, tags update support, and Worker-controlled `/cdn/:workspace/:asset/:version/:filename` fallback route are in place.
- Account settings started: dashboard account menu, sign out action, account settings page, and email/password change form are in place.

### Phase 1: Foundation

- [x] Добавить Alchemy dependencies и Next.js Cloudflare config.
- [x] Добавить D1 + Drizzle schema package или app-local `src/db`.
- [x] Подключить better-auth с D1-backed adapter.
- [x] Provision R2 и D1 для stage-specific окружений.

### Phase 2: Upload MVP - completed

- [x] Собрать authenticated dashboard shell.
- [x] Реализовать upload intent, object write, completion и file list.
- [x] Сохранять MIME type, size, hash, CDN flag и R2 key.
- [x] Добавить direct/private download route.
- [x] Добавить client-side upload UI поверх новых API routes.
- [x] Добавить workspace creation/onboarding для первого пользователя.

#### Phase 2 Implementation Notes

Upload MVP должен закрыть полный happy path без ручных API вызовов:

1. Пользователь входит в dashboard.
2. Если workspace нет, видит короткий onboarding и создает первый workspace.
3. Пользователь выбирает файл, видит имя, MIME type, размер и private upload режим.
4. UI создает upload intent через `POST /api/assets/uploads`.
5. UI отправляет bytes в app-mediated `PUT /api/assets/:id/content?versionId=...`.
6. UI вызывает `POST /api/assets/:id/complete`.
7. Таблица ассетов обновляется и показывает `ready`, размер и private download action.

Технические задачи:

- [x] Добавить server action или route для создания workspace + owner membership.
- [x] На первом входе показывать empty state с формой `workspace name` и автогенерацией slug.
- [x] Вынести dashboard upload в client component с `useTransition`/локальным upload state.
- [x] Добавить drag-and-drop upload область поверх текущего file picker.
- [x] Добавить file picker, progress states и error states.
- [x] После upload completion делать refresh списка через `router.refresh()`.
- [x] Для private ассетов добавить кнопку download, которая открывает authenticated download route.
- [x] Для таблицы добавить human-friendly status mapping: `pending`, `uploaded`, `ready`, `failed`, `abandoned`.
- [x] Добавить минимальную валидацию на клиенте: max 250 MB и allowed MIME families.
- [x] Записывать audit events для workspace creation.
- [x] Записывать audit events для private download, если download events нужны в MVP.

Acceptance criteria:

- [x] Новый пользователь может создать workspace без seed data.
- [x] Пользователь может загрузить файл через UI и увидеть его в списке без перезагрузки вручную.
- [x] Ready asset скачивается через authenticated private download.
- [x] Пользователь без membership получает `403` на list/upload/complete/download.
- [x] Ошибки upload не оставляют UI в вечном loading state.

### Phase 3: CDN Publishing

- [x] Добавить CDN toggle и versioned public object keys.
- [x] Генерировать public URL и copy-to-clipboard.
- [x] Настроить cache headers и CORS для embedding на сайтах.
- [ ] Добавить delete/disable поведение с сохранением audit history.

#### Phase 3 Implementation Notes

CDN publishing должен быть versioned-first: нельзя перезаписывать байты под уже выданным public URL.

Public key format:

- Private source object: `private/{workspaceId}/{assetId}/v{version}/{filename}`
- Public CDN object: `cdn/{workspaceId}/{assetId}/v{version}/{filename}`

Технические задачи:

- [x] Добавить helper `makePublicR2Key` рядом с `makePrivateR2Key`.
- [x] Добавить route/action `PATCH /api/assets/:id` для `cdnEnabled` и filename.
- [x] Добавить tags update в `PATCH /api/assets/:id`.
- [x] При включении CDN копировать current ready version из private key в public key.
- [x] В `asset_versions` сохранять `publicKey`, `publicUrl`, `cacheControl`.
- [x] Выставлять `Cache-Control: public, max-age=31536000, immutable` для public object.
- [x] При выключении CDN убирать public URL из активного состояния, но не ломать audit/history.
- [x] Добавить public delivery fallback route `GET /cdn/:workspace/:asset/:version/:filename` только если direct R2 custom domain не закрывает access control/headers.
- [x] Добавить UI: CDN switch, public URL cell, copy button, disabled state для not-ready versions.
- [x] Запретить CDN publish для неподготовленных или потенциально опасных MIME types до safety policy.

Acceptance criteria:

- Ready private asset можно опубликовать в CDN одним toggle.
- Public URL содержит версию и не меняется при повторном чтении.
- Повторная загрузка/замена файла создает новую версию и новый public URL.
- CDN-disabled asset не получает новый public URL.
- Copy URL button работает только когда `publicUrl` существует.

### Phase 4: Production Hardening

- [ ] Добавить quotas, rate limits, token scopes, virus/malware scanning hook и SVG safety.
- [x] Подключить Better Auth Infra Dash для production auth visibility.
- [x] Подключить Better Auth Sentinel client для security telemetry/challenges.
- [x] Настроить обязательные production auth secrets: `BETTER_AUTH_SECRET` и `BETTER_AUTH_API_KEY`.
- [x] Добавить email/password auth UI через Better Auth client.
- [x] Добавить Google OAuth wiring через `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`.
- [x] Добавить account menu, sign out и страницу account settings.
- [x] Добавить смену пароля для email/password аккаунтов.
- [x] Добавить production setup diagnostic endpoint `GET /api/setup/status`.
- [x] Подтвердить production Worker deploy последнего commit после изменения env/bindings.
- [x] Подтвердить Cloudflare bindings: `DB` D1 database и `MEDIA_BUCKET` R2 bucket.
- [x] Применить/подтвердить D1 migrations на production DB.
- [ ] Добавить audit log UI.
- [ ] Добавить background cleanup для abandoned uploads и deleted objects.
- [ ] Покрыть тестами permissions, CDN state transitions и upload edge cases.

#### Phase 4 Implementation Notes

Security и reliability задачи лучше вводить после UI happy path, но до публичного использования сервиса.

- [ ] Добавить workspace quota fields или отдельную `workspace_usage` модель.
- [ ] Ограничить upload intent по quota до записи `assets`.
- [ ] Добавить per-user/per-workspace rate limits для upload intent и content upload.
- [ ] Реализовать API token hashing, prefix display и scoped permissions.
- [ ] Добавить token auth path рядом с session auth для server-to-server API.
- [ ] Добавить SVG policy: sanitize или serve as attachment / strict CSP headers.
- [ ] Добавить malware scanning hook как async status перед CDN publish.
- [ ] Добавить scheduled cleanup для `pending` versions старше N часов.
- [ ] Добавить soft-delete cleanup для R2 objects после retention window.
- [ ] Добавить audit log page с фильтром по asset и event type.
- [ ] Подключить OpenTelemetry spans для upload intent, R2 put, complete и CDN publish.
- [x] После каждого production env/binding change проверять `GET /api/setup/status`:
  - `bindings.DB=true`
  - `bindings.MEDIA_BUCKET=true`
  - `bindings.GOOGLE=true`
  - `database.ready=true`
  - `database.missingTables=[]`

Test plan:

- [ ] Permission matrix: owner/admin/member/viewer/no membership.
- [ ] Upload state transitions: pending -> uploaded -> ready, conflict повторных вызовов.
- [ ] Size mismatch и MIME rejection.
- [ ] Private download для ready only.
- [ ] CDN publish для ready only и immutable URL behavior.
- [x] Workspace onboarding для первого пользователя.

### Phase 5: Developer Experience

- [x] Добавить OpenNext/Wrangler scripts для Cloudflare build/deploy из monorepo.
- [x] Добавить GitHub Actions deploy flow для Linux-сборки OpenNext и Wrangler deploy.
- [ ] Документировать local setup, Cloudflare auth, Alchemy stages и deploy flow.
- [ ] Документировать Cloudflare manual setup: D1 binding `DB`, R2 binding `MEDIA_BUCKET`, Better Auth secrets, Google OAuth env и required redeploy.
- [ ] Добавить seed/demo data.
- [ ] Добавить API docs и snippets для Next.js, plain HTML и server uploads.

#### Phase 5 Implementation Notes

- [ ] Описать required env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_API_KEY`, Cloudflare account auth и public media base URL.
- [ ] Описать Google OAuth setup:
  - Google Cloud OAuth client type: Web application;
  - redirect URI: `https://media-cdn-service.gabolov3.workers.dev/api/auth/callback/google`;
  - Worker env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`;
  - redeploy after env changes.
- [ ] Описать локальный D1 migration flow: generate, local migrate, remote migrate.
- [ ] Описать Cloudflare deploy flow: `bun run cf:build`, `bun run cf:deploy`, `bun run deploy`.
- [ ] Добавить troubleshooting для missing Cloudflare bindings и auth secret errors.
- [ ] Добавить seed script для пользователя/workspace/demo assets metadata без загрузки больших файлов.
- [ ] Добавить API examples:
  - browser upload through app-mediated routes;
  - server upload with API token;
  - embedding CDN URL in Next.js image/video/plain HTML.

## Ближайший порядок работ

1. Permission and state-transition tests.
2. CDN delete behavior and production browser verification.
3. Account settings polish: email change, profile name update, active sessions.
4. Local setup/deploy documentation, including GitHub Actions deploy and Windows OpenNext caveat.
5. Audit log UI.

## Production Auth/Setup Status

Current known state:

- GitHub Actions deploy workflow is active on `main` and successfully deployed commit `dfa5e3a`.
- `GET /api/setup/status` returns `ok=true`.
- Confirmed production bindings:
  - `bindings.DB=true`
  - `bindings.MEDIA_BUCKET=true`
  - `bindings.GOOGLE=true`
- Confirmed production database:
  - `database.ready=true`
  - `database.missingTables=[]`
- Confirmed production happy path:
  - email signup returns `200`;
  - `POST /api/workspaces` returns `201`;
  - dashboard render after workspace creation returns `200`.
- Confirmed latest production setup check after commit `dfa5e3a`:
  - `ok=true`;
  - `bindings.DB=true`;
  - `bindings.MEDIA_BUCKET=true`;
  - `bindings.GOOGLE=true`;
  - `database.ready=true`;
  - `database.missingTables=[]`.
- Local Windows OpenNext builds are unreliable because generated server-function dependency symlinks fail with `Access is denied`; production deploy should use GitHub Actions unless this is fixed upstream or locally.

## Риски и ограничения MVP

- App-mediated upload читает файл через Worker route, поэтому 250 MB лимит может быть слишком высоким для production. Если Cloudflare limits начнут мешать, перейти на short-lived direct-to-R2 signed upload.
- D1 подходит для metadata и audit событий, но list/search надо проектировать с индексами заранее: workspace, deleted state, MIME, CDN flag, tags.
- Public SVG нельзя отдавать как обычный trusted image без отдельной safety policy.
- Immutable CDN URL означает, что replace должен создавать новую version, а UI должен явно показывать active/current version.
- API tokens нельзя хранить в открытом виде: только hash + prefix.

## Открытые решения

- Delivery mode: direct R2 custom domain или Worker-controlled `/cdn/*`.
- Upload mode: app-mediated upload или signed direct-to-R2 upload.
- Включать ли image/video transformations в MVP или оставить v1 как storage + delivery.
- Billing/quota model: per-user, per-workspace или внешний subscription provider.

## Reference Docs

- https://alchemy.run/guides/cloudflare-nextjs/
- https://alchemy.run/providers/cloudflare/bucket/
- https://alchemy.run/providers/cloudflare/bucket-object/
- https://alchemy.run/providers/cloudflare/d1-database/
- https://alchemy.run/guides/turborepo/
