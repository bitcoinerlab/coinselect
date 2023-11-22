import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);
import { dustThreshold } from '../dist';

describe('dust', () => {
  test('pkh', () => {
    expect(
      dustThreshold(
        new Output({ descriptor: 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)' })
      )
    ).toBe(546);
  });
});

describe('dust', () => {
  test('wpkh', () => {
    expect(
      dustThreshold(
        new Output({
          descriptor: 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)'
        })
      )
    ).toBe(297);
  });
});
