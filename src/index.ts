// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import type { OutputInstance } from '@bitcoinerlab/descriptors';
export { vsize } from './vsize';
export { dustThreshold } from './dust';
export { coinselect } from './coinselect';
export { maxFunds } from './algos/maxFunds';
export { addUntilReach } from './algos/addUntilReach';
export { avoidChange } from './algos/avoidChange';

export const DUST_RELAY_FEE_RATE = 3;
export const MAX_FEE_RATE = 10 * 1000; //10 times larger than 2017 peak
export type InputOrigin = { txHex: string; vout: number };
export type OutputWithValue = { output: OutputInstance; value: number };
