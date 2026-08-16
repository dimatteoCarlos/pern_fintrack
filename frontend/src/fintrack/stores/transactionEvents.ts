// frontend/src/fintrack/stores/transactionEvents.ts
// 📣 TRANSACTION WRITE SIGNAL: the writer announces, the caches decide
//
// A cache that holds a server answer across navigations has to be told when the
// answer stops being true. The only moment that happens is a transaction write,
// and that moment is known inside this application.
//
// The signal carries no payload and names no consumer on purpose. A tracker
// screen has no business knowing which caches exist; each cache owns the
// decision of what a write invalidates, because it is the only thing that knows
// what it holds.
//
// This module imports nothing. That direction is load-bearing: the tracker
// imports this file, the stores import this file, and no tracker chunk ever
// pulls a store it does not render.

type TransactionRecordedListener = () => void;

const listeners = new Set<TransactionRecordedListener>();

// Returns the unsubscribe function. Stores subscribe at module scope and never
// call it; a component that subscribes must, in its effect cleanup.
export const onTransactionRecorded = (
 listener: TransactionRecordedListener,
): (() => void) => {
 listeners.add(listener);
 return () => {
  listeners.delete(listener);
 };
};

// Called from the tracker once a write is confirmed. Listeners only drop their
// memo, so this issues no request of its own.
export const notifyTransactionRecorded = (): void => {
 listeners.forEach((listener) => {
  listener();
 });
};
