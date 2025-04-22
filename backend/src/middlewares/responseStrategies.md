# 📱 Client Type Detection Middleware

This middleware is responsible for detecting the type of client based on the User-Agent and classifying it into a simplified logical category (`web`, `mobile`, `bot`, `unknown`). This helps the server determine how to respond properly — for example, whether to use cookies or send a token.

## 🔍 How It Works

- Detects the `clientType` from the `User-Agent`.
- Classifies it into a simpler `logicalClientType`.
- Sets both values on the `req` object:  
  - `req.clientType` → e.g. `mobile-app`, `web`, `bot`, etc.  
  - `req.logicalClientType` → e.g. `mobile`, `web`, etc.

You can then use this logic in your authentication routes to decide how to respond.

---

## 🧾 Client Type Table

| `clientType`         | `logicalClientType` | `action_message`                                                       | `response_strategy`     |
|----------------------|---------------------|------------------------------------------------------------------------|--------------------------|
| `web`                | `web`               | Use cookies; desktop browser                                           | `set-cookie`            |
| `mobile-browser`     | `web`               | Treat as browser; use cookies                                          | `set-cookie`            |
| `tablet-browser`     | `web`               | Browser on a tablet; use cookies                                       | `set-cookie`            |
| `mobile-app`         | `mobile`            | Send token in response body; client is a native app or WebView         | `send-token-in-body`    |
| `bot`                | `bot`               | Deny access or allow public resources only; log access attempts        | `reject-403-or-ignore`  |
| `unknown`            | `unknown`           | Deny access; possibly invalid or malicious client                      | `reject-400`            |

---

## 🛠 Usage Example in Route

```js
import { authDetectClientType } from './middlewares/authDetectClientType.js';

router.post('/sign-up', authDetectClientType, async (req, res) => {
  const token = 'abc123';

  switch (req.logicalClientType) {
    case 'web':
      res.cookie('token', token, { httpOnly: true });
      return res.status(200).json({ method: 'cookie', success: true });

    case 'mobile':
      return res.status(200).json({ method: 'token', token, success: true });

    default:
      return res.status(400).json({ message: 'Unsupported client type' });
  }
});
