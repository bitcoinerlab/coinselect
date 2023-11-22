import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import {
  validateFeeRate,
  validateOutputWithValues,
  validateDust,
  validatedFeeAndVsize
} from '../validation';
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
  validateDust(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

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
      throw new Error(`candidateFeeContribution < 0`); //TODO, simply return? maybe we dont have enough inpuyt value? This has to be applied in rest of algos

    // Only consider inputs with more value than the fee they require
    if (candidate.value > candidateFeeContribution) {
      if (
        utxosSoFarValue + candidate.value >=
        targetsValue + txFeeWithCandidate
      ) {
        // Evaluate if adding remainder is beneficial
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
        if (remainderValue < 0) throw new Error(`remainderValue < 0`);

        //return the same reference if nothing changed to interact nicely with
        //reactive components
        const utxosResult = [candidate, ...utxosSoFar];
        const targetsResult = isDust(
          remainder,
          remainderValue,
          dustRelayFeeRate
        )
          ? targets
          : [...targets, { output: remainder, value: remainderValue }];
        return {
          utxos: utxosResult.length === utxos.length ? utxos : utxosResult,
          targets: targetsResult,
          ...validatedFeeAndVsize(utxosResult, targetsResult, feeRate)
        };
      } else {
        utxosSoFar.push(candidate);
      }
    }
  }
  return;
}
