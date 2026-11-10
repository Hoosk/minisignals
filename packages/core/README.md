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

const stop = effect(() => {
  console.log(`Count: ${count.value}, Double: ${double.value}`);
  return () => console.log('cleanup'); // runs before each re-run and on stop()
});

count.value = 1; // Logs: Count: 1, Double: 2

// Batch multiple writes into a single notification pass
batch(() => {
  count.value = 10;
  count.value = 20;
}); // Logs once: Count: 20, Double: 40

stop();
```

### `peek()` and cleanup

`Signal` and `Computed` expose `.peek()` to read the current value without subscribing the active effect/computed:

```typescript
effect(() => {
  count.value; // tracked
  double.peek(); // not tracked
});
```

`effect()` callbacks may return a cleanup function that runs before every re-execution and when the effect is stopped.

## Reactivity model

Writes are processed in two phases:

1. **Push**: every affected `computed` is marked dirty synchronously.
2. **Pull**: queued effects refresh derived values and run once with consistent data.

This makes diamond graphs glitch-free, keeps `computed` reads inside `batch()` fresh, and enables early bailout: if a recomputed value is unchanged, downstream effects are skipped.

## Performance

The core is built on a linked-list dependency graph with O(1) dependency lookup (`currentLink` pointer), push-pull invalidation (glitch-free diamonds + lazy computed evaluation with version-based early bailout), and class-based signal/computed instances for V8 monomorphization.

Benchmark results on Node.js (warmup 150 ms, sample 350 ms):

```
── Signal ────────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
signal-read                    533.34M ops/s      1.87 ns/op
signal-write-no-subscribers    407.35M ops/s      2.45 ns/op
signal-write-same-value        843.42M ops/s      1.19 ns/op

── Effect ────────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
effect-fanout-write             18.98K ops/s     52.70 µs/op
effect-create-dispose            8.94M ops/s    111.83 ns/op
effect-dynamic-deps              7.34M ops/s    136.20 ns/op

── Computed ──────────────────────────────────────────────────
scenario                               ops/s        time/op
─────────────────────────────────────────────────────────────
computed-chain                 115.71K ops/s      8.64 µs/op
computed-cached-read           344.12M ops/s      2.91 ns/op
computed-batched-writes-no-read 469.72K ops/s     2.13 µs/op
computed-batched-writes-then-read 525.06K ops/s   1.90 µs/op
```

Run `npm run bench` to reproduce locally.

For full documentation and advanced features, please refer to the [main repository README](https://github.com/Hoosk/minisignals#readme).
