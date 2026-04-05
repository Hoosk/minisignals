# @hoosk/minisignals

The framework-agnostic core of the `minisignals` library.

This package provides the fundamental reactive primitives: `signal`, `effect`, `computed`, `batch`, and `untracked`. It has zero dependencies and is built for maximum performance and a minimal footprint.

## Installation

```bash
npm install @hoosk/minisignals
```

## Basic Usage

```typescript
import { signal, effect, computed, batch, untracked } from '@hoosk/minisignals';

const count = signal(0);
const double = computed(() => count.value * 2);

effect(() => {
  console.log(`Count: ${count.value}, Double: ${double.value}`);
});

count.value = 1; // Logs: Count: 1, Double: 2

// Batch multiple writes into a single notification pass
batch(() => {
  count.value = 10;
  count.value = 20;
}); // Logs once: Count: 20, Double: 40
```

For full documentation and advanced features, please refer to the [main repository README](../../README.md).
