# Configuración de Supabase Auth y Google OAuth

TUGA usa el flujo PKCE de Supabase Auth. El navegador recibe únicamente la URL del proyecto y la clave pública/publishable. El secreto OAuth de Google se configura en Supabase Dashboard y nunca debe incluirse en React, Dockerfile, `.env.example` ni variables `VITE_*`.

## 1. Crear las credenciales en Google Cloud

1. Abre Google Cloud Console y selecciona o crea el proyecto de TUGA.
2. En **Google Auth Platform**, completa **Branding**, **Audience** y **Data Access**. Solicita solo los datos básicos de identidad (`openid`, correo y perfil).
3. Si la aplicación está en modo de prueba, agrega las cuentas autorizadas en **Audience > Test users**.
4. En **Clients**, crea un cliente **Web application**.
5. Agrega como URI de redirección autorizada la URL de callback que muestra Supabase Dashboard en **Authentication > Providers > Google**. Para un proyecto alojado normalmente es:

   ```text
   https://PROJECT_REF.supabase.co/auth/v1/callback
   ```

6. Si se probará Google contra Supabase local, agrega además:

   ```text
   http://127.0.0.1:54321/auth/v1/callback
   ```

7. Copia el **Client ID** y el **Client secret**. No los guardes en el repositorio.

La URL autorizada en Google es la de Supabase (`/auth/v1/callback`), no la ruta de React (`/auth/callback`). Supabase termina el intercambio OAuth y luego redirige al frontend.

## 2. Habilitar Google en Supabase

1. Abre el proyecto en Supabase Dashboard.
2. En **Authentication > Providers > Google**, habilita el proveedor.
3. Pega el Client ID y el Client secret creados en Google Cloud y guarda los cambios.
4. En **Authentication > URL Configuration**, define:
   - **Site URL**: la URL principal de producción, por ejemplo `https://app.example.com`.
   - **Redirect URLs**:

     ```text
     http://localhost:5173/auth/callback
     http://127.0.0.1:5173/auth/callback
     https://app.example.com/auth/callback
     ```

5. Usa URLs exactas de producción. Los patrones comodín son útiles para previews controladas, pero no deben ampliar innecesariamente los destinos permitidos.

## 3. Variables públicas del frontend

Obtén la URL y la clave publishable desde **Project Settings > API** y configura un archivo ignorado por Git:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_AUTH_REDIRECT_URL=http://localhost:5173/auth/callback
```

Para producción, `VITE_AUTH_REDIRECT_URL` debe coincidir exactamente con la URL incluida en la lista de redirecciones de Supabase. Las claves `service_role` o secret nunca deben estar presentes en el frontend.

## 4. Validar localmente

La pila local requiere Docker Desktop:

```powershell
npm run supabase:start
npm run db:migrate:local
npm run db:test
npm run db:lint
npm run dev
```

Verifica lo siguiente:

1. Abre `http://localhost:5173`.
2. Pulsa **Continuar con Google**.
3. Completa el acceso en Google.
4. Confirma que el navegador vuelve a `/auth/callback` y luego a `/hoy`.
5. Recarga la página: la sesión debe mantenerse.
6. Abre `/configuracion`, comprueba el perfil actual y cierra la sesión.
7. Abre directamente `/hoy`: debe volver a la bienvenida.

El flujo interactivo de Google usa el proyecto Supabase configurado en las variables Vite; la pila local PostgreSQL se usa para validar migraciones y RLS.

## 5. Revisar una migración remota sin aplicarla

Estos comandos requieren autenticación en Supabase CLI y vinculan el repositorio con el proyecto. No se ejecutan como parte de la etapa:

```powershell
npx supabase login
npx supabase link --project-ref PROJECT_REF
npx supabase db push --dry-run
```

Revisa completamente el `--dry-run`. Solo con autorización expresa se debe ejecutar:

```powershell
npx supabase db push
```

No uses `db reset` contra un proyecto remoto. En local, `npm run db:reset:local` elimina y reconstruye la base local, por lo que debe usarse únicamente cuando esos datos sean desechables.

## 6. URLs para despliegues futuros

Antes de publicar en otro dominio:

1. Añade `https://DOMINIO/auth/callback` en Supabase **Redirect URLs**.
2. Configura `VITE_AUTH_REDIRECT_URL` con esa misma URL durante el build.
3. Si cambia el dominio principal, actualiza **Site URL**.
4. Mantén en Google la URL de callback de Supabase; no la sustituyas por la del frontend.
