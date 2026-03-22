(function checkNoteStyles() {
  console.clear();
  console.log('%c🔍 DIAGNÓSTICO DEL NOTE', 'font-size:14px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');

  const noteTextarea = document.querySelector('.input__note__description');
  const noteContainer = document.querySelector('.note--description');
  const cardScreenDesc = document.querySelector('.card__screen.description');
  const btnContainer = document.querySelector('.btn__container');
  const plusBtn = document.querySelector('.plus__btn');

  if (!noteTextarea) {
    console.log('❌ No se encontró el textarea .input__note__description');
    return;
  }

  // Obtener estilos computados
  const textareaStyles = getComputedStyle(noteTextarea);
  const containerStyles = noteContainer ? getComputedStyle(noteContainer) : null;
  const cardDescStyles = cardScreenDesc ? getComputedStyle(cardScreenDesc) : null;
  const btnStyles = btnContainer ? getComputedStyle(btnContainer) : null;
  const btnPlusStyles = plusBtn ? getComputedStyle(plusBtn) : null;

  console.log('📊 ESTILOS DEL TEXTAREA:');
  console.log(`   max-height: ${textareaStyles.maxHeight}`);
  console.log(`   overflow-y: ${textareaStyles.overflowY}`);
  console.log(`   height: ${textareaStyles.height}`);
  console.log(`   line-height: ${textareaStyles.lineHeight}`);
  console.log(`   rows atributo: ${noteTextarea.getAttribute('rows')}`);

  if (containerStyles) {
    console.log('\n📊 ESTILOS DEL CONTENEDOR .note--description:');
    console.log(`   min-height: ${containerStyles.minHeight}`);
    console.log(`   max-height: ${containerStyles.maxHeight}`);
  }

  if (cardDescStyles) {
    console.log('\n📊 ESTILOS DE .card__screen.description:');
    console.log(`   padding: ${cardDescStyles.padding}`);
  }

  if (btnStyles) {
    console.log('\n📊 ESTILOS DE .btn__container:');
    console.log(`   height: ${btnStyles.height}`);
  }

  if (btnPlusStyles) {
    console.log('\n📊 ESTILOS DE .plus__btn:');
    console.log(`   height: ${btnPlusStyles.height}`);
    console.log(`   width: ${btnPlusStyles.width}`);
  }

  // Buscar media queries que puedan afectar al note
  console.log('\n📊 MEDIA QUERIES ACTIVAS:');
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const rules = document.styleSheets[i].cssRules;
      if (rules) {
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule.media && rule.cssText && (rule.cssText.includes('note') || rule.cssText.includes('description'))) {
            console.log(`   Encontrada: ${rule.cssText.substring(0, 200)}`);
          }
        }
      }
    } catch(e) { /* CORS issues */ }
  }

  console.log('\n📋 Verifica si los valores de max-height son diferentes de "none"');
  console.log('==========================================');
})();