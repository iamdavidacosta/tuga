# Progreso de TUGA

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
