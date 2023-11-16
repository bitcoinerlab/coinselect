//TODO: first thing in coinselect and size is to validate the value in all inputs and outputs and throw if number !== integer finite > 0 < 1 Million bitcoin.
//TODO: allow addr() -> addr(sh) is assumed to be p2shp2wpkh, say so in documentation. If sh is wanted to be used for generic scripts then use sh(miniscript)
//TODO: allow float feeRate
//
//TODO: Test coinselect
//TODO: Add an algo to send FULL FUNDS to 1 target
//
//TODO: feeRate must be integer
//TODO: note that fee may end up being a float since it's depends on
//inputWeight, which, depends on my approx: https://github.com/bitcoinjs/coinselect/blob/master/accumulative.js
//TODO: inputs and outputs are undefined if no solution
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import type { OutputAndValue } from './index';
import { validateFeeRate, validateOutputAndValues } from './validation';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { inputWeight } from './size';

// order by descending value, minus the inputs approximate fee
function utxoTransferredValue(
  outputAndValue: OutputAndValue,
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
  utxos: Array<OutputAndValue>;
  targets: Array<OutputAndValue>;
  change: OutputInstance;
  feeRate: number;
}) {
  validateOutputAndValues(utxos);
  validateOutputAndValues(targets);
  validateFeeRate(feeRate);

  //We initially assume that the whole tx is segwit even if it ends up not being
  //segwit. It's segwit if there is at least one segwit utxo:
  const isSegwitTx = utxos.some(utxo => utxo.output.isSegwit());

  //Sort in descending utxoTransferredValue
  //[...utxos] because sort mutates the input
  const sortedUtxos = [...utxos].sort(
    (a, b) =>
      utxoTransferredValue(b, feeRate, isSegwitTx) -
      utxoTransferredValue(a, feeRate, isSegwitTx)
  );

  return (
    avoidChange({ utxos: sortedUtxos, targets, feeRate }) ||
    addUntilReach({ utxos: sortedUtxos, targets, change, feeRate })
  );
}
