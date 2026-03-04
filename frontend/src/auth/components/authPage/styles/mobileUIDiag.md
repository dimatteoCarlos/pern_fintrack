(function() {
  console.log('========== DIAGNÓSTICO COMPLETO MOBILE V3 ==========');
  
  // 1. Encontrar container principal
  const container = document.querySelector('[class*="auth-container"]');
  if (!container) {
    console.error('❌ No se encontró .auth-container');
    return;
  }
  
  const containerStyle = window.getComputedStyle(container);
  const containerRect = container.getBoundingClientRect();
  
  console.log('📦 CONTAINER:');
  console.log('  - Clase:', container.className);
  console.log('  - Ancho total:', Math.round(containerRect.width), 'px');
  console.log('  - Alto total:', Math.round(containerRect.height), 'px');
  console.log('  - Posición izquierda:', Math.round(containerRect.left), 'px');
  console.log('  - Posición derecha:', Math.round(containerRect.right), 'px');
  console.log('  - ¿Ocupa todo el ancho?', containerRect.left <= 1 && containerRect.right >= window.innerWidth - 1 ? '✅ SÍ' : '❌ NO');
  console.log('  - Padding top:', containerStyle.paddingTop);
  console.log('  - Padding bottom:', containerStyle.paddingBottom);
  console.log('  - Padding left:', containerStyle.paddingLeft);
  console.log('  - Padding right:', containerStyle.paddingRight);
  console.log('  - Gap:', containerStyle.gap);
  console.log('  - Margin:', containerStyle.margin);
  console.log('  - Border:', containerStyle.borderWidth);
  
  // 1b. Verificar el elemento padre del container
  const parent = container.parentElement;
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const parentStyle = window.getComputedStyle(parent);
    console.log('\n📦 PADRE DEL CONTAINER:');
    console.log('  - Tag:', parent.tagName);
    console.log('  - Clase:', parent.className);
    console.log('  - Ancho:', Math.round(parentRect.width), 'px');
    console.log('  - Padding:', parentStyle.padding);
    console.log('  - Margin:', parentStyle.margin);
    console.log('  - Posición izquierda:', Math.round(parentRect.left), 'px');
    console.log('  - Posición derecha:', Math.round(parentRect.right), 'px');
  }
  
  // 2. Botón X
  const closeBtn = document.querySelector('[class*="closeButton"]');
  if (closeBtn) {
    const btnStyle = window.getComputedStyle(closeBtn);
    const btnRect = closeBtn.getBoundingClientRect();
    console.log('\n❌ BOTÓN X:');
    console.log('  - Clase:', closeBtn.className);
    console.log('  - Ancho:', Math.round(btnRect.width), 'px');
    console.log('  - Alto:', Math.round(btnRect.height), 'px');
    console.log('  - Posición top:', Math.round(btnRect.top), 'px');
    console.log('  - Posición right (desde borde pantalla):', Math.round(window.innerWidth - btnRect.right), 'px');
    console.log('  - Posición left:', Math.round(btnRect.left), 'px');
    console.log('  - Position:', btnStyle.position);
    console.log('  - Z-index:', btnStyle.zIndex);
    console.log('  - Background:', btnStyle.backgroundColor);
    console.log('  - ¿Está dentro del container?', 
      btnRect.left >= containerRect.left && btnRect.right <= containerRect.right ? '✅ SÍ' : '❌ NO');
  } else {
    console.log('\n❌ No se encontró closeButton');
  }
  
  // 3. Título y relación con botón X
  const title = document.querySelector('[class*="auth-container__title"]');
  if (title) {
    const titleRect = title.getBoundingClientRect();
    const titleStyle = window.getComputedStyle(title);
    console.log('\n📝 TÍTULO:');
    console.log('  - Distancia desde top de pantalla:', Math.round(titleRect.top), 'px');
    console.log('  - Distancia desde top del container:', Math.round(titleRect.top - containerRect.top), 'px');
    console.log('  - Alto del título:', Math.round(titleRect.height), 'px');
    console.log('  - Margin-top:', titleStyle.marginTop);
    console.log('  - Margin-bottom:', titleStyle.marginBottom);
    
    // Relación con botón X
    if (closeBtn) {
      const btnRect = closeBtn.getBoundingClientRect();
      console.log('  - ¿Botón X está encima del título?', btnRect.bottom <= titleRect.top ? '✅ SÍ' : '❌ NO (está debajo o encima)');
      console.log('  - Distancia vertical botón X → título:', Math.round(titleRect.top - btnRect.bottom), 'px');
      
      // NUEVO: Calcular espacio desperdiciado arriba del título
      const spaceAboveTitle = titleRect.top;
      const btnBottom = btnRect.bottom;
      const wasteSpace = spaceAboveTitle - btnBottom;
      console.log('  - Espacio sobre el título (desde top pantalla):', Math.round(spaceAboveTitle), 'px');
      console.log('  - Espacio ocupado por botón X (incluye top):', Math.round(btnBottom), 'px');
      console.log('  - Espacio desperdiciado arriba:', Math.round(wasteSpace), 'px');
      if (wasteSpace > 5) {
        console.log('  ⚠️ Se puede reducir padding-top en', Math.round(wasteSpace), 'px');
      }
    }
  }
  
  // 4. Mensaje global (si está visible)
  const messageArea = document.querySelector('[class*="messageArea"][class*="isVisible"]');
  if (messageArea) {
    const msgRect = messageArea.getBoundingClientRect();
    const msgStyle = window.getComputedStyle(messageArea);
    console.log('\n💬 MENSAJE GLOBAL:');
    console.log('  - Visible: ✅ SÍ');
    console.log('  - Alto:', Math.round(msgRect.height), 'px');
    console.log('  - Top:', Math.round(msgRect.top), 'px');
    console.log('  - Font-size:', msgStyle.fontSize);
    console.log('  - Padding:', msgStyle.padding);
    console.log('  - Margin:', msgStyle.margin);
    console.log('  - Ancho:', Math.round(msgRect.width), 'px');
    
    if (closeBtn) {
      const btnRect = closeBtn.getBoundingClientRect();
      console.log('  - ¿Tapa al botón X?', 
        msgRect.right > btnRect.left ? '⚠️ SÍ (se superponen)' : '✅ NO');
    }
  } else {
    console.log('\n💬 MENSAJE GLOBAL: No visible');
  }
  
  // 5. Último elemento visible
  const authActions = document.querySelector('[class*="auth-actions"]');
  if (authActions) {
    const actionsRect = authActions.getBoundingClientRect();
    const lastButton = authActions.lastElementChild;
    const lastButtonRect = lastButton ? lastButton.getBoundingClientRect() : null;
    
    console.log('\n🔽 ÚLTIMO ELEMENTO:');
    if (lastButtonRect) {
      console.log('  - Elemento:', lastButton.tagName, lastButton.className);
      console.log('  - Posición bottom (relativa a pantalla):', Math.round(lastButtonRect.bottom), 'px');
      console.log('  - Posición bottom (relativa a container):', Math.round(lastButtonRect.bottom - containerRect.top), 'px');
      console.log('  - Altura ventana:', window.innerHeight, 'px');
      console.log('  - ¿Es visible completamente?', 
        lastButtonRect.bottom <= window.innerHeight ? '✅ SÍ' : '❌ NO (cortado)');
      console.log('  - Espacio restante debajo:', Math.round(window.innerHeight - lastButtonRect.bottom), 'px');
      console.log('  - Distancia desde borde inferior del container:', Math.round(containerRect.bottom - lastButtonRect.bottom), 'px');
    }
  }
  
  // 6. Verificar elementos que sobresalen a la derecha
  console.log('\n📏 VERIFICACIÓN DE DESBORDES:');
  const allElements = container.querySelectorAll('*');
  let maxRight = containerRect.right;
  let offendingElement = null;
  
  allElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.right > maxRight + 1) {
      maxRight = rect.right;
      offendingElement = el;
    }
  });
  
  if (offendingElement) {
    console.log('  ⚠️ Elemento que sobresale a la derecha:');
    console.log('    - Tag:', offendingElement.tagName);
    console.log('    - Clase:', offendingElement.className);
    console.log('    - Sobresale:', Math.round(maxRight - containerRect.right), 'px');
  } else {
    console.log('  ✅ Ningún elemento sobresale a la derecha');
  }
  
  // 7. Verificar elementos que sobresalen abajo
  let maxBottom = containerRect.bottom;
  let offendingBottomElement = null;
  
  allElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > maxBottom + 1) {
      maxBottom = rect.bottom;
      offendingBottomElement = el;
    }
  });
  
  if (offendingBottomElement) {
    console.log('  ⚠️ Elemento que sobresale abajo:');
    console.log('    - Tag:', offendingBottomElement.tagName);
    console.log('    - Clase:', offendingBottomElement.className);
    console.log('    - Sobresale:', Math.round(maxBottom - containerRect.bottom), 'px');
  } else {
    console.log('  ✅ Ningún elemento sobresale abajo');
  }
  
  // 8. Altura total de componentes
  let totalHeight = 0;
  const children = container.children;
  console.log('\n📊 DESGLOSE DE ALTURAS:');
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childRect = child.getBoundingClientRect();
    const childStyle = window.getComputedStyle(child);
    console.log(`  ${i}. ${child.className.split(' ')[0].substring(0, 30)}...: ${Math.round(childRect.height)}px (margin: ${childStyle.marginTop}, ${childStyle.marginBottom})`);
    totalHeight += childRect.height;
  }
  
  // 9. Sumar paddings y gaps
  const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;
  const gap = parseFloat(containerStyle.gap) || 0;
  const gapsTotal = (children.length - 1) * gap;
  
  console.log(`\n📐 CÁLCULO DE ALTURA:`);
  console.log(`  - Suma de componentes: ${totalHeight}px`);
  console.log(`  - Padding top: ${paddingTop}px`);
  console.log(`  - Padding bottom: ${paddingBottom}px`);
  console.log(`  - Gaps (${children.length-1} × ${gap}px): ${gapsTotal}px`);
  console.log(`  - Altura calculada: ${totalHeight + paddingTop + paddingBottom + gapsTotal}px`);
  console.log(`  - Altura real container: ${containerRect.height}px`);
  
  // 10. Viewport info
  console.log('\n📱 VIEWPORT:');
  console.log('  - Ancho:', window.innerWidth, 'px');
  console.log('  - Alto:', window.innerHeight, 'px');
  console.log('  - Relación container/ventana:', Math.round((containerRect.height / window.innerHeight) * 100), '%');
  
  // 11. Resumen de problemas
  console.log('\n🔍 RESUMEN DE PROBLEMAS:');
  const problems = [];
  
  if (containerRect.left > 5) problems.push(`❌ Container no pegado a borde izquierdo (${Math.round(containerRect.left)}px)`);
  if (containerRect.right < window.innerWidth - 5) problems.push(`❌ Container no pegado a borde derecho (falta ${Math.round(window.innerWidth - containerRect.right)}px)`);
  if (containerRect.right > window.innerWidth + 5) problems.push(`❌ Container se sale por derecha (${Math.round(containerRect.right - window.innerWidth)}px)`);
  if (containerRect.height > window.innerHeight) problems.push(`❌ Container más alto que la pantalla (${Math.round(containerRect.height - window.innerHeight)}px exceso)`);
  
  if (closeBtn) {
    const btnRect = closeBtn.getBoundingClientRect();
    const btnRight = window.innerWidth - btnRect.right;
    if (btnRight < 8) problems.push(`⚠️ Botón X muy pegado al borde (${btnRight}px)`);
    if (btnRight > 20) problems.push(`⚠️ Botón X muy separado del borde (${btnRight}px)`);
    
    if (title) {
      const titleRect = title.getBoundingClientRect();
      if (btnRect.bottom > titleRect.top) {
        problems.push(`❌ Botón X está encima del título (se superponen)`);
      }
    }
  }
  
  if (offendingElement) {
    problems.push(`❌ Hay elementos que sobresalen por derecha`);
  }
  
  if (offendingBottomElement) {
    problems.push(`❌ Hay elementos que sobresalen por abajo`);
  }
  
  // NUEVO: Calcular espacio total recuperable para evitar scroll
  const totalExcess = containerRect.height - window.innerHeight;
  if (totalExcess > 0) {
    problems.push(`📉 Exceso total: ${Math.round(totalExcess)}px. Se puede recuperar reduciendo:`);
    // Aquí podríamos sugerir reducciones, pero ya lo hacemos arriba
  }
  
  if (problems.length === 0) {
    console.log('✅ Todo correcto (según este diagnóstico)');
  } else {
    problems.forEach(p => console.log(p));
  }
  
  console.log('========== FIN DIAGNÓSTICO V3 ==========');
})();