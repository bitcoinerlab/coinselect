//TODO: npm push new version of descriptors with getScriptSatisfactionSize

// byteLength: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/ts_src/transaction.ts
// https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
// https://bitcoinops.org/en/tools/calc-size/
// https://github.com/bitcoinjs/coinselect/blob/master/utils.js

import type { OutputInstance } from '@bitcoinerlab/descriptors';

function checkUInt53(n: number) {
  if (n < 0 || n > Number.MAX_SAFE_INTEGER || n % 1 !== 0)
    throw new RangeError('value out of range');
}

function varIntLength(number: number) {
  checkUInt53(number);

  return number < 0xfd
    ? 1
    : number <= 0xffff
    ? 3
    : number <= 0xffffffff
    ? 5
    : 9;
}

function inputBytes(input: OutputInstance) {
  const errorMsg =
    'Input type not implemented. Currently supported: pkh(KEY), wpkh(KEY), sh(wpkh(KEY)), sh(wsh(MINISCRIPT)), sh(MINISCRIPT), wsh(MINISCRIPT)';

  const expandedExpression = input.expand().expandedExpression;
  if (!expandedExpression) throw new Error('Invalid input');

  if (expandedExpression.startsWith('pkh(')) {
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (sig:73) + (pubkey:34)
    return 148 * 4;
  } else if (expandedExpression.startsWith('wpkh(')) {
    // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1)
    return 108 + 41 * 4;
  } else if (expandedExpression.startsWith('sh(wpkh(')) {
    // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (p2wpkh:23)
    //  -> p2wpkh_script: OP_0 OP_PUSH20 <public_key_hash>
    //  -> p2wpkh: (script_len:1) + (script:22)
    return 108 + 64 * 4;
  } else if (expandedExpression.startsWith('sh(wsh(')) {
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (p2wsh:35)
    //  -> p2wsh: uses sha256 instead of hash160, so 12 more bytes than that p2wpkh above
    //  -> p2wsh_script: OP_0 OP_PUSH32 <sha256_of_script>
    //  -> p2wsh: (script_len:1) + (script:34)
    const scriptWitnessSize = input.getScriptSatisfactionSize();
    if (scriptWitnessSize === undefined) throw new Error(errorMsg);
    const witnessScriptSize = input.getWitnessScript()?.length;
    if (witnessScriptSize === undefined) throw new Error(errorMsg);
    return (
      varIntLength(scriptWitnessSize) +
      scriptWitnessSize +
      varIntLength(witnessScriptSize) +
      witnessScriptSize +
      76 * 4
    );
  } else if (expandedExpression.startsWith('sh(')) {
    // Regular sh(MINISCRIPT)
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (locking_len) + (locking) + (unlocking_len) + (ulocking):
    const scriptSatisfactionSize = input.getScriptSatisfactionSize();
    if (scriptSatisfactionSize === undefined) throw new Error(errorMsg);
    const lockingScriptSize = input.getRedeemScript()?.length;
    if (lockingScriptSize === undefined) throw new Error(errorMsg);
    return (
      (varIntLength(scriptSatisfactionSize) +
        scriptSatisfactionSize +
        varIntLength(lockingScriptSize) +
        lockingScriptSize +
        40) *
      4
    );
  } else if (expandedExpression.startsWith('wsh(')) {
    // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1)
    const scriptWitnessSize = input.getScriptSatisfactionSize();
    if (scriptWitnessSize === undefined) throw new Error(errorMsg);
    const witnessScriptSize = input.getWitnessScript()?.length;
    if (witnessScriptSize === undefined) throw new Error(errorMsg);
    return (
      varIntLength(scriptWitnessSize) +
      scriptWitnessSize +
      varIntLength(witnessScriptSize) +
      witnessScriptSize +
      41 * 4
    );
  } else {
    throw new Error(errorMsg);
  }
}

function outputBytes(output: OutputInstance) {
  const expandedExpression = output.expand().expandedExpression;
  if (!expandedExpression) throw new Error('Invalid output');
  const errorMsg =
    'Output type not implemented. Currently supported: pkh(KEY), wpkh(KEY), sh(ANYTHING), wsh(ANYTHING)';
  if (expandedExpression.startsWith('pkh(')) {
    // (p2pkh:26) + (amount:8)
    return 34 * 4;
  } else if (expandedExpression.startsWith('wpkh(')) {
    // (p2wpkh:23) + (amount:8)
    return 31 * 4;
  } else if (expandedExpression.startsWith('sh(')) {
    // (p2sh:24) + (amount:8)
    return 32 * 4;
  } else if (expandedExpression.startsWith('wsh(')) {
    // (p2wsh:35) + (amount:8)
    return 43 * 4;
  } else {
    throw new Error(errorMsg);
  }
}

export function size(
  inputs: Array<OutputInstance>,
  outputs: Array<OutputInstance>
) {
  let hasWitness = false;
  let totalWeight = 0;
  inputs.forEach(function (input) {
    totalWeight += inputBytes(input);
    if (input.isSegwit()) hasWitness = true;
  });
  outputs.forEach(function (output) {
    totalWeight += outputBytes(output);
  });

  console.log({ hasWitness });

  if (hasWitness) totalWeight += 2;

  totalWeight += 8 * 4;
  totalWeight += varIntLength(inputs.length) * 4;
  totalWeight += varIntLength(outputs.length) * 4;

  console.log('COMPUTED TEORICAL MAX SIZE', totalWeight / 4);

  return Math.ceil(totalWeight / 4);
}
