import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { DUST_RELAY_FEE_RATE } from './index';

/**
 * Coin selection algorithms in this library throw errors for targets below the
 * dustThreshold to prevent creation of transactions that Bitcoin nodes may not
 * relay. Ensure your targets are equal or above dust with this function.
 *
 * The default `DUST_RELAY_FEE_RATE` matches Bitcoin Core's. Changing it isn't
 * recommended.
 *
 * "Dust" is defined in terms of `dustRelayFee`, measured in satoshis-per-byte
 * (it differs from Bitcoin Core's measurement in satoshis-per-kilobyte).
 * If you'd pay more in fees than the value of the output to spend something,
 * then we consider it dust.
 *
 * Examples: A typical spendable non-segwit output is 34 bytes big, and will
 * need an input of at least 148 bytes to spend:
 * `TX_INPUT_BASE + TX_INPUT_PUBKEYHASH = (32 + 4 + 1 + 4) + 107 = 148`
 * so dust is a spendable output less than
 * `(34 + 148) * dustRelayFeeRate = 182 * dustRelayFee` (in satoshis).
 * 546 satoshis at the default `DUST_RELAY_FEE_RATE` of 3 sat/vB.
 *
 * A typical spendable segwit P2WPKH output is 31 bytes big, and will
 * need an input of at least 67.75 bytes to spend, 68, rounded up:
 * so dust is a spendable output less than
 * `98 * dustRelayFee` (in satoshis).
 * 297 satoshis at the default `DUST_RELAY_FEE_RATE` of 3 sat/vB.
 *
 * Note: Bitcoin Core contains a rounding error (rounds down instead of up) that
 * generates an incorrect dust threshold for Segwit (294). See:
 * https://github.com/lightningnetwork/lnd/issues/3946#issuecomment-890222512.
 *
 * We rather return the correct value (rounding up) which, in fact, is safer
 * should Bitcoin Core fix the problem in the future.
 *
 * See Bitcoin Core implementation here:
 * https://github.com/bitcoin/bitcoin/blob/d752349029ec7a76f1fd440db2ec2e458d0f3c99/src/policy/policy.cpp#L26
 */
export function dustThreshold(
  /**
   * The `Output` instance  for which the dust threshold is computed
   */
  output: OutputInstance,
  /**
   * Fee rate (in sats/byte) used to define dust, the value of an output such
   * that it will cost more than its value in fees at this fee rate to
   * spend it.
   * @defaultValue `DUST_RELAY_FEE_RATE `= `3`
   */
  dustRelayFeeRate: number = DUST_RELAY_FEE_RATE
) {
  const isSegwitOutput = output.isSegwit();
  if (isSegwitOutput === undefined) throw new Error(`Unknown output type`);
  // When sending to scripts (such as TR, SH, or WSH) using an addr() descriptor,
  // the actual input weight may be unknown because the unlocking script isn’t provided.
  // In such cases, we fall back to a conservative estimate based on a typical P2WPKH input.
  // Bitcoin Core Wallet does similar stuff...
  //
  // The fallback is derived as follows:
  // - Non-witness part:
  //   • txid: 32 bytes
  //   • vout: 4 bytes
  //   • sequence: 4 bytes
  //   • script length: 1 byte
  //   Total non-witness bytes = 41 bytes → 41 * 4 = 164 weight units.
  // - Witness part (for P2WPKH):
  //   • push count: 1 byte
  //   • signature: 73 bytes
  //   • public key: 34 bytes
  //   Total witness bytes = 108 weight units.
  // Combined total input weight = 164 + 108 = 272 weight units.
  let inputWeight: number;
  try {
    //this may throw. F.ex. if the output is a wsh and the miniscript was
    //not provided.
    inputWeight = output.inputWeight(
      isSegwitOutput,
      'DANGEROUSLY_USE_FAKE_SIGNATURES'
    );
  } catch (err) {
    void err;
    inputWeight = 272;
  }
  return BigInt(
    Math.ceil(
      dustRelayFeeRate * Math.ceil((output.outputWeight() + inputWeight) / 4)
    )
  );
}

export function isDust(
  output: OutputInstance,
  value: bigint,
  dustRelayFeeRate: number = DUST_RELAY_FEE_RATE
) {
  if (typeof value !== 'bigint') throw new Error(`Invalid value ${value}`);
  return value < dustThreshold(output, dustRelayFeeRate);
}
