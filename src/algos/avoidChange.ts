import type { OutputWithValue } from '../index';
import { size } from '../size';

/**
 * Include inputs only when they do not exceed the target value.
 * In other words, achieve an exact match.
 *
 * utxos passed must be ordered in descending (value - fee contribution)
 */
export function avoidChange({
  utxos,
  targets,
  feeRate
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  feeRate: number;
}):
  | undefined
  | {
      utxos: Array<OutputWithValue>;
      targets: Array<OutputWithValue>;
    } {
  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputWithValue> = [];

  for (const candidate of utxos) {
    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

    const txSizeWithCandidate = size(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    //For the threshold we assume fee contribution of typical inputs:
    //https://github.com/bitcoin/bitcoin/blob/f90603ac6d24f5263649675d51233f1fce8b2ecd/src/policy/policy.cpp#L42
    const threshold = Math.ceil(
      (candidate.output.isSegwit() ? 67.75 : 148) * feeRate
    );

    console.log({
      utxosSoFarValue,
      candidateValue: candidate.value,
      targetsValue,
      txFeeWithCandidate,
      threshold
    });

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
