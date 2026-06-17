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
- `GET /cdn/:workspace/:asset/:filename` публичная delivery route, если понадобится Worker fallback.

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

- Phase 1 foundation started: Alchemy/OpenNext Cloudflare wiring, D1/R2 resource definitions, Drizzle schema/migration, Better Auth route skeleton and monorepo deploy scripts are in place.

### Phase 1: Foundation

- Добавить Alchemy dependencies и Next.js Cloudflare config.
- Добавить D1 + Drizzle schema package или app-local `src/db`.
- Подключить better-auth с D1-backed adapter.
- Provision R2 и D1 для stage-specific окружений.

### Phase 2: Upload MVP

- Собрать authenticated dashboard shell.
- Реализовать upload intent, object write, completion и file list.
- Сохранять MIME type, size, hash, CDN flag и R2 key.
- Добавить direct/private download route.

### Phase 3: CDN Publishing

- Добавить CDN toggle и versioned public object keys.
- Генерировать public URL и copy-to-clipboard.
- Настроить cache headers и CORS для embedding на сайтах.
- Добавить delete/disable поведение с сохранением audit history.

### Phase 4: Production Hardening

- Добавить quotas, rate limits, token scopes, virus/malware scanning hook и SVG safety.
- Добавить audit log UI.
- Добавить background cleanup для abandoned uploads и deleted objects.
- Покрыть тестами permissions, CDN state transitions и upload edge cases.

### Phase 5: Developer Experience

- Документировать local setup, Cloudflare auth, Alchemy stages и deploy flow.
- Добавить seed/demo data.
- Добавить API docs и snippets для Next.js, plain HTML и server uploads.

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
