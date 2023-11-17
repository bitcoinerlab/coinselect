import { coinselect, OutputAndValue } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);

//TODO: do the same on accumulator
import fixtures from './fixtures/coinselect.json';

const pkhOutput = new Output({
  descriptor: 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)'
});
describe('coinselect', () => {
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
      const coinselected = coinselect({
        utxos: utxos as Array<OutputAndValue>,
        targets: targets as Array<OutputAndValue>,
        change: pkhOutput,
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
      //TODO: I must also expect the selected utxos!!!
    });
  }
});
