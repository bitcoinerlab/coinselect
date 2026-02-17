// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

// Same as in Bitcoin Core
export const DUST_RELAY_FEE_RATE = 3;
//10 times larger than 2017 peak
export const MAX_FEE_RATE = 10000;
export const MIN_FEE_RATE = 0.1;

import type { OutputInstance } from '@bitcoinerlab/descriptors';

export { coinselect } from './coinselect';
export { vsize } from './vsize';
export { dustThreshold } from './dust';
export { maxFunds } from './algos/maxFunds';
export { addUntilReach } from './algos/addUntilReach';
export { avoidChange } from './algos/avoidChange';
export type OutputWithValue = { output: OutputInstance; value: bigint };
