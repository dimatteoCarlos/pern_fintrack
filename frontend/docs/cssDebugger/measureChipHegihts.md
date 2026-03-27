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