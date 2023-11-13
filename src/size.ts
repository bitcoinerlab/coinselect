//TODO in installed bip39 to dev-dependencies. Make use i don't need it here
import type { OutputInstance } from '@bitcoinerlab/descriptors';
export function size(
  inputs: Array<OutputInstance>,
  outputs: Array<OutputInstance>
) {
  console.log(inputs, outputs);
  return 1;
}
