# Preparación del modelo para notificaciones

La etapa 3 no crea tablas ni envía notificaciones. El esquema deja identificadores estables para que una etapa posterior incorpore Web Push sin modificar la propiedad multiusuario existente.

## `push_subscriptions`

Cada registro deberá pertenecer a `auth.users` mediante `user_id` y representar un dispositivo o perfil de navegador. Como mínimo necesitará:

- `id` UUID.
- `user_id` UUID con clave foránea.
- endpoint Web Push y claves públicas del cliente (`p256dh`, `auth`).
- información no sensible para distinguir el dispositivo.
- fechas de creación, actualización, última confirmación y expiración o revocación.
- unicidad por endpoint y un mecanismo para reemplazar suscripciones rotadas.

RLS debe limitar todas las operaciones al `auth.uid()` actual. El cliente nunca debe definir una suscripción para otro `user_id`; se debe usar un valor derivado de la sesión y validarlo en la base.

## `notification_deliveries`

Cada intento deberá enlazar una `dose_occurrence` y una `push_subscription` del mismo usuario. Debe guardar el estado del intento, fecha programada, fecha de envío, código de respuesta normalizado y un detalle de error limitado que no contenga tokens ni payloads sensibles.

La combinación de ocurrencia, suscripción y tipo de recordatorio debe tener una clave de idempotencia o restricción única. Las claves foráneas compuestas deben impedir relacionar datos de usuarios diferentes, igual que ocurre ahora entre medicamentos, horarios y tomas.

Las Edge Functions usarán credenciales del servidor almacenadas como secretos de Supabase. La clave privada VAPID y `service_role` nunca se enviarán a React. Las entregas se registrarán como intentos; la aplicación no prometerá recepción cuando dependa del navegador, sistema operativo o proveedor push.
