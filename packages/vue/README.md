# @hoosk/minisignals-vue

The Vue 3 adapter for `@hoosk/minisignals`.

This package exposes minisignals values as native Vue refs, so they auto-unwrap in templates, work with `v-model`, `watch`, and `computed`, and are cleaned up automatically with the component or `effectScope`.

## Installation

```bash
npm install @hoosk/minisignals @hoosk/minisignals-vue
```

## Basic Usage

```vue
<script setup lang="ts">
import { useSignal } from '@hoosk/minisignals-vue';

const count = useSignal(0);
</script>

<template>
  <p>Count: {{ count }}</p>
  <button @click="count++">Increment</button>
</template>
```

## API

### `useSignal(initialValue): Ref<T>`

Creates a local signal and returns a writable Vue ref backed by it. Usable directly with `v-model`.

### `useSignalRef(sig): Ref<T>`

Bridges an existing `Signal<T>` to a writable ref. Useful when the signal lives in a store outside the component:

```ts
import { signal } from '@hoosk/minisignals';
import { useSignalRef } from '@hoosk/minisignals-vue';

export const count = signal(0);

// inside setup()
const countRef = useSignalRef(count);
```

### `useSignalValue(sig): Readonly<Ref<T>>`

Subscribes to any `Signal` or `Computed` and returns a read-only ref.

### `useComputed(fn): Readonly<Ref<T>>`

Creates a computed signal and returns a read-only ref. The computed instance is disposed automatically when the component or `effectScope` stops.

```vue
<script setup lang="ts">
import { signal } from '@hoosk/minisignals';
import { useComputed } from '@hoosk/minisignals-vue';

const price = signal(100);
const quantity = signal(2);
const total = useComputed(() => price.value * quantity.value);
</script>

<template>
  <p>Total: {{ total }}</p>
</template>
```

### `useSignalEffect(fn): () => void`

Runs a core `effect` bound to the Vue lifecycle. The callback may return a cleanup function, which runs before each re-execution and when the scope stops. Returns a manual stop function.

```ts
import { useSignalEffect } from '@hoosk/minisignals-vue';

useSignalEffect(() => {
  document.title = `Count: ${count.value}`;
  return () => console.log('cleanup');
});
```

All composables register their teardown through `onScopeDispose`, so they also work inside `effectScope` outside of components.

For full documentation, please refer to the [main repository README](https://github.com/Hoosk/minisignals#readme).
