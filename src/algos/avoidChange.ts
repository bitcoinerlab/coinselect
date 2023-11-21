import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import {
  validateFeeRate,
  validateOutputWithValues,
  validatedFeeAndVsize
} from '../validation';
import { vsize } from '../vsize';
import { isDust } from '../dust';

/**
 * Include inputs only when they do not exceed the target value.
 * In other words, achieve an exact match.
 *
 * utxos passed must be ordered in descending (value - fee contribution)
 *
 * Note that remainder is never used to create a target; however it is used
 * to compute dust: Would this algo add change if it were possible?
 */
export function avoidChange({
  utxos,
  targets,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  /**
   * This is the hypotetical change that this algo will check it would
   * never be needed
   */
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  validateOutputWithValues(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputWithValue> = [];

  for (const candidate of utxos) {
    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

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

    const txSizeWithCandidate = vsize(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    const txSizeSoFar = vsize(
      utxosSoFar.map(utxo => utxo.output),
      targets.map(target => target.output)
    );
    const txFeeSoFar = Math.ceil(txSizeSoFar * feeRate);
    const candidateFeeContribution = txFeeWithCandidate - txFeeSoFar;

    // Only consider inputs with more value than the fee they require
    if (candidate.value > candidateFeeContribution) {
      //Check that adding the candidate utxo would NOT imply that change was needed:
      if (isDust(remainder, remainderValue, dustRelayFeeRate)) {
        //Enough utxo value already so that it covers targets and fee?
        if (
          utxosSoFarValue + candidate.value >=
          targetsValue + txFeeWithCandidate
        ) {
          //return the same reference if nothing changed to interact nicely with
          //reactive components
          const utxosResult = [candidate, ...utxosSoFar];
          return {
            utxos: utxosResult.length === utxos.length ? utxos : utxosResult,
            targets,
            ...validatedFeeAndVsize(utxosResult, targets, feeRate)
          };
        } else utxosSoFar.push(candidate);
      }
    }
  }
  return;
}
