import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);
import { coinselect } from '../dist';

const descriptor = 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)';
describe('errors', () => {
  test('dusty outputs', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: new Output({ descriptor }), value: 1000 }],
        targets: [{ output: new Output({ descriptor }), value: 546 - 1 }],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Target #0 is dusty');
  });
  test('no inputs', () => {
    expect(() =>
      coinselect({
        utxos: [],
        targets: [{ output: new Output({ descriptor }), value: 1000 }],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Empty group');
  });
  test('no outputs', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: new Output({ descriptor }), value: 1000 }],
        targets: [],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Empty group');
  });
});
