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

For full documentation, please refer to the [main repository README](../../README.md).
