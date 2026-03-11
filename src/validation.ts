import {
  OutputWithValue,
  MIN_FEE_RATE,
  MAX_FEE_RATE,
  DUST_RELAY_FEE_RATE
} from './index';
import { vsize } from './vsize';
import { isDust } from './dust';
export function validateOutputWithValues(
  outputAndValues: Array<OutputWithValue>
) {
  if (outputAndValues.length === 0) throw new Error('Empty group');
  for (const outputAndValue of outputAndValues) {
    const value = outputAndValue.value;
    //note an utxo with value === 0 is possible, see https://blockstream.info/testnet/tx/a063dbdc23cf969df020536f75c431167a2bbf29d6215a2067495ac46991c954
    if (
      typeof value !== 'bigint' ||
      value < 0n ||
      value > 100000000000000n /*1 M Btc*/
    ) {
      throw new Error(`Input value ${value} not supported`);
    }
  }
}
export function validateFeeRate(
  feeRate: number,
  minimumFeeRate: number = MIN_FEE_RATE
) {
  validateMinimumFeeRate(minimumFeeRate);
  if (
    !Number.isFinite(feeRate) ||
    feeRate < minimumFeeRate ||
    feeRate > MAX_FEE_RATE
  ) {
    throw new Error(`Fee rate ${feeRate} not supported`);
  }
}

function validateMinimumFeeRate(minimumFeeRate: number) {
  if (
    !Number.isFinite(minimumFeeRate) ||
    minimumFeeRate < 0 ||
    minimumFeeRate > MAX_FEE_RATE
  ) {
    throw new Error(`Minimum fee rate ${minimumFeeRate} not supported`);
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
  feeRate: number,
  minimumFeeRate: number = MIN_FEE_RATE
): { fee: bigint; vsize: number } {
  const fee =
    utxos.reduce((a, u) => a + u.value, 0n) -
    targets.reduce((a, t) => a + t.value, 0n);
  const vsizeResult = vsize(
    utxos.map(u => u.output),
    targets.map(t => t.output)
  );
  const requiredFee = BigInt(Math.ceil(vsizeResult * feeRate));
  const finalFeeRate = Number(fee) / vsizeResult;
  // Don't compare fee rates because values are picked based on comparing fees (multiplications)
  // Don't mix * / operators:
  // F.ex.: 100/27 !== 100*(1/27)
  // Instead, compare final fee
  if (fee < requiredFee)
    throw new Error(`Final fee ${fee} lower than required ${requiredFee}`);
  validateFeeRate(finalFeeRate, minimumFeeRate);
  return { fee, vsize: vsizeResult };
}
