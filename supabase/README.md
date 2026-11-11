# Configurar Supabase

La aplicacion utiliza Supabase Auth para el registro y las sesiones, PostgreSQL para los perfiles, RLS para proteger el censo y Realtime para reflejar cambios sin recargar la pagina.

## 1. Crear y configurar el proyecto

1. Crea un proyecto en Supabase y abre **SQL Editor**.
2. Ejecuta el contenido de [`schema.sql`](schema.sql). El script crea el perfil de cada usuario al registrarse, activa RLS y agrega la tabla a `supabase_realtime`.
3. En **Authentication > Providers**, habilita Email. Para exigir confirmacion de correo, conserva activada la confirmacion de email.
4. En **Authentication > URL Configuration**, configura la URL local del sitio, por ejemplo `http://localhost:8080`, como **Site URL** y como URL permitida de redireccion.
5. En **Project Settings > API**, copia el Project URL y la clave **publishable** (o la antigua clave `anon`).

Supabase genera automaticamente la API REST para la tabla. El sitio solo necesita el Project URL y la clave publica; nunca uses ni publiques la clave `service_role`.

## 2. Ejecutar el sitio local

El Project URL y la clave publishable de este proyecto ya tienen valores predeterminados en `application.properties`. Si necesitas reemplazarlos, define estas variables en PowerShell y ejecuta Spring Boot en esa misma terminal:

```powershell
$env:SUPABASE_URL = "https://TU-PROYECTO.supabase.co"
$env:SUPABASE_ANON_KEY = "TU-CLAVE-PUBLICA"
mvn clean spring-boot:run
```

Abre `http://localhost:8080`. Las variables de entorno solo se inyectan en la pagina al servirla con Spring Boot; no es suficiente abrir `index.html` directamente en el navegador.

Para desplegar el sitio con Spring Boot, configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` como variables de entorno del servicio. La clave publishable es publica y puede aparecer en el navegador; nunca configures `service_role` ni una clave secreta en estas variables.

## 3. Usar GitHub Pages

GitHub Pages sirve la pagina como archivos estaticos; no ejecuta Spring Boot. El `index.html` incluye la URL y la clave publishable del proyecto, y carga el cliente desde una ruta relativa para que funcione bajo `/motravel-bikers/`.

1. En **Authentication > URL Configuration**, configura como **Site URL** `https://carl-tru.github.io/motravel-bikers/`.
2. Agrega esa misma direccion a **Redirect URLs**. Para probar en local, agrega tambien `http://localhost:8080/`.
3. Publica los cambios en GitHub Pages, espera a que termine el despliegue y abre `https://carl-tru.github.io/motravel-bikers/#registro`.

En GitHub Pages no configures variables de entorno: la clave publishable esta disenada para usarse en el navegador. Nunca publiques la clave secreta ni `service_role`.

## 4. Dar de alta al primer administrador

1. Registra una cuenta desde **Unirme al Club** y confirma su correo.
2. En Supabase **SQL Editor**, sustituye el correo por el de esa cuenta y ejecuta:

```sql
update public.profiles p
set account_role = 'admin',
    membership_status = 'approved'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@example.com');
```

3. Cierra e inicia sesion en el sitio. El administrador vera la herramienta para aprobar o rechazar solicitudes y actualizar la actividad de los integrantes.

Las cuentas nuevas quedan pendientes y no pueden consultar el censo hasta ser aprobadas. Los miembros aprobados pueden leer el censo y editar solo su propio perfil; el estado de actividad y los permisos solo pueden cambiarlos los administradores. La clave publica no permite evitar estas politicas, que tambien se aplican directamente en PostgreSQL.
