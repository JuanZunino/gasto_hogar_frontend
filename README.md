# GastoHogarFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Filtros del listado de gastos

En `/gastos`, los filtros desde/hasta (ISO `YYYY-MM-DD`), categoría y hogar se aplican
con **Aplicar filtros**. Solo los valores seleccionados se envían a
`GET /api/v1/expenses` como `from`, `to`, `category_id` y `household_id`.
Los cambios del formulario no alteran el listado hasta aplicarlos. Se reutilizan
`GET /api/v1/categories` y `GET /api/v1/households` para las opciones.

Los filtros aplicados se guardan en los query params: admiten recarga del navegador,
enlaces y navegación atrás/adelante. Un rango invertido o una fecha inválida en la
URL bloquean la consulta; se pueden corregir o usar **Limpiar filtros** para volver
al listado completo. Eliminar un gasto conserva los filtros y actualiza localmente
el listado, siguiendo el comportamiento existente.

**Limitación del contrato:** “Todas” en hogar incluye gastos personales y de hogares.
Solo se ofrecen los hogares devueltos por la API. No hay una opción “Solo personales”:
el contrato no define un valor de `household_id` para eso. Nunca se envían `null`,
`personal` ni valores vacíos para simular ese filtro, ni se filtran parcialmente
los resultados en el cliente. Si un ID de la URL no está entre las opciones, se
muestra explícitamente con su número y sin datos disponibles; la API valida su acceso.

Prueba manual (con Rails y sesión iniciada):

1. Abrir `/gastos`, combinar fechas, categoría y hogar, y aplicar. Revisar los parámetros en Network.
2. Recargar el navegador y usar atrás/adelante: comprobar los controles y los resultados.
3. Invertir las fechas: comprobar el mensaje y que no salga ninguna petición de gastos.
4. Aplicar una combinación sin coincidencias y luego limpiar: comprobar los dos mensajes de vacío y la consulta sin parámetros.
5. Eliminar un gasto filtrado: comprobar confirmación, mensaje de éxito y filtros conservados. Verificar también crear y editar.
6. Simular errores de gastos y de opciones; probar sus reintentos. Comprobar teclado, foco visible, etiquetas y pantalla estrecha.

Verificación automatizada: `npm test -- --watch=false`,
`npm run build -- --configuration production` y `git diff --check`.

## Dashboard de gastos

La ruta protegida `/dashboard` carga de forma diferida y consulta únicamente
`GET /api/v1/dashboard` con el Bearer token del interceptor existente. Se accede
desde Inicio o Mis gastos y permite volver a `/gastos`. Todos los datos mostrados
provienen de la API para la sesión autenticada; no hay datos de ejemplo en la pantalla.

Los filtros opcionales Desde/Hasta se envían como `from` y `to` en formato ISO
`YYYY-MM-DD` al aplicar. Se guardan en la URL para recargar o navegar atrás/adelante.
Las fechas inválidas y los rangos invertidos bloquean la consulta. Limpiar filtros
consulta el resumen completo sin parámetros. No se envían `category_id` ni
`household_id`, ya que el endpoint no los admite. El reintento usa el período
aplicado, aunque haya cambios sin aplicar en el formulario.

Los totales se conservan como strings decimales y se muestran con `ArsAmountPipe`.
El gráfico HTML/CSS mantiene nombres y valores visibles y usa barras decorativas
ocultas a lectores de pantalla. Sus longitudes comparan cada categoría con la mayor:
se calculan con centavos `BigInt` y solo el porcentaje visual se convierte a `Number`.
Una proporción muy pequeña puede redondearse visualmente a cero; su importe exacto
permanece legible. Se contemplan carga, ausencia de gastos, errores de API y reintento.

Prueba manual (con Rails y una sesión real):

1. Desde Inicio, abrir Ver resumen de gastos. Comparar total, cantidad y categorías con la respuesta de `/api/v1/dashboard` en Network.
2. Aplicar un período, uno solo de los límites y ambos límites iguales. Verificar `from`/`to`, recargar y usar atrás/adelante.
3. Invertir las fechas o abrir una URL con una fecha inválida: comprobar el error y que no se consulta la API. Corregir y aplicar, o limpiar.
4. Probar un período sin gastos y limpiar: comprobar los ceros y el mensaje correspondiente.
5. Simular un error HTTP o desconexión y reintentar. Verificar que conserve el período aplicado.
6. Recorrer controles y enlaces con Tab/Enter, comprobar foco visible y probar una pantalla de 320 px y zoom al 200 %; nombres e importes deben seguir siendo legibles.
7. Volver a Mis gastos y probar filtros, crear, editar y eliminar; volver a Inicio, cerrar sesión y comprobar que `/dashboard` redirige al login.

## Estructura visual y navegación — etapa 1

`AppLayout` envuelve el outlet sin recrearlo al cambiar entre login y pantallas
protegidas. Las rutas existentes indican `authenticatedLayout` en sus datos y
mantienen sus guards y carga diferida. Login se muestra sin sidebar ni encabezado
autenticado. La navegación compartida incluye únicamente Inicio, Dashboard y Mis
gastos; este último permanece activo también en alta y edición.

Los estilos globales definen colores, tipografía, controles, tarjetas y foco.
Los íconos son SVG locales decorativos, acompañados por etiquetas de texto. No se
agregaron dependencias, pantallas ni cambios a los gráficos o a la lógica de formularios.

El encabezado lee la señal de usuario de `AuthService`, actualizada por las respuestas
ya existentes de login y perfil. No consulta el perfil por su cuenta. Si se recarga
directamente en gastos/dashboard, el nombre se omite hasta disponer del usuario real.
Cerrar sesión se centraliza en el mismo servicio: elimina token y usuario en memoria
y navega a login.

En escritorio la sidebar permanece visible. Hasta 48rem se usa un menú desplegable
en el flujo del documento, sin superponer ni bloquear el contenido. El botón informa
su estado con `aria-expanded` y `aria-controls`; se cierra con el mismo botón,
Escape o al navegar. Escape devuelve el foco al botón. Los enlaces indican la página
activa con `aria-current`, y existe un enlace para saltar al contenido principal.

Verificación manual de navegación:

1. En escritorio, iniciar sesión y recorrer Inicio, Dashboard y Mis gastos desde la sidebar. Comprobar una sola navegación compartida y un único título de pantalla, con la ruta activa destacada.
2. Abrir alta y edición: Mis gastos debe seguir activo. Comprobar filtros, mensajes, carga y acciones del CRUD y dashboard.
3. Reducir a 320–390 px: abrir y cerrar el menú, seguir sus enlaces y comprobar que el contenido se adapta sin desplazamiento horizontal. Probar también zoom al 200 %.
4. Usar Tab/Enter para navegar. Abrir el menú móvil, mover el foco a un enlace y pulsar Escape: debe cerrarse y devolver el foco al botón. Probar Saltar al contenido.
5. Confirmar que aparece el nombre real recibido por login/perfil, y que navegar no agrega consultas de perfil. Una recarga directa de dashboard/gastos puede no mostrar el nombre; no debe mostrar datos inventados.
6. Cerrar sesión desde distintas pantallas. Confirmar login sin sidebar y que las rutas protegidas requieren volver a autenticarse.

Los tests del layout montan la aplicación completa y cubren navegación, ruta activa,
logout, estado del menú, Escape y foco, salto al contenido y reutilización del usuario.
La comprobación de breakpoints y apariencia requiere un navegador; jsdom no reproduce
las media queries de viewport.
