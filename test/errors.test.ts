import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);
import { addUntilReach, avoidChange, coinselect, maxFunds } from '../dist';

const descriptor = 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)';

function output() {
  return new Output({ descriptor });
}

describe('errors', () => {
  test('dusty outputs', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: new Output({ descriptor }), value: 1000n }],
        targets: [{ output: new Output({ descriptor }), value: 545n }],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Target #0 is dusty');
  });
  test('no inputs', () => {
    expect(() =>
      coinselect({
        utxos: [],
        targets: [{ output: new Output({ descriptor }), value: 1000n }],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Empty group');
  });
  test('no outputs', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: new Output({ descriptor }), value: 1000n }],
        targets: [],
        remainder: new Output({ descriptor }),
        feeRate: 1
      })
    ).toThrow('Empty group');
  });

  test('rejects fee rates below the default minimum', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: output(), value: 1000n }],
        targets: [{ output: output(), value: 1000n }],
        remainder: output(),
        feeRate: 0
      })
    ).toThrow('Fee rate 0 not supported');
  });

  test('rejects invalid minimum fee rates', () => {
    expect(() =>
      coinselect({
        utxos: [{ output: output(), value: 1000n }],
        targets: [{ output: output(), value: 1000n }],
        remainder: output(),
        feeRate: 0,
        minimumFeeRate: -1
      })
    ).toThrow('Minimum fee rate -1 not supported');
  });

  test('allows zero fee rate when minimumFeeRate is zero', () => {
    const coinselected = coinselect({
      utxos: [{ output: output(), value: 1000n }],
      targets: [{ output: output(), value: 1000n }],
      remainder: output(),
      feeRate: 0,
      minimumFeeRate: 0
    });
    expect(coinselected).toBeDefined();
    expect(coinselected?.fee).toBe(0n);
  });

  test('allows fractional fee rates below 0.1 when minimumFeeRate is lowered', () => {
    const coinselected = coinselect({
      utxos: [{ output: output(), value: 2000n }],
      targets: [{ output: output(), value: 1998n }],
      remainder: output(),
      feeRate: 0.01,
      minimumFeeRate: 0.01
    });
    expect(coinselected).toBeDefined();
    expect(coinselected?.fee).toBe(2n);
  });

  test('allows zero fee rate in all public selection entry points', () => {
    expect(
      addUntilReach({
        utxos: [{ output: output(), value: 1000n }],
        targets: [{ output: output(), value: 1000n }],
        remainder: output(),
        feeRate: 0,
        minimumFeeRate: 0
      })?.fee
    ).toBe(0n);

    expect(
      avoidChange({
        utxos: [{ output: output(), value: 1000n }],
        targets: [{ output: output(), value: 1000n }],
        remainder: output(),
        feeRate: 0,
        minimumFeeRate: 0
      })?.fee
    ).toBe(0n);

    expect(
      maxFunds({
        utxos: [{ output: output(), value: 1000n }],
        targets: [],
        remainder: output(),
        feeRate: 0,
        minimumFeeRate: 0
      })?.fee
    ).toBe(0n);
  });
});
