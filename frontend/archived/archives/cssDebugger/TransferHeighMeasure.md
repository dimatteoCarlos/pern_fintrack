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
//***********************************
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

//------------------
(function measureChipHeights() {
  console.clear();
  console.log('%c📐 CHIP HEIGHT MEASUREMENT', 'font-size:16px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');

  // Find all chip labels
  const allChips = document.querySelectorAll('.radio-input__options--chip .radio-input__label');
  
  if (allChips.length === 0) {
    console.error('❌ No chips found. Make sure you are in Transfer view and chips are visible.');
    return;
  }

  // Separate selected and unselected chips
  const selectedChips = [];
  const unselectedChips = [];

  allChips.forEach(chip => {
    const input = chip.previousElementSibling;
    if (input && input.checked) {
      selectedChips.push(chip);
    } else {
      unselectedChips.push(chip);
    }
  });

  if (selectedChips.length === 0) {
    console.error('❌ No selected chip found. Please select a chip first.');
    return;
  }

  // Measure selected chips
  console.log('%c✅ SELECTED CHIPS', 'font-weight:bold; color:#4CAF50');
  selectedChips.forEach((chip, index) => {
    const rect = chip.getBoundingClientRect();
    const styles = window.getComputedStyle(chip);
    
    console.log(`\n📌 Selected Chip ${index + 1}: "${chip.textContent.trim()}"`);
    console.log(`   Height: ${rect.height}px`);
    console.log(`   Padding-top: ${styles.paddingTop}`);
    console.log(`   Padding-bottom: ${styles.paddingBottom}`);
    console.log(`   Border-top: ${styles.borderTopWidth} ${styles.borderTopStyle}`);
    console.log(`   Border-bottom: ${styles.borderBottomWidth} ${styles.borderBottomStyle}`);
    console.log(`   Line-height: ${styles.lineHeight}`);
    console.log(`   Font-size: ${styles.fontSize}`);
  });

  // Measure unselected chips
  console.log('\n%c🔘 UNSELECTED CHIPS', 'font-weight:bold; color:#FF9800');
  unselectedChips.slice(0, 3).forEach((chip, index) => {
    const rect = chip.getBoundingClientRect();
    const styles = window.getComputedStyle(chip);
    
    console.log(`\n📌 Unselected Chip ${index + 1}: "${chip.textContent.trim()}"`);
    console.log(`   Height: ${rect.height}px`);
    console.log(`   Padding-top: ${styles.paddingTop}`);
    console.log(`   Padding-bottom: ${styles.paddingBottom}`);
    console.log(`   Border-top: ${styles.borderTopWidth} ${styles.borderTopStyle}`);
    console.log(`   Border-bottom: ${styles.borderBottomWidth} ${styles.borderBottomStyle}`);
    console.log(`   Line-height: ${styles.lineHeight}`);
    console.log(`   Font-size: ${styles.fontSize}`);
  });

  // Compare averages
  const avgSelectedHeight = selectedChips.reduce((sum, chip) => 
    sum + chip.getBoundingClientRect().height, 0) / selectedChips.length;
  
  const avgUnselectedHeight = unselectedChips.reduce((sum, chip) => 
    sum + chip.getBoundingClientRect().height, 0) / unselectedChips.length;

  console.log('\n%c📊 SUMMARY', 'font-size:14px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');
  console.log(`📏 Average selected chip height: ${avgSelectedHeight.toFixed(2)}px`);
  console.log(`📏 Average unselected chip height: ${avgUnselectedHeight.toFixed(2)}px`);
  
  const difference = avgSelectedHeight - avgUnselectedHeight;
  console.log(`📊 Height difference: ${difference.toFixed(2)}px`);
  
  if (Math.abs(difference) < 1) {
    console.log('%c✅ No significant height difference - layout is stable', 'color:#4CAF50');
  } else if (difference > 0) {
    console.log(`%c⚠️ Selected chips are ${difference.toFixed(2)}px TALLER`, 'color:#FF5722');
  } else {
    console.log(`%c⚠️ Selected chips are ${Math.abs(difference).toFixed(2)}px SHORTER`, 'color:#FF5722');
  }

  console.log('\n%c📋 Copy this output and paste it in the chat', 'color:#999');
  console.log('==========================================');
})();