# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build**: `npm run build` — Compiles `src/*.ts` to `dist/` via `tsc` and copies HTML templates
  - `npm run build:ts` — TypeScript compilation only (per-file CJS + `.d.ts` mirroring `src/`)
  - `npm run build:html` — Copy HTML templates to `dist/`
- **Test (all)**: `MONGOMS_VERSION=7.0.3 NODE_TLS_REJECT_UNAUTHORIZED=0 nyc mocha`
- **Test (single file)**: `MONGOMS_VERSION=7.0.3 NODE_TLS_REJECT_UNAUTHORIZED=0 npx mocha test/1-lti.js`
- **Test (filtered)**: add `--grep "pattern"` to the mocha command

> Tests require `dist/` build artifacts — rebuild after any `src/` changes. MongoDB Memory Server v7.0.3 is used for isolated database testing; `NODE_TLS_REJECT_UNAUTHORIZED=0` is intentional for test isolation.

> Lint: the legacy `standard` linter is JS-only and is effectively a no-op against the new `.ts` sources. Out of scope for the TS rewrite; replace with eslint + `@typescript-eslint` if/when needed.

## Architecture

**ltijs** is an Express-based LTI 1.3 provider library. It wraps protocol complexity into a single `Provider` class with pluggable service classes.

### Entry Point

`index.js` is a 2-line CommonJS shim — it stays as JavaScript and re-exports `Provider` from the compiled TypeScript output at `dist/Provider/Provider.js`. The published `types` field points at `dist/Provider/Provider.d.ts`. Source lives in `src/*.ts`, which `tsc` compiles to `dist/` targeting Node 18+, CommonJS, ES2020.

### Provider (`src/Provider/Provider.ts`)

The central class consumers instantiate. Manages:
- LTI 1.3 authentication flow (OIDC login → JWT validation → session token)
- Platform registration (`registerPlatform()`)
- Express route setup (`/login`, `/keyset`, app routes)
- Callback registration (`onConnect`, `onDeepLinking`, `onDynamicRegistration`)
- Exposes service instances as properties: `Grade`, `DeepLinking`, `NamesAndRoles`, `DynamicRegistration`

Uses JavaScript `#` private fields (preserved from the JS source — runtime-equivalent and minimal diff under strict TS).

### Service Classes (`src/Provider/Services/`)

| File | Purpose |
|---|---|
| `Grade.ts` | LTI Advantage Grading — publish scores back to the platform |
| `DeepLinking.ts` | LTI Deep Linking — content selection flow |
| `NamesAndRoles.ts` | LTI Names & Roles — fetch roster/user data from platform |
| `DynamicRegistration.ts` | LTI Dynamic Registration — auto-register with platforms |

### Utilities (`src/Utils/`)

| File | Purpose |
|---|---|
| `Server.ts` | Express app setup and route registration |
| `Database.ts` | Mongoose connection; platform/user data persistence |
| `Auth.ts` | JWT signing/verification, LTI state validation |
| `Platform.ts` | Platform config persistence and retrieval |
| `Keyset.ts` | JWK Set endpoint — distributes public keys for signature verification |
| `Request.ts` | OIDC login query construction |
| `Http.ts` | `got`-based HTTP client with pinned User-Agent |
| `Objects.ts` | `deepMergeObjects` helper |

### Types

- `src/types/shared.ts` — cross-file interfaces and aliases (`AuthConfig`, `DatabaseConfig`, `AccessTokenResponse`, `GetPlatformFn`, etc.). Implementation files use `export = ClassName`, which can't coexist with `export interface` — shared types live here instead.
- `src/types/ambient.d.ts` — ambient `declare module` blocks for the three dependencies that don't ship types (`rasha`, `sprightly`, `fast-url-parser`) plus an `Express.Request.token?` augmentation. The ambient shapes cover only the methods actually called in `src/`.

### LTI Request Flow

1. **Registration**: `registerPlatform()` stores platform config (keys, endpoints) encrypted in MongoDB.
2. **Login**: `/login` receives the OIDC initiation, validates the request, and redirects with a state parameter.
3. **Launch**: App route receives the JWT, validates its signature against the platform's cached keyset, and issues an httpOnly session cookie.
4. **Services**: `Grade`, `DeepLinking`, `NamesAndRoles` use the session token to make authenticated calls back to the platform.

### Test Files

Tests remain JavaScript and continue to `require('../dist/...')` per-file paths. They must run in order (numbered 0–6) because they share a live MongoDB Memory Server instance:

| File | Covers |
|---|---|
| `0-provider.js` | Provider setup and deployment lifecycle |
| `1-lti.js` | Full LTI 1.3 authentication flow |
| `2-grade.js` | Grade Service API operations |
| `3-deeplinking.js` | Deep Linking Service workflow |
| `4-namesandroles.js` | Names & Roles Service roster fetching |
| `5-dynamicregistration.js` | Dynamic Registration flow |
| `6-close.js` | MongoDB shutdown / cleanup |

### Debug Namespaces

Uses the `debug` module — set `DEBUG=provider:*` to see all internal logs. Key namespaces: `provider:main`, `provider:auth`, `provider:dynamicRegistrationService`.
