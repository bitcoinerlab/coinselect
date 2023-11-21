import type { OutputWithValue } from './index';
import { vsize } from './vsize';
const MAX_FEE_RATE = 10 * 1000;
export function validateOutputWithValues(
  outputAndValues: Array<OutputWithValue>
) {
  if (outputAndValues.length === 0) throw new Error('Empty group');
  for (const outputAndValue of outputAndValues) {
    const value = outputAndValue.value;
    if (!Number.isInteger(value) || value <= 0 || value > 1e14 /*1 M Btc*/) {
      throw new Error(`Input value ${value} not supported`);
    }
  }
}
export function validateFeeRate(feeRate: number) {
  if (!Number.isFinite(feeRate) || feeRate < 1 || feeRate > MAX_FEE_RATE) {
    throw new Error(`Fee rate ${feeRate} not supported`);
  }
}
export function validatedFeeAndVsize(
  utxos: Array<OutputWithValue>,
  targets: Array<OutputWithValue>,
  feeRate: number
): { fee: number; vsize: number } {
  const fee =
    utxos.reduce((a, u) => a + u.value, 0) -
    targets.reduce((a, t) => a + t.value, 0);
  const vsizeResult = vsize(
    utxos.map(u => u.output),
    targets.map(t => t.output)
  );
  const finalFeeRate = fee / vsizeResult;
  if (finalFeeRate < feeRate)
    throw new Error(
      `Final fee rate ${finalFeeRate} lower than required ${feeRate}`
    );
  validateFeeRate(finalFeeRate);
  return { fee, vsize: vsizeResult };
}
