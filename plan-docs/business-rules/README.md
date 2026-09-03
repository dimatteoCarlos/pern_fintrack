# Inventario de reglas de negocio

**Vive en `plan-docs/business-rules/`, que el `.gitignore:124` re-incluye: este
archivo sí se versiona.**

Documento de autoridad, no código. **No se extrae nada, no se crea ningún motor
de reglas.** El objetivo es que una regla implementada en más de un sitio se
vuelva visible, y para eso alcanza con inventariar.

Abierto el 2026-08-31 a pedido del desarrollador.

---

## Por qué existe

Las reglas están, y están **repartidas entre helpers, resolvers, controladores y
componentes**. Cada una vive pegada a lo que la calcula, con un comentario que
explica por qué — y esa costumbre es correcta: un umbral lejos de su cálculo se
desincroniza.

Lo que no existe es **el índice**. Nadie puede contestar "¿cuántas reglas de
fecha hay y dónde vive cada una?" sin leer las dos pilas enteras.

Y es el problema que Overview va a sufrir multiplicado, porque consolida cinco
dominios y cada uno tiene sus umbrales en su propia esquina.

---

## La columna que importa

| columna | qué contesta |
|---|---|
| **Regla** | qué se decide, en palabras, sin identificadores |
| **Valor** | el umbral, la constante o la condición |
| **Fuente de verdad** | **el único sitio donde se decide.** Si hay más de uno, la regla está duplicada y eso es un hallazgo |
| **Consumidores** | quién la lee. Un consumidor que la RECALCULA no es un consumidor: es una segunda fuente |

**Fuente de verdad es la columna que justifica el documento.** Las otras tres
son contexto.

---

## Cómo se clasifica una regla

Cuatro clases, y la distinción no es académica: decide quién puede cambiarla.

**Hecho servido.** El servidor lo decide y el cliente **no puede derivarlo**.
Alcanzado, vencido, sin respaldo, el ritmo mensual. Un componente que lo
recalcula introduce una segunda fuente que se desincroniza en silencio.

**Umbral de presentación.** El cliente lo decide **porque el modelo no tiene de
dónde leerlo**. Los treinta días de riesgo son eso: no hay columna en la base
que diga cuándo un pocket empieza a preocupar.

**Lectura derivada.** El cliente la calcula a partir de hechos servidos, sin
inventar ninguno. El nivel de un pocket, o cuántos llegaron exacto al objetivo.

**Vocabulario congelado.** Qué palabra nombra qué cosa. No es estilo: dos
palabras para un concepto son dos conceptos para quien lee la pantalla.

---

## Estado del inventario

| dominio | archivo | estado |
|---|---|---|
| Bolsillos | [POCKET.md](POCKET.md) | **completo y medido** el 2026-08-31 |
| Fechas y apertura de cuentas | pendiente | las reglas están medidas en el plan de fechado hacia atrás, sin volcar aquí |
| Tasas de cambio | pendiente | otra sesión trabaja ese frente; inventariar después de que cierre |
| Presupuesto | pendiente | |
| Deudas | pendiente | |
| Overview | **no aplica todavía** | no produce dato propio: consolida el de los demás, así que sus reglas son las de ellos más las políticas de consolidación, que aún no están decididas |

**Un dominio se inventaría cuando se puede medir entero.** Media tabla es peor
que ninguna: da la impresión de que lo que falta no existe.
