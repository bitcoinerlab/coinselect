// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license
type InputOrigin = { txHex: string; vout: number };
type OutputWithValue = {
  output: OutputInstance;
  value: number;
};

export const DUST_RELAY_FEE_RATE = 3;

import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { vsize } from './vsize';
import { coinselect } from './coinselect';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { isDust } from './dust';
export {
  vsize,
  isDust,
  coinselect,
  addUntilReach,
  avoidChange,
  InputOrigin,
  OutputWithValue
};
