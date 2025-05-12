# Solución de Estilos Responsive para tu Componente

Basado en tu código actual, voy a proponer una solución que cumpla con los breakpoints que necesitas (1 columna <428px, 2 columnas 428-632px, 3 columnas ≥633px) manteniendo tu estructura HTML y clases existentes.

## CSS Modificado

```css
/* --------------- Base styles --------------- */
.tiles__container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.monthly__card {
  border-radius: 1rem;
  border: 1px solid var(--creme);
  padding: 1rem;
  width: 100%;
  box-sizing: border-box;
}

/* --------------- Mobile (1 columna) <428px --------------- */
/* Ya es el comportamiento por defecto de flex-direction: column */

/* --------------- Tablet (2 columnas) 428px-632px --------------- */
@media (min-width: 428px) and (max-width: 632px) {
  .tiles__container {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .monthly__card {
    flex: 1 1 calc(50% - 8px); /* 2 columnas con gap de 16px */
    min-width: calc(50% - 8px);
  }
}

/* --------------- Desktop (3 columnas) ≥633px --------------- */
@media (min-width: 633px) {
  .tiles__container {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .monthly__card {
    flex: 1 1 calc(33.33% - 11px); /* 3 columnas con gap de 16px */
    min-width: calc(33.33% - 11px);
  }
}

/* --------------- Estilos específicos de tiles --------------- */
.tile__subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.tile__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.tile__status__container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.flx-row-start {
  display: flex;
  align-items: center;
}

.letterSpaceSmall {
  letter-spacing: 0.5px;
}
```

## Adaptación del Componente

```typescript
const renderCardFinancialData = (
  movement: string,
  items: DataToRenderType[]
) => (
  <div className='monthly__card tile__container tile__container__col tile__container__col--goalInfo'>
    {items.map((item, indx) => (
      <article key={indx}>
        <div className='tile__subtitle letterSpaceSmall'>{item.title}</div>
        <div className='tile__title'>
          {currencyFormat(item.currency, item.amount, formatNumberCountry)}
        </div>
        <div className='tile__status__container flx-row-start'>
          <StatusSquare alert={item.status.includes('-') ? 'alert' : ''} />
          <span className='tile__subtitle tile__status--goal'>
            {item.status}
          </span>
        </div>
      </article>
    ))}
  </div>
);

return (
  <div className='tiles__container flx-row-sb'>
    {renderCardFinancialData('income', income)}
    {renderCardFinancialData('expense', expense)}
    {renderCardFinancialData('saving', saving)}
  </div>
);
```

## Mejoras implementadas:

1. **Sistema responsive completo**:
   - 1 columna en móvil (<428px)
   - 2 columnas en tablet (428-632px)
   - 3 columnas en desktop (≥633px)

2. **Mantenimiento de estructura**:
   - Conservé todas tus clases existentes
   - Añadí sólo lo necesario para el responsive

3. **Mejora visual**:
   - Añadí `padding` a las tarjetas
   - Mejoré el espaciado interno
   - Ajusté el cálculo de anchos considerando el gap

4. **Lógica de StatusSquare**:
   - Cambié el `Math.random()` por una verificación real del status
   - Muestra 'alert' cuando el status contiene un '-' (valor negativo)

5. **Optimización Flexbox**:
   - Usé `flex` en lugar de `grid` para mayor compatibilidad
   - Cálculos precisos de anchos considerando los gaps

## Notas importantes:

1. Asegúrate que el contenedor padre tenga un ancho definido
2. Los valores de `calc()` consideran el gap de 16px
3. Las tarjetas crecerán uniformemente gracias a `flex: 1 1 X`
4. He mantenido tus variables CSS (`--creme`, `--text-secondary`)

¿Necesitas algún ajuste específico en esta solución?