import { coinselect, vsize } from '../dist';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';

const { Output } = DescriptorsFactory(secp256k1);

const INTERNAL_KEY =
  'a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd';
const LEAF_KEY_A =
  '669b8afcec803a0d323e9a17f3ea8e68e8abe5a278020a929adbec52421adbd0';
const LEAF_KEY_B =
  'c6e26fdf91debe78458853f1ba08d8de71b7672a099e1be5b6204dab83c046e5';

const TR_KEY_DESCRIPTOR = `tr(${INTERNAL_KEY})`;
const LEAF_A = `pk(${LEAF_KEY_A})`;
const TR_TREE_DESCRIPTOR = `tr(${INTERNAL_KEY},{${LEAF_A},pk(${LEAF_KEY_B})})`;

describe('tapscript support', () => {
  test('vsize estimates script-path spends larger than key-path spends', () => {
    const keyPathInput = new Output({
      descriptor: TR_TREE_DESCRIPTOR,
      taprootSpendPath: 'key'
    });
    const scriptPathInput = new Output({
      descriptor: TR_TREE_DESCRIPTOR,
      taprootSpendPath: 'script',
      tapLeaf: LEAF_A
    });
    const recipient = new Output({ descriptor: TR_KEY_DESCRIPTOR });

    const keyPathSize = vsize([keyPathInput], [recipient]);
    const scriptPathSize = vsize([scriptPathInput], [recipient]);

    expect(scriptPathSize).toBeGreaterThan(keyPathSize);
  });

  test('coinselect prefers lower-weight taproot key-path over script-path', () => {
    const scriptPathUtxo = {
      output: new Output({
        descriptor: TR_TREE_DESCRIPTOR,
        taprootSpendPath: 'script',
        tapLeaf: LEAF_A
      }),
      value: 20000n
    };
    const keyPathUtxo = {
      output: new Output({ descriptor: TR_KEY_DESCRIPTOR }),
      value: 20000n
    };

    const selected = coinselect({
      utxos: [scriptPathUtxo, keyPathUtxo],
      targets: [
        {
          output: new Output({ descriptor: TR_KEY_DESCRIPTOR }),
          value: 5000n
        }
      ],
      remainder: new Output({ descriptor: TR_KEY_DESCRIPTOR }),
      feeRate: 2
    });

    expect(selected).toBeDefined();
    expect(selected!.utxos.length).toBe(1);
    expect(selected!.utxos[0]).toBe(keyPathUtxo);
  });

  test('coinselect works with script-path-only taproot inputs', () => {
    const scriptPathOnlyUtxo = {
      output: new Output({
        descriptor: TR_TREE_DESCRIPTOR,
        taprootSpendPath: 'script',
        tapLeaf: LEAF_A
      }),
      value: 12000n
    };

    const selected = coinselect({
      utxos: [scriptPathOnlyUtxo],
      targets: [
        {
          output: new Output({ descriptor: TR_KEY_DESCRIPTOR }),
          value: 6000n
        }
      ],
      remainder: new Output({ descriptor: TR_KEY_DESCRIPTOR }),
      feeRate: 2
    });

    expect(selected).toBeDefined();
    expect(selected!.utxos).toEqual([scriptPathOnlyUtxo]);
    expect(typeof selected!.fee).toBe('bigint');
    expect(selected!.fee).toBeGreaterThan(0n);
  });
});
