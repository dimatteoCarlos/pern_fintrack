(function monitorLayout() {
  console.clear();
  console.log('%c📏 LAYOUT VERTICAL MONITOR', 'font-size:16px; font-weight:bold; color:#4CAF50');
  console.log('==========================================');

  // Get viewport dimensions
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  console.log(`%c📱 VIEWPORT`, 'font-weight:bold; color:#2196F3');
  console.log(`   Width: ${viewportWidth}px`);
  console.log(`   Height: ${viewportHeight}px`);
  console.log('');

  // Get all elements
  const elements = {
    homeHeader: document.querySelector('.home__header'),
    layoutHeader: document.querySelector('.layout__header'),
    trackerNavbar: document.querySelector('.trackerNavbar__container'),
    cardsContainer: document.querySelector('.cards__presentation--tracker'),
    mainNavbar: document.querySelector('.mainNavbar__container')
  };

  // Get CSS variables (computed values)
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars = {
    topSpaceHeight: parseFloat(rootStyles.getPropertyValue('--topSpaceHeight')) * 16,
    navbarTopHeight: parseFloat(rootStyles.getPropertyValue('--navbar-top-height')) * 16,
    navbarBottomHeight: parseFloat(rootStyles.getPropertyValue('--navbar-bottom-height')) * 16,
    headerContentHeight: parseFloat(rootStyles.getPropertyValue('--header-content-height')) * 16,
    gapBetween: parseFloat(rootStyles.getPropertyValue('--gap-between')) * 16,
    headerTotalHeight: parseFloat(rootStyles.getPropertyValue('--header-total-height')) * 16
  };

  console.log(`%c🎨 CSS VARIABLES (computed)`, 'font-weight:bold; color:#FF9800');
  console.log(`   --topSpaceHeight: ${cssVars.topSpaceHeight.toFixed(1)}px`);
  console.log(`   --navbar-top-height: ${cssVars.navbarTopHeight.toFixed(1)}px`);
  console.log(`   --navbar-bottom-height: ${cssVars.navbarBottomHeight.toFixed(1)}px`);
  console.log(`   --header-content-height: ${cssVars.headerContentHeight.toFixed(1)}px`);
  console.log(`   --gap-between: ${cssVars.gapBetween.toFixed(1)}px`);
  console.log(`   --header-total-height: ${cssVars.headerTotalHeight.toFixed(1)}px`);
  console.log('');

  // Calculate and display element measurements
  console.log(`%c🏠 ELEMENT MEASUREMENTS`, 'font-weight:bold; color:#9C27B0');
  
  let previousBottom = 0;
  let totalHeight = 0;
  let elementCount = 0;

  for (const [name, element] of Object.entries(elements)) {
    if (!element) {
      console.log(`   ⚠️ ${name}: NOT FOUND`);
      continue;
    }
    
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const marginTop = parseFloat(styles.marginTop) || 0;
    const marginBottom = parseFloat(styles.marginBottom) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    
    const elementTop = rect.top;
    const elementBottom = rect.bottom;
    const elementHeight = rect.height;
    
    // Calculate gap from previous element
    let gapFromPrevious = '';
    if (previousBottom > 0) {
      const gap = elementTop - previousBottom;
      if (gap > 0) {
        gapFromPrevious = `, gap from previous: ${gap.toFixed(1)}px`;
      } else if (gap < 0) {
        gapFromPrevious = `, ⚡ OVERLAP: ${Math.abs(gap).toFixed(1)}px`;
      }
    }
    
    console.log(`\n   📌 ${name}:`);
    console.log(`      Top: ${elementTop.toFixed(1)}px`);
    console.log(`      Bottom: ${elementBottom.toFixed(1)}px`);
    console.log(`      Height: ${elementHeight.toFixed(1)}px`);
    console.log(`      Margin: T:${marginTop.toFixed(1)}px, B:${marginBottom.toFixed(1)}px`);
    console.log(`      Padding: T:${paddingTop.toFixed(1)}px, B:${paddingBottom.toFixed(1)}px`);
    if (gapFromPrevious) console.log(`      ${gapFromPrevious}`);
    
    previousBottom = elementBottom;
    totalHeight += elementHeight;
    elementCount++;
  }
  
  console.log('');
  
  // Calculate available space and overflow
  const lastElementBottom = previousBottom;
  const availableSpaceBelow = viewportHeight - lastElementBottom;
  const totalContentHeight = lastElementBottom;
  
  console.log(`%c📊 SPACE ANALYSIS`, 'font-weight:bold; color:#4CAF50');
  console.log(`   Viewport height: ${viewportHeight}px`);
  console.log(`   Content bottom: ${lastElementBottom.toFixed(1)}px`);
  console.log(`   Available below: ${availableSpaceBelow.toFixed(1)}px`);
  console.log(`   Total content height: ${totalContentHeight.toFixed(1)}px`);
  console.log(`   Elements measured: ${elementCount}`);
  console.log('');
  
  // Check if content fits
  if (totalContentHeight > viewportHeight) {
    const overflow = totalContentHeight - viewportHeight;
    console.log(`%c⚠️ CONTENT OVERFLOW: ${overflow.toFixed(1)}px (${((overflow / viewportHeight) * 100).toFixed(1)}%)`, 'color:#FF5722; font-weight:bold');
  } else {
    const freeSpace = viewportHeight - totalContentHeight;
    console.log(`%c✅ CONTENT FITS: ${freeSpace.toFixed(1)}px free`, 'color:#4CAF50; font-weight:bold');
  }
  console.log('');
  
  // Special checks for navbar overlap
  if (elements.trackerNavbar && elements.homeHeader) {
    const headerRect = elements.homeHeader.getBoundingClientRect();
    const navbarRect = elements.trackerNavbar.getBoundingClientRect();
    const overlap = headerRect.bottom - navbarRect.top;
    
    console.log(`%c🔄 NAVBAR OVERLAP CHECK`, 'font-weight:bold; color:#FF9800');
    console.log(`   Header bottom: ${headerRect.bottom.toFixed(1)}px`);
    console.log(`   Navbar top: ${navbarRect.top.toFixed(1)}px`);
    if (overlap > 0) {
      console.log(`   ✅ Navbar overlap: ${overlap.toFixed(1)}px (${((overlap / navbarRect.height) * 100).toFixed(1)}% of navbar)`);
    } else {
      console.log(`   ⚠️ No overlap: gap of ${Math.abs(overlap).toFixed(1)}px`);
    }
  }
  console.log('');
  
  // Current breakpoint detection
  console.log(`%c📱 CURRENT BREAKPOINT`, 'font-weight:bold; color:#2196F3');
  if (viewportHeight > 835) {
    console.log(`   >835px: Normal layout (header with topSpaceHeight)`);
  } else if (viewportHeight > 776) {
    console.log(`   776-835px: Compact note (2 lines)`);
  } else if (viewportHeight > 686) {
    console.log(`   686-775px: Amount input compacted`);
  } else if (viewportHeight > 641) {
    console.log(`   641-685px: Amount + navbar reduction`);
  } else if (viewportHeight > 569) {
    console.log(`   569-640px: Navbar second reduction`);
  } else {
    console.log(`   ≤568px: Ultra compact mode`);
  }
  
  console.log('\n%c📋 Copy this output and paste in chat', 'color:#999');
  console.log('==========================================');
})();

***********************************
