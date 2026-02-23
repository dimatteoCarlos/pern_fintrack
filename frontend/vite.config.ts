//ORIGINAL-----------------

// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
//-------------------------------
//modificado
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  // …
  plugins: [
    react(),
    svgr({
      // exportAsDefault: true,
      // svgr options: https://react-svgr.com/docs/options/
      svgrOptions: {
        exportType: 'default',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
  ],
});


/*
No es estrictamente obligatorio usar el plugin, pero es la forma más eficiente de trabajar con SVGs en React si necesitas control total sobre ellos. 
Medium
Medium
 +1
Vite, por defecto, trata los archivos .svg como activos estáticos (como una imagen .jpg o .png). Sin el plugin, solo puedes usarlos así:
javascript
import logo from './logo.svg'
// ...
<img src={logo} alt="Logo" />
Use code with caution.

¿Por qué se usa vite-plugin-svgr?
Usar el plugin transforma el SVG en un componente de React real, lo que te permite: 
DEV Community
DEV Community
 +2
Cambiar colores con CSS: Puedes usar fill="currentColor" en tu SVG y cambiar su color desde el padre con la propiedad color.
Pasar Props: Puedes enviarle className, style, onClick o cualquier otra prop directamente al componente <Logo />.
Animaciones: Al ser parte del DOM de React (y no estar "encerrado" en una etiqueta <img>), puedes animar partes internas del SVG con CSS o librerías como Framer Motion.
Menos peticiones HTTP: El código del SVG se incluye directamente en tu bundle de JavaScript, lo que puede ser más rápido para iconos pequeños. 
DEV Community
DEV Community
 +3
¿Cuándo NO usarlo?
Si tu SVG es una ilustración muy compleja o pesada, es mejor usar la etiqueta <img> tradicional. Esto permite que el navegador descargue la imagen por separado y la guarde en caché, evitando que tu archivo de JavaScript crezca demasiado y ralentice la carga inicial de la app. 
Reddit
Reddit
 +3
Resumen de opciones sin plugin: 
LogRocket Blog
LogRocket Blog
 +1
Como imagen: import logo from './logo.svg' → <img src={logo} />.
En línea (Manual): Copiar el código <svg>...</svg> directamente dentro de un archivo .jsx. Es tedioso si tienes muchos iconos, pero no requiere plugins.




*/
