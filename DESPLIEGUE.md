# Despliegue de MiLepe en milepe.com

Reparto: **la web en Netlify** (gratis, con CDN) y **la API en Railway**,
donde ya estaba. El dominio está en Namecheap y ahí se queda: no hace falta
mover los nameservers a ningún sitio.

| Qué | Dónde | Dirección |
|---|---|---|
| Web (React) | Netlify | `https://milepe.com` (y `www`) |
| API (Express) | Railway | `https://api.milepe.com` |
| Base de datos | Railway (red privada) | sin acceso público, a propósito |

---

## 1. Netlify (la web)

Crear el sitio desde el repositorio de GitHub (`vtornet/milepe`) y
configurarlo así:

| Campo | Valor |
|---|---|
| Base directory | `client` |
| Build command | `npm run build` |
| Publish directory | `client/dist` |

El resto (la reescritura de rutas de la SPA, las cabeceras de caché y de
seguridad) ya va en `client/netlify.toml` y Netlify lo lee solo.

**Variable de entorno**, en *Site settings → Environment variables*:

```
VITE_API_URL = https://api.milepe.com/api
```

Ojo con esto: Vite **incrusta** esa variable dentro del JavaScript al
compilar, no la lee al ejecutarse. Si se cambia después, hay que volver a
desplegar para que tenga efecto; y si se despliega antes de definirla, la
web saldrá llamando a `http://localhost:5000/api` y no funcionará para
nadie.

Luego, en *Domain management*, añadir `milepe.com` y `www.milepe.com`,
dejando `milepe.com` como dominio principal.

## 2. Namecheap (el DNS)

En *Domain List → milepe.com → Advanced DNS*. Son cuatro registros:

| Tipo | Host | Valor | Para qué |
|---|---|---|---|
| A | `@` | `75.2.60.5` | milepe.com → Netlify |
| CNAME | `www` | *(el `xxx.netlify.app` que te dé Netlify)* | www.milepe.com → Netlify |
| CNAME | `api` | `7rg36sk5.up.railway.app` | api.milepe.com → Railway |
| TXT | `_railway-verify.api` | `railway-verify=450560ec8ed3470a305381b57521715f02eae3bcf40ef9dd4b029a5b70f65f5e` | prueba a Railway que el dominio es tuyo |

Notas:

- El **TXT es imprescindible**: sin él Railway no emite el certificado
  HTTPS de `api.milepe.com` y el navegador bloqueará la API por certificado
  inválido. Se puede borrar una vez el dominio aparezca como verificado,
  pero no cuesta nada dejarlo.
- La **IP del registro A** (`75.2.60.5`) es la de Netlify para dominios
  raíz. Conviene confirmarla en el panel de Netlify al añadir el dominio,
  por si la cambian.
- Namecheap trae por defecto dos registros de ejemplo (un CNAME `www` a
  `parkingpage.namecheap.com` y una redirección en `@`). **Hay que
  borrarlos**, o entrarán en conflicto con los de arriba.
- El DNS tarda. Suele estar en minutos, pero puede llegar a horas.

## 3. Railway (la API)

Ya está hecho:

- Dominio personalizado `api.milepe.com` dado de alta (sin puerto fijo: lo
  detecta solo, que es lo correcto porque Railway inyecta `PORT` y el
  servicio escucha en el 8080, no en el 5000).
- Variables `CLIENT_URL`, `CLOUDINARY_*` y `OPENWEATHER_API_KEY` añadidas.

`CLIENT_URL` vale `https://milepe.com,https://www.milepe.com`: es la lista
de sitios desde los que un navegador puede llamar a la API. Si algún día se
añade otro dominio, se añade aquí separado por comas, o sus peticiones se
quedarán bloqueadas por CORS (que desde el cliente se ve como un "no se
pudo cargar" sin más explicación).

## 4. Comprobar que está bien

```bash
# La API responde en su dominio
curl https://api.milepe.com/api/health          # {"ok":true,...}

# El Tiempo ya no da 503 (necesita OPENWEATHER_API_KEY)
curl -o /dev/null -w "%{http_code}\n" https://api.milepe.com/api/tiempo

# CORS: desde milepe.com debe venir la cabecera, desde otro sitio no
curl -sD- -o /dev/null -H "Origin: https://milepe.com" https://api.milepe.com/api/health | grep -i access-control-allow-origin
curl -sD- -o /dev/null -H "Origin: https://otra-web.com" https://api.milepe.com/api/health | grep -i access-control-allow-origin
```

Y en el navegador: entrar en `https://milepe.com/quejas` **directamente**
(no navegando desde el muro). Si sale el 404 de Netlify, es que no se está
aplicando la reescritura de `netlify.toml`.

## Lo que queda pendiente

- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) no está puesto
  en Railway porque la integración no está construida todavía. Cuando lo
  esté, el webhook tendrá que apuntar a `https://api.milepe.com/api/pagos/webhook`.
- **Correo**: no hay verificación de email ni recuperación de contraseña,
  así que de momento el dominio no necesita registros MX ni SPF/DKIM. Si se
  añade, habrá que configurarlos.
- `milepe-production.up.railway.app` sigue existiendo y funcionando en
  paralelo. Se puede borrar (`railway domain delete
  milepe-production.up.railway.app`) una vez `api.milepe.com` esté
  verificado, para que la API tenga una sola dirección.
