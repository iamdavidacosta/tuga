# Supervisión externa de Supabase

El healthcheck consulta PostgreSQL mediante `public.tuga_healthcheck()`, que ejecuta una operación de solo lectura sin tablas. No consulta usuarios, medicamentos ni tomas y no crea actividad persistente. La Edge Function devuelve solamente `{"status":"ok"}` o `{"status":"unavailable"}`.

Este mecanismo comprueba disponibilidad desde fuera de Supabase. **No garantiza que Supabase Free evite una pausa o suspensión**, porque esa decisión depende de las políticas y límites vigentes del proveedor.

## Despliegue manual

Revisa y aplica la migración `20261113000100_add_healthcheck.sql` únicamente con autorización. Después despliega la función:

```powershell
supabase functions deploy healthcheck
```

La función acepta una sesión válida de TUGA o una Supabase secret key en el encabezado `apikey`. No uses la publishable key para GitHub y nunca guardes la secret key en variables `VITE_*`, archivos del repositorio ni logs.

## GitHub Actions

El workflow `.github/workflows/supabase-healthcheck.yml` se ejecuta cada seis horas y también permite `workflow_dispatch`. El repositorio no se publica ni configura automáticamente.

En **GitHub → Settings → Secrets and variables → Actions**, crea:

- `TUGA_HEALTHCHECK_URL`: `https://PROJECT_REF.supabase.co/functions/v1/healthcheck`
- `TUGA_SUPABASE_SECRET_KEY`: una secret key revocable creada para esta automatización desde Supabase Dashboard.

La secret key tiene privilegios elevados: limita el acceso administrativo al repositorio, habilita protección de ramas y rótala si se expone. El workflow mantiene logs breves, usa un timeout de 15 segundos, comprueba HTTP 200 y exige exactamente `status: ok`.

## Verificación

1. Ejecuta el workflow manualmente desde **Actions → Supabase healthcheck → Run workflow**.
2. Confirma el mensaje `Supabase respondió correctamente.`.
3. Retira temporalmente el secret en un entorno de prueba para comprobar que el job falla; nunca muestres su valor.
4. En TUGA, abre **Configuración → Estado de TUGA** y pulsa **Comprobar** con una sesión válida.

Una respuesta fallida o un timeout solo indica que TUGA no pudo conectar en ese momento; no modifica datos ni tratamientos.
