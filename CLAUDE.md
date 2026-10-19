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
reactions, user blocking, friend requests (`Amistad`), notifications,
private messaging, and the report + appeal + audit-log moderation workflow.
That completes the feature set this project set out to translate from
Piverse; Stripe (`/api/pagos`) is the only thing left from the original
brief. Expect the feature set to keep growing beyond it.

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
makes each one's listing/creation different from the others). Only Stripe
(`pagos`) is still unbuilt.

Two of the nine sections are deliberately **not** part of this pattern, and
shouldn't be "regularized" into a `tipo`: **Contactos de interés**
(`ContactoInteres` — a standalone collection with no `Post`, no author, no
moderation, no reactions, because it's a static directory an admin
maintains rather than something a neighbour publishes) and **El Tiempo**
(no model at all — it never touches Mongo; see "El Tiempo" below).

Features from the wider social network sit outside the pattern too, for a
different reason: a reaction, a block, a friend request, a notification or
a private message isn't *publishable content*, so none of them gets a
`tipo`. `Conversacion`/`Mensaje` are the clearest case — see "Private
messaging" below.

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

Post-moderation, not pre-moderation: content is visible the instant it's
created (`estado_moderacion` defaults to `'publicado'`), and
`'eliminado'` is a soft delete — documents are never actually removed, so
comment references and history survive. `Usuario.rol`
(`usuario`/`moderador`/`admin`) is designed so new moderators can be added
by editing one field on an existing document — no migration.

Everything else runs through four collections and one controller
(`moderacionController` + `/api/moderacion`), all of it **generic over
`contenido_tipo`** (`'post' | 'comentario'`). `utils/contenidoModerable.js`
is the only place that maps a `contenido_tipo` to its model, and the thing
that makes the genericity work is that `Post` and `Comentario` already
share the three fields moderation cares about: `autor_id`,
`estado_moderacion`, `moderador_id`. A side effect worth knowing: a
comment can now be reported on its own, which was impossible before (you
had to report the whole post containing it).

- **`Reporte`** replaced the old embedded `Post.reportes` array, which
  couldn't be resolved (no reviewer, no timestamp, no state), couldn't be
  listed as a queue without scanning every post, and didn't cover comments
  at all. `motivo` is a closed enum (`MOTIVOS_REPORTE` in
  `models/constantes.js`) rather than free text, so the queue can be
  grouped and prioritised — a free-text `detalle` is still there, optional,
  for whatever the enum doesn't capture. A unique index on
  `{reportante_id, contenido_tipo, contenido_id}` is what now enforces "you
  can't report the same thing twice" (the array did it by scanning, which
  two simultaneous requests could slip past).
- **`Reporte.registrar()`** is the only way to create one, because three
  things have to happen together: save the report, check the threshold
  (`UMBRAL_REPORTES_AUTO_OCULTAR` = 3, moved here from `Post.js` since it's
  a rule about reports, not posts), and if it's reached, hide the content
  **and** write the audit entry. That last pairing is why this lives in the
  model: the invariant "anything hidden has a log entry saying why" can't
  depend on each caller remembering. Only **pending** reports count toward
  the threshold — if a moderator already dismissed three reports on
  something, the fourth shouldn't re-hide it by leaning on the discarded
  ones.
- **`RegistroModeracion`** is the audit log: who did what, to what, when
  and why. It's what `Post.moderador_id` could never be — that's a single
  field overwritten on every action, so only the last one survived; it
  stays as a shortcut for rendering "moderated by" without another query.
  The log is **append-only, enforced in the schema**: `pre('save')` throws
  on a non-new document and query middleware throws on every update and
  delete. That's an application-level barrier, not a database one (direct
  Mongo access can still do anything), but it rules out the real risk here,
  which is erasing it accidentally from the code. `moderador_id: null`
  means the threshold did it, not a person — that null is information, not
  a gap. `autor_contenido_id` is copied onto each entry so "what has been
  done to this neighbour" is one indexed query instead of a cross-collection
  join, and stays readable even if content is ever purged.
- **`Apelacion`** points at the **content**, not at the report that
  triggered the action: something can be hidden with no particular report
  behind it (a moderator acting on their own, or the automatic threshold
  summing several), so what the author is appealing is "my post is hidden",
  not "report number three". One appeal per content per author, enforced by
  a plain (not partial) unique index: the resolution is final and can't be
  re-litigated by resending. Resolving one is **admin-only**, and the
  controller additionally refuses to let anyone resolve the appeal against
  **their own** decision — it finds out who acted by reading the audit log,
  which is a good illustration of why the log exists. Without that rule,
  appealing would be asking the same moderator to overrule themselves.
- `aplicarAccion()` in the controller is the single path through which
  `estado_moderacion` changes by hand: it writes the log entry and notifies
  the author in one place. Changing the field directly anywhere else
  silently breaks the "every action is logged" invariant.
- Two consequences of the above that are easy to get wrong and are covered
  by tests: **dismissing** the last pending report on content the threshold
  had auto-hidden republishes it (otherwise "report rejected" would leave
  the punishment in place), and **accepting** an appeal also discards any
  still-pending reports on that content (otherwise the threshold would
  immediately re-hide what was just restored).
- The author's side is `GET /api/moderacion/mi-contenido-moderado`, which
  exists because the Muro and the sections only show `publicado` content —
  without it a hidden post simply vanishes and its author has no way to
  learn why or anywhere to appeal from. It returns the **reason** for the
  last action but deliberately not **who** took it: knowing which moderator
  it was doesn't help them argue their case and does invite taking it out
  on the person.
- `POST /api/posts/:id/reportar` and `PATCH /api/posts/:id/moderar` still
  exist and still work; they're now three-line adapters in `postsController`
  that fill in `contenido_tipo: 'post'` and hand off to the generic
  controller. Kept because `/api/posts/:id/...` is where you'd look for
  them, but there's no logic in them — don't add any there.

The embedded-array-to-collection switch needed no data migration: the live
database was checked first and held 0 embedded reports (3 posts, none
moderated), so nothing was lost by dropping the field.

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
`postsController.crearComentario`/`reaccionarPost` and into both
`conversacionesController.abrirConversacion`/`enviarMensaje` today (403 if
either has blocked the other); extend that same `existeEntre` check into
any new interaction surface rather than reinventing the check. Messaging
checks it *twice* on purpose — opening a thread and sending into an
already-open one — because a thread can be months old and the block from
yesterday; a one-time check at creation would leak a permanent channel.
`usuariosController.buscarUsuarios` also filters blocked users out of its
results, on the reasoning that surfacing someone you can't write to only
leads to a 403. Note the naming: this is unrelated to `ContactoInteres` (the
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
(`'post' | 'comentario' | 'amistad' | 'conversacion'`) pair for where to
navigate on click, since there's no single `ref` a Mongoose populate could
use across four unrelated collections. There is no model-level hook creating these (unlike
`num_comentarios`/`reacciones_resumen`, which are hooked because they're
data-integrity counters) — every trigger point calls `Notificacion.create()`
explicitly from the controller, currently: new comment, new/changed
reaction (never on removing one), a friend request sent, one accepted, a
queja's `estado` changing, a private message received, and every
moderation action on your content (hidden, removed, restored, appeal
resolved). `postsController.notificarSiNoEsUnoMismo()` is
the shared "skip if you're notifying yourself" helper for the three post/
comment triggers; the friend and queja triggers inline the same one-line
check since they only need it once each. Adding a new trigger point
anywhere else should follow this same explicit-call pattern, not add a new
model hook.

### Private messaging

`Conversacion` + `Mensaje` (`server/src/models/`, routes under
`/api/conversaciones`) are the one feature that exists entirely outside the
Post + `*_detalle` world — a private message is not publishable content, so
it gets its own two collections and never touches `posts`. Deliberately
1-to-1, no group threads: `participantes` is an embedded array validated to
exactly two distinct users in `pre('validate')` (Piverse needed a
`ConversationParticipant` join table for this; that was a SQL necessity,
not a design to carry over).

The non-obvious parts:

- **`clave_par`** is the two participant ids sorted and joined
  (`"menor_mayor"`), carrying a unique index. It exists *only* so Mongo can
  enforce "one thread per pair": a unique index can't do that on an array
  of participants, and without the guarantee two simultaneous clicks on
  "escribir a X" create two duplicate threads that then show as separate
  conversations. `Conversacion.obtenerOCrear()` is the only way to open
  one — it does find-then-create and, on an `E11000` from the race,
  re-reads the one the other request just created instead of throwing.
  Verified with two genuinely concurrent `obtenerOCrear` calls.
- **`ultimo_mensaje`** (text + author + date) is denormalized onto
  `Conversacion` for the inbox preview, maintained by a `post('save')` hook
  on `Mensaje` — same reasoning as `num_comentarios`/`reacciones_resumen`:
  it's a data-integrity summary, so it's hooked rather than left to each
  controller. That hook also touches `fecha_actualizacion`, which is what
  the inbox sorts by, so a new message bumps its thread to the top.
- **`Mensaje.leido_en` is a date, not a boolean** — a boolean can't render
  "visto a las 20:14" and going from one to the other later would be a
  migration, while ignoring the date and drawing a plain tick costs
  nothing. `marcarLeidos()` only marks messages the *other* person sent
  (reading is not mutual) and returns how many it marked, which is exactly
  what the client needs to clear its badge without a second request.
- **`cargarConversacionPropia()`** is the security-critical helper: every
  message route loads the thread through it, and it filters by
  `participantes: usuarioId` so a non-participant can't read, write to, or
  mark someone else's thread. It answers **404, not 403**, on purpose — a
  stranger isn't even told the thread exists. The smoke test covers all
  three verbs for an outsider; keep those cases if this is ever
  refactored.
- **One notification per unread run**: `notificarMensajeNuevo()` skips
  creating a `'mensaje_nuevo'` notification if the recipient already has an
  unread one for that same conversation, so a twenty-message exchange
  doesn't bury the notifications panel under twenty rows that say the same
  thing. `PATCH /:id/leida` marks the messages read *and* clears those
  notifications, which is what re-arms the next one.
- **`:id` means two different things** in this router, so `POST
  /con/:id` (the other **user's** id — the client knows who it wants to
  write to, not the thread id, same as `/api/amistades/:id`) is spelled
  with `/con/` precisely so the difference is visible in the URL instead of
  two indistinguishable kinds of id in the same position. Every other route
  takes the **conversation** id.
- Messages paginate backwards with `?antes=<ISO date>`, 50 per page: the
  query sorts descending and the controller reverses the array before
  responding, because what you need on opening a chat is the end of the
  conversation, not the beginning.
- `GET /:id/mensajes` also returns `con` (the other participant) and not
  just the messages, because a freshly opened thread has no message to
  derive the header name from.

`usuariosController.buscarUsuarios` (`GET /api/usuarios/buscar?q=`) was
added alongside this, not as part of it: messaging needed *some* way to
start a conversation and there's no profile page yet. Min 2 characters,
max 10 results, public fields only, excludes you and anyone a block
touches. It escapes the query before building the `RegExp` — an unbalanced
`(` typed into a search box is not an exotic search, it's a thrown
exception and a 500. The friends UI will want this same endpoint.

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

`/api/contactos-interes` is the odd one out (see the note in "Post +
`*_detalle`"): no `Post`, no author, no moderation. Reading is public and
only returns `activo: true` rows; everything else (`POST`, `PATCH /:id`,
`DELETE /:id`, plus `GET /todos`, which is the only way to see inactive
ones so you can reactivate them) is `autorizar('admin')`. `activo: false`
and `DELETE` mean different things on purpose: hide temporarily vs. it was
a mistake / no longer exists. Create and update run `req.body` through a
`CAMPOS_EDITABLES` whitelist, same discipline as `authController.registrar`.
`scripts/sembrar-contactos.mjs` seeds the starting directory and is
idempotent (`$setOnInsert` upsert keyed on `nombre`, so re-running never
duplicates *and* never clobbers an admin's later edits). It seeds the
nationally-standard Spanish numbers (112, 062, 061) as `activo: true`, but
anything whose real local number isn't known — Ayuntamiento, Policía Local,
Protección Civil de Lepe — is seeded with a placeholder and `activo: false`
so it can't surface in the app, and the script prints which ones need a
verified number. Keep that rule if you extend the seed: a wrong emergency
number published is worse than no number.

### El Tiempo

`GET /api/tiempo` (`tiempoController.js`) is the only endpoint in the app
that touches no model and no database — it's a cached proxy to OpenWeather
for Lepe's fixed coordinates. The proxy exists for two reasons, not one:
`OPENWEATHER_API_KEY` never reaches the browser, *and* the whole town looks
at the same municipality, so one upstream call serves everybody. The
in-memory cache (TTL from `TIEMPO_CACHE_MS`, default 10 min, read per
request so it can be changed without a restart — and so tests can shorten
it) is what keeps a free-tier quota, which counts calls rather than users,
from being burned by page refreshes. Three failure modes are handled on
purpose and each is covered by a test: no key configured → 503 (not a
confusing 500); upstream fails but cache is still valid → the outage is
invisible; upstream fails and cache has expired → the last good data is
served with `obsoleto: true` rather than breaking the page, and only a cold
cache with a failing upstream produces a 502 (with OpenWeather's own
`message` propagated, which is what tells you "invalid key" from "key not
activated yet" from "quota exceeded"). OpenWeather's response shape is
translated into our own in `formatearActual`/`formatearPrevision` (same
reasoning as `geo.js` with GeoJSON: swapping provider or moving to AEMET
should touch only this file, not the client) — including turning the
`/forecast` endpoint's 40 three-hour slots into per-day min/max, where the
day's icon comes from the slot nearest midday, not the first one, which
would otherwise show a moon for every day.

Two things about that per-day grouping that only showed up against the
real API, so don't "simplify" them away: `/forecast` spans 6 calendar days,
not 5, because it starts at the current time — and the **last** day arrives
truncated. Observed live: the final day held only the 00:00–09:00 slots, so
its "máxima" was really the early-morning temperature — 14 °C sitting next
to days of 25 °C, which reads as a cold snap that isn't coming. So a
trailing day with no slot at or after 12:00 is dropped (leaving 5). The
*first* day is deliberately exempt from that rule: it's "hoy", it's
legitimately partial, and it does include the afternoon.

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
  remembering `location.pathname` in nav state so login can return there).
  `/mensajes`, `/mensajes/:id` and `/mi-contenido` use it: every section
  page is public-readable with specific actions gated inline instead (a
  "inicia sesión para..." message rather than a hidden button), whereas a
  private thread or your own moderated content can't even be listed
  without knowing who you are. `router/RutaRol.jsx` is the same thing plus
  a role check, used only by `/moderacion`; it redirects a signed-in
  non-moderator to the Muro rather than showing "not authorised", since
  for a normal neighbour that page doesn't exist rather than being
  forbidden. It's navigation convenience, not security — `autorizar()` on
  the server routes is what actually enforces it, and faking the role in
  `localStorage` gets you an empty panel whose every request answers 403
  (verified against the running server for all three roles).
- `client/src/pages/Mensajes/` is the only client area deliberately *not*
  in `secciones.js`: messaging has no `Post.tipo`, never appears in the
  Muro, and only exists with a session, so its nav link lives in `NavBar`'s
  `navbar-sesion` block next to logout rather than among the sections.
  `MensajesPage` is the inbox (plus the vecino search that starts a
  thread); `ConversacionPage` is one thread. The latter re-polls every 10s
  while open — there are no websockets or push here yet — and merges the
  fetched page into what it already has by `_id` (`combinarMensajes`)
  rather than replacing it, since the poll always asks for the *latest* 50
  and a plain replace would wipe out any older pages the reader had loaded
  by scrolling up. The interval is cleared on unmount, so it doesn't keep
  polling in the background.
- `client/src/pages/Moderacion/` holds both sides of moderation and, like
  Mensajes, is not in `secciones.js`. `ModeracionPage` is the team panel
  (three tabs — report queue, appeal queue, audit log — in one route
  because they're worked together: resolve a report, check that
  neighbour's history, back to the queue); `MiContenidoModeradoPage`
  (`/mi-contenido`) is the author's view and the only place an appeal can
  be filed from. `components/BotonReportar.jsx` sits inside
  `PanelInteraccion`, which is what gets reporting into all six sections at
  once — and, in its `compacto` form, onto each individual comment.
  `NavBar` shows "Moderación" (with the pending count) only to the team,
  and "Mi contenido" only when `GET /moderacion/mi-contenido-moderado`
  comes back non-empty: that's one extra request per app load for a link
  most people never see, accepted over putting a permanent, unpleasantly
  named link in everyone's navbar.
- The server's error handler returns `{ ok: false, mensaje }` — **`mensaje`,
  not `message`**. Client code reading `err.response?.data?.message` gets
  `undefined` and silently falls back to its generic text, which is exactly
  what happened to the first versions of the Mensajes and Moderación
  components; the server's specific message ("Ya habías reportado este
  contenido") never reached the screen. Always read `data?.mensaje`.
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

`npm audit` in `server/` reports 3 high-severity findings (`braces` →
`chokidar` → `nodemon`). **Leave them.** The advisory's affected range is
`*` — no patched `braces` exists to pin via `overrides` — and the only fix
npm offers is `nodemon@1.14.10`, a 2018 major downgrade. `nodemon` is in
`devDependencies` and never runs in production (`npm start` is plain
`node src/server.js`), and the vulnerability needs attacker-controlled glob
patterns, which here only come from our own watch config. Re-check whether
upstream has shipped a fix before touching it; don't run `npm audit fix
--force`.
