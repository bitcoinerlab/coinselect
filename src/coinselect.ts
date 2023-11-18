//TODO: first thing in coinselect and size is to validate the value in all inputs and outputs and throw if number !== integer finite > 0 < 1 Million bitcoin.
//TODO: allow (in input and output) addr() -> addr(sh) is assumed to be p2shp2wpkh, say so in documentation. If sh is wanted to be used for generic scripts then use sh(miniscript)
//TODO: add tests for the addr() size for inputs and outputs
//TODO: allow float feeRate
//
//TODO: Test coinselect
//TODO: Add an algo to send FULL FUNDS to 1 target
//
//TODO: note that fee may end up being a float since it's depends on
//inputWeight, which, depends on my approx: https://github.com/bitcoinjs/coinselect/blob/master/accumulative.js
//TODO: inputs and outputs are undefined if no solution
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import type { OutputWithValue } from './index';
import { validateFeeRate, validateOutputWithValues } from './validation';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { inputWeight } from './size';

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
  targets,
  change,
  feeRate
}: {
  utxos: Array<OutputWithValue>;
  targets: Array<OutputWithValue>;
  change: OutputInstance;
  feeRate: number;
}):
  | undefined
  | {
      utxos: Array<OutputWithValue>;
      targets: Array<OutputWithValue>;
    } {
  validateOutputWithValues(utxos);
  validateOutputWithValues(targets);
  validateFeeRate(feeRate);

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

  console.log({ sortedUtxos });

  const coinselected =
    avoidChange({ utxos: sortedUtxos, targets, feeRate }) ||
    addUntilReach({ utxos: sortedUtxos, targets, change, feeRate });

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
