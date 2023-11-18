import type { OutputInstance } from '@bitcoinerlab/descriptors';
import type { OutputWithValue } from '../index';
import { size } from '../size';

/**
 * Continuously incorporate inputs until the target value is met or exceeded,
 * or until inputs are exhausted.
 *
 * utxos passed must be ordered in descending (value - fee contribution)
 */
export function addUntilReach({
  utxos,
  targets,
  change,
  feeRate
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  change: OutputInstance;
  feeRate: number;
}) {
  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputWithValue> = [];

  for (const candidate of utxos) {
    const txSizeSoFar = size(
      utxosSoFar.map(utxo => utxo.output),
      targets.map(target => target.output)
    );

    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

    const txFeeSoFar = Math.ceil(txSizeSoFar * feeRate);

    const txSizeWithCandidate = size(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    const candidateFeeContribution = txFeeWithCandidate - txFeeSoFar;

    if (candidateFeeContribution < 0)
      throw new Error(`candidateFeeContribution < 0`);

    // If you'd pay more than 1/3 in fees
    // to spend something, then we consider it dust.
    // https://github.com/bitcoin/bitcoin/blob/f90603ac6d24f5263649675d51233f1fce8b2ecd/src/policy/policy.cpp#L20
    //if (candidate.value >= candidateFeeContribution) {
    if (candidate.value > 3 * candidateFeeContribution) {
      if (
        utxosSoFarValue + candidate.value >=
        targetsValue + txFeeWithCandidate
      ) {
        // Evaluate if adding change is beneficial (is changeValue > 0?).
        // Note: Change is added even if it's a small amount ('dust'),
        // as receiving any amount of change back is considered worthwhile.
        const txSizeWithCandidateAndChange = size(
          [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
          [change, ...targets.map(target => target.output)]
        );
        const txFeeWithCandidateAndChange = Math.ceil(
          txSizeWithCandidateAndChange * feeRate
        );
        const changeValue =
          utxosSoFarValue +
          candidate.value -
          (targetsValue + txFeeWithCandidateAndChange);

        //const threshold = Math.ceil(
        //  (candidate.output.isSegwit() ? 67.75 : 148) * feeRate
        //);
        return {
          utxos: [candidate, ...utxosSoFar],
          targets:
            // changeValue > threshold
            // Add change if changeValue is larger than threshold

            // changeValue > 0
            // Add change if changeValue is positive; ignore if it's minimal ('dust')

            changeValue > 0
              ? [...targets, { output: change, value: changeValue }]
              : targets
        };
      } else {
        utxosSoFar.push(candidate);
      }
    }
  }
  return;
}
