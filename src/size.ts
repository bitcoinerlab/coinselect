import type { OutputInstance } from '@bitcoinerlab/descriptors';
export function size(
  inputs: Array<{ output: OutputInstance; value: number }>,
  outputs: Array<{ output: OutputInstance; value: number }>
) {
  console.log(inputs, outputs);
  return 1;
}
