# Patshop On-Demand Webapp Framework

Patshop On-Demand Webapp adalah framework aplikasi berbasis Bun, Elysia, Nuxt, Drizzle, dan Zod. Struktur proyek ini mengikuti pola Laravel secara konseptual: routing dipusatkan, bootstrap dipisahkan dari entrypoint, konfigurasi berada di `config`, logic HTTP berada di `app/Http`, console tersedia lewat `panda.ts`, dan database dipisahkan antara model aplikasi, schema Drizzle, migration, serta seeder.

Dokumentasi ini adalah kontrak framework. Setiap perubahan kode harus mengikuti aturan di bawah ini.

## Prinsip Utama

- `index.ts` hanya boleh menjalankan server. Jangan menaruh routing, middleware, provider, atau business logic di sana.
- `bootstrap/app.ts` adalah pusat komposisi framework. Semua provider, middleware, routes, dan error handler masuk melalui bootstrap.
- `routes/api.ts` adalah satu-satunya entrypoint route API.
- `config/` adalah pusat konfigurasi, default, registry, dan normalisasi environment.
- `app/` berisi kode aplikasi yang menjalankan behavior.
- `database/` hanya berisi migration SQL dan seeder aplikasi.
- `resources/` hanya berisi source Nuxt, CSS, dan helper frontend.
- Setiap behavior baru harus memiliki test pada level yang tepat.

## Struktur Direktori

```text
app/
  Console/
    Commands/
    Kernel.ts
    generator.ts
  Http/
    Controllers/
    Middlewares/
    Requests/
  Models/
  Policies/
  Providers/
  Support/
bootstrap/
config/
  Database/
  drizzle/
    meta/
    schemas/
database/
  migrations/
  seeders/
resources/
  css/
  js/
  views/
routes/
tests/
  unit/
  features/
  integration/
api.ts
index.ts
panda.ts
nuxt.config.ts
```

## Ownership Folder

### `index.ts`

`index.ts` hanya boot server standalone.

Wajib:
- membaca app factory dari bootstrap/API layer
- menjalankan server

Dilarang:
- mendefinisikan route
- mendaftarkan middleware
- membuat provider
- memanggil database langsung
- menaruh business logic

### `bootstrap/`

`bootstrap/` menyusun framework runtime.

- `bootstrap/app.ts` membuat instance Elysia dan menyatukan provider, middleware, routes, dan exception handler.
- `bootstrap/providers.ts` mendaftarkan provider dari config.
- `bootstrap/middleware.ts` mendaftarkan middleware global dari config.
- `bootstrap/exceptions.ts` merender error framework menjadi response.

Semua komposisi aplikasi harus melewati folder ini.

### `routes/`

`routes/api.ts` adalah satu-satunya router API.

Aturan:
- Route boleh memanggil controller dan request object.
- Route closure hanya boleh dipakai untuk adaptasi HTTP yang tipis.
- Jangan menaruh query database, validasi kompleks, atau business logic di route.
- Route baru harus memiliki feature test jika endpoint bisa diakses lewat HTTP.

Contoh pola:

```ts
export const apiRoutes = new Elysia().get("/users", ({ request, set }) => {
  const response = controller.index(new IndexUserRequest(request));

  set.status = response.status;

  return response.body;
});
```

### `app/Http/Controllers`

Controller mengubah request object menjadi response object.

Wajib:
- menerima request class atau input yang sudah jelas
- mengembalikan bentuk response yang eksplisit
- tetap tipis dan mudah dites

Dilarang:
- mendaftarkan route
- membuat middleware
- membaca environment langsung
- menaruh SQL/schema Drizzle
- melakukan validasi body manual jika sudah ada request class

### `app/Policies`

Policy adalah rule authorization seperti Laravel Policy.

Wajib:
- policy class berakhiran `Policy`
- helper dan tipe dasar policy berada di `app/Policies/Policy.ts`
- policy yang tersedia didaftarkan di `config/policies.ts`
- authorization resource memakai method eksplisit seperti `viewAny`, `view`, `create`, `update`, dan `delete`

Dilarang:
- menaruh query database atau schema Drizzle di policy
- membaca environment langsung
- menulis RBAC inline di `routes/api.ts`

Contoh policy:

```ts
export class UserPolicy {
  update({ user, resource }: PolicyContext) {
    return userHasRole(user, "admin") || user?.id === resource?.id;
  }
}
```

### `app/Http/Requests`

Request class menangani authorization dan validation. Request baru harus memakai Zod untuk validasi input.

Wajib:
- `authorize()` untuk aturan akses dasar
- `validate()` untuk parsing data valid
- `safeValidate()` jika caller membutuhkan hasil non-throwing
- schema Zod diekspor agar bisa dites

Contoh:

```ts
export const storeUserRequestSchema = z.object({
  name: z.string().trim().min(1),
});
```

### `app/Http/Middlewares`

Middleware adalah reusable class yang menerima dan mengembalikan app Elysia.

Wajib:
- memakai class dengan method `handle(app: Elysia)`
- hanya mengurus cross-cutting concern
- membaca nilai konfigurasi dari `config`

Dilarang:
- menaruh route feature
- menaruh controller logic
- menaruh query domain

### `app/Models`

`app/Models` hanya berisi model aplikasi.

Aturan ketat:
- Tidak boleh ada folder `mysql`, `postgresql`, atau `sqlite` di `app/Models`.
- Tidak boleh ada file schema Drizzle di `app/Models`.
- Model boleh menyimpan nama tabel, type aplikasi, dan metadata domain.
- Detail dialect database harus berada di `config/drizzle/schemas`.

### `app/Providers`

Provider mendaftarkan dan melakukan boot service framework.

Aturan:
- provider harus mengimplementasikan kontrak `ServiceProvider`
- provider didaftarkan lewat `config/providers.ts`
- provider tidak boleh didaftarkan langsung di `bootstrap/app.ts` kecuali melalui registry

### `app/Console`

Console framework diakses lewat `bun panda`.

File penting:
- `app/Console/Kernel.ts` menangani command dispatch
- `app/Console/generator.ts` membuat artifact framework
- `app/Console/Commands` berisi command runtime

Audit framework:

```bash
bun panda doctor
```

`doctor` mengaudit struktur framework, forbidden path, route boundary, policy directory, policy config, storage config, queue/mail/broadcast/notification support, Pino error logging, request validation, migration folder, seeder folder, direct environment access, generator template, dan code diagnostics melalui `bun test`. Command ini harus lulus sebelum perubahan besar dianggap selesai.

Generator tersedia:

```bash
bun panda make:console SyncCatalog
bun panda make:command SyncCatalog
bun panda make:controller User
bun panda make:middleware EnsureUserIsAdmin
bun panda make:request StoreUser
bun panda make:model User
bun panda make:policy User
bun panda make:migration create_users_table
bun panda make:seeder User
bun panda make:provider User
bun panda make:test User --unit
```

Template `command`, `controller`, `middleware`, dan `request` wajib memakai Zod validation.

## Configuration

Semua konfigurasi harus berada di `config/`.

Aturan:
- Environment hanya dinormalisasi melalui config.
- Jangan memanggil `Bun.env` atau `process.env` langsung dari controller, route, middleware, model, seeder, atau provider.
- Registry provider, middleware, generator, CORS, auth, telemetry, Nuxt, Eden, database, storage, queue, mail, broadcasting, notification, dan seeder harus berada di file config masing-masing.
- Registry policy dan rule route authorization harus berada di `config/policies.ts`.

File utama:
- `config/app.ts` untuk nama app, port, locale, timezone, dan header framework
- `config/auth.ts` untuk bearer token dan public path
- `config/broadcasting.ts` untuk realtime WebSocket dan driver broadcast
- `config/cors.ts` untuk CORS
- `config/database.ts` untuk koneksi database dan path Drizzle
- `config/console.ts` untuk generator command
- `config/logger.ts` untuk Pino error log file, level, sync mode, dan redaction
- `config/mail.ts` untuk SMTP, mailer default, dan sender default
- `config/middleware.ts` untuk global middleware
- `config/notifications.ts` untuk default queue behavior notification
- `config/policies.ts` untuk policy registry, route policy rules, dan header user authorization
- `config/providers.ts` untuk provider registry
- `config/queue.ts` untuk koneksi queue dan worker defaults
- `config/seeder.ts` untuk deterministic Faker
- `config/storage.ts` untuk disk filesystem local, public, S3, visibility, dan CDN
- `config/telemetry.ts` untuk OpenTelemetry

## Database

Database memakai Drizzle, tetapi struktur folder tetap dibuat seperti framework aplikasi yang rapi.

Aturan folder:
- `app/Models` hanya model aplikasi
- `config/Database` berisi client, connection factory, dan schema selector
- `config/drizzle/schemas/<connection>` berisi schema Drizzle per dialect
- `config/drizzle/meta` berisi journal dan snapshot Drizzle
- `database/migrations` hanya berisi file `.sql`
- `database/seeders` hanya berisi class seeder aplikasi

Dilarang:
- membuat `database/client.ts`
- membuat `database/schema.ts`
- membuat `database/migrations/meta`
- membuat `database/migrations/mysql`, `postgresql`, atau `sqlite`
- membuat `app/Models/mysql`, `postgresql`, atau `sqlite`
- menyimpan config di `database/`

Command:

```bash
bun panda doctor
bun panda db:generate
bun panda db:migrate
bun panda db:migrate --seed
bun panda db:migrate:fresh
bun panda db:migrate:fresh --seed
bun panda db:migrate:rollback
bun panda db:migrate:reset
bun panda db:seed
bun panda db:seed --class=SystemSettingsSeeder
bun panda queue:work --max-jobs=100
bun run db:studio
```

`db:generate` dan `db:migrate` men-stage Drizzle meta secara sementara agar `database/migrations` tetap hanya berisi SQL. Karena migration SQL Drizzle tidak memiliki file `down()` seperti Laravel, `db:migrate:rollback` dan `db:migrate:reset` menjalankan reset schema terkonfigurasi dengan production guard. Command destructive wajib memakai `--force` saat `APP_ENV=production`.

Environment database:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=root
DB_PASSWORD=
DB_SSL=false
DATABASE_URL=
DB_URL=
```

Nilai `DB_CONNECTION` yang didukung:
- `mysql`
- `mariadb`
- `pgsql`
- `postgres`
- `postgresql`
- `sqlite`
- `sqlite3`

## Seeder

Seeder aplikasi berada di `database/seeders`.

Aturan:
- Root seeder adalah `database/seeders/DatabaseSeeder.ts`.
- Seeder target dapat dijalankan dengan `bun panda db:seed --class=NamaSeeder`, `--file=NamaSeeder`, atau argumen langsung `bun panda db:seed NamaSeeder`.
- Seeder helper berada di `app/Support/Seeders`.
- Faker harus memakai context deterministic dari `config/seeder.ts`.
- Jangan memanggil random generator langsung tanpa shared seeder context.

Environment seeder:

```bash
SEEDER_FAKER_SEED=20260716
SEEDER_FAKER_REF_DATE=2026-01-01T00:00:00.000Z
SEEDER_FAKER_LOCALE=id_ID
```

## Storage / Filesystem

Storage framework mengikuti konsep Laravel filesystem disk. Semua disk dikonfigurasi di `config/storage.ts` dan digunakan melalui `StorageManager` atau helper `disk()`.

Disk bawaan:
- `local` untuk file private di `storage/app/private`
- `public` untuk file public di `storage/app/public`
- `s3` untuk S3-compatible object storage dengan URL CDN dan temporary signed URL

File penting:
- `app/Support/Storage/StorageDisk.ts` berisi kontrak disk, visibility, error, dan helper path
- `app/Support/Storage/LocalStorageDisk.ts` menangani local filesystem dan chmod public/private
- `app/Support/Storage/S3StorageDisk.ts` menangani object S3, ACL visibility, CDN URL, dan temporary URL
- `app/Support/Storage/S3Signer.ts` menangani AWS Signature V4 tanpa dependency eksternal
- `app/Support/Storage/StorageManager.ts` memilih disk default seperti Laravel

Contoh penggunaan:

```ts
import { disk, storage } from "./app/Support/Storage";

await storage.put("avatars/user-1.txt", "content");

await disk("public").put("avatars/user-1.txt", "content", {
  contentType: "text/plain",
  visibility: "public",
});

const publicUrl = disk("s3").url("avatars/user-1.txt");
const temporaryUrl = await disk("s3").temporaryUrl("private/invoice.pdf", 300);
```

Aturan:
- path storage tidak boleh mengandung `.` atau `..`
- file upload runtime berada di `storage/app` dan tidak ikut git
- visibility hanya `public` atau `private`
- disk `public` harus memakai visibility `public` dan URL publik
- disk `local` default adalah private dan tidak boleh diekspos sebagai URL publik tanpa config `url`
- disk `s3` harus memakai `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`, dan `AWS_DEFAULT_REGION`
- `AWS_CDN_URL` atau `STORAGE_CDN_URL` dipakai untuk URL CDN
- `temporaryUrl()` pada S3 selalu memakai signed URL ke endpoint S3, bukan URL CDN
- `AWS_USE_ACL=true` mengubah visibility menjadi ACL `public-read` atau `private`
- jika bucket S3 memakai bucket policy tanpa ACL, set `AWS_USE_ACL=false` dan kelola public/private di policy provider
- jangan membaca file upload langsung dari controller; gunakan disk abstraction

Environment storage:

```bash
FILESYSTEM_DISK=local
STORAGE_LOCAL_ROOT=storage/app/private
STORAGE_PUBLIC_ROOT=storage/app/public
STORAGE_PUBLIC_URL=/storage
STORAGE_CDN_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_ENDPOINT=
AWS_CDN_URL=
AWS_VISIBILITY=private
AWS_USE_ACL=true
AWS_USE_PATH_STYLE_ENDPOINT=false
AWS_TEMPORARY_URL_EXPIRES=300
```

## Queue, Mail, Broadcasting, Notifications

Framework menyediakan support Laravel-style untuk job queue, mailer SMTP, broadcasting realtime, dan notifications.

File penting:
- `app/Support/Queue` berisi `QueueManager`, `SyncQueue`, `MemoryQueue`, dan kontrak job
- `app/Console/Commands/QueueWorkCommand.ts` menjalankan worker lewat `bun panda queue:work`
- `app/Support/Mail` berisi `MailMessage`, `MailManager`, SMTP transport, log mailer, dan array mailer untuk test
- `app/Support/Broadcasting` berisi broadcaster log/realtime dan helper pesan WebSocket
- `app/Support/Notifications` berisi notification contract, route helper, dan dispatcher channel `mail`/`broadcast`
- `config/queue.ts`, `config/mail.ts`, `config/broadcasting.ts`, dan `config/notifications.ts` adalah sumber konfigurasi resmi

Command queue:

```bash
bun panda queue:work --max-jobs=100
```

Contoh penggunaan:

```ts
import { broadcaster } from "./app/Support/Broadcasting";
import { mail, MailMessage } from "./app/Support/Mail";
import { notifications } from "./app/Support/Notifications";
import { queue } from "./app/Support/Queue";

await queue.push({
  name: "SyncCatalog",
  handle: async () => {
    // side effect async
  },
});

await mail.send(
  new MailMessage()
    .subject("Order updated")
    .line("Your order status changed.")
    .render("customer@example.test")
);

await broadcaster.broadcast({
  channel: "orders.1",
  data: { id: 1 },
  event: "OrderUpdated",
});

await notifications.send(user, new OrderUpdatedNotification());
```

Realtime WebSocket:
- endpoint default adalah `GET /broadcasting`
- client mengirim JSON `{ "event": "subscribe", "channel": "orders.1" }`
- event client yang didukung adalah `subscribe`, `unsubscribe`, dan `ping`
- server mengirim payload broadcast berisi `channel`, `event`, `data`, dan `sentAt`
- route WebSocket harus tetap public di `config/policies.ts`, sementara authorization channel yang lebih spesifik harus ditempatkan di layer request/controller atau broadcaster extension

Environment:

```bash
QUEUE_CONNECTION=sync
QUEUE_WORKER_MAX_JOBS=100
QUEUE_WORKER_SLEEP_MS=250

MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=starttls
MAIL_FROM_ADDRESS=hello@example.test
MAIL_FROM_NAME=Patshop On-Demand
MAIL_TIMEOUT_MS=10000

BROADCAST_CONNECTION=realtime
BROADCAST_WS_PATH=/broadcasting
BROADCAST_WS_MAX_PAYLOAD=65536
BROADCAST_WS_IDLE_TIMEOUT=120
BROADCAST_WS_BACKPRESSURE_LIMIT=1048576

NOTIFICATIONS_QUEUE=false
```

Aturan:
- Side effect lambat, email, dan integrasi eksternal sebaiknya masuk job queue.
- `QUEUE_CONNECTION=sync` menjalankan job langsung; `QUEUE_CONNECTION=memory` menahan job sampai worker dipanggil.
- `MAIL_MAILER=array` hanya untuk test; `log` untuk development; `smtp` untuk runtime yang mengirim email sungguhan.
- Notification yang memiliki `shouldQueue=true` atau `NOTIFICATIONS_QUEUE=true` akan dikirim melalui queue manager.
- Jangan membaca environment mail/queue/broadcast langsung dari application code.

## Nuxt Dan Eden

Nuxt source berada di `resources/views`.

Aturan:
- `api.ts` mengekspor Elysia app factory untuk `nuxt-elysia`.
- `nuxt.config.ts` memasang Elysia pada `/api`.
- `resources/js/eden.ts` adalah helper Eden Treaty standalone.
- Jangan memindahkan source Nuxt ke root project.

Command:

```bash
bun run dev
bun run web:dev
bun run api:dev
bun run build
bun run preview
```

## Security

Runtime environment dikonfigurasi di `config/app.ts`.

Aturan:
- `APP_ENV` dinormalisasi menjadi environment lowercase seperti `local`, `testing`, `staging`, atau `production`.
- `APP_DEBUG` mengontrol apakah error internal menyertakan detail error pada response 500.
- Default `APP_DEBUG` aktif hanya saat `APP_ENV=local`; production harus eksplisit mematikan debug.
- Command destructive seperti migration reset/fresh/rollback dan seed menolak `APP_ENV=production` tanpa `--force`.

Bearer auth dikonfigurasi di `config/auth.ts`.

Aturan:
- `API_BEARER_TOKEN` wajib diset saat `APP_ENV=production`; framework akan fail-fast jika kosong.
- Auth boleh nonaktif hanya untuk local/test development.
- Public path harus diatur lewat `AUTH_PUBLIC_PATHS`.
- Middleware auth harus tetap reusable dan terdaftar lewat `config/middleware.ts`.
- Jangan hardcode token di kode aplikasi.

CORS dikonfigurasi di `config/cors.ts`.

Aturan:
- `CORS_ORIGIN` default hanya mengizinkan `http://localhost:3000`.
- `CORS_ORIGIN=*` tidak boleh digabung dengan `CORS_CREDENTIALS=true`.
- Origin production harus eksplisit.

Security middleware global:
- `SecurityHeadersMiddleware` menambahkan header hardening dasar untuk API response.
- `RateLimitMiddleware` membatasi request per method/path/window.
- `BodySizeLimitMiddleware` menolak `Content-Length` di atas batas konfigurasi.
- `CsrfMiddleware` memakai double-submit token untuk unsafe method berbasis cookie.

Environment security:

```bash
APP_ENV=local
APP_DEBUG=false
SECURITY_HEADERS_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_ATTEMPTS=120
RATE_LIMIT_WINDOW_MS=60000
REQUEST_MAX_BODY_BYTES=1048576
CSRF_ENABLED=true
CSRF_COOKIE_NAME=csrf-token
CSRF_HEADER_NAME=x-csrf-token
```

## Policy Dan RBAC

Policy layer menyediakan Gate, route policy, dan helper RBAC.

File penting:
- `app/Policies/Policy.ts` berisi tipe `PolicyContext`, `PolicyUser`, `AuthorizationError`, helper `allow`, `deny`, `userHasRole`, dan `userHasPermission`
- `app/Policies/*Policy.ts` berisi rule authorization per resource
- `app/Support/Authorization/Gate.ts` menjalankan policy ability dan route rule
- `app/Http/Middlewares/PolicyMiddleware.ts` menolak route yang gagal policy/RBAC
- `config/policies.ts` adalah registry resmi policy dan route policy

Contoh route policy:

```ts
export const policyConfig: PolicyConfiguration = {
  policies: {
    users: UserPolicy,
  },
  routePolicies: {
    "PATCH /users/1": {
      policy: "users",
      ability: "update",
      permissions: ["users.update"],
    },
  },
  userHeaders: {
    id: "x-auth-user-id",
    permissions: "x-auth-user-permissions",
    roles: "x-auth-user-roles",
  },
};
```

Aturan:
- route tanpa rule di `routePolicies` ditolak kecuali terdaftar di `publicRoutes`
- route public harus dideklarasikan eksplisit di `config/policies.ts`
- route dengan rule RBAC harus memiliki `roles` atau `permissions`
- `match: "all"` adalah default dan mewajibkan semua role/permission terpenuhi
- `match: "any"` mengizinkan salah satu role/permission terpenuhi
- rule yang memakai policy harus mendefinisikan `policy` dan `ability` bersamaan
- policy denial menghasilkan `AuthorizationError` dan dirender sebagai HTTP 403
- header `x-auth-user-*` tidak dipercaya secara default; set `AUTH_TRUST_USER_HEADERS=true` hanya jika upstream/proxy terpercaya sudah menghapus header user mentah

Gunakan Gate di controller/request jika authorization tergantung resource yang sudah di-load:

```ts
await createGate().authorize("users", "update", {
  user,
  resource: userRecord,
});
```

## Observability

Telemetry dikonfigurasi di `config/telemetry.ts` dan didaftarkan lewat `TelemetryServiceProvider`.

Error logging framework wajib memakai Pino dari `pinojs/pino`. Semua error yang dirender oleh `bootstrap/exceptions.ts`, termasuk 404, 403, dan 500, ditulis sebagai JSON line ke file `storage/logs/framework-errors.log` melalui `app/Support/Logging/PinoLogger.ts`.

Aturan logging:
- konfigurasi logger berada di `config/logger.ts`
- logger runtime harus memakai `pino` dan `pino.destination`
- file log default adalah `storage/logs/framework-errors.log`
- direktori log dibuat otomatis oleh logger
- error log memakai level Pino `error`
- request metadata yang aman boleh dicatat, tetapi header sensitif harus masuk daftar redaction
- controller, request, route, dan middleware tidak boleh membuat logger Pino sendiri untuk error framework
- error framework tidak boleh hanya di-`console.error`

Environment:

```bash
LOG_ERROR_FILE=storage/logs/framework-errors.log
LOG_LEVEL=error
LOG_SYNC=true
LOG_REDACT_PATHS=request.headers.authorization,request.headers.cookie,request.headers.set-cookie
OTEL_ENABLED=true
OTEL_SERVICE_NAME=patshop-ondemand-webapp
```

Telemetry harus bisa dimatikan untuk local development dan test.

## Testing

Test memakai Bun test runner.

Command:

```bash
bun run test:unit
bun run test:feature
bun run test:integration
bun test
```

Aturan test:
- Unit test wajib untuk exported function, config helper, controller method, provider, model, generator, dan middleware helper.
- Feature test wajib untuk endpoint route/controller yang bisa diakses lewat HTTP.
- Integration test wajib untuk komposisi app, middleware global, provider, auth, persistence, telemetry boundary, dan flow lintas modul.
- Bug fix harus memiliki regression test jika memungkinkan.
- Test harus deterministic. Inject clock, ID generator, database client, runner, atau external client jika perlu.
- Setelah perubahan behavior, jalankan suite paling sempit dulu, lalu `bun test`.

## Request Lifecycle

Alur request API:

```text
HTTP Request
  -> bootstrap/app.ts
  -> global middleware
  -> routes/api.ts
  -> request class
  -> controller
  -> response object
  -> exception renderer jika error
```

Aturan:
- Middleware global berjalan sebelum route handler.
- Route handler hanya mengadaptasi request dan response.
- Request class melakukan authorization dan validation.
- Controller membuat response.
- Exception renderer berada di `bootstrap/exceptions.ts`.

## Development Workflow

Untuk menambah endpoint baru:

1. Buat request class dengan `bun panda make:request`.
2. Buat controller dengan `bun panda make:controller`.
3. Tambahkan route di `routes/api.ts`.
4. Tambahkan unit test untuk request dan controller.
5. Tambahkan feature test untuk endpoint.
6. Jalankan `bun run test:unit`, lalu `bun test`.

Untuk menambah model dan tabel:

1. Buat model dengan `bun panda make:model`.
2. Tambahkan schema Drizzle di `config/drizzle/schemas/<connection>`.
3. Jalankan `bun panda db:generate`.
4. Review SQL di `database/migrations`.
5. Jalankan test yang relevan.

Untuk menjalankan ulang database development:

1. Jalankan `bun panda db:migrate:fresh --seed` untuk reset schema, migrate ulang, lalu seed.
2. Jalankan `bun panda db:migrate --seed` jika hanya ingin migrate lalu menjalankan root seeder.
3. Jalankan `bun panda db:seed --class=NamaSeeder` untuk target seeder tertentu.
4. Gunakan `--force` hanya untuk command destructive di `APP_ENV=production` setelah risiko data dipahami.

Untuk menambah middleware:

1. Buat middleware dengan `bun panda make:middleware`.
2. Tambahkan konfigurasi jika dibutuhkan.
3. Daftarkan di `config/middleware.ts`.
4. Tambahkan unit test dan integration test jika middleware global.

Untuk menambah policy/RBAC:

1. Buat policy dengan `bun panda make:policy`.
2. Daftarkan policy di `config/policies.ts`.
3. Tambahkan rule route di `routePolicies` jika authorization berlaku pada route.
4. Gunakan Gate di request/controller jika rule membutuhkan resource.
5. Tambahkan unit test policy, Gate, dan feature/integration test untuk route yang dilindungi.

Untuk menambah kebutuhan file storage:

1. Pilih disk lewat `FILESYSTEM_DISK` atau panggil `disk("public")` / `disk("s3")`.
2. Simpan file melalui `StorageManager`, bukan `node:fs` langsung di controller.
3. Tentukan visibility `public` atau `private` saat `put()` jika berbeda dari default disk.
4. Gunakan `url()` untuk asset public dan `temporaryUrl()` untuk akses private sementara.
5. Tambahkan unit test untuk disk behavior dan integration/feature test jika storage dipakai oleh endpoint.

Untuk menambah error handling:

1. Render response error lewat `bootstrap/exceptions.ts`.
2. Pastikan `renderException()` tetap memanggil `logFrameworkError()`.
3. Tambahkan unit test payload log dan integration test jika error berasal dari app router.
4. Jalankan `bun panda doctor` agar audit Pino logging tetap lulus.

## Naming Rules

- Controller harus berakhiran `Controller`.
- Request harus berakhiran `Request`.
- Middleware harus berakhiran `Middleware`.
- Policy harus berakhiran `Policy`.
- Provider harus berakhiran `ServiceProvider`.
- Seeder harus berakhiran `Seeder`.
- Command harus berakhiran `Command`.
- Test file memakai kebab-case atau nama suite yang sudah konsisten.
- Nested generator name boleh dipakai, tetapi tidak boleh mengandung `.` atau `..`.

## Forbidden Patterns

Hal berikut tidak boleh dilakukan:

- Route langsung di `index.ts`.
- Business logic di route file.
- RBAC atau policy logic inline di route file.
- Query database di request class.
- Config di folder `database/`.
- File upload runtime yang ikut commit selain `.gitkeep`.
- Akses `node:fs` langsung untuk file storage dari controller/request.
- Schema Drizzle di `app/Models`.
- Migration metadata di `database/migrations`.
- File non-SQL di `database/migrations`.
- Seeder helper di `database/seeders`.
- Environment read langsung di controller, route, middleware, provider, atau seeder.
- Logger Pino ad hoc di controller, request, route, atau middleware untuk error framework.
- Error framework yang hanya ditulis ke console tanpa file Pino.
- Random faker tanpa shared seeder context.
- Test yang bergantung pada waktu nyata tanpa injected clock.
- Menghapus atau memindahkan bootstrap contract tanpa update test.

## Validation Checklist

Sebelum perubahan selesai, pastikan:

- Struktur folder sesuai dokumentasi ini.
- Route hanya berada di `routes/api.ts`.
- Bootstrap tetap menjadi composition center.
- Config baru berada di `config`.
- `APP_ENV` dan `APP_DEBUG` tetap dinormalisasi di `config/app.ts`.
- Request validation memakai Zod.
- Database migration folder hanya berisi SQL.
- Command migration Laravel-style (`migrate`, `migrate:fresh`, `migrate:rollback`, `migrate:reset`, `--seed`) tetap tercatat di console kernel.
- Target seeder tetap berada di `database/seeders`.
- Model aplikasi berada langsung di `app/Models`.
- Seeder aplikasi berada langsung di `database/seeders`.
- Unit test ditambahkan untuk exported behavior.
- Feature atau integration test ditambahkan jika behavior melewati HTTP atau bootstrap app.
- `bun test` lulus sebelum merge.
