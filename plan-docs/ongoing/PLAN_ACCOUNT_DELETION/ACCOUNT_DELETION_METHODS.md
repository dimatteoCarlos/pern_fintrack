# Deletion methods — movido

**Este archivo ya no describe los métodos de borrado. Su contenido estaba
equivocado y fue reemplazado el 2026-09-07.**

Queda como redirección y no se borra por una sola razón: un comentario de
`accountDeleteController.js` lo cita ("§5/Q8b via ACCOUNT_DELETION_METHODS.md")
y la superficie de borrado está congelada para escritura, así que esa cita no se
puede corregir todavía. Borrar el archivo la dejaría apuntando a nada.

## Dónde está ahora cada cosa

| Lo que este archivo decía | Dónde vive ahora |
|---|---|
| Cómo funcionan hoy los cuatro métodos | `ACCOUNT_DELETION_SPEC.md` §4 |
| Cómo deben funcionar | `ACCOUNT_DELETION_SPEC.md` §6 |
| Qué está planeado y no construido | `ACCOUNT_DELETION_SPEC.md` §7 |
| El detalle medido, archivo por archivo | `PLAN_ACCOUNT_DELETION.md` |

## Por qué se retiró en vez de actualizarse

Declaraba la ruta mal en sus tres métodos —`DELETE /api/fintrack/accounts/:id?type=…`
cuando la real es `/api/fintrack/account/delete/:id`— y sus anclajes de línea
estaban corridos. Un archivo de referencia con la ruta equivocada es peor que
ningún archivo: se lee como autoridad.

## Corrección pendiente, retenida por el congelamiento

En `accountDeleteController.js`, el comentario que cita este archivo debe pasar a
citar `ACCOUNT_DELETION_SPEC.md` §4. No se escribe hasta que Carlos levante el
congelamiento de la superficie de borrado.
