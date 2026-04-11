# minisignals

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![React 18 Ready](https://img.shields.io/badge/React-18%2B-61dafb.svg)](https://react.dev/)

A blazing-fast, minimalist, framework-agnostic reactive signal library, paired with a React 18 adapter.

`minisignals` was designed as a deep-dive into modern reactive primitives (similar to Preact Signals or Vue Reactivity), implementing advanced concepts like dynamic dependency tracking and lazy evaluation in just a few lines of code.

---

## Packages

This project is structured as a monorepo containing:

| Package | Description |
| :--- | :--- |
| **`@hoosk/minisignals`** | The framework-agnostic core (`signal`, `effect`, `computed`, `batch`, `untracked`). |
| **`@hoosk/minisignals-react`** | React integration hooks (`useSignal`, `useSignalValue`). |
| **`@hoosk/minisignals-demo`** | Manual playground for behavior testing and validation. |

---

## Installation

You can install the core library on its own, or alongside the React adapter.

**Core only (Framework Agnostic):**
```bash
npm install @hoosk/minisignals
```

**With React Adapter:**
```bash
npm install @hoosk/minisignals @hoosk/minisignals-react
```

---

## Core API (`@hoosk/minisignals`)

### `signal<T>(initialValue: T)`
Creates a reactive container holding a `.value` property. It tracks subscriptions automatically when read inside an `effect`.

```typescript
import { signal } from '@hoosk/minisignals';

const count = signal(0);

// Mutating the value triggers reactivity
count.value = 1; 
console.log(count.value); // 1
```
> **Optimization Note:** Subscribers are only notified when `newValue !== oldValue` (strict reference equality).

### `effect(fn: () => void)`
Runs a function immediately and tracks any signals read within it dynamically. Returns an `unsubscribe` function.

```typescript
import { signal, effect } from '@hoosk/minisignals';

const count = signal(0);

const stop = effect(() => {
  // Automatically subscribes to 'count'
  console.log('Current count is:', count.value);
});

count.value = 1; // Logs: "Current count is: 1"
stop();          // Cleans up the subscription
count.value = 2; // Does nothing
```

### `computed<T>(fn: () => T)`
Creates a derived, read-only signal.

```typescript
import { signal, computed } from '@hoosk/minisignals';

const price = signal(100);
const qty = signal(2);

// Derived state
const total = computed(() => price.value * qty.value);
console.log(total.value); // 200

qty.value = 3;
console.log(total.value); // 300
```

**Advanced Features of `computed`:**
- **Lazy Evaluation:** The internal effect is *not* initialized until `.value` is read for the very first time.
- **Caching:** The value is cached and only recalculates when its specific dependencies mutate.
- **Memory Safety:** Includes a `.dispose()` method to detach subscriptions and prevent memory leaks. Once disposed, the last computed value is frozen — `fn` will never be called again.

### `batch<T>(fn: () => T): T`
Groups multiple signal writes into a single notification pass. Subscribers are notified only once after the batch completes. Nested batches are supported — notifications fire when the outermost batch ends.

```typescript
import { signal, effect, batch } from '@hoosk/minisignals';

const name = signal('John');
const surname = signal('Doe');

effect(() => console.log(`${name.value} ${surname.value}`));
// Logs: "John Doe"

batch(() => {
  name.value = 'Jane';
  surname.value = 'Smith';
});
// Logs once: "Jane Smith"  (not twice)
```

### `untracked<T>(fn: () => T): T`
Reads signals inside an effect without creating subscriptions. Useful when you need a signal's current value as a snapshot without reacting to its future changes.

```typescript
import { signal, effect, untracked } from '@hoosk/minisignals';

const trigger = signal(0);
const config = signal({ debug: false });

effect(() => {
  const t = trigger.value; // tracked — re-runs when trigger changes
  const cfg = untracked(() => config.value); // NOT tracked
  console.log(t, cfg.debug);
});

config.value = { debug: true }; // does NOT re-run the effect
trigger.value = 1;              // re-runs, picking up latest config
```

### Types: `ReadonlySignal<T>`
Both `Signal<T>` and `Computed<T>` extend the shared `ReadonlySignal<T>` interface (`{ readonly value: T }`). Use it to write utilities or hooks that accept either without caring about writability.

```typescript
import type { ReadonlySignal } from '@hoosk/minisignals';

function logValue<T>(sig: ReadonlySignal<T>) {
  console.log(sig.value);
}
```

---

## React Integration (`@hoosk/minisignals-react`)

The React adapter leverages React 18's **`useSyncExternalStore`** to ensure tear-free concurrent rendering and out-of-the-box SSR compatibility.

### `useSignal<T>(initialValue: T)`
Creates a stable signal that survives component re-renders.

```tsx
import { useSignal } from '@hoosk/minisignals-react';

function LocalCounter() {
  // The signal instance is preserved across renders
  const count = useSignal(0);
  return <button onClick={() => count.value++}>Add</button>;
}
```

### `useSignalValue<T>(signal: Signal<T> | Computed<T>)`
Subscribes to a Signal or Computed and triggers a React re-render *only* when the snapshot changes.

```tsx
import { useSignal, useSignalValue } from '@hoosk/minisignals-react';

function ReactiveCounter() {
  const count = useSignal(0);
  
  // Connects the signal to React's rendering lifecycle
  const value = useSignalValue(count);

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => count.value++}>+</button>
    </div>
  );
}
```

---

## Current Limitations

By design, to maintain its ultra-minimalist footprint, this library intentionally omits:
- **Transactions:** No execution priorities or deferred state mutations.
- **Deep Equality:** Object mutation relies on strict equality (`!==`); you must reassign object references to trigger updates.
- **Nested Effects:** Care must be taken with nested effects to avoid accumulation without proper cleanup.

---

## Monorepo Development

This project uses `npm` workspaces. From the repository root:

```bash
# Install all dependencies across workspaces
npm install

# Build all packages
npm run build

# Run Vitest test suites (Core: Node environment, React: jsdom)
npm test
```

You can also target specific workspaces:
```bash
npm test -w @hoosk/minisignals
npm test -w @hoosk/minisignals-react
npm start -w @hoosk/minisignals-demo
```

---

## License

[MIT](LICENSE)
