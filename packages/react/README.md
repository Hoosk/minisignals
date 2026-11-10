# @hoosk/minisignals-react

The React 18 adapter for `@hoosk/minisignals`.

This package provides custom hooks to seamlessly integrate the agnostic reactive signals with React's component lifecycle and rendering engine. It utilizes React 18's `useSyncExternalStore` for tear-free concurrent rendering.

## Installation

```bash
npm install @hoosk/minisignals @hoosk/minisignals-react
```

## Basic Usage

```tsx
import { useSignal, useSignalValue } from '@hoosk/minisignals-react';
function Counter() {
  // Create a local signal that survives re-renders
  const count = useSignal(0);
  
  // Connect the signal to trigger React renders on mutation
  const value = useSignalValue(count);

  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

### `useComputed(fn, deps?)`

Creates a `Computed<T>` that survives re-renders and is disposed automatically on unmount or when `deps` change:

```tsx
import { signal } from '@hoosk/minisignals';
import { useComputed, useSignalValue } from '@hoosk/minisignals-react';

const price = signal(100);

function Total({ quantity }: { quantity: number }) {
  const total = useComputed(() => price.value * quantity, [quantity]);
  return <p>{useSignalValue(total)}</p>;
}
```

### `useSignalEffect(fn, deps?)`

Runs a core `effect` bound to the component lifecycle. The callback may return a cleanup function, which runs before each re-execution and on unmount:

```tsx
import { signal } from '@hoosk/minisignals';
import { useSignalEffect } from '@hoosk/minisignals-react';

const count = signal(0);

function Title() {
  useSignalEffect(() => {
    document.title = `Count: ${count.value}`;
  });
  return null;
}
```

### `useSignalValue` accepts any `ReadonlySignal`

`useSignalValue` accepts both `Signal<T>` and `Computed<T>` via the shared `ReadonlySignal<T>` interface, so you can pass either directly:

```tsx
import { signal, computed } from '@hoosk/minisignals';
import { useSignalValue } from '@hoosk/minisignals-react';

const price = signal(100);
const doubled = computed(() => price.value * 2);

function Price() {
  const value = useSignalValue(doubled); // works with Computed too
  return <p>{value}</p>;
}
```

For full documentation, please refer to the [main repository README](https://github.com/Hoosk/minisignals#readme).
