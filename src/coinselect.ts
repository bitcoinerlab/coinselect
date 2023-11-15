//TODO: feeRate must be integer
//TODO: note that fee may end up being a float since it's depends on
//inputBytes, which, depends on my approx: https://github.com/bitcoinjs/coinselect/blob/master/accumulative.js
//TODO: inputs and outputs are undefined if no solution
import type { OutputInstance } from '@bitcoinerlab/descriptors';
const bjsCoinselect = require('coinselect');
const bjsCoinselectSplit = require('coinselect/split');
import { inputBytes, outputBytes } from './size';
import type { OutputAndValue } from './index';

// Corrects: https://github.com/bitcoinjs/coinselect/blob/master/utils.js
const TX_INPUT_BASE = 32 + 4 + 1 + 4;
const TX_OUTPUT_BASE = 8 + 1;

export function coinselect({
  utxos,
  targets,
  feeRate,
  changeOutput
}: {
  utxos: Array<OutputAndValue>;
  targets: Array<OutputAndValue>;
  feeRate: number;
  changeOutput: OutputInstance;
}) {
  //From coinselect lib:
  //https://github.com/bitcoinjs/coinselect
  //Pro-tip: if you want to send-all inputs to an output address, coinselect/split with a partial output (.address defined, no .value) can be used to send-all, while leaving an appropriate amount for the fee.

  const coinSelectAlgo =
    targets.length === 1 && typeof targets[0]?.value === 'undefined'
      ? bjsCoinselectSplit
      : bjsCoinselect;

  const txHasWitness = utxos.some(utxoInfo => utxoInfo.output.isSegwit());

  let addedExtraWitnessBytes = false;

  const csUtxos = utxos.map(utxo => {
    if (typeof utxo.value === 'undefined')
      throw new Error('Provide values to all utxos');
    const extraWitnessBytes = addedExtraWitnessBytes ? 0 : 2 / 4;
    addedExtraWitnessBytes = true;
    return {
      value: utxo.value,
      //Corrects: https://github.com/bitcoinjs/coinselect/blob/master/utils.js
      script: {
        length:
          inputBytes(utxo.output, txHasWitness) / 4 -
          TX_INPUT_BASE +
          extraWitnessBytes
      }
    };
  });
  const csTargets = targets.map(target => {
    return {
      value: target.value,
      //Corrects: https://github.com/bitcoinjs/coinselect/blob/master/utils.js
      script: { length: outputBytes(target.output) / 4 - TX_OUTPUT_BASE }
    };
  });

  console.log(changeOutput);
  console.log(JSON.stringify({ csUtxos, csTargets, feeRate }, null, 2));
  const { inputs, outputs, fee } = coinSelectAlgo(csUtxos, csTargets, feeRate);
  console.log(JSON.stringify({ inputs, outputs, fee }, null, 2));
}
