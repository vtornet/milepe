# MiLepe

Red social hiperlocal para el pueblo de Lepe (Huelva, España): quejas al
ayuntamiento, fotos antiguas/actuales, turismo, eventos, empleo de campaña,
negocios locales y contactos de emergencia — todo organizado como un feed
general (Muro) con acceso directo a cada sección.

## Estructura

```
client/   React + Vite, PWA instalable (vite-plugin-pwa)
server/   Node.js + Express, MongoDB (Mongoose), Cloudinary, Stripe, JWT
```

Modelo de datos: colección central `posts` con un campo `tipo` discriminador
(`queja`, `foto`, `evento`, `empleo_*`, `negocio`, `turismo`) más colecciones
`*_detalle` específicas enlazadas por `post_id`. El Muro consulta solo
`posts`; cada sección añade el join con su detalle. Moderación (`rol`,
`moderador_id`) integrada desde el primer esquema.

## Arranque en desarrollo

### Server

```
cd server
cp .env.example .env   # rellenar JWT_SECRET, Cloudinary, Stripe...
npm install
npm run dev             # http://localhost:5000 (health check en /api/health)
```

La base de datos es un MongoDB en Railway sin acceso publico (por seguridad,
solo habla con la red privada de Railway). Para conectar tu `npm run dev`
local hace falta un tunel SSH del propio Railway, en otra terminal aparte:

```
railway link                                    # una vez, elige el proyecto de MiLepe
railway connect MongoDB --tunnel-only --port 27018
```

Deja esa segunda terminal abierta mientras desarrollas (el tunel se cierra
con Ctrl+C) y pon en `server/.env`:

```
MONGODB_URI=mongodb://mongo:<password-de-MONGOPASSWORD>@127.0.0.1:27018/milepe?authSource=admin
```

El usuario/password son los mismos que `railway variables --service MongoDB`
(`MONGOUSER`/`MONGOPASSWORD`) o los que imprime el propio comando `connect`
al abrir el tunel.

### Client

```
cd client
cp .env.example .env    # VITE_API_URL apuntando al server
npm install
npm run dev              # http://localhost:5173
```

## Estado actual

Andamiaje inicial: estructura de carpetas, servidor Express arrancable
(conexión a Mongo, gestor de errores, router placeholder) y client React
con router y una página placeholder por sección. Los modelos de Mongoose
(Usuario, Post y detalles) son el siguiente paso.
