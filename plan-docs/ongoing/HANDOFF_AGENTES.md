# Qué se le entrega a un agente

**Escrito 2026-08-30 sobre `fix/auth-screen`, cabeza `be6ebbf`.** Vive en
`plan-docs/`, gitignoreado.

Un agente no recibe "arreglá el módulo de bolsillos". Recibe **un paquete**: una
unidad de trabajo con su estado medido, sus reglas vinculantes, su límite de
archivos y su verificación. Fuera del paquete no toca nada.

Este documento define **la forma del paquete**, **el preámbulo que va en todos**, y
**los paquetes listos para repartir hoy**.

---

## 1. El preámbulo — va literal en cada prompt

> Repositorio: `C:\AA1-WEB_DEVELOPER\REACT\apps\FINTRACK\pern_fintrack`, rama
> `fix/auth-screen`. **Medí el árbol de trabajo, no el último commit ni los
> documentos**: hay archivos modificados sin commitear y varios planes están
> desactualizados respecto del código. Donde un plan y el código discrepen, el
> código manda y lo reportás.
>
> Reglas vinculantes del proyecto, todas ellas:
>
> - Cada valor de color, espaciado, radio, tamaño de fuente y peso sale de un token
>   existente. **Si un valor no tiene token, lo decís y no lo inventás.** Nunca un
>   hexadecimal ni un píxel crudo, ni en CSS ni en línea.
> - **Nunca re-derives en el cliente una bandera que el servidor sirve.** Si viene
>   en el payload, se lee.
> - **Nunca sumes importes en el cliente.** Los totales los pliega el servidor.
> - **Una ausencia no es un cero.** Una cifra retenida se dibuja como guion o
>   esqueleto, jamás como `0` ni como `NaN`.
> - **El color nunca es el único canal.** Todo estado lleva marca y palabra.
> - Todo elemento interactivo declara reposo, apuntado, foco visible con anillo de
>   2px y desplazamiento de 2px, presionado y deshabilitado.
> - Móvil primero desde 360px. Preferí consulta de contenedor sobre consulta de
>   ventana: la columna está topada y una consulta de ventana dispara cuando la
>   columna todavía es angosta.
> - Comentarios de código en inglés. Indentación de un espacio.
> - **No cambies lo que no se te pidió.** La limpieza vecina es su propio commit.
>
> Reglas de salida:
>
> - **Nunca abras una frase con un identificador pelado.** El concepto en palabras
>   primero, el identificador entre paréntesis al final.
> - Nombrá archivo, línea, función y variable exactos.
> - **No commitees.** Los commits los maneja la sesión principal.
> - Al terminar: qué cambiaste archivo por archivo, qué valores necesitaste que no
>   tienen token, y qué te quedó dudoso sin haber visto la pantalla.
> - No leas ni imprimas ningún archivo `.env` ni `plan-docs/playwright/.credentials`.

---

## 2. La forma del paquete — siete campos, ninguno opcional

1. **El objetivo, en una frase.** Qué queda distinto cuando termina.
2. **El estado medido.** Qué hay hoy, con archivo y línea, para que no lo re-derive.
   Esto es lo que más ahorra: un agente que mide de nuevo gasta la mitad del turno.
3. **Los archivos que puede tocar**, enumerados. Y **los que no**, cuando hay riesgo
   de que otro agente o la sesión principal esté encima.
4. **Las decisiones ya tomadas que lo gobiernan**, enunciadas en palabras. No el
   número de sección: la regla.
5. **Las decisiones NO tomadas que no puede tomar solo.** Si se topa con una, para y
   la reporta.
6. **La verificación.** Qué comando corre y qué tiene que dar.
7. **El límite de alcance.** Qué sería tentador arreglar de paso y no se arregla.

---

## 3. Lo que un agente NUNCA decide solo

Un agente puede medir, proponer y ejecutar. **No cierra una decisión de producto ni
enmienda un contrato congelado.** Si su tarea lo lleva a una de estas, para:

- si una cuenta cerrada retiene su nombre;
- cómo se repara el descuadre de saldos existente;
- qué cuentas pueden recibir el saldo residual de una cuenta borrada;
- si dos bolsillos pueden llamarse igual;
- si el borrado suave se retira o se promueve a operación de cierre;
- qué etiqueta neutra reemplaza a un nombre borrado en las descripciones;
- si la tarjeta del tracker se encoge o el envío se muda al pie;
- cualquier cambio al vocabulario congelado de un módulo;
- acuñar un token nuevo.

---

## 4. Paquetes listos para repartir hoy

Estos no dependen de ninguna decisión abierta. Los demás esperan.

### A — Las cuatro consultas de la ficha de cuenta

**Objetivo.** Que la ficha de una cuenta muestre el mismo saldo que las listas.

**Medido.** Las listas derivan del libro; el detalle no. Cuatro consultas dentro de
`getAccountById`, en `backend/src/fintrack_api/controllers/getAccountController.js`,
líneas 588, 669, 695 y 711, seleccionan `ua.*` sin alias posterior, así que gana la
columna almacenada. El consumidor visiblemente afectado está en la misma función,
línea 836. Las consultas de lista del mismo archivo ya lo resuelven, en las líneas
288, 303, 322, 337, 354, 378, 404 y 512.

**Puede tocar.** Ese archivo, y nada más.

**Gobierna.** El libro es la fuente del saldo; la columna almacenada es una
proyección. La derivación canónica está congelada y se importa, no se reescribe.

**No decide nada.** Es mecánico.

**Verificación.** Que el servidor arranque, y que la ficha de una cuenta con
historial muestre el mismo número que su fila en la lista.

**Límite.** Hay dos lectores más de la columna que **no se tocan**: uno detrás de una
ruta comentada y otro que ni siquiera carga porque importa una ruta inexistente. Un
borrado espera a que el módulo funcione.

### B — Las cuatro reglas de color que faltan en la tarjeta de bolsillo

**Objetivo.** Que las cinco lecturas de estado de la tarjeta pinten, no tres.

**Medido.** La adopción de cinco niveles de hoy quedó a medias: la tarjeta compone
sus clases con cinco valores de tono, y la hoja declara tres variantes de barra y
tres de porcentaje. Los dos tonos nuevos caen a la regla base.

**Puede tocar.** `frontend/src/fintrack/pages/pocket/styles/pocket-styles.css`, y
nada más. **No toca** los componentes: otra sesión está encima de ellos.

**Gobierna.** El token de información ya existe y el cuadro compartido ya lo lee.
El nivel neutro toma la tinta de la tarjeta, no un color de semáforo, porque *en
plan* no es una advertencia atenuada sino la ausencia de advertencia.

**No decide nada.** Los colores ya están elegidos.

**Verificación.** Que la construcción pase, y que las cinco lecturas se distingan a
360px sobre la superficie oscura.

**Límite.** La hoja arrastra defectos previos —una declaración inválida, un bloque
duplicado, dos `!important`, colores crudos y un bloque muerto—. **No se tocan acá.**
Son su propio commit.

### C — El comparador de prioridad de bolsillos

**Objetivo.** Que exista, exportado, la regla que ya está escrita y sin código.

**Medido.** No existe. Iría junto al ayudante de niveles, en
`frontend/src/fintrack/helpers/pocketStatus.ts`.

**Puede tocar.** Ese archivo. **No monta el comparador en ninguna pantalla**: eso es
otro paquete.

**Gobierna, y va enunciado completo en el prompt.** Se apartan los financiados, los
vencidos y los descubiertos, cada uno por su razón. Entre los que compiten gana el
que requiere el mayor aporte mensual para llegar a su meta a tiempo — cifra que el
servidor ya pliega como `daysRemaining / 30.44` con aritmética decimal, y que vale
cero cuando la meta está cubierta y nulo cuando la fecha pasó. Empate: menos días
restantes, después nombre, después identificador como desempate técnico final. Sin
candidatos, no hay próximo objetivo.

**No decide nada.** La regla está congelada.

**Verificación.** Verificación de tipos en cero. El comparador es puro y no consulta.

**Límite.** No re-deriva las banderas servidas y no suma importes.

### D — La palabra de dirección del presupuesto, desde la bandera servida

**Objetivo.** Que la palabra *over* o *left* venga de la bandera del servidor y no
del signo del restante.

**Medido.** El ayudante decide del signo en
`frontend/src/fintrack/helpers/budgetStatus.ts`, líneas 96 a 98, y su firma nunca
recibe la bandera. Cinco llamadores. Cuatro ya tienen la bandera a mano; el quinto
es el encabezado del tablero y **espera un cambio de contrato**.

**Puede tocar.** El ayudante y los cuatro llamadores que ya tienen la bandera. **No
toca el encabezado del tablero.**

**Gobierna.** Nada en pantalla re-deriva una bandera que viene en el payload. Y la
guarda del caso sin presupuesto se conserva: cuando no hubo presupuesto ni gasto no
se imprime palabra, ni cuadro, ni porcentaje.

**No decide nada.**

**Verificación.** Verificación de tipos en cero, y que una fila excedida y una
holgada sigan diciendo lo mismo que hoy.

**Límite.** El modal imprime la palabra sin la guarda: **eso entra acá**, porque es
la misma expresión. El encabezado sobre el neto **no**.

### E — Los cuatro arreglos de una línea de deudas

**Objetivo.** Cuatro defectos independientes, ninguno con dependencias.

**Medido.** La ventana del extracto se compone con el reloj del navegador y se
redondea por UTC, así que al este de UTC pierde el último día del mes; el ayudante
que lo resuelve ya existe. Un importe se formatea a mano con símbolo y `toFixed`, y
es el único camino del módulo a un `NaN` visible. Las filas se indexan por posición
sobre una lista reordenada, teniendo identificador único servido. Y una clase se
escribió con punto inicial, así que no casa con ninguna regla.

**Puede tocar.** Los cuatro archivos que los contienen.

**Gobierna.** Una fecha es un instante y un plazo es una etiqueta; no se convierten
uno en otro por ida y vuelta a UTC.

**No decide nada.**

**Verificación.** Verificación de tipos en cero.

**Límite.** El titular sobre el neto y el conteo de saldados **no entran**: el
primero es decisión de producto y el segundo depende de una decisión abierta.

---

## 5. Los que no se reparten todavía, y por qué

| unidad | qué la traba |
|---|---|
| El escritor único de saldo | va después del paquete A, o se verifica contra una pantalla que lee otro número |
| El motor de borrado | dos decisiones abiertas: cómo se repara el descuadre y qué cuentas reciben el residual |
| Las cinco pantallas de unicidad | dos pueden ir ya; la del editor espera la decisión del nombre de una cuenta cerrada |
| La maqueta del tracker | el alto de la tarjeta no tiene origen nombrado; cualquier cambio se escribe contra una suposición |
| El conteo de saldados de deudas | necesita una bandera que la consulta de lista no sirve, y la misma decisión de cuentas cerradas |
| Cualquier código de Overview | el catálogo y el contrato están escritos contra el modelo retirado y hay que reescribirlos primero |
| La barra de herramientas de bolsillos | el comparador primero, aunque los otros tres órdenes y los cinco filtros son independientes |

---

## 6. Cómo se reparten

**En paralelo solo lo que no comparte archivo.** Hoy chocarían: cualquier par que
toque la hoja del tablero de bolsillos, y cualquier par que toque el controlador de
cuentas. El paquete B y el C pueden ir juntos; el B y cualquier cosa que toque los
componentes de bolsillo, no.

**Un agente por paquete.** Dos agentes sobre una unidad producen dos mediciones y un
conflicto.

**Y la sesión principal commitea.** Un agente que commitea deja el árbol en un estado
que el siguiente no midió.
