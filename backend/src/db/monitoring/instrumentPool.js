// backend/src/db/instrumentPool.js
import pc from 'picocolors';

export function instrumentPool(pool) {
  // 🧠 Evitar doble instrumentación (CRÍTICO en serverless)
  if (globalThis.__poolInstrumented) return;
  globalThis.__poolInstrumented = true;

  //identify each client
  const getId = (client) => {
    if (!client._id) {
      Object.defineProperty(client, '_id', {
        value: Math.random().toString(36).slice(2, 8),
        writable: false,
      });
    }
    return client._id;
  };

  // =========================
  // 🆕 CLIENT CREATED (new client)
  // =========================
  pool.on('connect', (client) => {
    console.log(pc.green(`🆕 [DB] Client created: ${getId(client)}`));
  });

  // =========================
  // 📥 ACQUIRE  (borrowed)
  // =========================
  pool.on('acquire', (client) => {
    console.log(pc.cyan(`📥 client acquired: ${getId(client)}`));
  });

  // =========================
  // 📤 RELEASE (returned)
  // =========================
  pool.on('release', (client) => {
    console.log(pc.yellow(`📤 client released: ${getId(client)}`));
  });

  // =========================
  // 💥 ERROR
  // =========================
  pool.on('error', (err, client) => {
    console.error(
      pc.red(`💥 [DB] Pool error (${getId(client) || 'unknown'})`),
      err.message,
    );
  });
}

// =========================
// 📊 POOL MONITOR (SAFE)
// =========================
  export function startPoolMonitor(pool) {
    if (process.env.NODE_ENV !== 'development') return;

    if (globalThis.__poolMonitorStarted) return;
    globalThis.__poolMonitorStarted = true;

    setInterval(() => {
      console.log(
        `📊 POOL STATUS → total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`
      );
    }, 10000);
  }