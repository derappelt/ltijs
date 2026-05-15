# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build**: `npm run build` — Compiles `src/` to `dist/` via Babel and copies HTML templates
  - `npm run build:js` — Babel transpilation only
  - `npm run build:html` — Copy HTML templates to `dist/`
- **Lint**: `npm run standard` — StandardJS linting on `src/`
- **Test (all)**: `MONGOMS_VERSION=7.0.3 NODE_TLS_REJECT_UNAUTHORIZED=0 nyc mocha`
- **Test (single file)**: `MONGOMS_VERSION=7.0.3 NODE_TLS_REJECT_UNAUTHORIZED=0 npx mocha test/1-lti.js`
- **Test (filtered)**: add `--grep "pattern"` to the mocha command

> Tests require `dist/` build artifacts — rebuild after any `src/` changes. MongoDB Memory Server v7.0.3 is used for isolated database testing; `NODE_TLS_REJECT_UNAUTHORIZED=0` is intentional for test isolation.

## Architecture

**ltijs** is an Express-based LTI 1.3 provider library. It wraps protocol complexity into a single `Provider` class with pluggable service classes.

### Entry Point

`index.js` exports `Provider` from `dist/` (compiled output). Source lives in `src/`, which Babel transpiles to `dist/` targeting Node 12+.

### Provider (`src/Provider/Provider.js`)

The central class consumers instantiate. Manages:
- LTI 1.3 authentication flow (OIDC login → JWT validation → session token)
- Platform registration (`registerPlatform()`)
- Express route setup (`/login`, `/keyset`, app routes)
- Callback registration (`onConnect`, `onDeepLinking`, `onDynamicRegistration`)
- Exposes service instances as properties: `GradeService`, `DeepLinkingService`, `NamesAndRolesService`, `DynamicRegistration`

Uses JavaScript private fields (`#`) for internal state encapsulation.

### Service Classes (`src/Provider/Services/`)

| File | Purpose |
|---|---|
| `Grade.js` | LTI Advantage Grading — publish scores back to the platform |
| `DeepLinking.js` | LTI Deep Linking — content selection flow |
| `NamesAndRoles.js` | LTI Names & Roles — fetch roster/user data from platform |
| `DynamicRegistration.js` | LTI Dynamic Registration — auto-register with platforms |

### Utilities (`src/Utils/`)

| File | Purpose |
|---|---|
| `Server.js` | Express app setup and route registration |
| `Database.js` | Mongoose connection; platform/user data persistence |
| `Auth.js` | JWT signing/verification, LTI state validation |
| `Platform.js` | Platform config persistence and retrieval |
| `Keyset.js` | JWK Set endpoint — distributes public keys for signature verification |
| `Request.js` | HTTP client for outbound calls to platform APIs |

### LTI Request Flow

1. **Registration**: `registerPlatform()` stores platform config (keys, endpoints) encrypted in MongoDB.
2. **Login**: `/login` receives the OIDC initiation, validates the request, and redirects with a state parameter.
3. **Launch**: App route receives the JWT, validates its signature against the platform's cached keyset, and issues an httpOnly session cookie.
4. **Services**: `Grade`, `DeepLinking`, `NamesAndRoles` use the session token to make authenticated calls back to the platform.

### Test Files

Tests must run in order (numbered 0–6) because they share a live MongoDB Memory Server instance:

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
