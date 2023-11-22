import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { payments } from 'bitcoinjs-lib';

export function guessOutput(output: OutputInstance) {
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

/**
 * It assumes that an addr(SH_ADDRESS) is always a add(SH_WPKH) address
 */
export function isSegwit(output: OutputInstance) {
  let isSegwit = output.isSegwit();
  const expansion = output.expand().expandedExpression;
  const { isPKH, isWPKH, isSH } = guessOutput(output);
  //expansion is not generated for addr() descriptors:
  if (!expansion && isPKH) isSegwit = false;
  if (!expansion && isWPKH) isSegwit = true;
  if (!expansion && isSH) isSegwit = true; //Assume PSH-P2WPKH
  if (isSegwit === undefined)
    throw new Error('Cannot guess whether the Output is Segwit or not');
  //we will assume that any addr(SH_TYPE_ADDRESS) is in fact SH_WPKH.
  return isSegwit;
}

export const isSegwitTx = (inputs: Array<OutputInstance>) =>
  inputs.some(input => isSegwit(input));
