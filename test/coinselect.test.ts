import { coinselect, OutputWithValue } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);

import fixturesCoinselect from './fixtures/coinselect.json';
import fixturesAccumulative from './fixtures/accumulative.json';

for (const fixturesWithDescription of [
  { fixtures: fixturesCoinselect, description: 'coinselect' },
  { fixtures: fixturesAccumulative, description: 'accumulative' }
]) {
  describe(fixturesWithDescription.description, () => {
    for (const fixture of fixturesWithDescription.fixtures) {
      test(fixture.description, () => {
        const utxos = fixture.utxos.map(utxo => ({
          value: utxo.value,
          output: new Output({ descriptor: utxo.descriptor })
        }));
        const targets = fixture.targets.map(target => ({
          value: target.value,
          output: new Output({ descriptor: target.descriptor })
        }));
        const coinselected = coinselect({
          utxos: utxos as Array<OutputWithValue>,
          targets: targets as Array<OutputWithValue>,
          change: new Output({ descriptor: fixture.change }),
          feeRate: fixture.feeRate
        });
        expect(coinselected ? coinselected.targets.length : 0).toBe(
          fixture.expected?.outputs?.length || 0
        );
        let changeValue: number | undefined;
        if (
          fixture.expected.outputs &&
          fixture.expected.outputs.length > fixture.targets.length
        ) {
          const lastExpectedOutput =
            fixture.expected.outputs![fixture.expected.outputs!.length! - 1]!;
          if (typeof lastExpectedOutput === 'undefined')
            throw new Error('lastExpectedOutput');
          changeValue =
            typeof lastExpectedOutput === 'number'
              ? lastExpectedOutput
              : lastExpectedOutput.value;
        }
        if (changeValue !== undefined && coinselected) {
          expect(
            coinselected.targets[coinselected.targets.length - 1]!.value
          ).toBe(changeValue);
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
