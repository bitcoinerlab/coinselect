import { OutputWithValue, MAX_FEE_RATE, DUST_RELAY_FEE_RATE } from './index';
import { vsize } from './vsize';
import { isDust } from './dust';
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

export function validateDust(
  targets: Array<OutputWithValue>,
  dustRelayFeeRate: number = DUST_RELAY_FEE_RATE
) {
  for (const [index, target] of Object.entries(targets))
    if (isDust(target.output, target.value, dustRelayFeeRate))
      throw new Error(`Target #${index} is dusty`);
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
  // Don't compare fee rates because values are picked based on comparing fees (multiplications)
  // Don't mix * / operators:
  // F.ex.: 100/27 !== 100*(1/27)
  // Instead, compare final fee
  if (fee < Math.ceil(vsizeResult * feeRate))
    throw new Error(
      `Final fee ${fee} lower than required ${Math.ceil(vsizeResult * feeRate)}`
    );
  validateFeeRate(finalFeeRate);
  return { fee, vsize: vsizeResult };
}
