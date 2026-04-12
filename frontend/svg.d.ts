// src/svg.d.ts
/* Esto le dice a TypeScript:
"Cuando veas una importación de archivo .svg, asume que es un componente de React y permite que se pase como prop."
*/
declare module '*.svg' {
  import * as React from "react";

// Para usar como componente: import { ReactComponent as Logo } from './logo.svg'

 export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;

  // Para usar como string: import logoUrl from './logo.svg'
  const src: string;
  export default src;

  // export default ReactComponent;
}