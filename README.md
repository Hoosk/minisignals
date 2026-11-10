# minisignals

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![React 18 Ready](https://img.shields.io/badge/React-18%2B-61dafb.svg)](https://react.dev/)

A blazing-fast, minimalist, framework-agnostic reactive signal library, paired with React 18 and Vue 3 adapters.

`minisignals` was designed as a deep-dive into modern reactive primitives (similar to Preact Signals or Vue Reactivity), implementing advanced concepts like a linked-list dependency graph with O(1) lookup, glitch-free push-pull invalidation, lazy computed evaluation with early bailout, and class-based signal instances for V8 monomorphization.

---

## Packages

This project is structured as a monorepo containing:

| Package | Description |
| :--- | :--- |
| **`@hoosk/minisignals`** | The framework-agnostic core (`signal`, `effect`, `computed`, `batch`, `untracked`). |
| **`@hoosk/minisignals-react`** | React integration hooks (`useSignal`, `useSignalValue`, `useComputed`, `useSignalEffect`). |
| **`@hoosk/minisignals-vue`** | Vue 3 composables (`useSignal`, `useSignalRef`, `useSignalValue`, `useComputed`, `useSignalEffect`). |
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

**With Vue Adapter:**
```bash
npm install @hoosk/minisignals @hoosk/minisignals-vue
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

Signals also expose **`.peek()`**, which reads the value without subscribing the active effect or computed:

```typescript
const count = signal(0);
effect(() => {
  count.value;        // tracked — re-runs on change
  count.peek();       // NOT tracked — safe snapshot read
});
```

### `effect(fn: () => void | (() => void))`
Runs a function immediately and tracks any signals read within it dynamically. Returns an `unsubscribe` function.

If the callback returns a function, it is used as **cleanup**: it runs before every re-execution and when the effect is stopped. This is ideal for timers, event listeners or `AbortController`s.

```typescript
import { signal, effect } from '@hoosk/minisignals';

const count = signal(0);

const stop = effect(() => {
  // Automatically subscribes to 'count'
  console.log('Current count is:', count.value);

  return () => console.log('cleanup');
});

count.value = 1; // cleanup runs, then logs: "Current count is: 1"
stop();          // cleanup runs and the subscription is removed
count.value = 2; // Does nothing
```

Effects are **disposal-safe**: calling `stop()` from inside the effect itself (or while it is queued in a batch) prevents any further re-execution and releases its dependencies immediately.

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
- **Lazy Evaluation:** `fn` is only called when `.value` is read and the computed is dirty. Dependency changes mark it dirty but do not trigger recomputation.
- **Caching:** The value is cached and only recalculates when its specific dependencies mutate.
- **Early Bailout:** If a recomputation produces the same value (`!==`), downstream effects are not re-executed. Derived booleans or filtered values no longer cause spurious renders.
- **Memory Safety:** Includes a `.dispose()` method to detach subscriptions and prevent memory leaks. Once disposed, the last computed value is frozen — `fn` will never be called again.

### Glitch-Free Updates

Every signal write is processed in two phases:

1. **Push (invalidation):** all affected `computed` nodes are marked dirty synchronously.
2. **Pull (execution):** queued effects pull fresh derived values and run only once.

This eliminates the classic *diamond problem*: with `a → b`, `a → c` and an effect reading both `b` and `c`, changing `a` produces exactly one consistent re-run. Reads of a `computed` inside a `batch()` are always fresh — never stale.

### `batch<T>(fn: () => T): T`
Groups multiple signal writes into a single notification pass. Subscribers are notified only once after the batch completes. Nested batches are supported — notifications fire when the outermost batch ends.

If an effect throws while the batch is flushing, the remaining pending subscribers keep their state consistent and will still react to future updates.

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
Reads signals inside an effect without creating subscriptions. Useful when you need a signal's current value as a snapshot without reacting to its future changes. For the common case of reading a single signal, prefer the allocation-free `sig.peek()`.

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
Both `Signal<T>` and `Computed<T>` extend the shared `ReadonlySignal<T>` interface (`{ readonly value: T; peek(): T }`). Use it to write utilities or hooks that accept either without caring about writability.

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

### `useSignalValue<T>(signal: ReadonlySignal<T>)`
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

### `useComputed<T>(fn: () => T, deps?: DependencyList)`
Creates a stable `Computed<T>` that survives re-renders and is automatically disposed on unmount (or when `deps` change).

```tsx
import { signal } from '@hoosk/minisignals';
import { useComputed, useSignalValue } from '@hoosk/minisignals-react';

const price = signal(100);

function Total({ quantity }: { quantity: number }) {
  const total = useComputed(() => price.value * quantity, [quantity]);
  return <p>{useSignalValue(total)}</p>;
}
```

### `useSignalEffect(fn: () => void | (() => void), deps?: DependencyList)`
Runs a core `effect` tied to the component lifecycle. The effect is stopped on unmount and its cleanup runs before each re-execution.

```tsx
useSignalEffect(() => {
  document.title = `Count: ${count.value}`;
  return () => console.log('cleanup');
});
```

---

## Vue Integration (`@hoosk/minisignals-vue`)

The Vue adapter exposes minisignals values as native Vue refs, so they auto-unwrap in templates, work with `v-model`, `watch`, and are cleaned up automatically with the component or `effectScope`.

### `useSignal<T>(initialValue: T): Ref<T>`
Creates a local signal and returns a writable Vue ref backed by it.

```vue
<script setup lang="ts">
import { useSignal } from '@hoosk/minisignals-vue';

const count = useSignal(0);
</script>

<template>
  <p>Count: {{ count }}</p>
  <button @click="count++">+</button>
</template>
```

### `useSignalRef<T>(sig: Signal<T>): Ref<T>`
Bridges an existing `Signal<T>` to a writable Vue ref (two-way binding, works with `v-model`).

### `useSignalValue<T>(sig: ReadonlySignal<T>): Readonly<Ref<T>>`
Subscribes to any `Signal` or `Computed` and exposes it as a read-only Vue ref.

### `useComputed<T>(fn: () => T): Readonly<Ref<T>>`
Creates a computed signal and exposes it as a read-only ref, disposing it automatically when the component or scope is torn down.

### `useSignalEffect(fn: () => void | (() => void)): () => void`
Runs a core effect bound to the Vue lifecycle and returns a manual stop function.

---

## Current Limitations

By design, to maintain its ultra-minimalist footprint, this library intentionally omits:
- **Transactions:** No execution priorities or deferred state mutations.
- **Deep Equality:** Object mutation relies on strict equality (`!==`); you must reassign object references to trigger updates.
- **Async Scheduling:** Effects run synchronously when the current write/batch completes; there is no microtask queue or scheduler.

---

## Monorepo Development

This project uses `npm` workspaces. From the repository root:

```bash
# Install all dependencies across workspaces
npm install

# Build all packages
npm run build

# Run Vitest test suites (Core: Node environment, React/Vue: jsdom)
npm test
```

You can also target specific workspaces:
```bash
npm test -w @hoosk/minisignals
npm test -w @hoosk/minisignals-react
npm test -w @hoosk/minisignals-vue
npm start -w @hoosk/minisignals-demo
```

---

## License

[MIT](LICENSE)
