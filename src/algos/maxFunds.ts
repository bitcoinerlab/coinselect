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
 * The `maxFunds` algorithm is tailored for scenarios where the goal is to transfer all funds from specified UTXOs to a single recipient output.
 * To utilize this function, specify the recipient output in the `remainder` argument.
 * In this context, the `remainder` serves as the recipient of the funds.
 *
 * Notes:
 *
 * - This function does not reorder UTXOs prior to selection.
 * - UTXOs that do not provide enough value to cover their respective fee contributions are automatically excluded.
 * - Recipient of all funds is set to last position of the returned `targets` array.
 *
 * Refer to {@link coinselect coinselect} for additional details on input parameters and expected returned values.
 */
export function maxFunds({
  utxos,
  targets,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  /**
   * Recipient to send maxFunds
   */
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  if (targets.length) validateOutputWithValues(targets);
  validateDust(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  const outputs = [...targets.map(target => target.output), remainder];
  const targetsValue = targets.reduce((a, target) => a + target.value, 0n);

  const allUtxosFee = BigInt(
    Math.ceil(
      feeRate *
        vsize(
          utxos.map(utxo => utxo.output),
          outputs
        )
    )
  );

  // Only consider inputs with more value than the fee they require
  const validUtxos = utxos.filter(validUtxo => {
    const txSizeWithoutUtxo = vsize(
      utxos.filter(utxo => utxo !== validUtxo).map(utxo => utxo.output),
      outputs
    );
    const feeContribution =
      allUtxosFee - BigInt(Math.ceil(feeRate * txSizeWithoutUtxo));
    if (feeContribution < 0n) throw new Error(`feeContribution < 0`);
    return validUtxo.value > feeContribution;
  });

  const validFee = BigInt(
    Math.ceil(
      feeRate *
        vsize(
          validUtxos.map(utxo => utxo.output),
          outputs
        )
    )
  );
  const validUtxosValue = validUtxos.reduce((a, utxo) => a + utxo.value, 0n);
  const remainderValue = validUtxosValue - targetsValue - validFee;
  if (!isDust(remainder, remainderValue, dustRelayFeeRate)) {
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    //mutate targets:
    targets = [...targets, { output: remainder, value: remainderValue }];
    return {
      utxos: utxos.length === validUtxos.length ? utxos : validUtxos,
      targets,
      ...validatedFeeAndVsize(validUtxos, targets, feeRate)
    };
  } else return;
}
