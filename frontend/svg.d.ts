// src/svg.d.ts
/* Esto le dice a TypeScript:
"Cuando veas una importación de archivo .svg, asume que es un componente de React y permite que se pase como prop."
*/
declare module '*.svg' {
  import { ReactComponent as ReactSVG } from 'react';
  const content: ReactSVG;
  export default content;
}