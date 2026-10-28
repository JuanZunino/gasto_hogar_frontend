# GastoHogar — Frontend Angular (TP2)

GastoHogar es un trabajo práctico de Programación IV para registrar y analizar gastos personales y compartidos en hogares. El TP1 aporta el backend Rails y su back-office; el TP2 incorpora esta aplicación Angular, que consume la API JSON autenticada de Rails.

[Repositorio backend y guía de instalación conjunta](https://github.com/JuanZunino/gasto_hogar#readme) · [Repositorio frontend](https://github.com/JuanZunino/gasto_hogar_frontend)

## Arquitectura y tecnologías

```text
Navegador → Angular (localhost:4200)
             → /api/v1/** → proxy de desarrollo → Rails (localhost:3000)
                                                  → Active Record → PostgreSQL
Back-office HTML → Rails /admin/login
```

Angular no accede directamente a PostgreSQL. Rails valida credenciales, aplica permisos y persiste los datos. La sesión administrativa de Rails y la autenticación de Angular son independientes.

Versiones y requisitos contrastados con `package.json`, `package-lock.json` y `angular.json`:

| Tecnología | Declaración / uso |
| --- | --- |
| Angular | Paquetes `^22.2.0`; componentes standalone, signals y rutas con carga diferida. |
| Angular CLI / build | `^22.2.4`; CLI resuelta en lockfile: 22.2.4. |
| Node.js | Rango de engines de CLI/build: `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`. |
| npm | `packageManager`: `npm@11.19.1`. |
| TypeScript | `~6.0.2`. |
| RxJS / tslib | `~7.8.0` / `^2.3.0`. |
| Formularios y HTTP | Angular Forms (Reactive Forms y Signal Forms), HttpClient e interceptor. |
| Estilos y gráficos | SCSS y SVG locales; barras y dona sin biblioteca gráfica externa. |
| Pruebas | Angular unit-test builder, Vitest `^5.0.0` y jsdom `^30.0.0`. |
| Formato | Prettier `^3.8.1`; no hay script de lint en `package.json`. |

Los rangos de dependencias no sustituyen las versiones resueltas del lockfile. El backend declara Ruby 4.0.6, Rails 8.1.3.1 y PostgreSQL; su README detalla instalación, modelo de datos y endpoints.

## Instalación y ejecución conjunta

Los comandos siguientes son una guía para ejecución posterior. En el Paso 120.18 solo se revisaron archivos: no se instalaron dependencias, ejecutaron pruebas ni iniciaron servicios.

### 1. Obtener los proyectos e instalar Angular

Desde el directorio elegido para ambos repositorios:

```bash
git clone https://github.com/JuanZunino/gasto_hogar.git
git clone https://github.com/JuanZunino/gasto_hogar_frontend.git
cd gasto_hogar_frontend
node --version
npm --version
npm ci
```

Usar Node compatible y npm indicados arriba. `npm ci` instala según `package-lock.json`; no hace falta CLI global. Si ya se dispone de las copias, situarse en la raíz del frontend. Las URLs coinciden con sus remotos `origin`; la disponibilidad remota no se verificó.

### 2. Preparar Rails, una base nueva y usuarios

Seguir la sección **Instalación y ejecución conjunta** del [README backend](https://github.com/JuanZunino/gasto_hogar#readme): instalar Ruby/Bundler y dependencias, disponer de PostgreSQL en una instancia local aislada y descartable, y preparar una base nueva mediante `DATABASE_URL`.

El procedimiento backend usa `gasto_hogar_demo_12018` como nombre de ejemplo, siempre que no exista, y una base distinta para pruebas. No usar bases protegidas ni datos existentes. Las migraciones y seeds se describen allí para ejecución posterior: crean el esquema y diez categorías globales, pero no usuarios.

Crear el administrador inicial mediante la consola según esa guía (contraseña solicitada sin mostrarla). Con ese administrador, ingresar en `http://localhost:3000/admin/login` y crear dos usuarios finales con rol `user`, contraseñas nuevas elegidas por el evaluador y emails distintos. Crear un hogar y asociar ambos usuarios mediante `/admin/memberships`, uno como `owner` y otro como `member`. No existen credenciales de demostración predefinidas ni registro público en Angular.

### 3. Iniciar servidores

En una terminal desde la raíz del backend, después de preparar la base nueva:

```bash
export RAILS_ENV=development
export DATABASE_URL=postgresql:///gasto_hogar_demo_12018
bin/rails server -p 3000
```

En otra terminal desde la raíz del frontend:

```bash
npm start
```

Abrir `http://localhost:4200/login` e ingresar con un usuario creado en el back-office. El frontend recarga automáticamente al cambiar los archivos.

`npm start` ejecuta `ng serve`; `angular.json` selecciona desarrollo y carga `proxy.conf.json`. El proxy reenvía `/api/v1/**` a `http://localhost:3000`. Los servicios usan rutas relativas, sin URL de API en archivos de entorno. Para trabajar localmente, ambos servidores deben estar activos; el proxy evita necesitar CORS entre ellos. No hay pantalla índice Rails en `/`.

El proxy pertenece al servidor de desarrollo y no se incorpora como servidor al build. Un despliegue estático requiere configurar el fallback de rutas Angular y el reenvío de `/api/v1/**`; este README no define un despliegue de producción.

## Autenticación y navegación

- `/login`: formulario de email y contraseña; envía `POST /api/v1/login`.
- `/inicio`: saludo y perfil real obtenido con `GET /api/v1/profile`, con accesos a gastos y dashboard.
- `/gastos`: listado y filtros.
- `/gastos/nuevo`: alta de gasto.
- `/gastos/:id/editar`: edición de gasto autorizado.
- `/dashboard`: resumen personal o del hogar seleccionado.

Las rutas salvo login tienen `authGuard`. La raíz y las rutas desconocidas redirigen a Inicio, sujeto al guard. El layout autenticado incluye navegación, usuario disponible en memoria, cierre de sesión y menú adaptable a móvil; login usa la presentación pública.

El login recibe `token` y `user`; `AuthService` guarda el token en `sessionStorage` bajo `gastohogar.token` y conserva el usuario en una señal en memoria. El interceptor agrega `Authorization: Bearer …` a las solicitudes relativas `/api/v1/`, excepto login. El guard comprueba presencia del token; Rails verifica su validez y permisos en cada solicitud.

Rails emite un `signed_id` firmado con propósito `api_v1` y duración de 24 horas. No es JWT. Cerrar sesión borra token y usuario del cliente y navega al login; no revoca el token en Rails. No hay endpoint de logout, renovación de token ni recuperación de contraseña. Un token inválido o vencido produce `401`; se debe volver a iniciar sesión. No se documenta una redirección global automática ante todo `401`, porque el interceptor no la implementa.

## Gastos y categorías

El CRUD usa `GET/POST /api/v1/expenses` y `GET/PATCH/DELETE /api/v1/expenses/:id`. Los formularios envían descripción, importe, fecha, categoría, hogar opcional y notas. Rails obtiene el autor del token.

- El listado conserva en query params los filtros `from`, `to`, `category_id` y `household_id`; permite aplicar y limpiar, recargar y navegar atrás/adelante. Orden: fecha e ID descendentes desde la API.
- Sin filtro de hogar muestra gastos propios accesibles, incluidos los asociados a hogares actuales. No equivale a mostrar únicamente gastos personales.
- El formulario ofrece Personal (sin hogar) y los hogares del usuario. Exige descripción, importe positivo, fecha válida y categoría disponible. El máximo es $9.999.999.999,99.
- Acepta importes en notación argentina, por ejemplo `1.234,56`; normaliza a string decimal `1234.56` para el envío. La presentación ARS conserva precisión decimal.
- Carga categorías globales y privadas propias mediante `GET /api/v1/categories`. Desde el formulario permite crear una privada con `POST /api/v1/categories`, cuerpo `{ category: { name, description } }`, y dejarla seleccionada.
- Edición precarga datos; eliminación solicita confirmación. Hay estados de carga, vacío, errores, reintento y bloqueo durante operaciones. Las acciones usan `can_edit` y `can_delete` de Rails, que vuelve a comprobar autorización.

Una categoría privada no aparece en el catálogo de otro usuario aunque comparta hogar. Su nombre sí puede aparecer en un gasto compartido o en las estadísticas del hogar. No hay pantalla Angular para editar o eliminar categorías.

## Hogares compartidos y permisos

Los selectores consumen `GET /api/v1/households` y ofrecen los hogares con membresía actual. Al filtrar gastos por hogar, Rails devuelve todos sus gastos, incluidos los de otros autores. El listado identifica autoría y muestra editar/eliminar solo cuando el backend lo permite.

Compartir hogar habilita lectura, no modificación de gastos ajenos. Solo el autor puede modificar sus gastos mientras conserve membresía; los personales solo son accesibles por su autor. Al retirar una membresía desde el back-office, el exintegrante pierde acceso incluso a sus gastos de ese hogar; estos permanecen para los miembros actuales. Un rol global `admin` no amplía los permisos de lectura/escritura de la API.

Angular no tiene rutas de alta/edición de hogares, invitaciones ni gestión de miembros. Para la demostración se preparan desde el back-office. La API Rails adicionalmente ofrece creación de hogar con membresía `owner` automática y consulta de detalle/integrantes; esas operaciones no tienen pantalla en este frontend.

## Dashboard

`/dashboard` consulta `GET /api/v1/dashboard` y permite alternar **Mis gastos** y un hogar de la lista del usuario, con filtros inclusivos desde/hasta. Envía `from`, `to` y, al elegir hogar, `household_id`. Los filtros quedan en la URL y se restauran al recargar o navegar atrás/adelante; las fechas inválidas o invertidas bloquean la consulta.

Mis gastos calcula solo gastos propios accesibles; un hogar calcula todos los gastos de sus integrantes y los históricos que permanecen asociados, sin incluir gastos personales. La selección de hogar se valida contra las opciones disponibles; si deja de estar disponible al restaurar la URL, se elimina esa selección con un aviso.

Muestra importe total (`total_expenses`), cantidad (`expenses_count`) y totales por categoría (`expenses_by_category`), con barras, dona y leyenda. Los importes llegan como strings decimales; la distribución usa centavos `BigInt` para preservar precisión. Los porcentajes visuales pueden redondear y no sumar exactamente 100 %. Contempla carga, período vacío, error de API y reintento, sin métricas ficticias.

## Active Storage y Action Mailer (TP1)

Estas funcionalidades se demuestran en Rails, no mediante formularios Angular:

- **Active Storage:** un comprobante opcional por gasto; carga/reemplazo desde `/admin/expenses` y descarga desde el detalle. Archivos locales en `storage/`; PostgreSQL guarda metadatos. La API solo expone `receipt_attached`, sin endpoints propios de carga/descarga.
- **Action Mailer:** bienvenida HTML/texto al crear correctamente un usuario desde el back-office mediante `deliver_later`. En desarrollo escribe en `tmp/mails`; también hay una vista previa en `http://localhost:3000/rails/mailers/user_mailer/welcome_email`. Crear usuarios desde consola no envía ese correo.

Consultar el README backend para configuración y alcance completos.

## Pruebas y build

Desde la raíz del frontend, con dependencias instaladas:

```bash
npm test
npm test -- --watch=false
npm run build
```

`npm test` usa `ng test`; el segundo comando permite una ejecución sin watch. `angular.json` configura `@angular/build:unit-test`, con Vitest/jsdom. Los tests existentes cubren autenticación, perfil, guard/interceptor, layout, gastos, filtros, opciones y creación de categorías, permisos compartidos, dashboard y distribución de categorías. Usan respuestas HTTP simuladas: no certifican integración con Rails ni necesitan PostgreSQL.

El build usa producción por defecto y genera artefactos bajo `dist/`; aplica los budgets de tamaño declarados en `angular.json`. No hay target e2e configurado: `ng e2e` no es un procedimiento de pruebas disponible. jsdom no verifica media queries reales, apariencia en navegador ni una auditoría AXE completa. No se ejecutó ninguno de estos comandos durante esta revisión; no se afirma un resultado aprobado.

Las pruebas backend requieren otra base PostgreSQL descartable, distinta de la demostración. Su README detalla `bin/rails test`, `bin/rails test:system` (Selenium/Chrome), controles de estilo y seguridad y exclusiones conocidas. Ejecutar una selección de archivos o excluir sistema es una ejecución parcial, no una suite completa.

## Recorrido de demostración y evaluación

Con datos preparados y ambos servidores activos:

1. Entrar en `/login` con un usuario final; mostrar Inicio y perfil real.
2. Crear un gasto Personal y otro del hogar; crear una categoría privada desde el formulario. Probar coma decimal y validaciones.
3. En Mis gastos, filtrar por fechas/categoría/hogar, editar un gasto propio y eliminar otro con confirmación; recargar y comprobar filtros.
4. Cambiar de usuario cerrando sesión: comprobar que no aparecen sus gastos personales, pero sí los compartidos al elegir hogar, sin acciones sobre gastos ajenos.
5. En Dashboard, alternar Mis gastos/hogar, aplicar y limpiar fechas, comparar total/cantidad/categorías con Network y probar un período vacío.
6. En el back-office mostrar usuarios, categorías, hogares, membresías, comprobante y bienvenida, según el recorrido backend.
7. Probar carga, errores y reintento; navegar con Tab/Enter, revisar foco, menú móvil, anchos de 320–393 px y zoom al 200 %. Cerrar sesión y comprobar protección de rutas.

## Verificación documental y límites

El Paso 120.18 contrastó esta guía con rutas, componentes, servicios, pruebas, manifests, lockfile y configuración de ambos proyectos. La instalación, creación de bases/usuarios, ejecución conjunta, navegador, tests y build no se ejecutaron por el alcance documental solicitado. Quedan pendientes de comprobación práctica en el entorno aislado del evaluador, al igual que disponibilidad de repositorios y dependencias remotas. No se modificaron código ni configuraciones.
