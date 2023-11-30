import { coinselect, addUntilReach, maxFunds } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);

import fixturesCoinselect from './fixtures/coinselect.json';
import fixturesAccumulative from './fixtures/addUntilReach.json';
import fixturesMaxFunds from './fixtures/maxFunds.json';

for (const fixturesWithDescription of [
  { fixtures: fixturesCoinselect, setDescription: 'coinselect' },
  { fixtures: fixturesAccumulative, setDescription: 'addUntilReach' },
  { fixtures: fixturesMaxFunds, setDescription: 'maxFunds' }
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
          setDescription === 'addUntilReach'
            ? addUntilReach({
                utxos,
                targets,
                remainder: new Output({ descriptor: fixture.remainder }),
                feeRate: fixture.feeRate,
                // This is probably a bad idea, but we're m using tests fixtures
                // from bitcoinjs/coinselect which operate like this:
                // https://github.com/bitcoinjs/coinselect/issues/86
                dustRelayFeeRate: fixture.feeRate
              })
            : setDescription === 'maxFunds'
              ? maxFunds({
                  utxos,
                  targets,
                  remainder: new Output({ descriptor: fixture.remainder }),
                  feeRate: fixture.feeRate,
                  // This is probably a bad idea, but we're m using tests fixtures
                  // from bitcoinjs/coinselect which operate like this:
                  // https://github.com/bitcoinjs/coinselect/issues/86
                  dustRelayFeeRate: fixture.feeRate
                })
              : coinselect({
                  utxos,
                  targets,
                  remainder: new Output({ descriptor: fixture.remainder }),
                  feeRate: fixture.feeRate,
                  // This is probably a bad idea, but we're m using tests fixtures
                  // from bitcoinjs/coinselect which operate like this:
                  // https://github.com/bitcoinjs/coinselect/issues/86
                  dustRelayFeeRate: fixture.feeRate
                });
        //console.log(
        //  JSON.stringify(
        //    {
        //      setDescription,
        //      desc: fixture.description,
        //      utxos,
        //      targets,
        //      coinselected,
        //      expected: fixture.expected
        //    },
        //    null,
        //    2
        //  )
        //);
        expect(coinselected ? coinselected.targets.length : 0).toBe(
          fixture.expected?.outputs?.length || 0
        );
        let expectedRemainderValue: number | undefined;
        if (
          fixture.expected.outputs &&
          fixture.expected.outputs.length >
            ('targets' in fixture && Array.isArray(fixture.targets)
              ? fixture.targets.length
              : 0)
        ) {
          const lastExpectedOutput =
            fixture.expected.outputs[fixture.expected.outputs.length - 1]!;
          expectedRemainderValue = lastExpectedOutput.value;
        }
        if (expectedRemainderValue !== undefined && coinselected) {
          expect(
            coinselected.targets[coinselected.targets.length - 1]!.value
          ).toBe(expectedRemainderValue);
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
