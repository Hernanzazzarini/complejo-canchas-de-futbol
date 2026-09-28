# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS 12 + TypeORM + PostgreSQL REST API for 5-a-side football courts ("Complejo Fútbol 5"): clients register/log in and book time slots. The git repo root is `backend/` (the parent `complejo_futbolV3/` folder is not versioned). The `README.md` is unmodified NestJS boilerplate — ignore it.

**It is multi-tenant.** Each `Cancha` belongs to a `propietario` (a `Usuario` with rol `PROPIETARIO`), and that column is the whole isolation mechanism: one owner must never see another's reservations. There is no `Complejo` entity — a cancha *is* the venue, and an owner with several courts simply has several rows. Anything that returns reservations or courts to a logged-in user must be scoped; see [Tenancy](#tenancy).

The domain language is Spanish: entities, DTOs, enums, variables and error messages are all in Spanish (`Usuario`, `Cancha`, `Reserva`, `RolUsuario`, `EstadoReserva`). Keep new code in Spanish to match.

## Commands

All commands run from `backend/`.

```bash
npm run start:dev          # watch mode, :3000 (PORT overrides), Swagger UI at /api
npm run build              # nest build
npm run lint               # oxlint src/ test/  (oxlint, NOT eslint)
npm run format             # prettier --write

npm test                   # jest
npm test -- reservas.service   # single suite by filename pattern
npm test -- -t "cancelar"      # single test by name
npm run test:cov
npm run test:e2e           # test/jest-e2e.json; needs a running PostgreSQL

npm run db:propietarios    # migración de una sola vez: dueño a las canchas viejas
npm run verificar:roles    # prueba de humo de los 3 roles contra un server levantado
```

`verificar:roles` (`scripts/verificar-roles.mjs`) walks the whole permission matrix against a running server and a real database, then deletes the users/canchas/reservas it created (`--dejar` keeps them). It reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` to log in. Unlike the e2e suite it exercises the guards and the HTTP layer end to end, so it's the quickest way to check a role change didn't leak.

## ESM: the constraint that shapes the tooling

**NestJS 12 ships ESM-only** (`"type": "module"`, no CJS build). Two consequences that are easy to break:

- **Jest must run in ESM mode.** The `test*` scripts invoke `node --experimental-vm-modules node_modules/jest/bin/jest.js` rather than the `jest` binary; `jest.config.ts` and `test/jest-e2e.json` set `useESM: true` and compile specs with `tsconfig.spec.json` (`module: esnext`). Don't "simplify" these back to a plain `jest` call — every suite fails with *"Must use import to load ES Module"*.
- **Jest does not inject the `jest` global under ESM.** `test/jest.setup.ts` publishes it on `globalThis` so specs can use the loose `@types/jest` typings. Importing `jest` from `@jest/globals` directly in a spec instead forces strictly-typed mocks (`Mock<UnknownFunction>`) and a cascade of `never` errors.
- **Entity relations use `Relation<T>`** (`usuario: Relation<Usuario>`). `Usuario` and `Reserva` import each other, and under ESM `emitDecoratorMetadata` evaluates the class eagerly, throwing *"Cannot access 'Usuario' before initialization"*. Plain `usuario: Usuario` compiles and even runs in the built CJS bundle, but breaks the e2e suite.

TypeScript 6 also requires an explicit `rootDir`: it's `.` in `tsconfig.json` (so `test/` is in ts-jest's program) and narrowed to `./src` in `tsconfig.build.json` (so `dist/` stays flat and `node dist/main` works).

## Environment

`.env` is git-ignored and loaded by `ConfigModule.forRoot({ isGlobal: true })`. See `.env.example`. Required: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`. Optional: `JWT_EXPIRES_IN` (default `1d`), `PORT` (3000), `ADMIN_EMAIL` / `ADMIN_PASSWORD`, `NODE_ENV`.

## Architecture

`src/modules/<feature>/` with a fixed internal layout:

```
controllers/  services/  entities/  enums/  guards/  utils/
dtos/input/   dtos/output/   interfaces/   decorators/
```

- **auth** — register/login/perfil, alta de propietarios, bcrypt (cost 10), JWT via `@nestjs/jwt`.
- **reservas** — `Cancha` CRUD (scoped to its owner) plus booking, cancelling and an availability grid.
- **seed** — `OnApplicationBootstrap` hook, idempotent. Creates the platform ADMIN and nothing else; canchas can't be seeded because each one needs a real owner.

`AppController` at the root is not scaffolding any more: `GET /` is a health check that runs `SELECT 1` through the injected `DataSource` and throws a 503 when Postgres is unreachable, so a deploy probe doesn't get a misleading 200.

Cross-module entity relations are imported directly across module folders (`Reserva` ↔ `Usuario`), so auth and reservas are coupled by design. `ReservasModule` imports `AuthModule` to get the guards; `AuthModule` re-exports `JwtModule`, both guards and `TypeOrmModule.forFeature([Usuario])`.

### Persistence

`TypeOrmModule.forRootAsync` in [src/app.module.ts](src/app.module.ts) uses `autoLoadEntities: true` and **`synchronize: !esProduccion`** — outside production the schema is derived from entity decorators on every boot and there are no migrations. Changing a column or relation changes the live database.

`Reserva` uses a **partial unique index**, not a plain `@Unique`:

```ts
@Index('uq_turno_confirmado', ['cancha', 'fecha', 'horaInicio'], {
  unique: true, where: `estado = 'CONFIRMADA'`,
})
```

Putting `estado` inside a normal unique key (the original design) would cap each slot at one cancelled row, so a user could not cancel-and-rebook the same slot twice. The index is also the real race-condition guard: the services check for overlap first, then `ReservasService.guardar` catches Postgres error `23505` and converts it to a 409 — route every `save` of a `Reserva` through it.

Moving a turno (`ReservasService.actualizar`) passes its own id as `ignorarId` to `validarSinSolapamiento`, or the reservation collides with itself. Only the fecha/horario change; the cancha is fixed (`ActualizarReservaDto` omits `canchaId`, so sending it is a 400).

### Time handling

Postgres returns `time` columns as `'HH:MM:SS'` and `date` as a string; DTOs accept `'HH:MM'`. Everything is normalised to `'HH:MM:SS'` by `src/modules/reservas/utils/horarios.util.ts`, which also owns the business hours (`HORA_APERTURA` 17:00, `HORA_CIERRE` 23:00, `DURACION_TURNO_MIN` 60 — a 6-slot grid) and the overlap rule (`inicioA < finB && finA > inicioB`, so back-to-back slots don't collide). Change opening hours or slot length there, not in the services.

`decimal` columns (`precioPorHora`, `precioTotal`) come back from the driver as **strings** — always `Number()` them before arithmetic or DTO output.

### Auth flow

`JwtAuthGuard` ([src/modules/auth/guards/jwt-auth.guard.ts](src/modules/auth/guards/jwt-auth.guard.ts)) is a hand-rolled `CanActivate` — there is no Passport strategy. It parses the `Bearer` header, verifies with `JWT_SECRET`, and assigns the payload to `request.user` (typed via `RequestConUsuario`). Read it in controllers with `@UsuarioActual()`, which returns a `JwtPayload` (`{ sub, email, rol }`).

Role checks: `@UseGuards(JwtAuthGuard, RolesGuard)` **in that order** plus `@Roles(...)`; `RolesGuard` reads `request.user.rol`, so it is useless without `JwtAuthGuard` ahead of it. Ownership checks live in the services (`ReservasService.validarPropiedad`, `CanchasService.buscarPropiaOFallar`), not in a guard, because they need the row. The JWT carries only `{ sub, email, rol }` — the owner of a cancha is resolved from the database, never from the token.

`POST /auth/register` always creates a `CLIENTE`. The only way to get an ADMIN is `SeedService`, which on boot creates `ADMIN_EMAIL` if that address doesn't exist, or promotes it if it registered as a client. It never overwrites an existing account's password. A `PROPIETARIO` can only be created by an ADMIN through `POST /auth/propietarios`.

### Tenancy

Three roles, and the hierarchy only exists in the services — `RolesGuard` just checks membership:

| Rol | Alcance |
|---|---|
| `CLIENTE` | Books anywhere, and manages **its own** bookings: create, move (`PATCH /reservas/:id`) and cancel. `GET /reservas/mias` spans every complex. |
| `PROPIETARIO` | Administers the canchas they were *given* — edit, deactivate, and see/move/cancel the reservations on them. Cannot create a cancha. |
| `ADMIN` | The whole platform, and can do everything the other two can. Creates propietarios, **is the only one who creates canchas** (always with a `propietarioId`), and can reassign a cancha's owner. |

`POST /canchas` is `@Roles(ADMIN)` and `CrearCanchaDto.propietarioId` is **required** — an alta always names a dueño. `CanchasService.resolverPropietario` enforces the same thing at the service level (a non-ADMIN gets a 403), so the rule survives a controller-decorator slip. `PATCH`/`DELETE /canchas/:id` stay open to the PROPIETARIO, scoped to their own rows.

Rules to preserve when touching these services:

- **Scope in the `where`, never as a check afterwards.** `CanchasService.alcance()` returns `{}` for an ADMIN and `{ propietario: { id: actor.sub } }` for anyone else, and it's spread into the query. An owner poking at someone else's id gets a **404, not a 403** — a 403 would confirm the row exists. `ReservasService.validarPropiedad` follows the same rule (403 stays for a *client* touching another client's booking, where there's nothing to hide).
- **`Cancha.nombre` is unique per owner**, via the `uq_cancha_nombre_propietario` index and `validarNombreLibre`. Two complexes each having a "Cancha 1" is the normal case.
- `ReservaDto.usuario` is populated for both ADMIN and PROPIETARIO (`esGestor`): the owner needs to know who booked.
- Anything public (`GET /canchas`, `GET /reservas/disponibilidad`) stays unscoped on purpose — a client browses every complex.

Business hours are still global constants in `horarios.util.ts`, so every complex opens 17:00–23:00. Making them per-cancha columns is the obvious next step and touches only that file plus `ReservasService.validarHorario`/`disponibilidad`.

Because there are no migrations, adding the `propietario_id NOT NULL` column to a table that already had rows needed `scripts/asignar-propietarios.mjs` (run once, before booting: it adds the column nullable and backfills it so `synchronize` can then tighten it). Keep it around as the pattern for the next non-nullable relation.

### Controller conventions

- Global `ValidationPipe` in [src/main.ts](src/main.ts) runs with `whitelist`, `forbidNonWhitelisted` and `transform`. Every body and query needs a DTO class with `class-validator` decorators, or unknown properties are rejected with a 400. Query params arrive as strings, so numeric fields need `@Type(() => Number)`.
- Entities never leave the service layer. Services map to output DTOs (`AuthService.toDto`, `CanchasService.toDto`, `ReservasService.toDto`) so `password` can't leak. `ReservaDto.usuario` is only populated for admin listings.
- Swagger is generated at `/api` with `addBearerAuth()`. Decorate new endpoints with `@ApiTags`, `@ApiOperation`, `@ApiResponse` and `@ApiBearerAuth` (when guarded), and DTO fields with `@ApiProperty({ example })`.
- Deleting a `Cancha` is a soft delete (`activa: false`) because reservations reference it (`onDelete: 'RESTRICT'`).
- Guarded endpoints that return or mutate tenant data take the `JwtPayload` as an explicit service argument (`@UsuarioActual()`), rather than reading it from a request-scoped provider.

## TypeScript

`module`/`moduleResolution: nodenext`, `isolatedModules: true`, `strict: true` but `strictPropertyInitialization: false` (entity/DTO fields are declared without initializers). Types used in a decorated signature must be imported with `import type` (e.g. `JwtPayload` in controllers), or TS raises error 1272 under `isolatedModules` + `emitDecoratorMetadata`.
