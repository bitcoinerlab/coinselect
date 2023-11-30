//TODO: docs: add a reference to the API
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { OutputWithValue, DUST_RELAY_FEE_RATE } from './index';
import {
  validateFeeRate,
  validateOutputWithValues,
  validateDust
} from './validation';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { inputWeight } from './vsize';
import { isSegwitTx } from './segwit';

// order by descending value, minus the inputs approximate fee
function utxoTransferredValue(
  outputAndValue: OutputWithValue,
  feeRate: number,
  isSegwitTx: boolean
) {
  return (
    outputAndValue.value -
    (feeRate * inputWeight(outputAndValue.output, isSegwitTx)) / 4
  );
}

/**
 * Selects UTXOs for a Bitcoin transaction.
 *
 * Sorts UTXOs by their descending net value
 * (each UTXO's value minus the fees needed to spend it).
 *
 * It initially attempts to find a solution using the
 * {@link avoidChange avoidChange} algorithm,
 * which aims to select UTXOs such that no change is required. If this is not
 * possible, it then applies the {@link addUntilReach addUntilReach} algorithm,
 * which adds UTXOs
 * until the total value exceeds the target value plus fees.
 * Change is added only if it's above the {@link dustThreshold dustThreshold}).
 *
 * UTXOs that do not provide enough value to cover their respective fee
 * contributions are automatically excluded.
 *
 * *NOTE:* When the descriptor in an input is `addr(address)`, it is assumed
 * that any `addr(SH_TYPE_ADDRESS)` is in fact a Segwit `SH_WPKH`
 * (Script Hash-Witness Public Key Hash).
 * For inputs using arbitrary scripts (not standard addresses),
 * use a descriptor in the format `sh(MINISCRIPT)`.
 *
 * @returns Object with selected UTXOs, targets, fee, and estimated vsize, or
 *          undefined if no solution is found.
 *
 * @example
 * ```
 * const { utxos, targets, fee, vsize } = coinselect({
 *   utxos: [
 *     { output: new Output({ descriptor: 'addr(...)' }), value: 2000 },
 *     { output: new Output({ descriptor: 'addr(...)' }), value: 4000 }
 *   ],
 *   targets: [
 *     { output: new Output({ descriptor: 'addr(...)' }), value: 3000 }
 *   ],
 *   remainder: new Output({ descriptor: 'addr(...)' }),
 *   feeRate: 1.34
 * });
 * ```
 *
 * @see {@link https://bitcoinerlab.com/modules/descriptors} for descriptor info.
 */
export function coinselect({
  utxos,
  targets,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  /**
   * Array of UTXOs for the transaction. Each UTXO includes an `OutputInstance`
   * and its value.
   */
  utxos: Array<OutputWithValue>;
  /**
   * Array of transaction targets. If specified, `remainder` is used
   * as the change address.
   */
  targets: Array<OutputWithValue>;
  /**
   * `OutputInstance` used as the change address when targets are specified,
   * or as the recipient address for maximum fund transactions.
   */
  remainder: OutputInstance;
  /*
   * Fee rate in satoshis per byte.
   */
  feeRate: number;
  /**
   * Fee rate used to calculate the dust threshold for transaction
   * outputs. Defaults to standard dust relay fee rate if not specified.
   * @defaultValue 3
   */
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  if (targets) {
    validateOutputWithValues(targets);
    validateDust(targets);
  }
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  //We will assume that the tx is segwit if there is at least one segwit
  //utxo for computing the utxo ordering. This is an approximation.
  //Note that having one segwit utxo does not mean the final tx will be segwit
  //(because the coinselect algo may end up choosing only non-segwit utxos).

  const isPossiblySegwitTx = isSegwitTx(utxos.map(utxo => utxo.output));
  //Sort in descending utxoTransferredValue
  //Using [...utxos] because sort mutates the input
  const sortedUtxos = [...utxos].sort(
    (a, b) =>
      utxoTransferredValue(b, feeRate, isPossiblySegwitTx) -
      utxoTransferredValue(a, feeRate, isPossiblySegwitTx)
  );
  const coinselected =
    avoidChange({
      utxos: sortedUtxos,
      targets,
      remainder,
      feeRate,
      dustRelayFeeRate
    }) ||
    addUntilReach({
      utxos: sortedUtxos,
      targets,
      remainder,
      feeRate,
      dustRelayFeeRate
    });
  if (coinselected) {
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    utxos =
      coinselected.utxos.length === utxos.length ? utxos : coinselected.utxos;
    targets =
      coinselected.targets.length === targets?.length
        ? targets
        : coinselected.targets;

    return { utxos, targets, fee: coinselected.fee, vsize: coinselected.vsize };
  } else return;
}
