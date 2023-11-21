import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE, OutputWithValue } from '../index';
import { validateFeeRate, validateOutputWithValues } from '../validation';
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
}):
  | undefined
  | {
      utxos: Array<OutputWithValue>;
      targets: Array<OutputWithValue>;
    } {
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
    if (feeContribution < 0) throw new Error(`feeContribution < 0`);
    return validUtxo.value > feeContribution;
  });

  const validFee = Math.ceil(
    feeRate *
      vsize(
        utxos.map(utxo => utxo.output),
        [remainder]
      )
  );
  const validUtxosValue = validUtxos.reduce((a, utxo) => a + utxo.value, 0);
  const remainderValue = validUtxosValue - validFee;
  if (!isDust(remainder, remainderValue, dustRelayFeeRate))
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    return {
      utxos: utxos.length === validUtxos.length ? utxos : validUtxos,
      targets: [{ output: remainder, value: remainderValue }]
    };
  else return;
}
