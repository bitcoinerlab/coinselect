import { coinselect, OutputAndValue } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);

import { fixtures } from './fixtures/coinselect';

const descriptor = 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)';

const pkhOutput = new Output({ descriptor });
describe('coinselect', () => {
  for (const fixture of fixtures) {
    const testFeeRate =
      typeof fixture.feeRate === 'number' &&
      Number.isInteger(fixture.feeRate) &&
      fixture.feeRate >= 1;
    if (!testFeeRate) {
      console.log(
        `Discarding (BAD FEE: ${fixture.feeRate}) - ${fixture.description}`
      );
    } else {
      const feeRate = Number(fixture.feeRate);
      const utxos = fixture.inputs
        .map(input => {
          if (typeof input === 'number') {
            return {
              value: input,
              output: pkhOutput
            };
          } else if (typeof input === 'object') {
            let value = input.value;
            if ('script' in input) {
              // In the input if script is HIGH then we compensate it by SUBSTRACTING output value
              value -= (input.script.length - 107) * feeRate;
              if (value < 1) {
                console.log(
                  `Discarding (CANNOT COMPENSATE SCRIPT: ${value} - ${fixture.description}`
                );
                return;
              }
            }
            return {
              value,
              output: pkhOutput
            };
          } else {
            throw new Error('unhandled case');
          }
        })
        .filter(input => !!input);

      const targets = fixture.outputs
        .map(output => {
          if (typeof output === 'number') {
            return {
              value: output,
              output: pkhOutput
            };
          } else if (typeof output === 'object') {
            let value;
            if (!('value' in output)) {
              console.log(
                `Discarding (NO OUTPUT VALUE) - ${fixture.description}`
              );
              return;
            } else value = output.value;
            if (typeof value !== 'number') {
              console.log(
                `Discarding (BAD OUTPUT VALUE ${value}) - ${fixture.description}`
              );
              return;
            }
            if ('script' in output) {
              // In the output if script is HIGH then we compensate it by ADDING output value
              value += (output.script.length - 25) * feeRate;
            }
            return {
              value,
              output: pkhOutput
            };
          } else {
            throw new Error('unhandled case');
          }
        })
        .filter(output => !!output);
      if (
        utxos.length === fixture.inputs.length &&
        targets.length === fixture.outputs.length
      ) {
        let changeValue: number;
        if (
          fixture.expected.outputs &&
          fixture.expected.outputs.length > fixture.outputs.length
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
        test(fixture.description, () => {
          console.log(fixture.description);
          const coinselected = coinselect({
            utxos: utxos as Array<OutputAndValue>,
            targets: targets as Array<OutputAndValue>,
            change: pkhOutput,
            feeRate
          });
          console.log({
            utxos,
            targets,
            coinselectedUtxos: coinselected?.utxos,
            coinselectedTargets: coinselected?.targets
          });
          expect(coinselected ? coinselected.targets.length : 0).toBe(
            fixture.expected?.outputs?.length || 0
          );
          if (changeValue !== undefined && coinselected) {
            expect(
              coinselected.targets[coinselected.targets.length - 1]!.value
            ).toBe(changeValue);
          }
          //TODO: I must also expect the selected utxos!!!
        });
      }
    }
  }
});
