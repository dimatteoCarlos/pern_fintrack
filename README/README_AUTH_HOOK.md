# 🔐 useAuth Hook

📂 File Location
frontend/src/auth/hooks/useAuth.ts
Note: This hook relies on authFetch for authenticated requests and useAuthStore for reactive UI updates.

The `useAuth.ts` hook serves as the **centralized authentication controller** for the frontend. It acts as the Single Source of Truth for managing user identity, session persistence, and security-related API interactions.

## 🚀 Key Features

*   **Session Hydration:** Automatically restores user sessions on page refresh by validating tokens against the backend.
*   **Complete Auth Flow:** Integrated logic for `Sign In`, `Sign Up`, and `Sign Out`.
*   **Smart Persistence:** Supports "Remember Me" functionality using a hybrid of `localStorage` and `sessionStorage`.
*   **Robust Error Handling:** Custom [Axios](https://axios-http.com) error interceptor that translates server codes (401, 400, 429) into human-readable messages.
*   **Data Transformation:** Normalizes API responses into consistent frontend TypeScript interfaces.

## 🛠️ Tech Stack

*   **State Management:** [Zustand](https://zustand-demo.pmnd.rs) (via `useAuthStore`).
*   **HTTP Client:** [Axios](https://axios-http.com) for asynchronous requests and `fetch` for registration.
*   **Routing:** [React Router Dom](https://reactrouter.com) for programmatic navigation.

## 📖 Code Structure

### 1. Data Transformation (`mapUserResponseToUserData`)
A utility function that maps backend naming conventions (e.g., `user_firstname`) to clean frontend camelCase or standardized properties, ensuring type safety across components.

### 2. Error Extraction Utility
The `extractErrorMessage` function categorizes issues into:
- **Server Errors:** Specific handling for Invalid Credentials (401), Rate Limiting (429), and Validation (400).
- **Network Errors:** Detects if the server is unreachable.
- **Generic Errors:** Fallback for unexpected runtime exceptions.

### 3. Exposed Methods

| Method | Description |
| :--- | :--- |
| `handleSignIn` | Authenticates credentials, manages token expiry, and redirects to the initial page. |
| `handleSignUp` | Registers a new account and immediately initializes a user session. |
| `handleSignOut` | Invalidates the session on the server and executes `logoutCleanup` locally. |
| `checkAuthStatus` | An internal `useEffect` logic that validates the existing `accessToken` on mount. |

## 💻 Usage Example

```tsx
import useAuth from './auth/hooks/useAuth';

const LoginView = () => {
  const { handleSignIn, isLoading, error } = useAuth();

  const onLogin = async (credentials) => {
    const success = await handleSignIn(credentials, true);
    if (success) {
      console.log("Redirecting to dashboard...");
    }
  };

  return (
    // Component JSX
  );
};

📂 File Location
frontend/src/auth/hooks/useAuth.ts
Note: This hook relies on authFetch for authenticated requests and useAuthStore for reactive UI updates.

