# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MiLepe: a hyperlocal social network for the town of Lepe (Huelva, Spain).
One general feed (Muro) aggregates posts from distinct sections — Quejas
(complaints to the town hall), Turismo, Fotos (old/current), Eventos, El
Tiempo (weather widget, no user content), Empleo (Busco/Ofrezco), Negocios
locales, and Contactos de interés. See `README.md` for the full pitch.

Beyond that section-based content, MiLepe is being built out into a fuller
social network, modeled after a previous project (`E:/Piverse`, a Flask/
SQLAlchemy/Jinja2 app for a different, unrelated community, not reused as
code — see the "Reactions" section below for how that translation into
this stack's conventions works in practice). Built so far: typed
reactions, user blocking, friend requests (`Amistad`), notifications. Not
yet built: private messaging and a proper report+appeal moderation
workflow with an audit log (today's moderation is just `Post.reportar()` +
auto-hide, no formal appeal). Expect the feature set to keep growing in
that direction.

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
  independent of anything in the code — happened repeatedly during
  development. Symptom: a request that touches the DB hangs for ~30s then
  the server logs `[db] Desconectado de MongoDB` followed by
  `MongoServerSelectionError: read ECONNRESET` (or `connect ECONNREFUSED
  127.0.0.1:27018` if it's fully dead), and the response is a 500 with that
  message. No server restart needed either way — Mongoose reconnects to the
  same local port on its own once the tunnel is back.
  Use `node scripts/vigilar-tunel.mjs [puerto]` (default 27018) instead of
  a bare `railway connect` for local dev: it launches the tunnel and, every
  15s, actually probes the port (not just "is the process still alive" —
  the process can survive while the tunnel itself stops forwarding, so a
  process-liveness check alone misses this) and kills+relaunches on
  failure. Recovery isn't always instant: right after a kill, `railway
  connect` can briefly fail with "Local port ... is already in use" because
  the previous process hasn't released it yet — the watchdog's *next* cycle
  (another ~15s) succeeds once it has. Confirmed self-healing end to end by
  killing the tunnel's `ssh.exe` mid-session and watching it recover
  unattended in about two cycles.
- Creating and deleting several throwaway smoke-test files in quick
  succession (the pattern below) makes nodemon fire a burst of "restarting
  due to changes..." with no settled request in between. Once, this left a
  *stale* `node` process still bound to port 5000 answering requests with
  route tables from before a routes/index.js change (new routes 404'd even
  though the file on disk was correct and nodemon claimed to have
  restarted). Symptom: `Cannot POST /whatever-you-just-added`. Fix: `netstat
  -ano | grep :5000` to find the real listening PID, kill that exact PID,
  and start `npm run dev` fresh — don't assume nodemon's last restart
  actually took.
- No test runner and no linter are configured yet. New Mongoose models have
  been verified during development with a throwaway script plus
  `npm install --no-save mongodb-memory-server` (spin up a real in-memory
  MongoDB, exercise the model, assert behavior, then delete the script and
  `npm uninstall mongodb-memory-server` so it never lands in package.json).
  Follow that pattern for new models until a real test runner is set up.
- Image uploads (see "Image uploads" below) need real
  `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` in
  `.env` — get them from the account's Dashboard, specifically the row
  labeled **Root** if more than one API key pair is listed (a fresh account
  can have a second, more restricted one named `moderation` that Cloudinary
  adds on its own; that one is not what you want).

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
Type-specific fields live in a separate `*_detalle` collection, linked back
by a unique `post_id` (one-to-one): `QuejaDetalle`, `FotoDetalle`,
`EmpleoDetalle`, `EventoDetalle`, `NegocioDetalle`, `TurismoDetalle`. Every
`tipo` now has its controller/routes built (`quejas`, `fotos`, `eventos`,
`negocios`, `turismo`, `empleo` — see "Section controllers" below for what
makes each one's listing/creation different from the others); only `tiempo`
and a static `contactos-interes` remain unbuilt, plus Stripe (`pagos`).

This means: the Muro feed is a plain `Post.find({ estado_moderacion:
'publicado' })` with no joins at all, while a section view (e.g. `/quejas`)
additionally queries/populates the matching `*_detalle` by `post_id`. Adding
a new section type means adding a new `tipo` enum value and a new
`*_detalle` model — never new fields on `Post` itself.

The deliberate exception: `negociosController.listarNegocios` and
`turismoController.listarTurismo` both build their aggregation starting
from the `*_detalle` collection, not `Post` (every other section's listing
starts from `Post`). Reason: MongoDB requires `$geoNear` to be the
pipeline's first stage, and the 2dsphere-indexed `ubicacion` field lives on
`NegocioDetalle`/`TurismoDetalle`, not `Post` — so a `?lat=&lng=&radioKm=`
"cerca de mí" search has to start there. Both still work with no geo
params (they just skip the `$geoNear` stage and sort some other way — see
below), so this isn't a geo-only code path. Follow the same
flip-the-starting-collection approach for any future section with a
2dsphere field; don't try to `$geoNear` from `Post`, it can't reach the
index.

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
  can't live on the shared sub-schema). Required on `QuejaDetalle` and
  `NegocioDetalle` (a complaint or a business without a map pin defeats the
  point); optional on `EventoDetalle` and `TurismoDetalle` (an event or a
  gastronomy recommendation can be posted without one — a route or a beach
  usually gets one, but the schema doesn't force it).
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

### Blocking

`Bloqueo` (`server/src/models/Bloqueo.js`, routes under `/api/usuarios`) is
directional in storage (`bloqueador_id` blocked `bloqueado_id`) but
`Bloqueo.existeEntre(a, b)` checks both directions — a block stops
interaction between the two regardless of who blocked whom. It's wired into
`postsController.crearComentario`/`reaccionarPost` today (403 if either has
blocked the other); extend that same `existeEntre` check into any new
interaction surface (messaging, contact requests) rather than reinventing
the check. Note the naming: this is unrelated to `ContactoInteres` (the
static Ayuntamiento/Policía/... directory) — a friend-request system already exists as
`Amistad`/`/api/amistades`, specifically named to not collide with that.
`Amistad.existeEntre(a, b)` is the same "check both directions of a
directional record" pattern as `Bloqueo.existeEntre` — one document holds
`solicitante_id`/`receptor_id`, but either side queries it the same way.
Rejecting a pending request or unfriending an accepted one are the same
operation (`eliminarAmistad`): the document is deleted outright, there's no
`'rechazada'` state sitting around — a friend request can always be sent
again after a rejection.

### Notifications

`Notificacion` (`server/src/models/Notificacion.js`, routes under
`/api/notificaciones`) stores an already-rendered `mensaje` string (not
pieces to assemble client-side — server and client can't disagree on
wording that way) plus a polymorphic `referencia_id`/`referencia_tipo`
(`'post' | 'comentario' | 'amistad'`) pair for where to navigate on click,
since there's no single `ref` a Mongoose populate could use across three
unrelated collections. There is no model-level hook creating these (unlike
`num_comentarios`/`reacciones_resumen`, which are hooked because they're
data-integrity counters) — every trigger point calls `Notificacion.create()`
explicitly from the controller, currently: new comment, new/changed
reaction (never on removing one), a friend request sent, one accepted, and
a queja's `estado` changing. `postsController.notificarSiNoEsUnoMismo()` is
the shared "skip if you're notifying yourself" helper for the three post/
comment triggers; the friend and queja triggers inline the same one-line
check since they only need it once each. Adding a new trigger point
anywhere else should follow this same explicit-call pattern, not add a new
model hook.

### Section controllers — what's different about each one

All six built sections (`quejas`, `fotos`, `eventos`, `negocios`, `turismo`,
`empleo`) follow the create-with-compensation / list-with-filters /
get-by-id shape from "Post + `*_detalle`" above, plus get like/react/
comment/moderate for free from the generic `postsController`. What's worth
knowing per section, because it'd take reading every controller to
re-derive otherwise:

- **Quejas**: `ubicacion` required. `estado` (`pendiente`/`en_curso`/
  `resuelto`) is tracked with a full `historial_estados` (who changed it and
  when), separate from `Post.estado_moderacion` — moderating visibility and
  tracking complaint progress are unrelated axes. Only `moderador`/`admin`
  can change `estado` (`PATCH /:id/estado`).
- **Fotos**: `imagenes` is required and non-empty at creation — the only
  section where that's true, since a photo post without a photo makes no
  sense. Client has to call `POST /api/subidas/imagenes` first and pass the
  returned URLs; there's no way to create a Foto without doing that step.
- **Eventos**: sorted by `fecha_inicio` ascending (soonest first), not by
  `fecha_creacion` like every other section — it's an agenda, not a feed.
  Hides anything already finished by default; `?incluirPasados=true` brings
  the history back (and flips the sort to descending, most recent first).
- **Negocios**: `ubicacion` required. Sorted destacado-first (via
  `$addFields` computing `destacado_hasta > now` then `$sort`), then by
  `fecha_creacion` — *unless* a geo search is active, in which case
  distance wins and destacado status is ignored entirely (mixing "closest"
  and "paid placement" ordering would defeat the geo search). Reviews
  aren't a separate collection: a `Comentario` on a `negocio` post can carry
  `valoracion` (1–5); the client only shows the star picker there
  (`PanelInteraccion`'s `permitirValoracion` prop).
- **Turismo**: same geo-search shape as Negocios (see the `$geoNear`
  exception above) but no "destacado" concept — without geo params it's
  just `fecha_creacion` descending, plain and simple.
- **Empleo**: `modalidad` (`busco`/`ofrezco`) is a *required* query param on
  `GET /api/empleo`, not an optional filter like `categoria` elsewhere — the
  two shapes (candidate vs. job offer) are different enough that showing
  them mixed wouldn't make sense to a client. `Post.tipo` is derived from
  `modalidad` (`empleo_busco` / `empleo_ofrezco`) at creation, not passed
  separately. Expired offers (`estado_oferta: 'caducada'`) are hidden by
  default too (`?incluirCaducadas=true`), same pattern as Eventos' past
  events. `PATCH /:id/republicar` is restricted to the post's own author
  (403 otherwise) and only works on `'ofrezco'` (`EmpleoDetalle.republicar()`
  itself throws on `'busco'`, the controller just forwards that as a 400).
  `server/src/jobs/caducarEmpleos.js` is the cron that actually flips
  `estado_oferta` to `'caducada'` once `fecha_caducidad` passes — daily at
  03:00, registered in `server.js` via `iniciarCronCaducarEmpleos()` right
  after `conectarDB()` resolves (confirmed in a real boot log: `[cron]
  Caducidad de ofertas de empleo programada (diario, 03:00)`). It calls
  `EmpleoDetalle.marcarCaducada()` per expired doc, the same method the
  model already exposed — the cron only decides *when* to call it.

### Auth

`Usuario.js` hashes `contraseña` via a `pre('save')` bcrypt hook, the field
is `select: false` (must `.select('+contraseña')` explicitly, e.g. for
login), and `compararContraseña()` / `toJSON()` (strips the hash from any
serialized response). `utils/jwt.js` signs/verifies a JWT whose payload is
just `{ id: usuarioId }` — nothing else, so a role change takes effect
immediately rather than waiting for the old token to expire.
`middlewares/auth.js` exports `protegido` (requires a valid, non-expired
token *and* re-checks `Usuario.activo` on every request — deactivating an
account invalidates its already-issued tokens instantly, not just future
logins) and `autorizar(...roles)` (403 unless `req.usuario.rol` is one of
the given roles). `POST /api/auth/registro` destructures only the four
expected fields from `req.body` before calling `Usuario.create()` — never
passes `req.body` through directly, specifically so nobody can smuggle in
`rol: 'admin'`. Login returns the same generic "Credenciales invalidas" for
a wrong password, an unknown email, and a deactivated account — deliberately
not distinguishing which. `utils/ErrorHttp.js` is the plain `{status,
message}` error class every controller throws for expected failures (404,
403, 400 with a specific message); the central handler in `app.js` also
separately translates raw Mongoose `ValidationError` (400), duplicate-key
`11000` (409), bad-ObjectId `CastError` (400), and `MulterError` (400) —
so a controller only needs to construct `ErrorHttp` for cases Mongoose/
multer don't already cover on their own.

### Image uploads

Deliberately **not** using `multer-storage-cloudinary` — it's unmaintained
and only supports Cloudinary v1, which conflicts with the `cloudinary` v2
SDK this project uses. Instead: `middlewares/upload.js` (multer,
`memoryStorage`, image-mimetype filter, 8MB/5-files limit) + `utils/
subirImagen.js` (pipes the in-memory buffer to `cloudinary.uploader.
upload_stream` via `streamifier`, no disk write ever). `POST /api/subidas/
imagenes` (generic, not tied to any one section) wraps both and returns
`secure_url`s. `MulterError` (oversized file, too many files, wrong field
name) is mapped to 400 in the central handler like every other error
class. Needs real `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` in
`.env` — nothing here works against `mongodb-memory-server`-style fakes,
there's no local Cloudinary stand-in.

Every section's `Post` accepts `imagenes` (an array of already-uploaded
URLs) at creation, but **only Fotos' client form actually calls the
upload endpoint** (`client/src/pages/Fotos/FotoFormulario.jsx`: picks
files → `POST /api/subidas/imagenes` → `POST /api/fotos` with the returned
URLs). Turismo, Negocios, and Eventos' backends accept `imagenes` the same
way, but their client forms (`TurismoFormulario`, `NegocioFormulario`,
`EventoFormulario`) don't expose a file picker at all yet — an open gap,
not a design decision, if asked to add photo upload to one of those.

### Client structure

- `client/src/context/AuthContext.jsx` (wraps the whole app in `App.jsx`)
  owns the session: `usuario`/`cargando` state plus `login`/`registro`/
  `logout`, persisted to `localStorage` under `milepe_token`/
  `milepe_usuario` (same `milepe_token` key `services/api.js`'s request
  interceptor already reads). `useAuth()` throws if called outside the
  provider — a deliberate loud failure over a silent `undefined`.
  `api.js`'s response interceptor clears both keys on any 401 (expired/
  invalid token, or a since-deactivated account), so a stale session
  doesn't linger past its next failed request. `router/RutaProtegida.jsx`
  wraps a whole route that requires a session (redirects to `/login`,
  remembering `location.pathname` in nav state so login can return there);
  none of the section pages use it today since they're public-readable
  with only specific actions gated inline (a "inicia sesión para..."
  message instead of hiding the button) — it's there for a future
  session-only page (notifications, "mi perfil").
- `client/src/router/secciones.js` is the single source of truth mapping
  route path ↔ nav label ↔ the `Post.tipo`(s) it corresponds to — `tipos`
  is always an array, even for a section with just one, because Empleo
  alone maps to two (`empleo_busco`/`empleo_ofrezco`) and a shared shape
  means nothing downstream needs a special case for it. Both
  `AppRouter.jsx` and `NavBar.jsx` read from it; `MuroPage.jsx` flattens it
  into a `tipo -> seccion` lookup for the "which section does this Muro
  post belong to" badge. Don't hardcode a new nav link without adding it
  here first.
- `client/src/components/PanelInteraccion.jsx` is the reactions+comments
  block shared by every section's "tarjeta" component (`QuejaTarjeta`,
  `FotoTarjeta`, `EventoTarjeta`, `NegocioTarjeta`, `TurismoTarjeta`,
  `EmpleoTarjeta`) — they all talk to the same generic `/api/posts/:id/
  reaccion` and `/comentarios`, so the block only needs `postId` and the
  starting `reaccionesIniciales` as props. `permitirValoracion` (only
  passed by `NegocioTarjeta`) turns on a 5-star picker when commenting and
  renders stars on any existing comment that has a `valoracion`, without
  changing anything for sections that don't pass it. Extracted after Fotos
  needed the identical block Quejas already had — do the same rather than
  copy-pasting a third time if a new section needs it.
- `client/src/pages/Quejas/SelectorUbicacion.jsx` is the shared Leaflet
  click-to-place-a-marker map (also used by `EventoFormulario` and
  `NegocioFormulario` despite living under `pages/Quejas/` — it was built
  there first). Ships its own marker icon fix (Leaflet's default icon
  paths break under Vite's bundling) — reuse it rather than re-solving
  that.
- The create-a-post pattern repeats across every section's page component
  (`QuejasPage`, `FotosPage`, `EventosPage`, `NegociosPage`, `TurismoPage`,
  `EmpleoPage`): a "+ Nueva/o ..." button toggles a form component, the
  form's `onCreado(nuevo)` callback prepends the result to local state and
  closes the form. `EventosPage` deviates: it refetches the whole list
  instead of prepending, because a freshly-created event might not actually
  belong in the current filtered/sorted view (e.g. it could land outside
  today's "próximos" window) — prefer refetch over prepend whenever
  creation could produce something the current filter would legitimately
  exclude. `EmpleoPage` prepends on creation like everything else, but its
  *other* mutation, republishing an offer (`onRepublicado`), refetches
  instead — same underlying reason (the offer's new `estado_oferta` might
  no longer match the active filter), just triggered by a different action.
- `client/src/services/api.js` is a single shared axios instance (base URL
  from `VITE_API_URL`, JWT-from-`localStorage` request interceptor, 401
  response interceptor — see AuthContext above). Section-specific API
  calls should import this instance, not create their own `axios.create()`.
- `server/panel-pruebas/index.html`, served at `/panel` only when
  `NODE_ENV !== 'production'`, is a zero-dependency manual test page
  (register/login/create a queja/list) that talks to `/api` same-origin —
  predates the real client UI and was the only way to test by hand before
  it existed; still useful for a quick check without opening the full
  React app.
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
