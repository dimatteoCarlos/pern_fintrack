// 📁 frontend/src/debug/components/TestAuthStorage.tsx

/* ===============================
   🧪 TEST COMPONENT FOR AUTH STORAGE
   Only runs in development, never in production
   =============================== */

import { useEffect } from 'react';
import { saveIdentity,  getIdentity, 
  clearIdentity, 
  hasRememberedIdentity  } from '../auth/auth_utils/localStorageHandle/authStorage';

/**
 * 🧪 Test component for authStorage functionality
 * 
 * This component automatically runs tests when mounted in development.
 * It has no UI and should only be used temporarily.
 * 
 * @example
 * // In App.tsx (development only)
 * {import.meta.env.VITE_ENVIRONMENT && <TestAuthStorage />}
 */
const TestAuthStorage = () => {
  useEffect(() => {
    // Only run in development
    if (!import.meta.env.DEV) return;

    console.log('🧪 ===== AUTH STORAGE TEST STARTED =====');
    console.log('----------------------------------------');
    
    try {
      // 1️⃣ Save identity
      console.log('1️⃣ Testing saveIdentity()...');
      saveIdentity({ 
        email: 'test@test.com', 
        username: 'testuser', 
        rememberMe: true 
      });
      console.log('   ✅ saveIdentity completed');
      
      // 2️⃣ Get identity
      console.log('2️⃣ Testing getIdentity()...');
      const identity = getIdentity();
      console.log('   Result:', identity);
      console.log('   Expected:', { 
        email: 'test@test.com', 
        username: 'testuser', 
        rememberMe: true 
      });
      
      // 3️⃣ Check existence
      console.log('3️⃣ Testing hasRememberedIdentity()...');
      const exists = hasRememberedIdentity();
      console.log('   Result:', exists);
      console.log('   Expected: true');
      
      // 4️⃣ Clear identity
      console.log('4️⃣ Testing clearIdentity()...');
      clearIdentity();
      console.log('   ✅ clearIdentity completed');
      
      // 5️⃣ Verify cleared
      console.log('5️⃣ Verifying clear worked...');
      const afterClear = getIdentity();
      console.log('   Result:', afterClear);
      console.log('   Expected: null');
      
      console.log('----------------------------------------');
      console.log('✅ ===== AUTH STORAGE TEST PASSED =====');
      
    } catch (error) {
      console.error('❌ ===== AUTH STORAGE TEST FAILED =====');
      console.error('Error:', error);
    }
  }, []); // Empty deps = run once on mount

  // This component has no UI
  return null;
};

export default TestAuthStorage;