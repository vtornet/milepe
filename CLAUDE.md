# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MiLepe: a hyperlocal social network for the town of Lepe (Huelva, Spain).
One general feed (Muro) aggregates posts from distinct sections — Quejas
(complaints to the town hall), Turismo, Fotos (old/current), Eventos, El
Tiempo (weather widget, no user content), Empleo (Busco/Ofrezco), Negocios
locales, and Contactos de interés. See `README.md` for the full pitch.

Beyond that section-based content, MiLepe is being built out into a fuller
social network — reactions, blocking, contacts (friend requests),
notifications, private messaging, and a proper report+appeal moderation
workflow with an audit log — modeled after a previous project
(`E:/Piverse`, a Flask/SQLAlchemy/Jinja2 app for a different, unrelated
community, not reused as code — see the "Reactions" section below for how
that translation into this stack's conventions works in practice). Expect
this feature set to keep growing in that direction.

Two independent apps, each with its own `package.json`/`node_modules` — there
is no root package.json or workspace tooling:

- `client/` — React + Vite, built as an installable PWA (`vite-plugin-pwa`).
- `server/` — Node.js + Express, MongoDB via Mongoose, Cloudinary, Stripe, JWT.

Both are ESM (`"type": "module"` in both package.json files) — use
`import`/`export`, not `require`.

## Commands

### Server (`cd server`)

- `npm run dev` — start with nodemon on `http://localhost:5000`
  (`/api/health` for a liveness check).
- `npm start` — start without nodemon.
- Requires a `.env` (copy `.env.example`) with a Mongo connection string —
  `conectarDB()` in `src/config/db.js` accepts `MONGODB_URI`, `MONGODB_URL`,
  or `MONGO_URL` (Railway's Mongo templates use different names depending
  on the template), checked in that order. The process exits with a logged
  error if none is set or the DB is unreachable.
- The Railway MongoDB has no public proxy (deliberately — the "Public
  Access" toggle bills egress and accepts connections from anyone with the
  string). Local `npm run dev` instead goes through a Railway-managed SSH
  tunnel: `railway link` once, then `railway connect MongoDB --tunnel-only
  --port 27018` in a separate terminal, left running, with `MONGODB_URI` in
  `.env` pointing at `127.0.0.1:27018`. Needs an SSH key registered with
  Railway (`railway ssh keys add`) and, on Windows, `railway` CLI subcommands
  that take a file path (like `ssh keys add -k`) want a Windows-style path
  (`C:\Users\...`), not the POSIX-style path Git Bash's `~` expands to.
- That tunnel drops on its own occasionally (idle timeout / network blip),
  independent of anything in the code. Symptom: a request that touches the
  DB hangs for ~30s then the server logs `[db] Desconectado de MongoDB`
  followed by `MongoServerSelectionError: read ECONNRESET`, and the response
  is a 500 with that message. Fix: kill the stale `railway connect` process
  and its child, then run the same `railway connect MongoDB --tunnel-only
  --port 27018` again — no server restart needed, Mongoose reconnects to the
  same local port on its own once the tunnel is back.
- No test runner and no linter are configured yet. New Mongoose models have
  been verified during development with a throwaway script plus
  `npm install --no-save mongodb-memory-server` (spin up a real in-memory
  MongoDB, exercise the model, assert behavior, then delete the script and
  `npm uninstall mongodb-memory-server` so it never lands in package.json).
  Follow that pattern for new models until a real test runner is set up.

### Client (`cd client`)

- `npm run dev` — Vite dev server on `http://localhost:5173`.
- `npm run build` — production build (also generates the PWA service worker
  via `vite-plugin-pwa`).
- `npm run lint` — ESLint (flat config in `client/eslint.config.js`).
- Requires a `.env` (copy `.env.example`) with `VITE_API_URL` pointing at the
  server's `/api` base.

## Architecture

### Post + `*_detalle` join pattern (the core design)

Everything publishable lives in one central `posts` collection
(`server/src/models/Post.js`) discriminated by `tipo` (`muro`, `queja`,
`turismo`, `foto`, `evento`, `empleo_busco`, `empleo_ofrezco`, `negocio`).
`Post` only holds generic feed fields: `autor_id`, `tipo`, `titulo`,
`contenido`, `imagenes`, `reacciones_resumen`, moderation state, `reportes`.
Type-specific
fields live in a separate `*_detalle` collection, linked back by a unique
`post_id` (one-to-one): `QuejaDetalle`, `FotoDetalle`, `EmpleoDetalle`,
`EventoDetalle`, `NegocioDetalle`.

This means: the Muro feed is a plain `Post.find({ estado_moderacion:
'publicado' })` with no joins at all, while a section view (e.g. `/quejas`)
additionally queries/populates the matching `*_detalle` by `post_id`. Adding
a new section type means adding a new `tipo` enum value and a new
`*_detalle` model — never new fields on `Post` itself.

### Naming and schema conventions

- All collection and field names are Spanish (`autor_id`, `fecha_creacion`,
  `moderador_id`, `estado`, `contraseña`...) — including accents/`ñ`, which
  round-trip fine through this toolchain. Keep new fields consistent with
  this, not English.
- Every schema uses custom timestamp field names instead of Mongoose
  defaults: `timestamps: { createdAt: 'fecha_creacion', updatedAt:
  'fecha_actualizacion' }`.
- Enums are exported as named constants from the model file (e.g.
  `TIPOS_POST`, `ESTADOS_MODERACION` from `Post.js`, `CATEGORIAS_QUEJA` from
  `QuejaDetalle.js`) rather than inlined, so controllers/validators can
  import and reuse them.
- Cross-field validation (a variant of a `*_detalle` model requiring some
  fields and forbidding others) is done in a `pre('validate')` hook using
  `this.invalidate(field, message)`, not in the controller layer. See
  `FotoDetalle.js` (`epoca: 'antigua'` requires `decada`, `'actual'` forbids
  it) and `EmpleoDetalle.js` (`modalidad: 'busco'` vs `'ofrezco'` each
  require/forbid a disjoint set of fields). Follow this pattern for any new
  detail model with variants.
- Geolocation reuses one sub-schema, `server/src/models/schemas/
  puntoSchema.js` (GeoJSON `Point` with coordinate-range validation). Each
  parent schema embeds it and declares its own `2dsphere` index (the index
  can't live on the shared sub-schema). Currently: `QuejaDetalle.ubicacion`
  (required) and `NegocioDetalle.ubicacion` (required) and
  `EventoDetalle.ubicacion` (optional — an event can be posted without a map
  pin yet).
- "Valid while a date is in the future" is the recurring pattern for
  Stripe-driven or time-limited state, instead of a boolean that something
  has to remember to flip off: `NegocioDetalle.destacado_hasta`,
  `EventoDetalle.patrocinado_hasta`, `EmpleoDetalle.fecha_caducidad` (+
  `estado_oferta`). Renewal methods (e.g. `NegocioDetalle.extenderDestacado
  ()`) extend from the current expiry if still active, or from now if
  already expired — never just `+N days` from `Date.now()` unconditionally.

### Moderation

Post-moderation, not pre-moderation: a post is visible the instant it's
created (`estado_moderacion` defaults to `'publicado'`). `Post.reportar
(usuarioId, motivo)` records a report (a user can't report the same post
twice) and auto-hides the post once reports reach `UMBRAL_REPORTES_AUTO_
OCULTAR` (3, defined in `Post.js`) — it does not delete it.
`estado_moderacion: 'eliminado'` is a soft delete; documents are never
actually removed. `moderador_id` on `Post` tracks who last acted on it.
`Usuario.rol` (`usuario`/`moderador`/`admin`) is designed so new moderators
can be added later by editing one field on an existing document — no
migration.

### Reactions

`Reaccion` (`server/src/models/Reaccion.js`) is one collection shared by
posts and comments — a document has exactly `post_id` XOR `comentario_id`
(enforced in `pre('validate')`), never both, never neither. `TIPOS_REACCION`
(`me_gusta`, `me_encanta`, `apoyo`, `triste` — lives in `models/
constantes.js`, not in `Reaccion.js`, specifically to avoid a circular
import since `Post.js`/`Comentario.js` need the list too for their
`reacciones_resumen` field) is deliberately not Facebook's full reaction
set — `apoyo` doubles as "this happens to me too" solidarity on a Quejas
post. `Reaccion.alternar({ autor_id, tipo, post_id | comentario_id })` is
the only way to react: it upserts, and reacting again with the same `tipo`
removes it (toggle) while a different `tipo` swaps it — one reaction per
user per target, enforced by a partial unique index (partial because only
one of `post_id`/`comentario_id` is set per document, so a plain compound
unique index would collide across targets). It also keeps
`reacciones_resumen` (a per-type counter, same denormalization pattern as
`num_comentarios`) in sync on the right parent model. There used to be a
simple `Post.likes: [ObjectId]` array with a `Post.alternarLike()` toggle —
that's gone, replaced entirely by this.

### Auth building blocks (routes not built yet)

`Usuario.js` hashes `contraseña` via a `pre('save')` bcrypt hook, the field
is `select: false` (must `.select('+contraseña')` explicitly, e.g. for
login), and `compararContraseña()` / `toJSON()` (strips the hash from any
serialized response) are already in place. What's not built yet: the actual
auth routes/controllers, JWT signing/verification middleware, and anything
under `server/src/routes|controllers|middlewares|jobs|utils` beyond the
`/api/health` check — those directories currently hold only placeholder
files. `server/src/routes/index.js` has each future section's mount point
already commented in, in the intended order.

### Image uploads

Deliberately **not** using `multer-storage-cloudinary` — it's unmaintained
and only supports Cloudinary v1, which conflicts with the `cloudinary` v2
SDK this project uses. The intended pattern is `multer` memory storage +
manual upload to Cloudinary via a stream (`streamifier`), not disk storage
or that package.

### Client structure

- `client/src/router/secciones.js` is the single source of truth mapping
  route path ↔ nav label ↔ the `Post.tipo` it corresponds to. Both
  `AppRouter.jsx` and `NavBar.jsx` should read from it — don't hardcode a
  new nav link without adding it here first.
- One placeholder page component per section under `client/src/pages/
  <Seccion>/<Seccion>Page.jsx`; none has real data-fetching yet.
- `client/src/services/api.js` is a single shared axios instance (base URL
  from `VITE_API_URL`, JWT-from-`localStorage` request interceptor).
  Section-specific API calls should import this instance, not create their
  own `axios.create()`.
- PWA manifest/icons are configured in `client/vite.config.js`, but
  `icon-192.png`/`icon-512.png` referenced there don't exist yet (see
  `client/public/icons/README.md`) — only a placeholder SVG favicon does.

### Dependency versions

Versions were deliberately bumped past whatever a plain `npm install` of the
initial scaffold would have picked, to clear known vulnerabilities/peer
conflicts — don't "helpfully" downgrade these: Vite 8, `@vitejs/plugin-
react` 6, `vite-plugin-pwa` 1.x, `react-router-dom` 7, `node-cron` 4,
`multer` 2. ESLint is intentionally pinned to 9.x (not 10) because
`eslint-plugin-react-hooks` doesn't yet declare 10 as a supported peer.
