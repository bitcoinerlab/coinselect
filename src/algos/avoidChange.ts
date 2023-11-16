import type { OutputAndValue } from '../index';
import { size } from '../size';

/**
 * Include inputs only when they do not exceed the target value.
 * In other words, achieve a precise match.
 */
export function avoidChange({
  utxos,
  targets,
  feeRate
}: {
  /**
   * utxos are ordered in descending (value - fee contribution)
   */
  utxos: Array<OutputAndValue>;
  targets: Array<OutputAndValue>;
  feeRate: number;
}) {
  const targetsValue = targets.reduce((a, target) => a + target.value, 0);
  const utxosSoFar: Array<OutputAndValue> = [];

  for (const candidate of utxos) {
    const txSizeSoFar = size(
      utxosSoFar.map(utxo => utxo.output),
      targets.map(target => target.output)
    );

    const utxosSoFarValue = utxosSoFar.reduce((a, utxo) => a + utxo.value, 0);

    const txFeeSoFar = Math.ceil(txSizeSoFar * feeRate);
    const txSizeWithCandidate = size(
      [candidate.output, ...utxosSoFar.map(utxo => utxo.output)],
      targets.map(target => target.output)
    );
    const txFeeWithCandidate = Math.ceil(txSizeWithCandidate * feeRate);

    if (
      utxosSoFarValue + candidate.value <= targetsValue + txFeeWithCandidate &&
      utxosSoFarValue + candidate.value >= targetsValue + txFeeSoFar
    )
      return { utxos: [candidate, ...utxosSoFar], targets };
    else utxosSoFar.push(candidate);
  }
  return;
}
