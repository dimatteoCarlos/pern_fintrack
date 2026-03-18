// =============================================
// 📏 TRANSFER HEIGHT MEASURER - CORREGIDO
// =============================================
// Copia y pega esto en la consola del navegador
// cuando estés en la página Transfer

(function measureTransferRealHeight() {
  console.clear();
  console.log('%c📐 TRANSFER - MEDICIÓN REAL', 'font-size:16px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');

  // 1. Obtener elementos principales
  const form = document.querySelector('form.transfer');
  const viewportHeight = window.innerHeight;
  
  if (!form) {
    console.error('❌ No se encontró el formulario .transfer');
    return;
  }

  // 2. Medir alturas reales
  const formRect = form.getBoundingClientRect();
  const formScrollHeight = form.scrollHeight;
  const formOffsetHeight = form.offsetHeight;
  
  // 3. Verificar si hay scroll necesario
  const needsScroll = formScrollHeight > viewportHeight;
  const overflowAmount = Math.max(0, formScrollHeight - viewportHeight);
  
  console.log('📊 DATOS DEL VIEWPORT:');
  console.log(`   Viewport height: ${viewportHeight}px`);
  console.log(`   Viewport width: ${window.innerWidth}px`);
  console.log('');
  
  console.log('📊 DATOS DEL FORMULARIO:');
  console.log(`   Altura visible (offsetHeight): ${formOffsetHeight}px`);
  console.log(`   Altura total con scroll (scrollHeight): ${formScrollHeight}px`);
  console.log(`   Posición superior (top): ${formRect.top}px`);
  console.log(`   Posición inferior (bottom): ${formRect.bottom}px`);
  console.log('');
  
  console.log('📊 ANÁLISIS DE ESPACIO:');
  console.log(`   ¿Necesita scroll? ${needsScroll ? 'SÍ' : 'NO'}`);
  
  if (needsScroll) {
    console.log(`   ⚠️ Exceso de altura: ${overflowAmount}px`);
    console.log(`   Porcentaje extra: ${Math.round(overflowAmount / viewportHeight * 100)}%`);
  } else {
    const freeSpace = viewportHeight - formScrollHeight;
    console.log(`   ✅ Espacio libre: ${freeSpace}px`);
  }
  
  console.log('');
  
  // 4. Medir elementos específicos que causan problemas
  console.log('📊 ELEMENTOS QUE OCUPAN MÁS ESPACIO:');
  
  const elements = [
    { selector: '.state__card--top', name: 'Top Card' },
    { selector: '.state__card--bottom', name: 'Bottom Card' },
    { selector: '.separator__container', name: 'Separator' },
    { selector: '.card__screen.description', name: 'Note Container' },
    { selector: 'button[type="submit"]', name: 'Save Button' },
  ];
  
  elements.forEach(({ selector, name }) => {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      console.log(`   ${name}: ${rect.height}px (top: ${rect.top}px, bottom: ${rect.bottom}px)`);
    }
  });
  
  console.log('');
  
  // 5. Detectar elementos que podrían estar ocultos
  console.log('📊 ELEMENTOS DE NAVEGACIÓN (superpuestos):');
  
  const navElements = [
    { selector: '.home__header', name: 'Header' },
    { selector: '.mainNavbar__container', name: 'Navbar' },
  ];
  
  navElements.forEach(({ selector, name }) => {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      console.log(`   ${name}: ${rect.height}px (position: ${styles.position})`);
    }
  });
  
  console.log('');
  
  // 6. Verificar elementos que no son visibles
  console.log('📊 ELEMENTOS QUE PUEDEN NO SER VISIBLES:');
  
  const checkVisibility = (selector, name) => {
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const styles = getComputedStyle(el);
      const isVisible = rect.height > 0 && 
                       styles.display !== 'none' && 
                       styles.visibility !== 'hidden' &&
                       styles.opacity !== '0';
      
      if (!isVisible) {
        console.log(`   ⚠️ ${name}: puede no ser visible`);
      }
    }
  };
  
  checkVisibility('.note-section', 'Note section');
  checkVisibility('.save-button-container', 'Save button container');
  
  console.log('');
  
  // 7. RESUMEN FINAL
  console.log('%c📋 RESUMEN EJECUTIVO', 'font-size:14px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');
  
  if (needsScroll) {
    console.log(`%c🔴 OPTIMIZACIÓN NECESARIA: ${overflowAmount}px de exceso`, 'color:#FF5722; font-weight:bold');
    console.log(`   Para que quepa sin scroll, reducir:`);
    console.log(`   - Note: actual ~50px → objetivo 40px (ahorra 10px)`);
    console.log(`   - Bottom Card: actual ~228px → objetivo 160px (ahorra 68px)`);
    console.log(`   - Gaps: reducir espacios entre elementos (ahorra ~30px)`);
    console.log(`   Total ahorro posible: ~108px`);
  } else {
    console.log(`%c✅ OK: El formulario cabe en la pantalla`, 'color:#4CAF50');
  }
  
  console.log('\n📌 Para copiar: selecciona todo este output y pégalo en el chat');
  console.log('==========================================');
})()

//tambien ejecuta esto en la consola.
// Ejecuta esto en la consola:
const note = document.querySelector('.input__note__description');
const styles = getComputedStyle(note);
console.log({
  height: note.offsetHeight,
  lineHeight: styles.lineHeight,
  paddingTop: styles.paddingTop,
  paddingBottom: styles.paddingBottom,
  scrollHeight: note.scrollHeight, // Altura total del contenido
  clientHeight: note.clientHeight, // Altura visible
  value: note.value,
  lines: note.value.split('\n').length
});