// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

// https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
// Look for byteLength: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/ts_src/transaction.ts
// https://bitcoinops.org/en/tools/calc-size/
// https://github.com/bitcoinjs/coinselect/blob/master/utils.js

import type { PartialSig } from 'bip174/src/lib/interfaces';
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { payments } from 'bitcoinjs-lib';
import { encodingLength } from 'varuint-bitcoin';

function varSliceSize(someScript: Buffer): number {
  const length = someScript.length;

  return encodingLength(length) + length;
}

function vectorSize(someVector: Buffer[]): number {
  const length = someVector.length;

  return (
    encodingLength(length) +
    someVector.reduce((sum, witness) => {
      return sum + varSliceSize(witness);
    }, 0)
  );
}

/**
 * This function will typically return 73; since it assumes a signature size of
 * 72 bytes (this is the max size of a DER encoded signature) and it adds 1
 * extra byte for encoding its length
 */
function signatureSize(signature?: PartialSig) {
  const length = signature?.signature?.length || 72;
  return encodingLength(length) + length;
}

export function inputBytes(
  input: OutputInstance,
  /**
   *  If a transaction hasWitness, a single byte is then also required for
   *  non-witness inputs to encode the length of the empty witness stack:
   *  encodeLength(0) + 0 = 1
   *  Read more:
   * https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c?permalink_comment_id=4760512#gistcomment-4760512
   */
  txHasWitness: boolean,
  signatures?: Array<PartialSig>
) {
  const errorMsg =
    'Input type not implemented. Currently supported: pkh(KEY), wpkh(KEY), sh(wpkh(KEY)), sh(wsh(MINISCRIPT)), sh(MINISCRIPT), wsh(MINISCRIPT).';

  const expandedExpression = input.expand().expandedExpression;
  if (!expandedExpression) throw new Error(errorMsg);

  if (expandedExpression.startsWith('pkh(')) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (sig:73) + (pubkey:34)
      (32 + 4 + 4 + 1 + signatureSize(signatures?.[0]) + 34) * 4 +
      //Segwit:
      (txHasWitness ? 1 : 0)
    );
  } else if (expandedExpression.startsWith('wpkh(')) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1)
      41 * 4 +
      // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
      (1 + signatureSize(signatures?.[0]) + 34)
    );
  } else if (expandedExpression.startsWith('sh(wpkh(')) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (p2wpkh:23)
      //  -> p2wpkh_script: OP_0 OP_PUSH20 <public_key_hash>
      //  -> p2wpkh: (script_len:1) + (script:22)
      64 * 4 +
      // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
      (1 + signatureSize(signatures?.[0]) + 34)
    );
  } else if (expandedExpression.startsWith('sh(wsh(')) {
    const witnessScript = input.getWitnessScript();
    if (!witnessScript) throw new Error('sh(wsh) must provide witnessScript');
    const payment = payments.p2sh({
      redeem: payments.p2wsh({
        redeem: {
          input: input.getScriptSatisfaction(
            signatures || 'DANGEROUSLY_USE_FAKE_SIGNATURES'
          ),
          output: witnessScript
        }
      })
    });
    if (!payment || !payment.input || !payment.witness)
      throw new Error('Could not create payment');
    return (
      //Non-segwit
      4 * (40 + varSliceSize(payment.input)) +
      //Segwit
      vectorSize(payment.witness)
    );
  } else if (expandedExpression.startsWith('sh(')) {
    const redeemScript = input.getRedeemScript();
    if (!redeemScript) throw new Error('sh() must provide redeemScript');
    const payment = payments.p2sh({
      redeem: {
        input: input.getScriptSatisfaction(
          signatures || 'DANGEROUSLY_USE_FAKE_SIGNATURES'
        ),
        output: redeemScript
      }
    });
    if (!payment || !payment.input) throw new Error('Could not create payment');
    if (payment.witness?.length)
      throw new Error('A legacy p2sh payment should not cointain a witness');
    return (
      //Non-segwit
      4 * (40 + varSliceSize(payment.input)) +
      //Segwit:
      (txHasWitness ? 1 : 0)
    );
  } else if (expandedExpression.startsWith('wsh(')) {
    const witnessScript = input.getWitnessScript();
    if (!witnessScript) throw new Error('wsh must provide witnessScript');
    const payment = payments.p2wsh({
      redeem: {
        input: input.getScriptSatisfaction(
          signatures || 'DANGEROUSLY_USE_FAKE_SIGNATURES'
        ),
        output: witnessScript
      }
    });
    if (!payment || !payment.input || !payment.witness)
      throw new Error('Could not create payment');
    return (
      //Non-segwit
      4 * (40 + varSliceSize(payment.input)) +
      //Segwit
      vectorSize(payment.witness)
    );
  } else {
    throw new Error(errorMsg);
  }
}

export function outputBytes(output: OutputInstance) {
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
  outputs: Array<OutputInstance>,
  /** For testing purposes only. It can be used to obtain the exact
   * size of the signatures.
   * If not passed, then signatures are assumed to be 72 bytes length:
   * https://transactionfee.info/charts/bitcoin-script-ecdsa-length/
   */
  signaturesPerInput?: Array<Array<PartialSig>>
) {
  let hasWitness = false;
  let totalWeight = 0;
  inputs.forEach(function (input) {
    if (input.isSegwit()) hasWitness = true;
  });
  inputs.forEach(function (input, index) {
    if (signaturesPerInput)
      totalWeight += inputBytes(input, hasWitness, signaturesPerInput[index]);
    else totalWeight += inputBytes(input, hasWitness);
  });
  outputs.forEach(function (output) {
    totalWeight += outputBytes(output);
  });

  if (hasWitness) totalWeight += 2;

  totalWeight += 8 * 4;
  totalWeight += encodingLength(inputs.length) * 4;
  totalWeight += encodingLength(outputs.length) * 4;

  return Math.ceil(totalWeight / 4);
}
