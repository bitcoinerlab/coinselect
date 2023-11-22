import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { inputWeight, outputWeight } from './vsize';
import { isSegwit } from './segwit';
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
  const isSegwitOutput = isSegwit(output);
  return Math.ceil(
    dustRelayFeeRate *
      Math.ceil(
        (outputWeight(output) + inputWeight(output, isSegwitOutput)) / 4
      )
  );
}

export function isDust(
  output: OutputInstance,
  value: number,
  dustRelayFeeRate: number = DUST_RELAY_FEE_RATE
) {
  if (!Number.isInteger(value)) throw new Error(`Invalid value ${value}`);
  return value < dustThreshold(output, dustRelayFeeRate);
}
