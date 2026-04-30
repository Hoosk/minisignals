import { performance } from 'node:perf_hooks';
import * as minisignals from '../dist/index.js';

const { signal, computed, effect, batch } = minisignals;

const DEFAULT_WARMUP_MS = 150;
const DEFAULT_SAMPLE_MS = 350;

function runForDuration(task, durationMs) {
  const deadline = performance.now() + durationMs;
  let iterations = 0;

  while (performance.now() < deadline) {
    task();
    iterations++;
  }

  return iterations;
}

// innerOps: how many logical operations each task() call performs internally
// (e.g. 200_000 for tight read/write loops). Used only for reporting.
function measureScenario(name, task, innerOps = 1) {
  task();
  runForDuration(task, DEFAULT_WARMUP_MS);

  const start = performance.now();
  const iterations = runForDuration(task, DEFAULT_SAMPLE_MS);
  const elapsedMs = performance.now() - start;
  const outerOpsPerSecond = iterations * (1000 / elapsedMs);
  const opsPerSecond = outerOpsPerSecond * innerOps;

  return { name, iterations, elapsedMs, opsPerSecond };
}

// ─── Signal ───────────────────────────────────────────────────────────────────

// Baseline getter throughput. No active subscriber → the inline null-check
// short-circuits, measuring only raw property-access overhead.
function createSignalReadScenario() {
  const value = signal(1);

  return () => {
    let sum = 0;
    for (let index = 0; index < 200_000; index++) {
      sum += value.value;
    }
    if (sum === 0) {
      throw new Error('unreachable');
    }
  };
}

// Write to a signal with no subscribers: exercises the !== guard, the value
// assignment, and scheduleSource traversing an empty subsHead list.
function createSignalWriteNoSubscribersScenario() {
  const src = signal(0);

  return () => {
    for (let index = 0; index < 200_000; index++) {
      src.value = index + 1;
    }
  };
}

// Write the same value repeatedly: only the `_value !== newValue` check is
// executed — scheduleSource is never reached. Measures setter no-op overhead.
function createSignalWriteSameValueScenario() {
  const src = signal(42);

  return () => {
    for (let index = 0; index < 200_000; index++) {
      src.value = 42;
    }
  };
}

// ─── Effect ───────────────────────────────────────────────────────────────────

// Fan-out: one signal drives 1 000 effects. Measures subscriber-list traversal
// and synchronous effect re-run cost per write.
function createEffectFanoutScenario() {
  const source = signal(0);
  let sink = 0;

  for (let index = 0; index < 1_000; index++) {
    effect(() => {
      sink += source.value;
    });
  }

  return () => {
    source.value += 1;
    if (sink < 0) {
      throw new Error('unreachable');
    }
  };
}

// Create + dispose: measures the full effect lifecycle — trackSubscriber setup,
// linkDependency (O(1) via currentLink), and cleanupSubscriber teardown.
function createEffectCreateDisposeScenario() {
  const source = signal(0);

  return () => {
    for (let index = 0; index < 10_000; index++) {
      const dispose = effect(() => {
        source.value; // subscribe to one dependency
      });
      dispose();
    }
  };
}

// Dynamic dependencies: an effect alternates which of two signals it reads on
// each run. Exercises the trackId mechanism for adding new deps and pruning
// stale ones via pruneStaleDependencies on every rerun.
function createEffectDynamicDepsScenario() {
  const toggle = signal(true);
  const a = signal(0);
  const b = signal(0);
  let sink = 0;

  effect(() => {
    sink += toggle.value ? a.value : b.value;
  });

  return () => {
    for (let index = 0; index < 1_000; index++) {
      toggle.value = !toggle.value;
    }
    if (sink < 0) {
      throw new Error('unreachable');
    }
  };
}

// ─── Computed ─────────────────────────────────────────────────────────────────

// Deep chain: source → c₀ → c₁ → … → c₉₉. Each write + read propagates
// dirty flags and triggers lazy recomputation through all 100 nodes.
function createComputedChainScenario() {
  const source = signal(0);
  let current = computed(() => source.value + 1);

  for (let index = 0; index < 99; index++) {
    const previous = current;
    current = computed(() => previous.value + 1);
  }

  return () => {
    source.value += 1;
    const result = current.value;
    if (result < 0) {
      throw new Error('unreachable');
    }
  };
}

// Cached read: the computed is initialized and clean. Measures the hot path:
// dirty === false → return cachedValue, with no fn() call.
function createComputedCachedReadScenario() {
  const source = signal(1);
  const derived = computed(() => source.value * 2);
  derived.value; // initialize and cache; source never changes again

  return () => {
    let sum = 0;
    for (let index = 0; index < 200_000; index++) {
      sum += derived.value;
    }
    if (sum === 0) {
      throw new Error('unreachable');
    }
  };
}

// Batched writes — no read: 100 writes inside a batch to a signal with one
// computed subscriber. The fn is never called.
// Verifies the lazy guarantee: recomputations must not increase.
function createComputedBatchedWritesNoReadScenario() {
  const source = signal(0);
  let recomputations = 0;
  const derived = computed(() => {
    recomputations++;
    return source.value * 2;
  });

  derived.value; // initialize (recomputations === 1)
  const baseline = recomputations;

  return () => {
    batch(() => {
      for (let index = 0; index < 100; index++) {
        source.value += 1;
      }
    });
    if (recomputations !== baseline) {
      throw new Error('computed recomputed during batched writes — lazy guarantee violated');
    }
  };
}

// Batched writes then read: same setup as above, but forces the lazy
// recomputation by reading derived.value after the batch. Measures the full
// invalidation → dirty flush → recompute round-trip.
function createComputedBatchedWritesThenReadScenario() {
  const source = signal(0);
  const derived = computed(() => source.value * 2);
  derived.value; // initialize

  return () => {
    batch(() => {
      for (let index = 0; index < 100; index++) {
        source.value += 1;
      }
    });
    const result = derived.value; // triggers recomputation
    if (result < 0) {
      throw new Error('unreachable');
    }
  };
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

// Each entry: { name, factory, innerOps? }
// innerOps: how many logical operations each task() call performs internally
// (e.g. 200_000 for tight read/write loops). Used only for reporting.
const groups = [
  {
    label: 'Signal',
    scenarios: [
      { name: 'signal-read',                       factory: createSignalReadScenario,               innerOps: 200_000 },
      { name: 'signal-write-no-subscribers',       factory: createSignalWriteNoSubscribersScenario, innerOps: 200_000 },
      { name: 'signal-write-same-value',           factory: createSignalWriteSameValueScenario,     innerOps: 200_000 },
    ],
  },
  {
    label: 'Effect',
    scenarios: [
      { name: 'effect-fanout-write',               factory: createEffectFanoutScenario },
      { name: 'effect-create-dispose',             factory: createEffectCreateDisposeScenario,      innerOps: 10_000 },
      { name: 'effect-dynamic-deps',               factory: createEffectDynamicDepsScenario,        innerOps:  1_000 },
    ],
  },
  {
    label: 'Computed',
    scenarios: [
      { name: 'computed-chain',                    factory: createComputedChainScenario },
      { name: 'computed-cached-read',              factory: createComputedCachedReadScenario,       innerOps: 200_000 },
      { name: 'computed-batched-writes-no-read',   factory: createComputedBatchedWritesNoReadScenario },
      { name: 'computed-batched-writes-then-read', factory: createComputedBatchedWritesThenReadScenario },
    ],
  },
];

// ─── Reporting ────────────────────────────────────────────────────────────────

function formatNsOp(opsPerSecond) {
  const ns = 1e9 / opsPerSecond;
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms/op`;
  if (ns >= 1_000)     return `${(ns / 1_000).toFixed(2)} µs/op`;
  return `${ns.toFixed(2)} ns/op`;
}

function formatOps(ops) {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M ops/s`;
  if (ops >= 1_000)     return `${(ops / 1_000).toFixed(2)}K ops/s`;
  return `${ops.toFixed(2)} ops/s`;
}

function pad(str, width) {
  return String(str).padEnd(width).slice(0, width);
}

function padLeft(str, width) {
  return String(str).padStart(width).slice(-width);
}

const COL_NAME = 36;
const COL_OPS  = 16;
const COL_TIME = 13;
const TOTAL = COL_NAME + COL_OPS + COL_TIME;

const colHeader = pad('scenario', COL_NAME) + padLeft('ops/s', COL_OPS) + padLeft('time/op', COL_TIME);
const divider = '─'.repeat(TOTAL);

console.log(`\nminisignals core benchmark  (warmup ${DEFAULT_WARMUP_MS} ms · sample ${DEFAULT_SAMPLE_MS} ms)\n`);

for (const group of groups) {
  const rows = group.scenarios.map(({ name, factory, innerOps = 1 }) => ({
    name,
    result: measureScenario(name, factory(), innerOps),
  }));

  console.log(`── ${group.label} ${'─'.repeat(TOTAL - group.label.length - 4)}`);
  console.log(colHeader);
  console.log(divider);

  for (const { name, result } of rows) {
    console.log(
      pad(name, COL_NAME) +
      padLeft(formatOps(result.opsPerSecond), COL_OPS) +
      padLeft(formatNsOp(result.opsPerSecond), COL_TIME)
    );
  }
  console.log();
}