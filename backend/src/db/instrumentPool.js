// backend/src/db/instrumentPool.js
import pc from 'picocolors';

export function instrumentPool(pool) {
  // Asignar ID a cada cliente
  pool.on('connect', (client) => {
    const id = Math.random().toString(36).slice(2, 8);
    // ❌ NO modificar client directamente
    Object.defineProperty(client, '_id', {
      value: id,
      writable: false,
      enumerable: false,
    });
    console.log(pc.green(`🆕 [DB] Client created: ${id}`));
  });

  pool.on('acquire', (client) => {
    const id = client?._id;
    if (!id) {
      console.log(pc.cyan(`📥 [DB] Client acquired: internal/unknown`));
      return;
    }

    console.log(pc.cyan(`📥 [DB] Client acquired: ${id}`));
  });

  pool.on('release', (client) => {
    const id = client?._id;

    if (!id) {
      console.log(pc.yellow(`📤 [DB] Client released: internal/unknown`));
      return;
    }

    console.log(pc.yellow(`📤 [DB] Client released: ${id}`));
  });

  pool.on('error', (err, client) => {
    console.error(
      pc.red(`💥 [DB] Pool error (client ${client?._id || 'unknown'})`),
      err.message,
    );
  });

  // Monitor del estado del pool (cada X segundos)
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      console.log(
        pc.magenta(
          `📊 [DB POOL STATUS] total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`
        )
      );
    }, 36000); // cada 10h (ajústalo)
   }
}
