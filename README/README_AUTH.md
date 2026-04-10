# 🔐 Full-Stack Authentication & Authorization System

## Security Design & Technical Documentation

---

# 1. Overview

This document describes the complete full-stack authentication and authorization architecture.

The system implements:

- JWT-based authentication (Access + Refresh Token)
- Stateful refresh token persistence in database
- Conditional refresh token rotation
- Token revocation and cleanup
- Hierarchical Role-Based Access Control (RBAC)
- Rate limiting per endpoint
- Structured validation using Zod (Frontend + Backend)
- Centralized error normalization
- Silent token refresh
- UX-driven state machine for authentication flows

Architecture Type:

- Frontend: React + TypeScript + Zustand
- Backend: Node.js + Express + PostgreSQL
- Token Strategy: Short-lived Access Token + Long-lived Rotatable Refresh Token

---

# 2. System Architecture

## Layered Structure

| Layer                    | Responsibility                               |
| ------------------------ | -------------------------------------------- |
| Presentation (FE)        | UI rendering, modals, form state             |
| Application (FE)         | Auth orchestration, navigation decisions     |
| Infrastructure (FE)      | Authenticated HTTP, silent refresh           |
| API Layer (BE)           | Token issuing, verification, refresh         |
| Security Middleware (BE) | JWT validation, authorization, rate limiting |
| Persistence              | Refresh token storage & revocation           |

---

# 3. Token Model

---

## 3.1 Access Token

- Type: JWT
- Lifetime: 1 hour
- Storage (Frontend): sessionStorage
- Transport: Authorization Bearer Header
- Signature: JWT_SECRET

### Payload

```json
{
  "userId": "uuid",
  "role": "user | admin | super_admin",
  "type": "access_token",
  "iat": 123456,
  "exp": 123456
}

Purpose:

API authorization

Short-lived credential

3.2 Refresh Token

Type: JWT

Lifetime: 7 days

Stored in: HttpOnly Cookie

Persisted in database

Rotatable

Revocable

Database Table: refresh_tokens
Field	Description
user_id	Foreign key
token	Full JWT
expiration_date	Expiration timestamp
revoked	Boolean flag
user_agent	Audit metadata
ip_address	Audit metadata
updated_at	Timestamp

Purpose:

Issue new access tokens

Maintain session continuity

Enable server-side revocation

4. Backend Authentication Flow
4.1 Login

Zod validation

Rate limit check

Password verification (bcrypt)

Generate access token

Generate refresh token

Store refresh token in DB

Set HttpOnly cookie

4.2 Authenticated Request

Extract access token

Verify JWT signature

Attach req.user

Apply authorization middleware

Execute controller

4.3 Refresh Token Flow
Steps

Read refresh token from cookie

Verify JWT signature

Extract userId

Validate token exists in DB

Ensure token not revoked

Ensure token not expired

Issue new access token

Rotate refresh token if needed

4.4 Conditional Rotation Logic

Rotation occurs when remaining lifetime < 25% of total lifetime.

If condition met:

Revoke old token

Generate new refresh token

Insert into database

Set new cookie

4.5 Logout

Revoke all user refresh tokens

Clear cookies

Cleanup client session

5. Authorization Model
Role Hierarchy
ROLE_LEVELS = {
  user: 1,
  admin: 2,
  super_admin: 3
}
Middleware
verifyToken

Validates JWT

Attaches req.user

verifyAuthorization(requiredRole)

Dynamic RBAC:

Required Role	Behavior
user	Ownership + hierarchy check
admin	role >= admin
super_admin	role == super_admin
Ownership Check

Access allowed if:

Authenticated user owns resource

Authenticated user has higher role

Authenticated user is super_admin

6. Frontend Authentication Architecture
6.1 useAuth Hook

Responsibilities:

Login

Signup

Logout

Password change

Profile update

Session hydration

Navigation orchestration

Error normalization

6.2 authFetch Utility

Responsibilities:

Inject Bearer token

Handle 401 responses

Perform silent refresh

Retry original request

Dispatch SESSION_EXPIRED state

Never navigate

Flow
Request → 401?
    → Call /refresh-token
        → Success → Retry request
        → Failure → invalidateSession()
6.3 ProtectedRoute

Decision Matrix:

Condition	Redirect
Authenticated	Render content
Not Authenticated + Identity	/auth
Not Authenticated + No Identity	/
Manual Logout Flag	/
6.4 Authentication UI State Machine
State	Meaning
IDLE	No modal open
REMEMBERED_VISITOR	Prefilled login
SESSION_EXPIRED	Forced login
PASSWORD_CHANGED	Post password state
6.5 Identity Persistence

Stored only if rememberMe = true.

{
  "email": "...",
  "username": "...",
  "rememberMe": true
}

Used only for UX purposes.
Never used for authentication.

7. Rate Limiting Strategy
Matrix
Endpoint	Limit	Window	Strategy
Login	5	15 min	IP-based
Profile Update	5	2 min	userId + IP
Password Change	5	30 sec	userId + IP
Global API	100	5 min	IP-based
Standard 429 Response
{
  "success": false,
  "error": "RateLimitExceeded",
  "message": "Too many attempts.",
  "retryAfter": 120
}
8. Zod Validation Layer
Backend

Middleware:

Uses safeParse

Attaches req.validatedData

Returns structured 400 response

Error Format
{
  "success": false,
  "error": "ValidationError",
  "message": "Request validation failed",
  "fieldErrors": {
    "email": ["Invalid email"],
    "password": ["Too short"]
  }
}
Frontend

Zod validation before submission

Maps backend fieldErrors to form state

Prevents invalid request execution

9. Refresh / Rotation Sequence Diagram
Access Token Expired
Client → API (protected endpoint)
API → 401 Unauthorized
Client → /refresh-token
Backend:
    Verify signature
    Validate DB record
    Rotate if needed
    Return new access token
Client:
    Store new token
    Retry original request
API:
    200 OK
Refresh Token Expired
Client → /refresh-token
Backend:
    JWT expired
    401
Client:
    invalidateSession()
    UI state → SESSION_EXPIRED
    Redirect to /auth
10. Security Matrix
Threat	Mitigation
Access token theft	Short lifetime
Refresh token theft	HttpOnly cookie
Token replay	DB validation + revocation
Refresh reuse	Rotation logic
Brute force login	authLimiter
Password abuse	passwordChangeLimiter
Privilege escalation	ROLE_LEVELS enforcement
IDOR	Ownership verification
Token tampering	JWT signature validation
CSRF	SameSite cookies
XSS token exfiltration	No tokens in localStorage
11. Threat Model
Protected Assets

Access tokens

Refresh tokens

User credentials

Role hierarchy

Account ownership

Attack Surfaces

Login endpoint

Refresh endpoint

Protected APIs

Password change endpoint

Profile update endpoint

Primary Threat Categories
Authentication Bypass

Mitigation:

JWT verification

DB refresh validation

Authorization Escalation

Mitigation:

Hierarchical RBAC

Ownership checks

Token Replay

Mitigation:

Persistent refresh storage

Rotation

Revocation

Brute Force

Mitigation:

Rate limiting

Session Fixation

Mitigation:

New refresh on login

Revoke on logout

12. Authentication Lifecycle
Sign In
 → Access Token (1h)
 → Refresh Token (7d)

API Usage
 → Access valid → OK
 → Access expired → Refresh

Refresh
 → Valid → new access
 → <25% lifetime → rotate
 → Invalid → force login

Logout
 → Revoke tokens
 → Cleanup client
13. Security Properties
Property	Implemented
Short-lived access tokens	Yes
Stateful refresh control	Yes
Refresh token rotation	Yes
Server-side revocation	Yes
Role hierarchy enforcement	Yes
Rate limiting	Yes
Zod validation	Yes
Structured error responses	Yes
Silent refresh	Yes
14. Error Taxonomy
Error Type	HTTP
ValidationError	400
Unauthenticated	401
TokenExpired	401
InvalidToken	403
Unauthorized	403
NotFound	404
RateLimitExceeded	429
InternalError	500
15. Security Guarantees

No refresh token usable without DB validation

No access token valid after expiration

No privilege escalation without role hierarchy validation

No brute-force without throttling

No session persistence without valid refresh token
```
