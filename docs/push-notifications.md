# Configuración de recordatorios Web Push

La etapa 6 prepara PWA, Service Worker, Web Push, una Edge Function y Supabase Cron. Un resultado `accepted` significa únicamente que el proveedor push aceptó el intento; no garantiza que el dispositivo lo haya mostrado.

## 1. Generar VAPID

Genera un par nuevo fuera del repositorio:

```powershell
npx --yes web-push generate-vapid-keys --json
```

- Copia la clave pública a `VITE_VAPID_PUBLIC_KEY` en `.env.local` y en el entorno de build del frontend.
- Guarda `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` como secretos de Edge Functions. `VAPID_SUBJECT` debe ser una URL HTTPS o `mailto:responsable@dominio`.
- Nunca uses `VITE_` para la clave privada.

Desarrollo local: copia `supabase/functions/.env.example` como `supabase/functions/.env`; este último está ignorado por Git.

Producción, después de vincular el proyecto:

```powershell
supabase secrets set VAPID_PUBLIC_KEY=VALOR_PUBLICO
supabase secrets set VAPID_PRIVATE_KEY=VALOR_PRIVADO
supabase secrets set VAPID_SUBJECT=mailto:responsable@dominio
supabase secrets set TUGA_ALLOWED_ORIGINS=https://app.example.com
```

## 2. Migración y Edge Function

Revisa y aplica `20261112000400_add_push_notifications.sql` solo con autorización. Después despliega:

```powershell
supabase functions deploy push-notifications
```

La función usa el patrón oficial actual `@supabase/server` con `auth: ['user', 'secret']`. Por eso `verify_jwt=false` está acompañado por validación alternativa explícita: usuarios con JWT para la prueba y la clave secreta de API para Cron. Referencias: [seguridad de Edge Functions](https://supabase.com/docs/guides/functions/auth) y [programación con Cron](https://supabase.com/docs/guides/functions/schedule-functions).

## 3. Vault y Cron

En Supabase Dashboard crea, si es posible, una secret key dedicada llamada `automations`. Guarda el URL y esa `sb_secret_…` en Vault desde SQL Editor:

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'tuga_project_url');
select vault.create_secret('SB_SECRET_KEY', 'tuga_edge_secret_key');
```

No guardes una publishable key: permitiría invocaciones no autorizadas. La migración configura `tuga-process-reminders` cada minuto. Sin ambos secretos, el trabajo queda inerte. Verifica en Cron que la frecuencia sea compatible con el plan contratado; si no lo es, aumenta el intervalo conscientemente.

## 4. Verificación manual obligatoria

Usa cuentas y medicamentos de prueba, nunca datos personales de producción.

### Android Chrome

1. Abre TUGA por HTTPS, inicia sesión e instálala desde Chrome.
2. En Configuración pulsa **Activar recordatorios**; confirma el permiso.
3. Pulsa **Probar mis recordatorios**. Comprueba el mensaje de aceptación y luego la recepción real por separado.
4. Programa una toma próxima; prueba con la app en segundo plano y luego con la pestaña cerrada.
5. Con pantalla bloqueada, confirma que solo aparece el texto genérico, sin medicamento ni dosis.

### iPhone

1. En Safari usa **Compartir → Agregar a inicio** y abre TUGA desde el icono instalado.
2. Activa y prueba recordatorios. Un iPhone que no está ejecutando la app instalada debe mostrar la instrucción correspondiente.

### Dos dispositivos

1. Inicia la misma cuenta en dos dispositivos y activa cada suscripción.
2. Confirma que Configuración muestra dos dispositivos activos.
3. Programa una toma de prueba y verifica cada recepción de manera independiente.
4. Confirma la toma en uno; abre la notificación del otro y comprueba que TUGA consulta el estado actualizado y no ofrece una segunda confirmación pendiente.

### Posponer y suscripción inválida

- Pulsa **Recordarme en 15 minutos**; confirma que la toma sigue pendiente y que no se generan más de tres posposiciones.
- Desactiva permisos desde el navegador o elimina la suscripción; una respuesta 404/410 debe desactivar únicamente ese dispositivo.

## Límites

- El proveedor, navegador y sistema operativo controlan la entrega final.
- Cron y Edge Functions están sujetos a cuotas y pausas del plan.
- TUGA nunca marca una toma como realizada desde una notificación ni incluye información médica en la pantalla bloqueada.
