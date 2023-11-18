// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license
type InputOrigin = { txHex: string; vout: number };
type OutputWithValue = {
  output: OutputInstance;
  value: number;
};

import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { size } from './size';
import { coinselect } from './coinselect';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
export {
  size,
  coinselect,
  addUntilReach,
  avoidChange,
  InputOrigin,
  OutputWithValue
};
