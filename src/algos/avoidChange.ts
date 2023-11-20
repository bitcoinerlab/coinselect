import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import { validateFeeRate, validateOutputWithValues } from '../validation';
import { vsize } from '../vsize';

/**
 * Include inputs only when they do not exceed the target value.
 * In other words, achieve an exact match.
 *
 * utxos passed must be ordered in descending (value - fee contribution)
 */
export function avoidChange({
  utxos,
  targets,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  feeRate: number;
  dustRelayFeeRate?: number;
}):
  | undefined
  | {
      utxos: Array<OutputWithValue>;
      targets: Array<OutputWithValue>;
    } {
  validateOutputWithValues(utxos);
  validateOutputWithValues(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);
  if (utxos.length === 0 || targets.length === 0) return;

  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputWithValue> = [];

  if (utxos.length === 0 || targets.length === 0) return;

  for (const candidate of utxos) {
    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

    const txSizeWithCandidate = vsize(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    // https://github.com/bitcoin/bitcoin/blob/d752349029ec7a76f1fd440db2ec2e458d0f3c99/src/policy/policy.cpp#L26

    const threshold =
      dustRelayFeeRate *
      (candidate.output.isSegwit()
        ? /*wpkh out:*/ 31 + /*wpkh in:*/ (32 + 4 + 1 + 107 / 4 + 4)
        : /*pkh out:*/ 34 + /*pkh in:*/ 32 + 4 + 1 + 107 + 4);
    if (
      utxosSoFarValue + candidate.value <=
      targetsValue + txFeeWithCandidate + threshold
    ) {
      if (
        utxosSoFarValue + candidate.value >=
        targetsValue + txFeeWithCandidate
      )
        return { utxos: [candidate, ...utxosSoFar], targets };
      else utxosSoFar.push(candidate);
    }
  }
  return;
}
