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
export { size, coinselect, InputOrigin, OutputWithValue };
