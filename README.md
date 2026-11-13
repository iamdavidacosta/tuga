# TUGA

Aplicación web de recordatorios de medicamentos, diseñada para ofrecer una experiencia clara y accesible a personas mayores.

La etapa 7 incorpora una comprobación externa, protegida y de solo lectura para la disponibilidad de Supabase. También conserva la PWA, Web Push, medicamentos, calendario, historial, control de tomas, autenticación Google y Row Level Security.

## Requisitos

- Node.js 22.12 o una versión posterior de la rama 22.
- npm 10 o superior.
- Docker Desktop con contenedores Linux.

## Configuración del entorno

1. Copia `.env.example` como `.env` o `.env.local`.
2. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores públicos del proyecto.
3. Deja `VITE_AUTH_REDIRECT_URL` vacío para usar `<origen>/auth/callback`, o define la URL exacta de producción.
4. Define `VITE_VAPID_PUBLIC_KEY` con la clave VAPID pública; la clave privada se configura únicamente como secreto de la Edge Function.

Nunca agregues `service_role`, secret keys, el secreto de Google ni claves VAPID privadas a una variable `VITE_*`. Un `.env.local` con valores vacíos tiene precedencia sobre `.env`; elimínalos si las credenciales ya están en `.env`.

La configuración manual de Google y Supabase Auth está en [docs/supabase-auth.md](docs/supabase-auth.md). VAPID y Cron están en [docs/push-notifications.md](docs/push-notifications.md). El healthcheck y GitHub Actions están en [docs/supabase-healthcheck.md](docs/supabase-healthcheck.md).

## Desarrollo local

```powershell
npm ci
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Desarrollo web con Docker

```powershell
docker compose up --build
docker compose logs -f
docker compose down
```

El código local se monta en `/app`, mientras `node_modules` permanece en un volumen de Docker. Supabase es externo al `docker-compose.yml` de la aplicación.

## Supabase local y migraciones

```powershell
npm run supabase:start
npm run db:migrate:local
npm run db:test
npm run db:lint
npm run supabase:stop
```

`supabase start` crea el entorno local y aplica las migraciones pendientes. `db:migrate:local` aplica únicamente las migraciones locales pendientes; `db:reset:local` es destructivo y se reserva para una base local desechable.

No se aplican migraciones remotas de forma automática. El procedimiento de revisión y aplicación remota está documentado en [docs/supabase-auth.md](docs/supabase-auth.md).

## Verificaciones

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run db:test
npm run db:lint
```

## Imagen de producción

Vite incorpora las variables públicas durante la compilación. Para una imagen conectada al proyecto correcto, pásalas como argumentos de build o usa un flujo de CI que los suministre:

```powershell
docker build --target production `
  --build-arg VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co `
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_KEY `
  --build-arg VITE_AUTH_REDIRECT_URL=https://app.example.com/auth/callback `
  --build-arg VITE_VAPID_PUBLIC_KEY=PUBLIC_VAPID_KEY `
  -t tuga-web .
docker run --rm -p 8080:80 tuga-web
```

Nginx sirve la SPA en el puerto 80 y hace fallback a `index.html` para las rutas de React.

## Estructura principal

```text
src/
├── app/          # Router y composición de la aplicación
├── components/   # Componentes compartidos
├── features/     # Funcionalidades organizadas por dominio
├── hooks/        # Hooks compartidos
├── pages/        # Páginas asociadas a rutas
├── services/     # Adaptadores de servicios externos
├── styles/       # Tokens y estilos globales
├── test/         # Configuración de pruebas
└── types/        # Tipos compartidos

supabase/
├── migrations/   # Esquema PostgreSQL versionado y políticas RLS
└── tests/         # Pruebas pgTAP de estructura y aislamiento
```

`/` y `/auth/callback` son rutas públicas. El resto requiere una sesión válida. `/medicamentos` administra tratamientos y `/hoy`, `/calendario` e `/historial` consultan ocurrencias reales sincronizadas por Supabase Realtime.
