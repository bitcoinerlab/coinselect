//TODO: add tests for the addr() size for inputs and outputs: addresses types: pkh, wpkh, sh(wpkh)
//  -> addr(sh) is assumed to be p2shp2wpkh, say so in documentation. If sh is wanted to be used for generic scripts then use sh(miniscript)
//TODO: test send max funds
//TODO: Add a way to receive change. Pass one vout with empty value. Then check is one at most. Or pass a  "remainder"? But then you must pass the target value.
//TODO: note that fee may end up being a float since it's depends on
//inputWeight, which, depends on my approx: https://github.com/bitcoinjs/coinselect/blob/master/accumulative.js
//TODO: inputs and outputs are undefined if no solution
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { OutputWithValue, DUST_RELAY_FEE_RATE } from './index';
import { validateFeeRate, validateOutputWithValues } from './validation';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { inputWeight } from './vsize';

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

export function coinselect({
  utxos,
  targets = [],
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  remainder?: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}):
  | undefined
  | {
      utxos: Array<OutputWithValue>;
      targets: Array<OutputWithValue>;
    } {
  validateOutputWithValues(utxos);
  validateOutputWithValues(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);
  if (utxos.length === 0 || (targets.length === 0 && !remainder)) return;

  //We will assume that the tx is segwit if there is at least one segwit
  //utxo for computing the utxo ordering. This is an approximation.
  //Note that having one segwit utxo does not mean the final tx will be segwit
  //(because the coinselect algo may end up choosing only non-segwit utxos).
  const isPossiblySegwitTx = utxos.some(utxo => utxo.output.isSegwit());

  //Sort in descending utxoTransferredValue
  //Using [...utxos] because sort mutates the input
  const sortedUtxos = [...utxos].sort(
    (a, b) =>
      utxoTransferredValue(b, feeRate, isPossiblySegwitTx) -
      utxoTransferredValue(a, feeRate, isPossiblySegwitTx)
  );

  const coinselected =
    avoidChange({ utxos: sortedUtxos, targets, feeRate, dustRelayFeeRate }) ||
    (remainder &&
      addUntilReach({
        utxos: sortedUtxos,
        targets,
        remainder,
        feeRate,
        dustRelayFeeRate
      }));

  if (!coinselected) return;

  //return the same reference if nothing changed to interact nicely with
  //reactive components
  utxos =
    coinselected.utxos.length === utxos.length ? utxos : coinselected.utxos;
  targets =
    coinselected.targets.length === targets.length
      ? targets
      : coinselected.targets;

  return { utxos, targets };
}
