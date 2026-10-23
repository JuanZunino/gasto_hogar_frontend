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
