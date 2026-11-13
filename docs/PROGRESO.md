# Progreso de TUGA

## Calendario — ajuste al mockup (2026-11-13)

- Conserva la lógica real de mes, día y ocurrencias, con encabezado TUGA, selector mensual en píldora, celdas amplias por estado, leyenda y detalle navegable del día.
- El detalle muestra medicamentos, dosis, hora y estado; los días vacíos presentan un mensaje accesible dentro de la tarjeta.
- Validación aprobada: 5 pruebas Vitest focalizadas, TypeScript estricto, ESLint focalizado y un recorrido Playwright en 360, 390 y 430 px.
- Capturas comparadas con el mockup: `docs/capturas/calendario-390x844.png` y `docs/capturas/calendario-detalle-390x844.png`.
- No se modificaron Supabase, servicios ni lógica temporal; no se ejecutaron Playwright completo ni Docker.

## Medicamentos — ajuste al mockup (2026-11-13)

- La lista conserva los datos reales y ahora muestra encabezado TUGA, descripción, pestañas con contadores, tarjetas con dosis/frecuencia/hora y acceso inferior para añadir medicamentos.
- El encabezado global usa el mismo fondo crema del logo para evitar el corte visual entre blanco y crema.
- Validación aprobada: 2 pruebas Vitest focalizadas, TypeScript estricto, ESLint focalizado y un recorrido Playwright en 360, 390 y 430 px.
- Captura comparada con el mockup: `docs/capturas/medicamentos-390x844.png`.
- No se modificaron Supabase, servicios ni otras pantallas; no se ejecutaron Playwright completo ni Docker.

## Agregar medicamento — rediseño del mockup (2026-11-13)

- Asistente real de introducción y seis pasos: nombre, dosis, frecuencia, horarios, inicio y duración con resumen final.
- Conserva datos al regresar, valida antes de avanzar, admite horarios fijos o por intervalo, frecuencia por días, duración continua, días, semanas, meses calendario o fecha final y evita guardados duplicados.
- Frecuencias distintas de diaria se guardan en `recurrence_config`; la migración aditiva `20261113000200_add_schedule_frequency.sql` hace que el generador de tomas respete `intervalDays`.
- Validación aprobada: 15 pruebas Vitest focalizadas, 23 pruebas pgTAP de tomas, ESLint focalizado, TypeScript/build Vite y un recorrido Playwright en 360, 390 y 430 px.
- Capturas comparadas con el mockup: `docs/capturas/agregar-medicamento-*-390x844.png`.
- La migración de frecuencia fue aplicada al proyecto remoto por el usuario; no se reconstruyó Docker ni se ejecutó Playwright completo.

## Estado

Etapa 7 completada localmente. Una Edge Function protegida comprueba PostgreSQL con una función SQL de solo lectura que no accede a tablas ni escribe actividad. Responde únicamente `ok` o indisponibilidad, aplica timeout y admite una sesión válida de TUGA o una secret key de servicio.

Configuración muestra **Estado de TUGA**, conexión disponible o no disponible, estado de notificaciones y el botón **Comprobar**. El workflow de GitHub consulta el endpoint externamente cada seis horas y permite ejecución manual; no se publicó ningún repositorio.

## Pruebas ejecutadas

- Vitest/RTL focalizado: 3 archivos, 9 pruebas aprobadas.
- pgTAP de función y permisos: 4 pruebas aprobadas; linter PostgreSQL aprobado.
- Integración local: consulta PostgreSQL real aprobada y solicitud sin credenciales rechazada con 401.
- ESLint focalizado, TypeScript estricto y build Vite aprobados.

No se ejecutaron Playwright completo ni build Docker.

## Pendientes y configuración manual

- Revisar y aplicar `20261113000100_add_healthcheck.sql` y desplegar `healthcheck` solo con autorización.
- Configurar `TUGA_HEALTHCHECK_URL` y `TUGA_SUPABASE_SECRET_KEY` en GitHub Actions según `docs/supabase-healthcheck.md`.
- Ejecutar manualmente el workflow después del despliegue y rotar la secret key si se expone.
- Permanecen pendientes las configuraciones remotas de etapas anteriores.

El healthcheck no garantiza evitar pausas o suspensiones de Supabase Free.

## Próximo módulo

Esperar la solicitud explícita de la etapa 8. No se adelantó su implementación.

## Ajuste visual solicitado — 2026-11-13

- Renovadas las vistas de bienvenida, Hoy, calendario, asistente de medicamentos y confirmación de toma, conservando su comportamiento y los recursos oficiales.
- El encabezado usa el logotipo oficial de TUGA y los enlaces de regreso ahora se presentan como botones circulares accesibles.
- Validación: 11 pruebas Vitest focalizadas, 9 pruebas Playwright de bienvenida y anchos móviles, ESLint, TypeScript estricto y build Vite aprobados.
- No se ejecutaron pruebas E2E autenticadas, la suite Playwright completa ni build Docker. Verificar visualmente las pantallas privadas con una sesión real antes de publicar.

### Login refinado

- La bienvenida usa el logo vertical sonriente y el paisaje en capas originales, sin tarjeta blanca.
- Conserva únicamente el mensaje del mockup y el acceso con Google, ahora con su marca visual.
- Validación focalizada: 4 pruebas Vitest y 9 pruebas Playwright aprobadas; revisión visual en un dispositivo Android simulado.

### Vista Hoy refinada

- Reproducida la composición del mockup oficial: bienvenida orgánica, tarjeta protagonista, hora en formato de 12 horas, estado y acción “Tomé mi medicamento”.
- Incorporados estados para día completado, día sin pendientes y ausencia de tomas; la lista sigue siendo adaptable para nombres largos.
- Captura de referencia disponible en `docs/capturas/hoy-390x844.png`.
- Validación focalizada: Vitest, Playwright en 360/390/430 px, tablet y escritorio, ESLint, TypeScript estricto y build Vite.
- Ajustes finales: encabezado `#FDF8EF` integrado con el logo, mascota contenida y tarjetas de próxima toma y otras tomas con encabezado posterior y cuerpo crema superpuesto.
