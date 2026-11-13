# Project State

## Purpose

TUGA es una aplicación web de recordatorios y registro de medicamentos orientada especialmente a adultos mayores con poca experiencia tecnológica. La interfaz usa español claro, preferiblemente es-CO, y prioriza Android sin excluir iPhone, tablets ni computadores. TUGA registra lo que declara la persona; no recomienda dosis, no modifica prescripciones y nunca confirma una toma automáticamente.

## Current stage and stack

La etapa 7 está implementada. La SPA usa React 19, TypeScript estricto, Vite 8, React Router 7 y `@supabase/supabase-js` 2. Supabase aporta Auth con Google, persistencia PostgreSQL multiusuario, Realtime, Edge Functions y Cron. Web Push usa VAPID y un único Service Worker. Un healthcheck externo supervisa disponibilidad sin leer ni escribir datos médicos. Las pruebas usan Vitest, React Testing Library, Playwright y pgTAP.

No se aplicó ninguna migración remota, no se desplegó la Edge Function y no se verificó una entrega push real. Medicamentos, Hoy, calendario, control de tomas e historial usan datos reales de Supabase.

## Main structure

- `src/app`: composición y contrato de rutas.
- `src/components`: componentes de presentación y layout compartidos.
- `src/features/auth`: contexto de sesión, servicio OAuth, guardas de rutas, errores y perfil autenticado.
- `src/features/medications`: reglas de fechas y horarios, tipos, adaptador Supabase y asistente de seis pasos.
- `src/features/doses`: reglas de calendario, tipos, adaptador Supabase, contexto horario y suscripción Realtime.
- `src/features/notifications`: compatibilidad, suscripción por dispositivo, diagnóstico y estado de recordatorios.
- `src/features/health`: comprobación acotada de disponibilidad y adaptación a estados sencillos de interfaz.
- `src/pages`: páginas asociadas al router, incluido el callback OAuth.
- `src/services/supabase`: validación de variables públicas y singleton del cliente.
- `src/assets/tugaAssets.ts`: catálogo único de recursos visuales oficiales.
- `public/assets`: copias sin modificación de recursos aprobados de TUGA.
- `supabase/migrations`: esquema versionado, funciones, relaciones, restricciones y RLS.
- `supabase/tests/database`: pruebas pgTAP de estructura y aislamiento multiusuario.
- `docs/supabase-auth.md`: configuración manual y flujo seguro de migración.
- `docs/notification-data-model.md`: decisiones iniciales del modelo Web Push.
- `docs/push-notifications.md`: VAPID, despliegue, Vault, Cron y verificación manual.
- `docs/supabase-healthcheck.md`: despliegue del healthcheck y configuración de GitHub Actions.

Los originales visuales permanecen en `../insumos` y nunca se modifican.

## Architecture and dependency direction

La arquitectura continúa siendo una SPA sencilla. Las páginas componen componentes y funcionalidades; el singleton de Supabase vive en `services`, mientras cada funcionalidad posee su adaptador y sus reglas puras. `features/medications/medicationRules.ts` no depende de React ni Supabase; `medicationsService.ts` traduce entre el dominio y consultas/RPC tipadas. Las vistas no crean clientes directamente. `AppRouter` instala `AuthProvider`; `routes.tsx` declara rutas públicas y un único límite de protección para el layout privado.

`/` y `/auth/callback` son públicas. Hoy, medicamentos, asistente, calendario, confirmación, historial, configuración e información requieren sesión. Nginx hace fallback a `index.html` para permitir recargas directas.

## Authentication and session contract

El cliente de Supabase usa PKCE, persistencia de sesión, renovación automática, detección de callback y una clave de almacenamiento propia. `onAuthStateChange` procesa `INITIAL_SESSION`, por lo que una sesión válida se recupera al recargar. El acceso usa exclusivamente Google y una URL de callback HTTP/HTTPS validada. El cierre de sesión usa alcance local para cerrar solamente el dispositivo actual.

La bienvenida redirige a `/hoy` si existe sesión. Las rutas privadas vuelven a `/` si no existe. Configuración presenta únicamente nombre y correo provenientes del usuario autenticado. Los errores se traducen a español claro y nunca se muestra el detalle técnico recibido por OAuth.

El frontend solo admite `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_AUTH_REDIRECT_URL` y la clave pública `VITE_VAPID_PUBLIC_KEY`. No puede contener `service_role`, secret keys, secreto OAuth de Google ni clave VAPID privada.

## Database and authorization contract

La migración base crea `profiles`, `medications`, `medication_schedules` y `dose_occurrences`. `20261112000200_add_medication_management.sql` agrega gestión atómica de tratamientos. `20261112000300_add_dose_control.sql` agrega vigencias y datos históricos de horarios, generación acotada de ocurrencias UTC, auditoría `dose_occurrence_events`, transiciones atómicas, contexto horario y publicación Realtime.

Todas las tablas tienen RLS habilitado y forzado, permisos explícitos solo para `authenticated` y políticas separadas de SELECT, INSERT, UPDATE y DELETE. `user_id` usa `auth.uid()` por defecto y las políticas lo validan. Claves foráneas compuestas garantizan que un horario pertenezca al mismo usuario que el medicamento y que una toma coincida con usuario, medicamento y horario. Un estado `taken` exige `taken_at`; los demás estados lo prohíben.

`20261112000400_add_push_notifications.sql` agrega suscripciones por dispositivo, entregas, posposiciones y pruebas diagnósticas. Las tablas tienen RLS forzado y no exponen endpoints ni claves al cliente: este usa RPC que deriva `auth.uid()`. Las operaciones del programador son exclusivas del rol de servicio, reclaman filas con bloqueo e idempotencia y limitan reintentos y posposiciones.

La Edge Function `push-notifications` usa `@supabase/server` con autenticación `user` para diagnósticos y `secret` para Cron. Aunque su configuración desactiva la verificación heredada del gateway, no es pública: el wrapper oficial valida cada modo. Cron obtiene URL y secret key desde Vault. La clave VAPID privada vive únicamente en secretos de Edge.

`20261113000100_add_healthcheck.sql` agrega una función SQL de solo lectura que ejecuta `SELECT true`, sin consultar tablas. Solo `service_role` puede ejecutarla. La Edge Function `healthcheck` acepta usuario autenticado o secret key, usa el cliente administrativo exclusivamente para esa función, aplica timeout y devuelve un estado mínimo. GitHub Actions la consulta externamente cada seis horas sin escrituras persistentes.

## Durable business rules

- Las tomas tienen estados `pending`, `taken` o `skipped` en la base.
- “Todavía no” conserva el estado pendiente.
- Una toma solo pasa a realizada mediante acción explícita y debe registrar `taken_at`.
- Las relaciones y toda lectura/escritura permanecen aisladas por usuario.
- Las fechas inicial y final de un tratamiento son inclusivas. Días y semanas cuentan desde la fecha inicial; los meses usan límites de calendario y no equivalen a 30 días.
- Los horarios fijos admiten varias horas exactas. Los intervalos guardan la primera hora, el número de horas y todas las horas locales derivadas del ciclo diario.
- Editar conserva versiones anteriores y horarios retirados; suspender no elimina historia.
- Confirmar, omitir y corregir bloquea la fila, es idempotente cuando corresponde y guarda una auditoría inmutable.
- La generación admite como máximo 63 días solicitados, evita duplicados y conserva ocurrencias confirmadas al editar o suspender.
- La fecha “Hoy” proviene de la zona configurada en el perfil; los instantes se guardan en UTC y Realtime sincroniza cambios entre dispositivos.
- Los recordatorios se procesan fuera de React y crean una entrega independiente para cada dispositivo activo.
- Una notificación contiene texto genérico; al abrirla se consulta nuevamente el estado real de la toma.
- Posponer crea un aviso a 15 minutos, mantiene la toma pendiente y permite como máximo tres posposiciones.
- Una respuesta 404/410 desactiva solamente la suscripción afectada; los fallos temporales tienen reintentos acotados.
- Web Push no ofrece garantía absoluta de entrega.
- El healthcheck no consulta datos de usuarios, no escribe actividad y no garantiza evitar pausas de Supabase Free.

## Visual and accessibility constraints

Los textos visibles son españoles y no culpabilizan. La interfaz conserva los recursos y tokens aprobados, WCAG 2.2 AA, controles táctiles grandes, foco visible, reducción de movimiento y reflujo al 200 %. No se usa Tailwind ni un kit visual externo.

## Build and validation

- `npm run dev`: Vite en `0.0.0.0:5173`.
- `npm run typecheck`: TypeScript estricto.
- `npm run lint`: ESLint sin advertencias.
- `npm test`: Vitest y React Testing Library.
- `npm run test:e2e`: Playwright con Chromium.
- `npm run build`: typecheck y bundle de producción.
- `npm run supabase:start` / `supabase:stop`: pila Supabase local.
- `npm run db:migrate:local`: aplica migraciones locales pendientes.
- `npm run db:test`: pruebas pgTAP de RLS.
- `npm run db:lint`: linter PostgreSQL local.
- `docker compose up --build`: frontend de desarrollo con recarga automática.
- `docker build --target production`: imagen Nginx de producción.

## Remaining work

La configuración interactiva de Google OAuth debe completarse en Google Cloud y Supabase Dashboard. Las migraciones deben revisarse y aplicarse al proyecto remoto con autorización explícita. También faltan configurar Web Push y desplegar sus funciones. Para el healthcheck faltan el despliegue remoto, los Actions Secrets y la ejecución manual del workflow; el repositorio no fue publicado.
