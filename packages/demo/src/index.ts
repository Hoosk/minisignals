import { signal, effect, computed } from '@hoosk/minisignals';

console.log('--- Testing @hoosk/minisignals ---\n');

// 1. Type inference and Simple Signals
const count = signal(0);
const name = signal('Hoosk');

// 2. Computed (Derived state)
let computeRuns = 0;
const doubleCount = computed(() => {
  computeRuns++;
  return count.value * 2;
});

const userGreeting = computed(() => `${name.value} has ${doubleCount.value} points.`);

// 3. Reactive effect with computed
const stopLogger = effect(() => {
  console.log(`[Effect] Name: ${name.value}, Count: ${count.value}`);
  console.log(`[Effect-Computed] Double: ${doubleCount.value}`);
  console.log(`[Effect-Computed] Greeting: ${userGreeting.value}`);
});

// 4. Reactive updates
console.log(`\nUpdating values... (initial computeRuns: ${computeRuns})`);
count.value++; // Should trigger updates and increase computeRuns
count.value++; // computeRuns = 3

console.log('\nChecking Cache...');
console.log(`Double read directly: ${doubleCount.value}`); // Should not increase computeRuns
console.log(`computeRuns after direct read: ${computeRuns} (Should be 3)`);

console.log('\nChanging name...');
name.value = 'CLI'; // Should not increase computeRuns because doubleCount doesn't depend on name

console.log(`\ncomputeRuns before dispose: ${computeRuns}`);

// 5. Computed destruction
console.log('\n--- Testing Computed Cleanup (Memory Leak Prevention) ---');
doubleCount.dispose();
console.log('Changing count again (should not trigger doubleCount calculation)...');
count.value++; // This no longer affects doubleCount

console.log(`computeRuns final: ${computeRuns} (Should still be 3)`);

console.log('\nDemo finished successfully.');
