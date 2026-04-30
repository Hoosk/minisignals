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

## Performance

The core is built on a linked-list dependency graph with O(1) dependency lookup (`currentLink` pointer), lazy computed evaluation (dirty flag, no eager recomputation), and class-based signal instances for V8 monomorphization.

Benchmark results on Node.js (warmup 150 ms, sample 350 ms):

```
── Signal ────────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
signal-read                    420.38M ops/s      2.38 ns/op
signal-write-no-subscribers    210.86M ops/s      4.74 ns/op
signal-write-same-value        760.84M ops/s      1.31 ns/op

── Effect ────────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
effect-fanout-write             17.77K ops/s     56.27 µs/op
effect-create-dispose            5.86M ops/s    170.66 ns/op
effect-dynamic-deps              7.08M ops/s    141.15 ns/op

── Computed ──────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
computed-chain                  51.07K ops/s     19.58 µs/op
computed-cached-read            44.59M ops/s     22.42 ns/op
computed-batched-writes-no-read 742.71K ops/s     1.35 µs/op
computed-batched-writes-then-read 706.54K ops/s   1.42 µs/op
```

Run `npm run bench` to reproduce locally.

For full documentation and advanced features, please refer to the [main repository README](../../README.md).
