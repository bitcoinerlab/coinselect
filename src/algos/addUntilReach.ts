import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import { validateFeeRate, validateOutputWithValues } from '../validation';
import { vsize } from '../vsize';
import { isDust } from '../dust';

/**
 * Continuously incorporate inputs until the target value is met or exceeded,
 * or until inputs are exhausted.
 *
 * utxos passed must be ordered in descending (value - fee contribution)
 */
export function addUntilReach({
  utxos,
  targets,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  validateOutputWithValues(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  if (utxos.length === 0 || targets.length === 0) return;

  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputWithValue> = [];

  for (const candidate of utxos) {
    const txSizeSoFar = vsize(
      utxosSoFar.map(utxo => utxo.output),
      targets.map(target => target.output)
    );

    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

    const txFeeSoFar = Math.ceil(txSizeSoFar * feeRate);

    const txSizeWithCandidate = vsize(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    const candidateFeeContribution = txFeeWithCandidate - txFeeSoFar;

    if (candidateFeeContribution < 0)
      throw new Error(`candidateFeeContribution < 0`);

    if (candidate.value >= candidateFeeContribution) {
      if (
        utxosSoFarValue + candidate.value >=
        targetsValue + txFeeWithCandidate
      ) {
        // Evaluate if adding remainder is beneficial (is remainderValue > 0?).
        // Note: Change is added even if it's a small amount ('dust'),
        // as receiving any amount of change back is considered worthwhile.
        const txSizeWithCandidateAndChange = vsize(
          [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
          [remainder, ...targets.map(target => target.output)]
        );
        const txFeeWithCandidateAndChange = Math.ceil(
          txSizeWithCandidateAndChange * feeRate
        );
        const remainderValue =
          utxosSoFarValue +
          candidate.value -
          (targetsValue + txFeeWithCandidateAndChange);

        return {
          utxos: [candidate, ...utxosSoFar],
          targets: isDust(remainder, remainderValue, dustRelayFeeRate)
            ? targets
            : [...targets, { output: remainder, value: remainderValue }]
        };
      } else {
        utxosSoFar.push(candidate);
      }
    }
  }
  return;
}
