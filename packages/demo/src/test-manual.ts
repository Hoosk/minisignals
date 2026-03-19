import { signal, effect, computed } from '@hoosk/minisignals';


const price = signal(100);
const quantity = signal(2);
const total = computed(() => price.value * quantity.value);

effect(() => {
  console.log(`🛒 Total purchase: $${total.value}`);
});

// This should trigger the log automatically
price.value = 150; 
// This should also trigger the log
quantity.value = 3;
