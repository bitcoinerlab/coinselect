import type { OutputAndValue } from './index';
export function validateOutputAndValues(
  outputAndValues: Array<OutputAndValue>
) {
  for (const outputAndValue of outputAndValues) {
    const value = outputAndValue.value;
    if (!Number.isInteger(value) || value <= 0 || value > 1e14 /*1 M Btc*/) {
      throw new Error(`Input value ${value} not supported`);
    }
  }
}
export function validateFeeRate(feeRate: number) {
  if (!Number.isFinite(feeRate) || feeRate < 1 || feeRate > 10 * 1000) {
    throw new Error(`feeRate ${feeRate} not supported`);
  }
}
