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
reactions, user blocking, following (`Seguimiento`, which replaced an
earlier `Amistad` friend-request model), notifications, private messaging
gated on mutual follow, threaded comments, post editing, Web Push, and the
report + appeal + audit-log moderation workflow.
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

## Despliegue

Production lives at **milepe.com**: the React client on Netlify, the
Express API on Railway at **api.milepe.com**, Mongo on Railway's private
network. The domain is registered at Namecheap and its DNS stays there.
`DESPLIEGUE.md` at the repo root has the exact records, the Netlify build
settings and the checks — read it before touching anything DNS-related.

Three things that bite:

- **`VITE_API_URL` is baked into the bundle at build time**, not read at
  runtime. Changing it in Netlify does nothing until the site is rebuilt,
  and deploying before setting it ships a site that calls
  `http://localhost:5000/api` for everybody.
- **`CLIENT_URL` on the server is a comma-separated list of origins**, not
  one value — a real domain is at least two (`milepe.com` and
  `www.milepe.com`). `app.js` rejects anything else by returning the
  response *without* the CORS headers rather than throwing, so a blocked
  origin doesn't show up as a 500 that looks like a server fault. In
  production with no `CLIENT_URL` it logs a loud error at boot and refuses
  every browser origin; in development an empty list allows everything,
  because Vite's port moves when 5173 is taken.
- **`client/netlify.toml` rewrites every path to `index.html` with status
  200.** Without it, opening `milepe.com/quejas` directly — a refresh, or a
  link shared on WhatsApp — returns Netlify's 404, because that route only
  exists inside React Router. It must be a rewrite (200), not a redirect,
  or the address bar loses the path. The same file stops `sw.js` from ever
  being cached, which is the classic way a PWA strands people on an old
  version.

## Architecture

### Post + `*_detalle` join pattern (the core design)

Everything publishable lives in one central `posts` collection
(`server/src/models/Post.js`) discriminated by `tipo` (`muro`, `queja`,
`foto`, `evento`, `empleo_busco`, `empleo_ofrezco`, `negocio`).
`Post` only holds generic feed fields: `autor_id`, `tipo`, `titulo`,
`contenido`, `imagenes`, `reacciones_resumen`, moderation state, `reportes`.
Type-specific fields live in a separate `*_detalle` collection, linked back
by a unique `post_id` (one-to-one): `QuejaDetalle`, `FotoDetalle`,
`EmpleoDetalle`, `EventoDetalle`, `NegocioDetalle`. Every
`tipo` now has its controller/routes built (`quejas`, `fotos`, `eventos`,
`negocios`, `empleo` — see "Section controllers" below for what
makes each one's listing/creation different from the others). Only Stripe
(`pagos`) is still unbuilt.

Three of the nine sections are deliberately **not** part of this pattern, and
shouldn't be "regularized" into a `tipo`: **Turismo** (`RecursoTuristico` —
see "Turismo" below; it used to be a `tipo` and was taken out), **Contactos de interés**
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

The deliberate exception: `negociosController.listarNegocios` builds its
aggregation starting from the `*_detalle` collection, not `Post` (every
other section's listing starts from `Post`). Reason: MongoDB requires `$geoNear` to be the
pipeline's first stage, and the 2dsphere-indexed `ubicacion` field lives on
`NegocioDetalle`, not `Post` — so a `?lat=&lng=&radioKm=`
"cerca de mí" search has to start there. It still works with no geo
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
  point); optional on `EventoDetalle` and `RecursoTuristico` (an event can be
  posted without one; a route or a beach usually gets one, but the schema
  doesn't force it).
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

### Editing a post

`PATCH /api/posts/:id` (`postsController.editarPost`) is generic like
reacting and reporting: it edits only what lives on `Post` — `titulo`,
`contenido`, `imagenes`, through a `CAMPOS_EDITABLES_POST` whitelist. The
section-specific fields in each `*_detalle` are **not** editable from here
(each would need its own form and its own validation).

- **Only the author**, checked in the controller. A moderator can hide or
  remove someone's post, which is a different thing from rewriting it in
  their name. A post that isn't `publicado` can't be edited at all, or a
  moderator would end up resolving a report against a text that no longer
  exists.
- **A text edit does not re-moderate; an image change does.** A new image
  is content nobody has seen, and it's the obvious way to slip something in
  behind an already-accepted text. `Post.aplicarEdicion()` owns that rule
  (it's a rule about the content, not about the request) and returns
  `imagenesCambiaron` so the controller knows whether to write the audit
  entry. Reordering counts as a change; sending the same list in the same
  order doesn't.
- **Re-moderation does not hide the post.** `revision_pendiente` is a
  separate boolean, deliberately *not* a new `estado_moderacion` value: with
  a `'pendiente'` state, swapping one photo would make the post vanish from
  the Muro until someone approved it, and with a single moderator that's
  hours invisible for retouching an image. The post stays `publicado` and
  visible, and joins a third queue in the moderation panel
  (`GET /api/moderacion/ediciones`, `PATCH /api/moderacion/ediciones/:id`).
  The queue has its own **partial** index on `Post` (`editado_en` filtered
  by `revision_pendiente: true`), since posts under review are always a
  handful.
- The two new `ACCIONES_MODERACION` (`revision_por_edicion`,
  `edicion_aprobada`) carry `estado_anterior`/`estado_nuevo` **null**, same
  convention as dismissing a report: nothing about the visibility changed.
  `revision_por_edicion` also has `moderador_id: null` — the system marked
  it, not a person. `anotarRevisionPorEdicion()` lives in
  `moderacionController` even though `postsController` is what calls it, so
  there aren't two places that write to the audit log.
- Approving **doesn't notify the author**: from their side nothing
  happened, their post never stopped being visible, and a notification
  would only alarm them. Hiding it goes through the existing
  `aplicarAccion()`, which does notify — and which now also clears
  `revision_pendiente`, or resolved content would sit in the queue forever.
- `historial_ediciones` stores the **previous** versions (title, text and
  images, not just the text), because what a moderator needs is to compare
  what was published with what it became. Capped at
  `MAX_EDICIONES_GUARDADAS` (20): the array lives inside the document, so
  without a cap a much-retouched post would weigh more in old versions than
  in what it currently says. `GET /api/posts/:id/ediciones` is author +
  team only.
- Fotos' "imágenes required" rule is re-checked on edit (emptying the array
  would otherwise bypass it through the back door), and the client checks it
  too so it doesn't upload files for a request that will be refused.
- On the client, `TarjetaPublicacion` holds the version it renders in local
  state (so an edit shows immediately without six section pages passing an
  `onEditado` down), and re-syncs from the prop when the parent brings a
  newer one. "editado" is shown **to everyone** — a text that changes
  silently under the comments answering the old one is the easiest way to
  make a discussion stop making sense — while the "pending review" notice is
  shown only to the author and the team: for everyone else the post looks
  the same, and a "pending review" sign on something harmless just raises a
  suspicion nobody had.

### Reactions

`Reaccion` (`server/src/models/Reaccion.js`) is one collection shared by
posts and comments — a document has exactly `post_id` XOR `comentario_id`
(enforced in `pre('validate')`), never both, never neither. `TIPOS_REACCION`
(`me_gusta`, `me_encanta`, `jaja`, `vaya`, `apoyo`, `triste`, `enfado` —
lives in `models/constantes.js`, not in `Reaccion.js`, specifically to
avoid a circular import since `Post.js`/`Comentario.js` need the list too
for their `reacciones_resumen` field) is **seven, not Facebook's six**:
`apoyo` ("this happens to me too") is the only one that means anything on
a Quejas post, where a "like" on a pothole says nothing, so dropping it to
match the usual set would have cost the flagship section its one useful
reaction *and* required migrating existing `apoyo` rows onto a type that
means something else. The list's order is the order the picker draws and
the order of the `reacciones_resumen` keys.

Adding the three new types needed **no migration**: documents written
before them simply lack those keys, `$inc` creates a key that isn't there,
and every read goes through helpers that treat missing as zero
(`contarReacciones`/`reaccionesPresentes` on the client). Don't "fix" the
old documents by backfilling zeros.

`Reaccion.alternar({ autor_id, tipo, post_id | comentario_id })` is
the only way to react: it upserts, and reacting again with the same `tipo`
removes it (toggle) while a different `tipo` swaps it — one reaction per
user per target, enforced by a partial unique index (partial because only
one of `post_id`/`comentario_id` is set per document, so a plain compound
unique index would collide across targets). It also keeps
`reacciones_resumen` (a per-type counter, same denormalization pattern as
`num_comentarios`) in sync on the right parent model. `GET /api/posts/mis-reacciones` answers "what has *this* user reacted
to", as two maps (`posts` and `comentarios`) of id → type, capped at
`TOPE_MIS_REACCIONES` (1000). It's one request per app load, held in
`client/src/context/ReaccionesContext.jsx`, rather than a `mi_reaccion`
field added to each listing: the seven listings (Muro plus six sections)
would each have to compute it — two of them inside an aggregation — and the
picker lives inside a card that doesn't know which listing it came from.
Before this, the client started every card with no idea what you'd already
chosen, so after a reload your own reaction wasn't highlighted.

`components/SelectorReaccion.jsx` is the picker, shared by posts and
comments (`compacto`). Three things about it are load-bearing:

- **It renders the pill in a portal on `<body>`, positioned `fixed`.**
  `.pub` has `overflow: hidden` (it needs it to clip the media grid to the
  rounded corners) and the pill opens upward, so inside the card it got cut
  off on short cards — which is what the "buttons sticking out of the pill"
  symptom was. Position is computed by measuring the *rendered* pill, not by
  estimating its width, since the buttons shrink below 420px; it flips below
  the button when there's no room above, and clamps to the viewport. It
  closes on scroll and resize, because a fixed element doesn't follow the
  card.
- **A plain tap gives or removes `me_gusta`; the row of seven opens on long
  press** (450ms) on touch and on hover (350ms) with a real mouse
  (`matchMedia('(hover: hover) and (pointer: fine)')`), plus ArrowUp/Down
  for keyboard, which would otherwise have no way in. A long press also
  fires a click, so a ref swallows that one click — without it, lifting your
  finger opened the pill and set a reaction nobody asked for.
- The buttons are `display: grid` + `place-items: center` with explicit
  `padding: 0` and an emoji font stack. The browser's own button padding
  inside a 44px box leaves the emoji no room, and emoji metrics differ per
  platform, so centring them as text doesn't centre them.

Reactions on comments existed server-side from the start
(`POST /api/posts/:id/comentarios/reaccion`) but had no UI at all until the
picker was shared; `PanelInteraccion` now renders it in each comment's
footer next to the time and the report button.

There used to be a
simple `Post.likes: [ObjectId]` array with a `Post.alternarLike()` toggle —
that's gone, replaced entirely by this.

### Comments and threads

`Comentario` is threaded through `padre_id` (null = a first-level comment)
plus a stored `profundidad`. It's a pointer to the parent, not a
materialized path like `"1.4.2"`: moving a comment isn't an operation that
exists here, and a path would mean rewriting every descendant's the day it
did.

- **`profundidad` is computed in the model**, in a `pre('validate')` hook
  that runs only on creation (`colocarEnElHilo`): it loads the parent,
  checks it belongs to the same post — otherwise a thread could be stitched
  across two publications — and sets `profundidad = padre.profundidad + 1`.
  It is never read from the request. The smoke test posts a reply with
  `profundidad: 0` in the body and asserts the server ignores it.
- **The server does not cap depth.** `NIVELES_SANGRADO` (3, exported from
  `postsController` and sent in every listing as `niveles_sangrado`) is a
  *rendering* limit: the client stops indenting and offers "continuar
  hilo", which re-roots the view on that comment. Three levels at full
  indentation already leaves a column too narrow for a sentence on a phone.
- **`GET /api/posts/:id/comentarios` returns one level at a time**, 10 per
  page: no `?padre` gives the roots (`padre_id: null` is just another value
  of the same filter), `?padre=<id>` gives that comment's replies. It used
  to return every comment of the post at once, which meant sending two
  hundred comments to show the first five, and replies only matter to
  whoever asks for them.
- **A retired comment comes back as a hole**: `paraElCliente()` keeps the
  row (`_id`, `padre_id`, `profundidad`, `num_respuestas`, date, and
  `retirado: 'autor' | 'moderacion'`) and drops the text *and the author*.
  That's the whole point — if they travelled and the client merely drew
  "[deleted]" on top, the deletion would be decoration: anyone reading the
  API response, or the browser's network tab, would still read what its
  author withdrew. `retirado` distinguishes the two cases because "its
  author removed this" and "a moderator removed this" aren't the same
  sentence to whoever is reading.
- **`num_respuestas` counts every surviving reply, including retired
  ones** — a different rule from `Post.num_comentarios`, which counts only
  visible ones because it's the number shown to people. The reason is
  reachability: the listing returns retired replies as holes, so if the
  counter skipped them, a deleted reply whose own thread is still alive
  would leave the count at zero, the "ver N respuestas" button wouldn't be
  drawn, and that part of the conversation would become unreachable. Soft
  deletion therefore does *not* decrement it; only a physical `deleteOne`
  does.
- **Deleting takes two different paths on purpose.** The author gets a
  plain soft delete with `borrado_por_autor: true` — not a moderation
  action, so no audit entry and no notification to themselves. A moderator
  deleting someone else's comment goes through `moderarContenido` (and so
  through `aplicarAccion`), which logs it and tells the author why so they
  can appeal. A moderator deleting *their own* comment counts as the
  author: there's no sense in opening a file on yourself. Repeating the
  call answers the same thing instead of 400 — with bad coverage people tap
  twice.
- **`borrado_por_autor` exists so the visibility axis stays single.** Both
  kinds of deletion land in `estado_moderacion: 'eliminado'` (two fields
  saying whether something is visible end up contradicting each other), but
  they have to be told apart: `listarMiContenidoModerado` filters
  `borrado_por_autor: { $ne: true }`, because a comment you deleted
  yourself is not a sanction and would otherwise show up there as one, with
  an appeal button against your own decision.
- **Editing a comment keeps no version history**, unlike a post: a comment
  is two lines, what gets fixed is almost always a typo, and keeping every
  version of every comment of every thread costs more than it gives.
  `editado`/`editado_en` *are* shown, because replies underneath may be
  answering what it said before.
- A reply re-checks `Bloqueo.existeEntre` against the **parent comment's
  author**, not just the post's: without it, someone you blocked couldn't
  write on your post but could hang off your comment on someone else's.
- **A reply notifies the author of the comment, a root comment notifies the
  author of the post** — one person, not both. Notifying the post's author
  of every reply in every thread turns the notifications panel into a
  counter nobody reads.
- Client side, `components/HiloComentarios.jsx` holds the whole thread:
  levels cached by parent id (so entering and leaving a sub-thread doesn't
  refetch), a *stack* for "continuar hilo" so going back returns where you
  came from rather than to the top, inline edit, and an inline "¿Seguro?"
  instead of `confirm()` — same reasoning as everywhere else here, a
  browser dialog blocks the page and reads as a system error. It was split
  out of `PanelInteraccion`, which now keeps only the reaction bar and the
  two buttons.

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
leads to a 403. Blocking also **breaks the follow in both directions**
(`Seguimiento.romperEnAmbosSentidos`), because private messages are gated
on mutual follow: leaving the other person's follow in place would leave
the channel open, which is not blocking anything. Note the naming: this is
unrelated to `ContactoInteres` (the static Ayuntamiento/Policía/...
directory).

### Following (replaced `Amistad`)

`Seguimiento` (`server/src/models/Seguimiento.js`, routes under
`/api/seguimientos`) **replaced the `Amistad` friend-request model**, which
is gone — model, controller and routes. `Amistad` had never grown any UI,
so the swap only touched the server.

The difference that matters: following is unilateral and isn't approved.
That's what lets "you follow each other" be a *derived* state — two
documents, one per direction — instead of a field somebody has to keep in
sync, and it's exactly what the private-message gate reads. With `Amistad`
you had to ask which direction the row had been created in to know whether
two people were related; here each direction is its own row and there's
nothing to interpret.

- The only unique index is on the **ordered** pair
  (`{seguidor_id, seguido_id}`), unlike `Amistad`, where the controller had
  to check the reverse direction by hand so two rows couldn't describe the
  same relationship.
- `estadoEntre(a, b)` answers all three questions (`sigo`, `me_sigue`,
  `mutuo`) in **one** query, because they're always asked together: the
  follow button and the message button are drawn at the same time.
- Following is **idempotent**: a duplicate-key error means you already
  follow them, which is what you wanted. The notification is only created
  when the row is actually new, or two taps send two identical ones.
- There are **no denormalized counters** on `Usuario`: counting with these
  indexes is cheap, and a counter only pays for itself when it's needed per
  row of a listing. The profile counts on demand.
- `scripts/migrar-amistades-a-seguimientos.mjs` converts the old
  collection: an *accepted* friendship becomes two follows (otherwise two
  neighbours who had been messaging for months would find their thread
  read-only overnight), a *pending* request becomes one follow from the
  sender (the faithful translation — they wanted the relationship, and that
  is now called following; discarding them would throw away an intent
  somebody expressed). Idempotent, and it doesn't drop the old collection
  unless you pass `--borrar`.

**Private messages are gated on mutual follow.** `canalAbierto()` /
`exigirCanalAbierto()` in `conversacionesController` is the single gate,
checked when opening a thread **and on every send** — a thread can be
months old and the unfollow from yesterday, so a one-time check at creation
would leave a permanent channel open. Mutual and not "I follow you":
if following were enough, anyone could open a channel to write to whoever
they liked with one tap, which is the problem direct messages have on open
networks. The 403 carries a `razon` (`sin_seguimiento_mutuo` | `bloqueo`)
so the client can tell the two cases apart without parsing the message.

**Unfollowing makes the conversation read-only, it does not delete it.**
Reading your own thread needs nothing; only writing is gated. The history
stays whole — deleting it would destroy *both* people's record because one
of them changed their mind — and `listarMensajes` and `listarConversaciones`
both return `solo_lectura` + `razon_solo_lectura` so the inbox can mark a
thread before you open it and type into it. The client keeps polling a
read-only thread on purpose: the same response carries that state, so if
the other person follows back the notice clears itself.

### Reporting a private message

`TIPOS_CONTENIDO_MODERABLE` is now `['post', 'comentario', 'mensaje']`, and
`Mensaje` gained the two fields the generic moderation needs
(`estado_moderacion`, `moderador_id`) on top of the `autor_id` it already
had. Without this, the only thing you could do about an abusive private
message was block its sender, which hides it but tells nobody.

- **`puedeReportar()`** in `utils/contenidoModerable.js` is new and is not
  a formality: a post or a comment is public, so anyone can report it, but a
  private message has been seen by two people. Without the check, anyone
  holding a message id could push it into the moderation queue and get a
  moderator to read someone else's private conversation — and the
  auto-hide threshold would do it with no moderator involved. It answers
  **404, not 403**, same reasoning as `cargarConversacionPropia`.
- A moderated message's text **stops travelling**: `mensajeParaElCliente()`
  returns the row with `retirado: 'moderacion'` and no text. The author
  *is* kept, unlike a deleted comment — in a thread of two, knowing who
  wrote it reveals nothing the other person doesn't already know.
- The moderation panel shows **only the reported message**, never the
  thread around it.
- `TEXTOS_ACCION` in `moderacionController` is now per content type. There
  used to be one set of wordings, the posts' one, so somebody whose
  *comment* was hidden got "Tu publicación ha sido ocultada" — Spanish
  needs agreement, so a noun in a template doesn't fix it; each case needs
  its own sentence.
- Two traps that the smoke test caught, both in `Mensaje`'s hooks:
  - The `post('save')` hook that maintains `Conversacion.ultimo_mensaje`
    used to run on **every** save. That was safe only while a message was
    written once and never touched again (`marcarLeidos` uses `updateMany`,
    which skips hooks). Moderating a month-old message saves it, which
    would have made that old message the thread's preview and bumped the
    conversation to the top of the inbox as if something had just arrived.
    It now only runs when the document is new.
  - `refrescarVistaPrevia()` rewrites the preview after moderation (the
    retired text is **copied** into `Conversacion`, so without this you'd
    keep reading it in the inbox after hiding it) and must pass
    `{ timestamps: false }`: Mongoose updates `fecha_actualizacion` on its
    own in *any* `updateOne`, and the inbox is sorted by that field.

### Real time (not yet)

There is still no real time: `ConversacionPage` polls every 10s. Both
halves of the seam exist so that enchufing socket.io later means changing
one place on each side, and **socket.io is deliberately not installed** —
adding it now means a server holding open websockets nobody listens to,
and on Railway those are billed connections for nothing.

- `server/src/utils/tiempoReal.js`: `emitir(usuarioId, evento, datos)` does
  nothing until `registrarAdaptador()` is called from `server.js` (the file
  carries the exact snippet). `enviarMensaje` already calls it. Events are
  named after the matching notification type so client and server don't
  keep two vocabularies.
- `client/src/hooks/useSondeo.js`: the polling hook. It also **stops while
  the tab is hidden** — polling a chat nobody is looking at spends a
  neighbour's battery and mobile data — and fetches immediately on return,
  so nothing is missed.

### Web Push

`web-push` (a real dependency now) + `Suscripcion` + `utils/push.js`.
Avisos go out on a new follower and on a new private message.

- A `Suscripcion` row is **a browser**, not a user: the permission is
  granted per browser and per device, so one neighbour can have three rows
  and all three must be notified. `POST /api/notificaciones/push` is an
  **upsert by endpoint**, never an insert — on a shared phone a second
  neighbour subscribing has to take the row over, not collide with it.
- Same contract as `utils/correo.js`: **unconfigured, nothing breaks.** No
  VAPID keys means no pushes and one logged line. And a failing push can
  never take down the request that triggered it — not getting the
  notification for a message is an annoyance; the message not being sent
  because the notification failed is a bug.
- VAPID keys are just a keypair (`npx web-push generate-vapid-keys`), no
  account anywhere. The **public key is served by the API**
  (`GET /api/notificaciones/push/clave`) instead of living in the client's
  `.env`, so the two can't drift apart: a public key that isn't the pair of
  the server's private one produces subscriptions that look fine and fail
  only when you try to send.
- All pushes about one conversation share a `tag`, so the twentieth message
  replaces the first notification instead of stacking twenty.
- The browser's service worker is generated by `vite-plugin-pwa`
  (`generateSW`) and can't be edited, so `workbox.importScripts` pulls in
  `client/public/push-sw.js`, which holds the `push` and
  `notificationclick` handlers. The alternative was moving the whole PWA to
  `injectManifest` and hand-writing the service worker, precaching
  included.
- The permission is **not** requested on load — a browser asking "allow
  notifications?" in the first second is the fastest way to get a
  permanent no, and the browser never asks again. It's a switch in the
  profile (`components/AvisosPush.jsx`).

### Public profile

`GET /api/usuarios/:id` (`perfilPublico`) + `client/src/pages/Perfil/
VecinoPage.jsx` at `/vecino/:id`. Readable without an account, like the
rest of MiLepe; what a session adds is the follow and message buttons and
the `relacion` block. It returns only `CAMPOS_PUBLICOS_USUARIO` plus the
join date and role — the real name, surnames and email never leave through
here, which is the whole reason `miPerfil()` is the only place that adds
them back by hand.

It needed a third auth middleware, `opcional` in `middlewares/auth.js`:
like `protegido` but it lets anonymous requests through with `req.usuario`
undefined, and **ignores a bad token** instead of answering 401 (a stale
token must not break a public page). `listarMuro` also took a `?autor=`
filter, served by the `{autor_id, fecha_creacion}` index that already
existed.

### Notifications

`Notificacion` (`server/src/models/Notificacion.js`, routes under
`/api/notificaciones`) stores an already-rendered `mensaje` string (not
pieces to assemble client-side — server and client can't disagree on
wording that way) plus a polymorphic `referencia_id`/`referencia_tipo`
(`'post' | 'comentario' | 'mensaje' | 'usuario' | 'conversacion'`) pair for
where to navigate on click, since there's no single `ref` a Mongoose
populate could use across unrelated collections. There is no model-level hook creating these (unlike
`num_comentarios`/`reacciones_resumen`, which are hooked because they're
data-integrity counters) — every trigger point calls `Notificacion.create()`
explicitly from the controller, currently: new comment, new/changed
reaction (never on removing one), a new follower (`seguidor_nuevo`, which
replaced the two `Amistad` types and whose wording changes when the follow
makes it mutual, because that's the moment you can write to each other), a
queja's `estado` changing, a private message received, and every
moderation action on your content (hidden, removed, restored, appeal
resolved). `postsController.notificarSiNoEsUnoMismo()` is
the shared "skip if you're notifying yourself" helper for the three post/
comment triggers; the follow and queja triggers inline the same one-line
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
  write to, not the thread id, same as `/api/seguimientos/:id`) is spelled
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
exception and a 500. Since the mutual-follow gate exists, the inbox's
search no longer opens a thread directly (that would almost always be a
403): it navigates to `/vecino/:id`, where the follow and message buttons
live with the reason written out.

### Section controllers — what's different about each one

All five post-based sections (`quejas`, `fotos`, `eventos`, `negocios`,
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
- **Turismo** is not a post section any more — see "Turismo" below.
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

### Turismo (information, not posts)

`RecursoTuristico` (`server/src/models/RecursoTuristico.js`, routes under
`/api/turismo`) is a standalone collection like `ContactoInteres`: no `Post`,
no author, no moderation, no reactions, no comments. Turismo used to be a
`Post.tipo` with a `TurismoDetalle` where neighbours recommended places;
it became information a **admin** maintains, so `TurismoDetalle` is gone,
`'turismo'` is no longer in `TIPOS_POST`, and the fifteen posts the first
seed had created were removed by `scripts/sembrar-turismo.mjs` (which
refuses to delete anything if a post of turismo isn't one of its own, or
has comments).

- `seccion` is the seven sections of turismo.lepe.es that have content of
  their own (`SECCIONES_TURISMO`: sol_y_playa, turismo_activo,
  turismo_cultural, gastronomia, alojamientos, servicios_turisticos,
  rutas). Agenda is the Eventos section; the site's map, search and planner
  are tools, not content. Labels, icons and descriptions live in the client
  (`pages/Turismo/seccionesTurismo.js`); the server only knows the enum.
- Reading is public and only returns `activo: true`. `GET /todos`
  (hidden ones too, to reactivate them), `POST`, `PATCH /:id` and
  `DELETE /:id` are `autorizar('admin')` — moderators can't edit it, same
  as contacts. `/secciones` (counts per section, zeros included, for the
  cards) and `/todos` are declared before `/:id`.
- `ubicacion` arrives as `{lat,lng}` and is converted in the controller
  (`null` removes it, absent leaves it); the field whitelist is
  `CAMPOS_EDITABLES`. The 2dsphere index stays, but there is no "cerca de
  mí" any more: it belonged to the feed version.
- `fuente` is the turismo.lepe.es page a record was written from; `web`
  is the resource's own site. The texts are summaries, not copies.
- **Photos come from Wikimedia Commons** (CC BY / CC BY-SA / public domain),
  picked by hand in `scripts/datos/fotos-turismo.json` and loaded by
  `scripts/importar-fotos-turismo.mjs` (downloaded at ≤2000 px and uploaded
  to our Cloudinary, `milepe/turismo`; never hot-linked). Those licences
  **require crediting the author**, so each image has an entry in
  `creditos` (`imagen`, `autor`, `licencia`, `url` of the Commons page) and
  `RecursoTarjeta` prints it under the photo — don't drop it, and when a
  record's image is removed in the form its credit goes with it. Images an
  admin uploads need no credit. The municipal site's photos are *not* used:
  they aren't ours. `/secciones` also returns each section's `portada`
  (first image of its first record with one) for the cards.
  `utils/imagenes.js` (`redimensionada`) asks Cloudinary for the width
  actually painted instead of the 2000 px original.
- Client: `TurismoPage` is a grid of seven cards linking to
  `/turismo/:seccion` (`TurismoSeccionPage`), which lists
  `RecursoTarjeta`s. Only `usuario.rol === 'admin'` sees create / edit /
  hide / delete (inline "¿Seguro?") and the hidden records; the API
  re-checks it. `TurismoFormulario` uploads images through
  `/subidas/imagenes` before saving.

### Admin statistics

`GET /api/estadisticas` (`estadisticasController.js`, **admin only**, not
moderators: it is network-wide data, not the moderation queue) returns
counts and aggregates for users, content, comments/reactions, follows and
messages, moderation, quejas and the other sections, plus 30-day daily
series (days with no activity are filled with 0, or a chart would lie).
"Participantes" are users who posted, commented or reacted in the window.
Private messages contribute **volumes only** — never content. The client
side is the "Estadísticas" tab of `ModeracionPage` (`EstadisticasPanel.jsx`,
admin only, charts are hand-drawn SVG/CSS, no chart library: same reasoning
as `Icono.jsx`). Everything is computed live on each request (fine at this
scale; add a short cache if the collections ever get big).

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
not distinguishing which. **Entrar con Google** (`POST /api/auth/google`) uses Google Identity
Services' ID-token flow, not the redirect-based OAuth2 dance: the client
gets a token signed by Google and posts it here, which fits an API that
already has no sessions and answers with its own JWT.
`utils/googleAuth.js` verifies it against Google's public keys — never
trust the payload unverified, or anyone could post a JSON with a
neighbour's email — and **rejects accounts whose email Google hasn't
verified**, because linking by email without that check would let someone
take over another neighbour's account.

Three cases, and the third is the one that matters: a known `google_id`
signs in; an unknown one creates an account; and an existing account **with
the same email** gets *linked*, not duplicated. Without that, a neighbour
who registered with a password and later pressed "Continuar con Google"
would end up with two accounts and their posts split between them.

Consequences elsewhere:

- `Usuario.contraseña` is **conditionally required** (a function, not
  `required: true`): a Google account has none. `iniciarSesion` therefore
  also checks `!usuario.contraseña`, so a Google-only account fails the
  password login with the same generic message as everything else.
- `google_id`'s uniqueness is a **partial index**, not `unique + sparse`.
  Sparse skips documents where the field is *missing*, but `default: null`
  makes it *present and null*, so every password account collided on that
  null. The smoke test caught it on the second account created — it would
  have broken registration immediately in production.
- Google users get an invented `nombre_usuario`
  (`generarNombreUsuarioLibre`), since Google supplies none and the field
  is unique and shown on every post.

**Recuperación de contraseña** (`POST /api/auth/recuperar` +
`/restablecer`): `Usuario` stores the **SHA-256 hash** of the token, never
the token itself — the one that travels by email is the original, so a
database leak doesn't let anyone reset a single account. SHA-256 and not
bcrypt on purpose: the secret is 32 random bytes, not a guessable word, so
bcrypt's cost buys nothing. Valid one hour, single use (the token is
cleared in the same save as the new password).

Both halves answer **the same generic message whatever happens** — unknown
email, Google-only account, or rate-limited. Vary it and the endpoint
becomes a way to find out which neighbours have an account. The client
mirrors this: `RecuperarPage` shows the same confirmation either way, or
the server's care would be wasted. A per-email 60-second throttle (in
process memory, same reasoning as El Tiempo's cache) stops the endpoint
being a comfortable way to flood a neighbour's inbox. A Google-only
account still gets an email, telling them to use Google — otherwise they'd
wait for a message that is never coming.

Mail goes out over **SMTP via nodemailer** (`utils/correo.js`), not a
provider's own SDK: every provider speaks SMTP, so switching from Brevo to
Resend to anything else is four environment variables rather than a
rewrite. With no SMTP configured it prints the email to the console in
development — the whole recovery flow, link included, can be exercised
without signing up for anything — and logs an error in production, where
missing configuration means nobody is receiving their link.

**El nombre real nunca es publico.** `Usuario.nombre` and `apellidos` hold
the neighbour's real identity, asked for so there's a locatable person
behind every account — not to display. Three layers keep them in:
`select: false` on the schema, membership in `CAMPOS_NUNCA_SERIALIZADOS`
(so a freshly created or saved document doesn't leak them in *its own*
response — `select: false` only affects queries, which is exactly how the
registration response was leaking them until the smoke test caught it),
and `CAMPOS_PUBLICOS_USUARIO` in `models/constantes.js`, which is just
`'nombre_usuario avatar_url'`. That constant exists because the projection
used to be typed by hand in about twenty controllers: with one copy per
controller, forgetting a single one leaks every neighbour's real name.
`usuariosController.miPerfil` re-adds them by hand, and is the only place
that should.

**Email verification + profile gate.** `middlewares/perfil.js`
(`exigePerfilCompleto`) guards every *writing* route — publish, comment,
react, report, message, upload. Reading needs nothing: MiLepe is readable
without an account at all, and demanding verification to look at the Muro
would just scare neighbours off. Two conditions, same purpose:
`email_verificado` (or anyone registers with someone else's address and
posts in their name) and `perfil_completo`. The 403 carries a `razon`
(`email_sin_verificar` / `perfil_incompleto`) through the central error
handler, because the two cases lead to two different screens and inferring
that from the message text would be fragile.

**`nombre_usuario` is chosen once and never again.** It appears on every
post and comment its owner ever wrote, so changing it would rewrite the
authorship of their whole history in everyone else's eyes. Enforced in
`actualizarMiPerfil`: editable only while `perfil_completo` is false, which
is also what gives a Google signup the chance to replace the username that
was invented from their email. `perfil_completo` is computed server-side
from the required fields — it is never accepted from the client.

`utils/ErrorHttp.js` is the plain `{status,
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
URLs). Negocios and Eventos' backends accept `imagenes` the same way, but
their client forms (`NegocioFormulario`, `EventoFormulario`) don't expose a
file picker at all yet (the admin-only `TurismoFormulario` does upload) — an open gap,
not a design decision, if asked to add photo upload to one of those.

### Design system and app shell

The client has a real design system, split across `client/src/styles/` and
imported in order by `index.css` (tokens → base → layout → componentes).
The order matters: components consume the tokens, and overriding the base.
**Never write a raw hex colour in a component** — add a token instead, or
dark mode silently breaks in that one place.

- `tokens.css` holds every colour, space, radius, shadow and type size.
  The palette is sampled from the real logo (`logo.png` at the repo root):
  the pin's navy `#033263`, its cyan edge `#0dd4dc`, and the sun's orange
  `#fb7126`. The UI was green before the logo existed; a green interface
  beside a blue logo reads as an accident, like the brand and the app came
  from two different projects. Each hue is a full 50–800 scale, because
  with two shades you can't tell a resting button from a pressed one, or a
  tinted background from a border. Neutrals are slightly *cool* to sit with
  the blue. `--acento` (the orange) is reserved for what's genuinely
  exceptional on screen — a featured business, a sponsored event; spend it
  on anything else and it stops highlighting anything.
- Dark mode is three rules, not one: `@media (prefers-color-scheme: dark)`
  guarded by `:root:not([data-tema='claro'])`, plus `:root[data-tema=
  'oscuro']`. That guard is what lets someone whose phone is in dark mode
  still choose light. `hooks/useTema.js` owns the `data-tema` attribute and
  has three states (`sistema`/`claro`/`oscuro`) — without `sistema` there'd
  be no way back to following the phone once you'd picked something.
- Fonts are the system stack on purpose. No Google Fonts: this is a PWA
  that has to open instantly and work offline, and a remote font is one
  more blocking request plus a flash of restyled text.

The shell is `App.jsx` → `BarraSuperior` + `NavegacionLateral` +
`RailDerecho` + `BarraInferior`, laid out by `.armazon`, a three-column
grid. It's a grid and not floats so the centre column keeps its reading
width (`--ancho-columna`) as the side columns appear and disappear. Three
breakpoints: phone (top bar + bottom tabs), ≥900px (side nav appears,
tabs go), ≥1240px (right rail appears).

- The **bottom tab bar** is where a phone's thumb reaches; a menu in the
  top-left corner needs a change of grip. Only five slots fit, so
  `secciones.js` marks two sections `principal` (Quejas, Eventos) and the
  rest live behind "Más", which opens a bottom sheet.
- `RailDerecho` surfaces the weather and the emergency numbers, which
  already existed but were buried one page deep each. It hides whichever
  panel duplicates the page you're on, and only mounts at ≥1240px, so a
  phone never makes those two requests.
- The three places that show counters (top bar, side nav, tabs) get them
  from **one** fetch in `App.jsx` passed down as props — otherwise it'd be
  the same three requests per page load.

Shared components worth knowing before writing a new page:

- `TarjetaPublicacion` is the post shell (avatar, author, relative time,
  section link, chips, title, text, media grid, action bar). All six
  section cards now pass only what's theirs: `chips` for their badges and
  `datos` for their own fields. They used to each repeat the structure by
  hand, which is why they had drifted apart — one showed the author, one
  didn't; one counted comments, one didn't — and why any visual change had
  to be made six times.
- `Icono.jsx` is a hand-rolled SVG set, ~30 icons, stroked `currentColor`.
  No icon library on purpose: `lucide-react` or `react-icons` ship
  thousands of icons to use thirty, and this is a PWA people install on
  mobile data. Add new ones to the `TRAZOS` map.
- `Avatar.jsx` falls back to initials on a colour derived from the name,
  so the same neighbour always gets the same colour — recognising someone
  in a feed is partly recognising their blob of colour before reading the
  name. Nobody has uploaded a photo yet, so this is the common case, and a
  grid of identical grey silhouettes makes a full feed look empty.
- `Esqueleto.jsx` and `EstadoVacio.jsx` replaced the bare `Cargando...`
  and `No hay nada.` lines. A skeleton holds the space the content will
  take, so the page doesn't jump; an empty state with an icon and a next
  step doesn't get confused with a failed request, which matters a lot in
  a social network that starts out empty everywhere.
- `CabeceraSeccion` is the section header; it reads the icon and label
  from `secciones.js` by route, so a new section doesn't restate them.
- There are **no `alert()` calls left**. A browser alert blocks the page
  and reads as a system error; "inicia sesión para reaccionar" now appears
  inside the card.

Every icon in `client/public/icons/` is generated from `logo.png` at the
repo root — the transparent version of the logo. (`logo.jpg`, the earlier
one on a black background, is still in the repo but is no longer the
source for anything.) See that folder's README for the full list.

Three things worth knowing before touching them:

- They use the **pin only, without the "Mi Lepe" wordmark**, which is
  illegible below about 64px — and where the small mark appears (the top
  bar) the name is already written beside it.
- `marca.png` is **transparent**, so it sits on whatever background it
  lands on and works in light and dark alike. It carries no tile or shadow:
  that's what makes a logo look stuck on top of an interface rather than
  part of it.
- Every *system* icon is composited **on white** rather than left
  transparent. iOS composites transparency onto black by itself, and this
  logo is drawn for a light background — the pin's inner circle is a hole,
  not a dark area. The manifest's `background_color` is white for the same
  reason: it's Android's splash background and has to match what the icons
  sit on.

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
  Muro, and only exists with a session, so its nav link lives in the
  session area of the shell (top bar and the "Tú" group of the side nav)
  rather than among the sections.
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
  The shell shows "Moderación" (with the pending count) only to the team,
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
  `AppRouter.jsx` and the three navigation components read from it, and it
  also exports `SECCION_POR_TIPO` (the flattened `tipo -> seccion` lookup
  the Muro uses for its "which section is this from" link). Each entry now
  also carries `icono` (a name from `Icono.jsx`) and an optional
  `principal` flag for the phone tab bar. Don't hardcode a new nav link
  without adding it here first.
- `client/src/components/PanelInteraccion.jsx` is the reactions+comments
  block, now rendered by `TarjetaPublicacion` rather than by each section's
  card directly — they all talk to the same generic `/api/posts/:id/
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
  (`QuejasPage`, `FotosPage`, `EventosPage`, `NegociosPage`,
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
- PWA manifest/icons are configured in `client/vite.config.js`; the PNGs
  now exist (see "Design system and app shell" above). `index.html` carries
  two `theme-color` tags, one per colour scheme, or the browser chrome
  stays light green above a dark app.

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
