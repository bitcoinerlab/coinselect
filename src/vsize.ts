// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

// References, acknowledgments and inspiration:
// https://gist.github.com/junderw/b43af3253ea5865ed52cb51c200ac19c
// https://bitcoinops.org/en/tools/calc-size/
// Look for byteLength: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/ts_src/transaction.ts
// https://github.com/bitcoinjs/coinselect/blob/master/utils.js

import type { PartialSig } from 'bip174';
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { encodingLength } from 'varuint-bitcoin';

export const isSegwitTx = (inputs: Array<OutputInstance>) =>
  inputs.some(input => input.isSegwit());

/**
 * Computes the virtual size (vsize) of a Bitcoin transaction based on specified
 * inputs and outputs.
 *
 * @returns The computed virtual size (vsize) of the transaction, rounded up to
 * the nearest integer.
 *
 * *NOTE:* When the descriptor in an input is `addr(address)`, it is assumed
 * that any `addr(SH_TYPE_ADDRESS)` is in fact a Segwit `SH_WPKH`
 * (Script Hash-Witness Public Key Hash).
 * For inputs using arbitrary scripts (not standard addresses),
 * use a descriptor in the format `sh(MINISCRIPT)`.
 * Similarly, add(TR_TYPE_ADDRESS) is assumed to be a single-key tr address.
 *
 * @example
 * ```
 * const vsizeValue = vsize(
 *   [new Output({ descriptor: 'addr(...)' })], // inputs
 *   [new Output({ descriptor: 'addr(...)' })]  // outputs
 * );
 * ```
 *
 * @see {@link https://bitcoinerlab.com/modules/descriptors} for details on
 * OutputInstance and descriptors.
 */
export function vsize(
  /**
   * Array of `OutputInstance` representing the inputs of the transaction.
   */
  inputs: Array<OutputInstance>,

  /**
   * Array of `OutputInstance` representing the outputs of the transaction.
   */
  outputs: Array<OutputInstance>,

  /**
   * Optional array of arrays containing signatures.
   * The outer array corresponds to each input in the transaction. The inner array contains
   * signatures for each public key associated with the respective input.
   *
   * If provided, enables calculation of exact signature sizes.
   * Defaults to assuming 72 bytes per signature.
   * Mainly used for testing and accurate fee estimation.
   */
  signaturesPerInput?: Array<Array<PartialSig>>
) {
  const isSegwitTxValue = isSegwitTx(inputs);

  let totalWeight = 0;
  inputs.forEach(function (input, index) {
    if (signaturesPerInput) {
      const signatures = signaturesPerInput[index];
      if (!signatures)
        throw new Error(`signaturesPerInput not defined for ${index}`);
      totalWeight += input.inputWeight(isSegwitTxValue, signatures);
    } else
      totalWeight += input.inputWeight(
        isSegwitTxValue,
        'DANGEROUSLY_USE_FAKE_SIGNATURES'
      );
  });
  outputs.forEach(function (output) {
    totalWeight += output.outputWeight();
  });

  if (isSegwitTxValue) totalWeight += 2;

  totalWeight += 8 * 4;
  totalWeight += encodingLength(inputs.length) * 4;
  totalWeight += encodingLength(outputs.length) * 4;

  return Math.ceil(totalWeight / 4);
}
