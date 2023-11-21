import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import {
  validateFeeRate,
  validateOutputWithValues,
  validatedFeeAndVsize
} from '../validation';
import { vsize } from '../vsize';
import { isDust } from '../dust';

export function maxFunds({
  utxos,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  /**
   * target to send maxFunds
   */
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  const allUtxosFee = Math.ceil(
    feeRate *
      vsize(
        utxos.map(utxo => utxo.output),
        [remainder]
      )
  );

  // Only consider inputs with more value than the fee they require
  const validUtxos = utxos.filter(validUtxo => {
    const txSizeWithoutUtxo = vsize(
      utxos.filter(utxo => utxo !== validUtxo).map(utxo => utxo.output),
      [remainder]
    );
    const feeContribution =
      allUtxosFee - Math.ceil(feeRate * txSizeWithoutUtxo);
    if (feeContribution < 0) throw new Error(`feeContribution < 0`); //TODO, simply return? maybe we dont have enough inpuyt value? This has to be applied in rest of algos
    return validUtxo.value > feeContribution;
  });

  const validFee = Math.ceil(
    feeRate *
      vsize(
        validUtxos.map(utxo => utxo.output),
        [remainder]
      )
  );
  const validUtxosValue = validUtxos.reduce((a, utxo) => a + utxo.value, 0);
  const remainderValue = validUtxosValue - validFee;
  if (remainderValue < 0) throw new Error(`remainderValue < 0`);
  if (!isDust(remainder, remainderValue, dustRelayFeeRate)) {
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    const targets = [{ output: remainder, value: remainderValue }];
    return {
      utxos: utxos.length === validUtxos.length ? utxos : validUtxos,
      targets,
      ...validatedFeeAndVsize(validUtxos, targets, feeRate)
    };
  } else return;
}
