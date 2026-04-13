# 🔐 Auth Storage Utilities

A lightweight, type-safe persistence layer for user identity management within the frontend application.

## 🚀 Overview

This utility module provides pure functions to handle `localStorage` persistence for user credentials. It acts as the **Single Source of Truth** for identity data, ensuring that "Remember Me" functionality and session persistence are handled reliably.

## ✨ Key Features

- **Robust Error Handling**: Wrapped in `try-catch` blocks to prevent app crashes if `localStorage` is disabled or full.
- **Data Integrity**: Automatically validates the shape of retrieved data; if the object is corrupted, it cleans the storage automatically.
- **Type Safety**: Fully integrated with TypeScript using `UserIdentityType`.
- **Silent Failures**: Designed to fail gracefully without interrupting the user experience.

## 📁 File Location
`frontend/src/logic/AUTH/authStorage.ts`

## 🛠️ Usage Guide

### Save User Identity
Use this when a user logs in or updates their profile settings.
```typescript
import { saveIdentity } from './logic/auth/authStorage';

saveIdentity({ 
  email: 'user@example.com', 
  username: 'johndoe', 
  rememberMe: true 
});
Use code with caution.

Retrieve Identity
Use this to pre-fill login forms or restore user sessions on app load.
typescript
import { getIdentity } from './logic/auth/authStorage';

const identity = getIdentity();
if (identity) {
  // Logic to pre-fill UI
}
Use code with caution.

Clear Storage
Call this during logout or when the user opts out of persistence.
typescript
import { clearIdentity } from './logic/auth/authStorage';

clearIdentity();
Use code with caution.

📊 Data Schema
The utility manages the following data structure defined in authTypes.ts:
Property	Type	Description
email	string	User's registered email address
username	string	Display name or handle
rememberMe	boolean	Flag to determine persistence duration
Note: This module handles identity data only. Sensitive tokens (JWT) should be managed according to your security policy (HttpOnly cookies or secure memory storage).