// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

// References, acknowledgments and inspiration:
// https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
// https://bitcoinops.org/en/tools/calc-size/
// Look for byteLength: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/ts_src/transaction.ts
// https://github.com/bitcoinjs/coinselect/blob/master/utils.js

import type { PartialSig } from 'bip174/src/lib/interfaces';
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { payments } from 'bitcoinjs-lib';
import { encodingLength } from 'varuint-bitcoin';

function guessOutput(output: OutputInstance) {
  function guessSH(output: Buffer) {
    try {
      payments.p2sh({ output });
      return true;
    } catch (err) {
      return false;
    }
  }
  function guessWPKH(output: Buffer) {
    try {
      payments.p2wpkh({ output });
      return true;
    } catch (err) {
      return false;
    }
  }
  function guessPKH(output: Buffer) {
    try {
      payments.p2pkh({ output });
      return true;
    } catch (err) {
      return false;
    }
  }
  const isPKH = guessPKH(output.getScriptPubKey());
  const isWPKH = guessWPKH(output.getScriptPubKey());
  const isSH = guessSH(output.getScriptPubKey());

  if ([isPKH, isWPKH, isSH].filter(Boolean).length > 1)
    throw new Error('Cannot have multiple output types.');

  return { isPKH, isWPKH, isSH };
}

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

/**
 * When the descriptor is addr(address) then we will assume that any
 * addr(SH_TYPE_ADDRESS) is in fact SH_WPKH.
 * If you plan to use sh(ARBITRARY SCRIPT), then you must use a descriptor
 * of this type: sh(MINISCRIPT)
 */
export function inputWeight(
  input: OutputInstance,
  /**
   *  If a transaction isSegwitTx, a single byte is then also required for
   *  non-witness inputs to encode the length of the empty witness stack:
   *  encodeLength(0) + 0 = 1
   *  Read more:
   * https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c?permalink_comment_id=4760512#gistcomment-4760512
   */
  isSegwitTx: boolean,
  signatures?: Array<PartialSig>
) {
  const errorMsg =
    'Input type not implemented. Currently supported: pkh(KEY), wpkh(KEY), \
    sh(wpkh(KEY)), sh(wsh(MINISCRIPT)), sh(MINISCRIPT), wsh(MINISCRIPT), \
    addr(PKH_ADDRESS), addr(WPKH_ADDRESS), addr(SH_WPKH_ADDRESS).';

  //expand any miniscript-based descriptor. It not miniscript-based, then it's
  //an addr() descriptor. For those, we can only guess their type.
  const expansion = input.expand().expandedExpression;
  const { isPKH, isWPKH, isSH } = guessOutput(input);
  if (!expansion && !isPKH && !isWPKH && !isSH) throw new Error(errorMsg);

  if (expansion ? expansion.startsWith('pkh(') : isPKH) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (sig:73) + (pubkey:34)
      (32 + 4 + 4 + 1 + signatureSize(signatures?.[0]) + 34) * 4 +
      //Segwit:
      (isSegwitTx ? 1 : 0)
    );
  } else if (expansion ? expansion.startsWith('wpkh(') : isWPKH) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1)
      41 * 4 +
      // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
      (1 + signatureSize(signatures?.[0]) + 34)
    );
  } else if (expansion ? expansion.startsWith('sh(wpkh(') : isSH) {
    return (
      // Non-segwit: (txid:32) + (vout:4) + (sequence:4) + (script_len:1) + (p2wpkh:23)
      //  -> p2wpkh_script: OP_0 OP_PUSH20 <public_key_hash>
      //  -> p2wpkh: (script_len:1) + (script:22)
      64 * 4 +
      // Segwit: (push_count:1) + (sig:73) + (pubkey:34)
      (1 + signatureSize(signatures?.[0]) + 34)
    );
  } else if (expansion?.startsWith('sh(wsh(')) {
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
  } else if (expansion?.startsWith('sh(')) {
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
      (isSegwitTx ? 1 : 0)
    );
  } else if (expansion?.startsWith('wsh(')) {
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

export function outputWeight(output: OutputInstance) {
  const errorMsg =
    'Output type not implemented. Currently supported: pkh(KEY), wpkh(KEY), \
    sh(ANYTHING), wsh(ANYTHING), addr(PKH_ADDRESS), addr(WPKH_ADDRESS), \
    addr(SH_WPKH_ADDRESS)';

  //expand any miniscript-based descriptor. It not miniscript-based, then it's
  //an addr() descriptor. For those, we can only guess their type.
  const expansion = output.expand().expandedExpression;
  const { isPKH, isWPKH, isSH } = guessOutput(output);
  if (!expansion && !isPKH && !isWPKH && !isSH) throw new Error(errorMsg);
  if (expansion ? expansion.startsWith('pkh(') : isPKH) {
    // (p2pkh:26) + (amount:8)
    return 34 * 4;
  } else if (expansion ? expansion.startsWith('wpkh(') : isWPKH) {
    // (p2wpkh:23) + (amount:8)
    return 31 * 4;
  } else if (expansion ? expansion.startsWith('sh(') : isSH) {
    // (p2sh:24) + (amount:8)
    return 32 * 4;
  } else if (expansion?.startsWith('wsh(')) {
    // (p2wsh:35) + (amount:8)
    return 43 * 4;
  } else {
    throw new Error(errorMsg);
  }
}

/**
 * When the descriptor in an input is is addr(address) then we will assume that
 * any addr(SH_TYPE_ADDRESS) is in fact SH_WPKH.
 * If you plan to use sh(ARBITRARY SCRIPT), then you must use a descriptor
 * of this type: sh(MINISCRIPT)
 */
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
  const isSegwitTx = inputs.some(input => input.isSegwit());

  let totalWeight = 0;
  inputs.forEach(function (input, index) {
    if (signaturesPerInput)
      totalWeight += inputWeight(input, isSegwitTx, signaturesPerInput[index]);
    else totalWeight += inputWeight(input, isSegwitTx);
  });
  outputs.forEach(function (output) {
    totalWeight += outputWeight(output);
  });

  if (isSegwitTx) totalWeight += 2;

  totalWeight += 8 * 4;
  totalWeight += encodingLength(inputs.length) * 4;
  totalWeight += encodingLength(outputs.length) * 4;

  return Math.ceil(totalWeight / 4);
}
