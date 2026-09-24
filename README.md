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
cp .env.example .env   # rellenar MONGODB_URI, JWT_SECRET, Cloudinary, Stripe...
npm install
npm run dev             # http://localhost:5000 (health check en /api/health)
```

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
