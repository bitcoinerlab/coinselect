import type { OutputInstance } from '@bitcoinerlab/descriptors';
import type { OutputAndValue } from '../index';
import { size } from '../size';

/**
 * Continuously incorporate inputs until the target value is met or exceeded,
 * or until inputs are exhausted.
 */
export function addUntilReach({
  utxos,
  targets,
  change,
  feeRate
}: {
  /**
   * utxos are ordered in descending (value - fee contribution)
   */
  utxos: Array<OutputAndValue>;
  targets: Array<OutputAndValue>;
  change: OutputInstance;
  feeRate: number;
}) {
  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputAndValue> = [];

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
    if (candidate.value > 3 * candidateFeeContribution) {
      //if (candidate.value >= candidateFeeContribution) {
      if (
        utxosSoFarValue + candidate.value >=
        targetsValue + txFeeWithCandidate
      ) {
        const txSizeWithCandidateAndChange = size(
          [change, candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
          targets.map(target => target.output)
        );
        const txFeeWithCandidateAndChange = Math.ceil(
          txSizeWithCandidateAndChange * feeRate
        );
        const changeValue =
          utxosSoFarValue +
          candidate.value -
          (targetsValue + txFeeWithCandidateAndChange);

        return {
          utxos: [candidate.output, ...utxosSoFar],
          targets:
            changeValue > 0
              ? [{ output: change, value: changeValue }, ...targets]
              : targets
        };
      } else {
        utxosSoFar.push(candidate);
      }
    }
  }
  return;
}
