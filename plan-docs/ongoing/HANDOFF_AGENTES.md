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

### F — El corredor de migraciones y las seis que producción no tiene

**Objetivo.** Que la cadena se pueda aplicar sin dejar una base a medias, y que
las seis migraciones que esta rama agregó puedan llegar a producción.

**Lo que ya está medido y escrito, y no hay que volver a medir.** El plan de
retro-fechado, sección 9.4.24, tiene el terreno levantado el 2026-09-01: la copia
de producción se construyó por el DDL de arranque y nunca por el corredor, su
libro de migraciones estaba vacío, y la cadena se detiene en el segundo archivo
porque `002_accounts.sql` le cuelga un disparador `BEFORE INSERT OR UPDATE OF
timezone ON users` a una tabla que ya existe sin esa columna. Ahí también está
verificada la migración 024 contra la forma de producción, en los dos órdenes en
que puede encontrarla.

**Lo medido el 2026-09-02, que es lo que agrega este paquete.**

*1. La ficción de la transacción cubre la corrida entera, no siete archivos.*
La sección 9.4.24 cerraba diciendo que las migraciones de tipo de cambio son
atómicas porque no traen sentencias de transacción propias. Es al revés: no traer
`BEGIN;` es justamente lo que las deja sin transacción, porque para cuando les
toca ya no hay ninguna abierta. `runMigrations.js:35` abre la suya y el `COMMIT;`
de `001_initial_migration.sql:47` se la lleva. Reproducida la forma exacta del
corredor contra la base de desarrollo: después de un archivo que trae su propio
`COMMIT;`, `txid_current_if_assigned()` devuelve nulo, y una tabla creada después
de ese punto sobrevivió al `ROLLBACK` de la línea 81.

**La unidad atómica es el archivo, no la sentencia.** Una primera redacción de
esta corrección decía que cada sentencia de 008 a 024 se confirma sola. No es
así: el corredor manda el archivo entero como un solo `client.query(sql)`, y
Postgres envuelve una consulta simple de varias sentencias en una transacción
implícita. Medido con `CREATE TEMP TABLE ...; SELECT 1/0;` después de que la
transacción del corredor ya había sido confirmada: la tabla no sobrevivió. Un
archivo que falla a mitad se revierte entero. **Lo que queda fuera de esa unidad
es el libro**: `runMigrations.js:71` escribe la fila `INSERT INTO migrations` en
una transacción aparte de la del archivo que nombra, así que un corte entre las
dos deja el archivo aplicado sin fila que lo nombre y la corrida siguiente lo
repite. El defecto existe; la ventana está entre el archivo y su fila, no dentro
del archivo. Las dos correcciones quedaron escritas en la propia 9.4.24.

*2. La salida exitosa después de una falla.*
El `catch` sale con código 1 en `runMigrations.js:83` y el `finally` sale con
código 0 en la 86. Hoy el código de salida es correcto por un accidente del
lenguaje: probado, `process.exit` no ejecuta el `finally`. El día que alguien
saque ese `exit` del `catch` para liberar el cliente como corresponde, toda falla
pasa a reportarse como éxito y el paso de despliegue la lee como buena. Quien
arregle el punto 1 se va a topar con esto en la misma función.

*3. Una columna de la cadena que el camino de arranque no declara.*
`022_add_transaction_opening_for_account.sql:65-66` agrega
`transactions.opening_for_account_id`.
`backend/src/db/run_time_db_init/createTables.js` no la declara en ninguna parte,
y ese no es sólo el camino por el que producción construyó: `initializeDatabase()`
lo invoca en **cada arranque del servidor** desde `backend/src/index.js:37`, no
sólo desde el script de inicialización. `recordTransaction.js:100` la
inserta y `derivedBalance.js:154`, `:212` y `:237` la leen en los tres
constructores de saldo, así que una base levantada por ese camino falla en cada
inserción de transacción y en cada derivación de saldo. La 019 y la 024 sí están
en los dos lados — `createTables.js:133` y `:835` — lo que muestra que la paridad
se cuida a veces y a veces no. Es el riesgo que el encabezado de la propia 019
anuncia: la tabla está definida dos veces y producción construye por la otra.

*4. Dos documentos que no dicen lo mismo sobre el estado de producción, y nadie
lo ha resuelto.* El encabezado de
`backend/src/db/migrations/supabase/001_production_alignment.sql` dice que su paso
9 escribió diecisiete filas en el libro y que el archivo se aplicó a Supabase el
2026-08-22, más la 018 el 2026-08-27. La sección 9.4.24 midió `fintrack_prod_data`
el 2026-09-01 y encontró el libro vacío. Las dos cosas se concilian si
`fintrack_prod_data` es una restauración local anterior al 22 de agosto y no la
base viva — el propio archivo de alineación dice que el volcado es del 2026-08-21
23:04 — pero **eso no está medido**. De cuál de las dos sea la verdad depende si
lo pendiente son seis migraciones o veinticuatro. **Se mide antes de tocar nada.**

*5. Una fila del libro que nombra un archivo inexistente.*
`fintrack_dev` registra `012_backfill_budget_policies.sql` el 2026-08-08. El
repositorio tiene `012_backfill_budget_allocations.sql`, registrado el 2026-08-14.
Nadie puede decir qué esquema produjo la primera.

*6. Ninguna migración de la cadena declara su reverso*, contra lo que pide el
documento de reglas del proyecto. Sólo el archivo de alineación marca `-- UP`. Lo
más cercano a un reverso son tres líneas comentadas en
`020_create_pocket_tables.sql:425-427`.

**Puede tocar.** `runMigrations.js`, `createTables.js`, y archivos SQL nuevos.

**No toca.** Ningún `sql_migrations/*.sql` ya aplicado — no hay migraciones
correctivas. Tampoco `supabase/001_production_alignment.sql`, que ya se aplicó.
Tampoco `.env`, que comparten tres sesiones y que no debe apuntar nunca a
`fintrack_prod_data` ni a Supabase. Nada se ejecuta contra Supabase.

**Gobierna.**

- Una migración sale bien la primera vez. Romper una base local es un costo
  aceptado; romper la cadena no lo es.
- Lo que una migración le agrega a una tabla entra a `createTables.js` en el mismo
  commit, o producción nunca lo recibe.
- Cada migración declara su avance y su reverso explícitamente.
- La transacción la maneja el corredor o la maneja el archivo, nunca los dos.

**Decisiones ya tomadas, con su razón.** Van tomadas para que el agente no las
devuelva; si alguna se quiere distinta, se dice antes de repartir el paquete.

- **Una transacción por archivo, y la abre el corredor.** El corredor envuelve
  cada archivo por separado: abre antes del archivo y confirma después de escribir
  su fila del libro, de modo que el esquema y el registro se confirman juntos —
  que es justamente el invariante que hoy se rompe. A los siete archivos que traen
  su propio `BEGIN;`/`COMMIT;` se les quitan. La alternativa, dejar que cada
  archivo maneje lo suyo y que el corredor no abra nada, deja la fila del libro
  fuera de la transacción del archivo y reproduce el mismo defecto en chico.
- **La columna que falta entra por `createTables.js`, sin migración nueva.** Ese
  archivo construye bases vacías; agregarle una columna no toca ninguna base que
  ya tenga datos, así que no hay nada que migrar.
- **La regla del reverso rige desde la 025 en adelante.** Ninguna de las
  veinticuatro ya aplicadas se retrofitea: un `DOWN` escrito hoy para una
  migración que ya corrió es un reverso que nadie va a ejecutar y que nadie puede
  probar, y escribirlo obligaría además a tocar archivos que el límite de alcance
  declara intocables. La regla se hace exigible en el corredor, no en el pasado.
- **La fila fantasma del libro se deja como está.** Corregirla es reescribir
  historia sobre una base de desarrollo que igual se reconstruye, y en producción
  esa fila no existe.

**Lo que no decide solo.** Si al terminar el arreglo del corredor se aplica o no
la cadena a producción. Eso es una operación sobre datos vivos, va con su propio
ensayo contra una copia restaurada, y la autoriza el desarrollador.

**Verificación.**

- Contra una base descartable construida desde vacío, la cadena entera corre y el
  libro queda con veinticuatro filas y ninguna más.
- Con una falla forzada en medio de un archivo, ni su DDL ni su fila del libro
  sobreviven, y una segunda corrida arranca desde ese archivo. **Esta prueba sola
  no demuestra el arreglo**: hoy ya pasa para 008-024, porque el archivo es
  atómico por sí mismo. La que sí lo demuestra es cortar el proceso entre el
  archivo y su fila del libro, y comprobar que el esquema del archivo tampoco
  sobrevivió.
- Una base levantada sólo por `createTables.js` acepta una inserción de
  transacción y deriva un saldo.
- El servidor arranca en el puerto 5078. **Nunca el 5000**, que lo usa el
  desarrollador.

**Límite de alcance.** No se reescribe ninguna migración ya aplicada, no se toca
el archivo de alineación de producción, y no se aplica nada a producción en este
paquete: esto deja la cadena en condiciones de aplicarse, y aplicarla es la
decisión aparte de arriba.

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
