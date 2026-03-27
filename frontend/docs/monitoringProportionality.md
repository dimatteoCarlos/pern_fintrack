(function monitorLayoutProportional() {
console.clear();
console.log('%c📏 LAYOUT VERTICAL MONITOR - PROPORTIONAL ANALYSIS', 'font-size:16px; font-weight:bold; color:#4CAF50');
console.log('==========================================');

// Get viewport dimensions
const viewportHeight = window.innerHeight;
const viewportWidth = window.innerWidth;

console.log(`%c📱 VIEWPORT`, 'font-weight:bold; color:#2196F3');
console.log(`   Width: ${viewportWidth}px`);
console.log(`   Height: ${viewportHeight}px`);
console.log('');

// Get CSS variables (computed values)
const rootStyles = getComputedStyle(document.documentElement);
const cssVars = {
topSpaceHeight: parseFloat(rootStyles.getPropertyValue('--topSpaceHeight')) _ 16,
navbarTopHeight: parseFloat(rootStyles.getPropertyValue('--navbar-top-height')) _ 16,
navbarBottomHeight: parseFloat(rootStyles.getPropertyValue('--navbar-bottom-height')) _ 16,
headerContentHeight: parseFloat(rootStyles.getPropertyValue('--header-content-height')) _ 16,
gapBetween: parseFloat(rootStyles.getPropertyValue('--gap-between')) _ 16,
headerTotalHeight: parseFloat(rootStyles.getPropertyValue('--header-total-height')) _ 16,
};

console.log(`%c🎨 CSS VARIABLES (computed)`, 'font-weight:bold; color:#FF9800');
console.log(`   --topSpaceHeight: ${cssVars.topSpaceHeight.toFixed(1)}px`);
console.log(`   --navbar-top-height: ${cssVars.navbarTopHeight.toFixed(1)}px`);
console.log(`   --navbar-bottom-height: ${cssVars.navbarBottomHeight.toFixed(1)}px`);
console.log(`   --header-content-height: ${cssVars.headerContentHeight.toFixed(1)}px`);
console.log(`   --gap-between: ${cssVars.gapBetween.toFixed(1)}px`);
console.log(`   --header-total-height: ${cssVars.headerTotalHeight.toFixed(1)}px`);
console.log('');

// Get all elements
const elements = {
homeHeader: document.querySelector('.home**header'),
layoutHeader: document.querySelector('.layout**header'),
trackerNavbar: document.querySelector('.trackerNavbar**container'),
cardsContainer: document.querySelector('.cards**presentation--tracker'),
mainNavbar: document.querySelector('.mainNavbar\_\_container')
};

// Store measurements
const measurements = {};
let previousBottom = 0;
let elementOrder = [];

for (const [name, element] of Object.entries(elements)) {
if (!element) {
console.log(`   ⚠️ ${name}: NOT FOUND`);
continue;
}

    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const marginTop = parseFloat(styles.marginTop) || 0;
    const marginBottom = parseFloat(styles.marginBottom) || 0;

    measurements[name] = {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      marginTop,
      marginBottom
    };

    elementOrder.push({ name, top: rect.top, bottom: rect.bottom, height: rect.height });

    // Calculate gap from previous element
    let gapFromPrevious = '';
    if (previousBottom > 0) {
      const gap = rect.top - previousBottom;
      if (gap > 0) {
        gapFromPrevious = `, gap from previous: ${gap.toFixed(1)}px`;
      } else if (gap < 0) {
        gapFromPrevious = `, ⚡ OVERLAP: ${Math.abs(gap).toFixed(1)}px`;
      }
    }

    console.log(`\n   📌 ${name}:`);
    console.log(`      Top: ${rect.top.toFixed(1)}px`);
    console.log(`      Bottom: ${rect.bottom.toFixed(1)}px`);
    console.log(`      Height: ${rect.height.toFixed(1)}px`);
    console.log(`      Margin: T:${marginTop.toFixed(1)}px, B:${marginBottom.toFixed(1)}px`);
    if (gapFromPrevious) console.log(`      ${gapFromPrevious}`);

    previousBottom = rect.bottom;

}

console.log('');

// ============================================
// PROPORTIONAL ANALYSIS (Design Base)
// ============================================

console.log(`%c📐 PROPORTIONAL ANALYSIS (vs design base)`, 'font-weight:bold; color:#9C27B0');

// 1. Header / Navbar ratio
if (measurements.homeHeader && measurements.trackerNavbar) {
const headerHeight = measurements.homeHeader.height;
const navbarHeight = measurements.trackerNavbar.height;
const currentRatio = headerHeight / navbarHeight;
const targetRatio = 1.91; // Design base: 152.8 / 80 = 1.91

    console.log(`\n   1️⃣ HEADER / NAVBAR RATIO:`);
    console.log(`      Header height: ${headerHeight.toFixed(1)}px`);
    console.log(`      Navbar height: ${navbarHeight.toFixed(1)}px`);
    console.log(`      Current ratio: ${currentRatio.toFixed(2)} (target: ${targetRatio.toFixed(2)})`);

    const ratioDiff = ((currentRatio - targetRatio) / targetRatio) * 100;
    if (Math.abs(ratioDiff) > 5) {
      console.log(`      ⚠️ Ratio deviation: ${ratioDiff.toFixed(1)}% from target`);
    } else {
      console.log(`      ✅ Ratio within tolerance`);
    }

    // Target header height based on navbar
    const targetHeaderHeight = navbarHeight * targetRatio;
    const headerMinContent = cssVars.headerContentHeight;
    console.log(`      Target header height (if proportional): ${targetHeaderHeight.toFixed(1)}px`);
    console.log(`      Min content height: ${headerMinContent.toFixed(1)}px`);
    if (headerHeight <= headerMinContent + 2) {
      console.log(`      ℹ️ Header at minimum content height (cannot shrink further)`);
    }

}

// 2. Navbar overlap over header
if (measurements.homeHeader && measurements.trackerNavbar) {
const headerBottom = measurements.homeHeader.bottom;
const navbarTop = measurements.trackerNavbar.top;
const navbarHeight = measurements.trackerNavbar.height;
const overlap = headerBottom - navbarTop;
const overlapRatio = overlap / navbarHeight;
const targetOverlapRatio = 0.2; // 20% of navbar height

    console.log(`\n   2️⃣ NAVBAR OVERLAP:`);
    console.log(`      Header bottom: ${headerBottom.toFixed(1)}px`);
    console.log(`      Navbar top: ${navbarTop.toFixed(1)}px`);
    console.log(`      Overlap: ${overlap.toFixed(1)}px (${(overlapRatio * 100).toFixed(1)}% of navbar)`);
    console.log(`      Target overlap: ${(targetOverlapRatio * 100).toFixed(0)}% (${(navbarHeight * targetOverlapRatio).toFixed(1)}px)`);

    if (overlap > 0) {
      const overlapDiff = ((overlapRatio - targetOverlapRatio) / targetOverlapRatio) * 100;
      if (Math.abs(overlapDiff) > 20) {
        console.log(`      ⚠️ Overlap deviation: ${overlapDiff.toFixed(1)}% from target`);
      } else {
        console.log(`      ✅ Overlap within tolerance`);
      }
    } else {
      console.log(`      ⚠️ No overlap detected`);
    }

}

// 3. Gap between navbar and card
if (measurements.trackerNavbar && measurements.cardsContainer) {
const navbarBottom = measurements.trackerNavbar.bottom;
const cardTop = measurements.cardsContainer.top;
const gap = cardTop - navbarBottom;
const targetGap = 16; // 1rem = 16px

    console.log(`\n   3️⃣ NAVBAR → CARD GAP:`);
    console.log(`      Navbar bottom: ${navbarBottom.toFixed(1)}px`);
    console.log(`      Card top: ${cardTop.toFixed(1)}px`);
    console.log(`      Gap: ${gap.toFixed(1)}px (target: ${targetGap}px)`);

    const gapDiff = gap - targetGap;
    if (Math.abs(gapDiff) > 8) {
      console.log(`      ⚠️ Gap deviation: ${gapDiff.toFixed(1)}px from target`);
    } else {
      console.log(`      ✅ Gap within tolerance`);
    }

}

// 4. Space below last element
if (elementOrder.length > 0) {
const lastElement = elementOrder[elementOrder.length - 1];
const spaceBelow = viewportHeight - lastElement.bottom;
console.log(`\n   4️⃣ BOTTOM SPACE:`);
console.log(`      Last element (${Object.keys(measurements)[elementOrder.length-1]}) bottom: ${lastElement.bottom.toFixed(1)}px`);
console.log(`      Space below: ${spaceBelow.toFixed(1)}px`);

    if (spaceBelow < 0) {
      console.log(`      ⚠️ Content overflows by ${Math.abs(spaceBelow).toFixed(1)}px`);
    } else if (spaceBelow > 100) {
      console.log(`      ℹ️ Extra space: ${spaceBelow.toFixed(1)}px available`);
    }

}

// 5. Current breakpoint detection
console.log(`\n   5️⃣ CURRENT BREAKPOINT:`);
if (viewportHeight > 835) {
console.log(`      >835px: Normal layout (design base)`);
} else if (viewportHeight > 776) {
console.log(`      776-835px: Compact note (2 lines)`);
} else if (viewportHeight > 686) {
console.log(`      686-775px: Amount input compacted`);
} else if (viewportHeight > 641) {
console.log(`      641-685px: Amount + navbar reduction`);
} else if (viewportHeight > 569) {
console.log(`      569-640px: Navbar second reduction`);
} else {
console.log(`      ≤568px: Ultra compact mode`);
}

// 6. Summary
console.log(`\n%c📊 SUMMARY`, 'font-weight:bold; color:#4CAF50');
const lastElementBottom = previousBottom;
const totalContentHeight = lastElementBottom;

if (totalContentHeight > viewportHeight) {
const overflow = totalContentHeight - viewportHeight;
console.log(`   ⚠️ CONTENT OVERFLOW: ${overflow.toFixed(1)}px (${((overflow / viewportHeight) * 100).toFixed(1)}%)`);
} else {
const freeSpace = viewportHeight - totalContentHeight;
console.log(`   ✅ CONTENT FITS: ${freeSpace.toFixed(1)}px free`);
}

console.log('\n%c📋 Copy this output and paste in chat', 'color:#999');
console.log('==========================================');
})();
