# 🛡️ Authentication Utility Helpers

A secure and efficient utility module for handling password encryption and JWT-based session management in Node.js.

## 🚀 Key Features

*   **`hashed(word)`**: Generates a secure hash using [bcrypt](https://www.npmjs.com) based on the salt rounds configured in the environment variables.
*   **`isRight(userPwd, hashedPwd)`**: Compares a plain-text password with a stored hash to validate user credentials during login.
*   **`createToken(id, role)`**: Generates a short-lived **Access Token** containing the user's ID and role for authorized requests.
*   **`createRefreshToken(id)`**: Generates a long-lived **Refresh Token** (7 days by default) to maintain active sessions without re-authenticating.
*   **`cleanRevokedTokens()`**: Performs database maintenance by deleting expired or revoked tokens from the **PostgreSQL** database.
*   **`rotateRefreshToken(oldToken, userId, req)`**: Implements **Token Rotation**. It revokes the old token and issues a new one, logging metadata such as IP address and User-Agent for enhanced security.
*   **`revokeAllUserRefreshTokens(userId)`**: Immediately invalidates all active tokens for a specific user, essential for global logouts or security resets.

## 🛠️ Tech Stack

*   **Runtime:** [Node.js](https://nodejs.org)
*   **Encryption:** [bcrypt](https://www.npmjs.com)
*   **Token Format:** [JSON Web Tokens (JWT)](https://jwt.io)
*   **Database:** [PostgreSQL](https://www.postgresql.org) (via [pg-pool](https://node-postgres.com))

## 📋 Environment Configuration

To run these utilities, ensure your `.env` file contains:

```env
SALT_ROUNDS=10
JWT_SECRET=your_access_secret
JWT_REFRESH_TOKEN_SECRET=your_refresh_secret
JWT_ISSUER=fintrack_app
Use code with caution.

📂 File Location
backend/src/utils/authHelpers.js
[!IMPORTANT]
This module interacts directly with your database pool. Ensure the database connection is initialized before calling token rotation or cleanup functions.