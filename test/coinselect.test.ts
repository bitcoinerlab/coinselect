import { coinselect, addUntilReach, OutputWithValue } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);

import fixturesCoinselect from './fixtures/coinselect.json';
import fixturesAccumulative from './fixtures/addUntilReach.json';

for (const fixturesWithDescription of [
  { fixtures: fixturesCoinselect, setDescription: 'coinselect' },
  { fixtures: fixturesAccumulative, setDescription: 'addUntilReach' }
]) {
  const { fixtures, setDescription } = fixturesWithDescription;
  describe(setDescription, () => {
    for (const fixture of fixtures) {
      test(fixture.description, () => {
        const utxos = fixture.utxos.map(utxo => ({
          value: utxo.value,
          output: new Output({ descriptor: utxo.descriptor })
        }));
        const targets = fixture.targets.map(target => ({
          value: target.value,
          output: new Output({ descriptor: target.descriptor })
        }));
        const coinselected =
          setDescription === 'coinselect'
            ? coinselect({
                utxos: utxos as Array<OutputWithValue>,
                targets: targets as Array<OutputWithValue>,
                remainder: new Output({ descriptor: fixture.remainder }),
                feeRate: fixture.feeRate,
                // This is probably a bad idea, but we're m using tests fixtures
                // from bitcoinjs/coinselect which operate like this:
                // https://github.com/bitcoinjs/coinselect/issues/86
                dustRelayFeeRate: fixture.feeRate
              })
            : addUntilReach({
                utxos: utxos as Array<OutputWithValue>,
                targets: targets as Array<OutputWithValue>,
                remainder: new Output({ descriptor: fixture.remainder }),
                feeRate: fixture.feeRate,
                // This is probably a bad idea, but we're m using tests fixtures
                // from bitcoinjs/coinselect which operate like this:
                // https://github.com/bitcoinjs/coinselect/issues/86
                dustRelayFeeRate: fixture.feeRate
              });
        expect(coinselected ? coinselected.targets.length : 0).toBe(
          fixture.expected?.outputs?.length || 0
        );
        let remainderValue: number | undefined;
        if (
          fixture.expected.outputs &&
          fixture.expected.outputs.length > fixture.targets.length
        ) {
          const lastExpectedOutput =
            fixture.expected.outputs[fixture.expected.outputs.length - 1]!;
          remainderValue = lastExpectedOutput.value;
        }
        if (remainderValue !== undefined && coinselected) {
          expect(
            coinselected.targets[coinselected.targets.length - 1]!.value
          ).toBe(remainderValue);
        }
        // Check if the selected UTXOs match the expected indices
        if (coinselected && fixture.expected.inputs) {
          const selectedUtxoIndices = coinselected.utxos.map(selectedUtxo => {
            const index = utxos.indexOf(selectedUtxo);
            if (index === -1) {
              throw new Error('Selected UTXO not found in original list');
            }
            return index;
          });

          const expectedIndices = fixture.expected.inputs.map(input => input.i);

          expect(selectedUtxoIndices.sort()).toEqual(expectedIndices.sort());
        }
      });
    }
  });
}
