import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
import { coinselect, dustThreshold } from '../dist';

const { Output } = DescriptorsFactory(secp256k1);

const P2PKH_DESCRIPTOR = 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)';
const P2WPKH_DESCRIPTOR = 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)';

describe('v2 breaking changes', () => {
  test('rejects number values in utxos at runtime', () => {
    expect(() =>
      coinselect({
        utxos: [
          {
            output: new Output({ descriptor: P2PKH_DESCRIPTOR }),
            value: 1000 as unknown as bigint
          }
        ],
        targets: [
          {
            output: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
            value: 600n
          }
        ],
        remainder: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
        feeRate: 1
      })
    ).toThrow('Input value 1000 not supported');
  });

  test('rejects number values in targets at runtime', () => {
    expect(() =>
      coinselect({
        utxos: [
          {
            output: new Output({ descriptor: P2PKH_DESCRIPTOR }),
            value: 3000n
          }
        ],
        targets: [
          {
            output: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
            value: 600 as unknown as bigint
          }
        ],
        remainder: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
        feeRate: 1
      })
    ).toThrow('Input value 600 not supported');
  });

  test('rejects negative bigint values', () => {
    expect(() =>
      coinselect({
        utxos: [
          {
            output: new Output({ descriptor: P2PKH_DESCRIPTOR }),
            value: -1n
          }
        ],
        targets: [
          {
            output: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
            value: 600n
          }
        ],
        remainder: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
        feeRate: 1
      })
    ).toThrow('Input value -1 not supported');
  });

  test('returns dust threshold and selected values as bigint', () => {
    const selected = coinselect({
      utxos: [
        {
          output: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
          value: 2000n
        },
        {
          output: new Output({ descriptor: P2PKH_DESCRIPTOR }),
          value: 4000n
        }
      ],
      targets: [
        {
          output: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
          value: 3000n
        }
      ],
      remainder: new Output({ descriptor: P2WPKH_DESCRIPTOR }),
      feeRate: 1.34
    });

    expect(selected).toBeDefined();
    if (!selected) throw new Error('Expected a valid coinselect result');

    expect(
      typeof dustThreshold(new Output({ descriptor: P2PKH_DESCRIPTOR }))
    ).toBe('bigint');
    expect(typeof selected.fee).toBe('bigint');
    selected.utxos.forEach(utxo => expect(typeof utxo.value).toBe('bigint'));
    selected.targets.forEach(target =>
      expect(typeof target.value).toBe('bigint')
    );
  });
});
