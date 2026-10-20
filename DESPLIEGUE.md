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

## 1. Netlify (la web) — YA HECHO

Proyecto `milepe` (equipo Appstracta), conectado a `github.com/vtornet/milepe`,
rama `main`. Configuración aplicada:

| Campo | Valor |
|---|---|
| Base directory | `client` |
| Build command | `npm run build` |
| Publish directory | `client/dist` |
| `VITE_API_URL` | `https://api.milepe.com/api` |

El resto (la reescritura de rutas de la SPA, las cabeceras de caché y de
seguridad) va en `client/netlify.toml` y Netlify lo lee solo. Comprobado en
el despliegue: "1 redirect rule processed, 4 header rules processed".

Ojo con `VITE_API_URL`: Vite la **incrusta** dentro del JavaScript al
compilar, no la lee al ejecutarse. Si se cambia, hay que volver a desplegar
para que tenga efecto.

Dominios añadidos: `milepe.com` (principal) y `www.milepe.com` (redirige a
la principal). Los dos en *Pending DNS verification* hasta que se toquen
los registros en Namecheap.

Visibilidad: **pública** (*Project visibility → Public → Production and
previews*). Venía privada de fábrica, que es lo que hacía que
`milepe.netlify.app` respondiera 401.

## 2. Namecheap (el DNS) — YA HECHO

En *Domain List → milepe.com → Advanced DNS*. Cuatro registros, ya
creados (y borrados los dos de ejemplo que trae Namecheap):

| Tipo | Host | Valor | Para qué |
|---|---|---|---|
| ALIAS | `@` | `apex-loadbalancer.netlify.com` | milepe.com → Netlify |
| CNAME | `www` | `milepe.netlify.app` | www.milepe.com → Netlify |
| CNAME | `api` | `7rg36sk5.up.railway.app` | api.milepe.com → Railway |
| TXT | `_railway-verify.api` | `railway-verify=450560ec8ed3470a305381b57521715f02eae3bcf40ef9dd4b029a5b70f65f5e` | prueba a Railway que el dominio es tuyo |

Notas:

- Para el dominio raíz, **ALIAS es mejor que un registro A**. Netlify ofrece
  las dos opciones (`ALIAS apex-loadbalancer.netlify.com` o `A 75.2.60.5`),
  y Namecheap admite ALIAS en su DNS básico. Con ALIAS, si Netlify cambia
  de IP no hay que tocar nada; con el registro A, el día que la cambien el
  dominio deja de funcionar sin que nadie sepa por qué. Si por lo que sea
  el ALIAS da problemas, el registro A es el recambio.
- El **TXT es imprescindible**: sin él Railway no emite el certificado
  HTTPS de `api.milepe.com` y el navegador bloqueará la API por certificado
  inválido. Se puede borrar una vez el dominio aparezca como verificado,
  pero no cuesta nada dejarlo.
- Namecheap trae por defecto dos registros de ejemplo (un CNAME `www` a
  `parkingpage.namecheap.com` y una redirección en `@`). Había que
  borrarlos, o entrarían en conflicto con los de arriba.
- Propagó en menos de un minuto, y los certificados de Let's Encrypt
  (Netlify y Railway, cada uno el suyo) se emitieron un minuto después.
  Mientras no están, el síntoma es que `http://` funciona y `https://`
  falla con "nombre de entidad de seguridad incorrecto": no es un error de
  configuración, es que falta el certificado.

## 3. Railway (la API)

Ya está hecho:

- Dominio personalizado `api.milepe.com` dado de alta (sin puerto fijo: lo
  detecta solo, que es lo correcto porque Railway inyecta `PORT` y el
  servicio escucha en el 8080, no en el 5000).
- Variables `CLIENT_URL`, `CLOUDINARY_*` y `OPENWEATHER_API_KEY` añadidas.
- `MONGODB_URI` corregida: ver abajo.

### El nombre de la base de datos en MONGODB_URI

La URI que da Railway **no incluye nombre de base de datos**, así que
producción se conectaba a la base por defecto (`test`) mientras que todos
los datos -usuarios, publicaciones y los contactos de emergencia
sembrados- están en `milepe`. No era un error visible: la API respondía
200 a todo, solo que el muro salía vacío y, peor, la sección de Contactos
no enseñaba ningún teléfono de urgencias.

Al añadir `/milepe` hay que añadir **también `?authSource=admin`**. Sin
eso, MongoDB intenta autenticar contra la base que se nombra en la ruta, y
el usuario de Railway vive en `admin`: el servicio arranca pero cae con
`AuthenticationFailed (code 18)` en cada petición y Railway devuelve 502.
La URI correcta termina así:

    .../milepe?authSource=admin

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

## 5. Acceso con Google

Proyecto `milepe` en Google Cloud Console, cliente de OAuth "MiLepe web"
(tipo *Aplicacion web*), con estos origenes autorizados de JavaScript:
`https://milepe.com`, `https://www.milepe.com` y `http://localhost:5173`.
No hay URIs de redireccionamiento porque el flujo es de **ID token**, no
el OAuth2 clasico con vuelta.

El ID de cliente va en DOS sitios y es el mismo: `GOOGLE_CLIENT_ID` en
Railway (para verificar que el token recibido se emitio para esta app) y
`VITE_GOOGLE_CLIENT_ID` en Netlify (para pintar el boton). No es secreto:
viaja al navegador por definicion.

Estado de publicacion: **En produccion**. Antes estaba en *Prueba*, donde
solo entran los correos que figuren en la lista de usuarios de prueba —
con la app recien creada eso significa que el boton de Google no le
funciona a nadie mas. Para publicar, Google exige en la pagina de marca el
correo de contacto del desarrollador y los enlaces a **politica de
privacidad** y **condiciones**, que son `/privacidad` y `/condiciones`.

Si alguna vez se piden permisos sensibles (leer el Gmail del vecino, su
agenda...), Google exigiria ademas verificar la app. Con los permisos
basicos que usa MiLepe (nombre, correo y foto) no hace falta.

## 6. Correo saliente (Resend)

Dominio `milepe.com` **verificado** en Resend. Clave de API con permiso de
**solo envio**, guardada en `SMTP_PASS`.

Variables en Railway: `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=2465`,
`SMTP_USER=resend`, `SMTP_PASS=<clave>`, `CORREO_REMITENTE`.

El puerto es **2465 y no el 587**, y conviene saber por que: Railway
bloquea la salida por el 587, y el sintoma es un `Connection timeout` que
parece un fallo de Resend cuando en realidad es la red de salida. Resend
ofrece el 2465 (TLS directo) justo para eso.

Los registros DNS de Resend en Namecheap son cuatro:

| Tipo | Host | Para que |
|---|---|---|
| TXT | `resend._domainkey` | DKIM: firma los correos |
| CNAME | `send` | SPF del Return-Path |
| CNAME | `rsend` | infraestructura de envio |
| TXT | `_dmarc` | politica DMARC (`v=DMARC1; p=none;`) |

**El MX de Resend se omitio a proposito.** Sirve para *recibir* correo en
`@milepe.com`, cosa que MiLepe no necesita, y ponerlo convertiria a Resend
en el destinatario de todo el correo del dominio, cerrando la puerta a
gestionarlo en otro sitio. Si algun dia se quiere recibir, se añade.

## Lo que queda pendiente

- **Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) no está puesto
  en Railway porque la integración no está construida todavía. Cuando lo
  esté, el webhook tendrá que apuntar a `https://api.milepe.com/api/pagos/webhook`.
- **Datos del responsable en las paginas legales**: `/privacidad` y
  `/condiciones` llevan marcadores `[PENDIENTE]` donde van el nombre o
  razon social, el NIF y el domicilio de quien responde legalmente. El RGPD
  y la LSSI obligan a identificarlo, asi que hay que rellenarlo **antes de
  abrir el registro al publico**. Las dos paginas muestran un aviso visible
  mientras falte.
- **Correos del dominio**: la politica cita `privacidad@milepe.com` y
  `hola@milepe.com`, que todavia no existen. Hacen falta (un reenvio basta)
  o habra que cambiar esas direcciones por una real.
- **Verificacion de email al registrarse**: no existe. Cualquiera puede
  registrarse con un correo que no es suyo. Quien entra con Google si viene
  verificado por Google.
- `milepe-production.up.railway.app` sigue existiendo y funcionando en
  paralelo. Se puede borrar (`railway domain delete
  milepe-production.up.railway.app`) una vez `api.milepe.com` esté
  verificado, para que la API tenga una sola dirección.
