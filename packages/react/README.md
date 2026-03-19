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

For full documentation, please refer to the [main repository README](../../README.md).
