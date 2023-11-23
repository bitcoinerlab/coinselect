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
 * Seeks a selection of UTXOs that does not necessitate the creation of change.
 * Although the function signature matches that of the standard {@link coinselect coinselect},
 * requiring a `remainder`, change is never generated. The `remainder` is used
 * to assess if hypothetical change would NOT be considered dust, thereby rendering
 * the solution unviable.
 *
 * Notes:
 *
 * - This function does not reorder UTXOs prior to selection.
 * - UTXOs that do not provide enough value to cover their respective fee contributions are automatically excluded.
 *
 * Refer to {@link coinselect coinselect} for additional details on input parameters and expected returned values.
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
  validateDust(targets);
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
    if (candidateFeeContribution < 0)
      throw new Error(`candidateFeeContribution < 0`);

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
