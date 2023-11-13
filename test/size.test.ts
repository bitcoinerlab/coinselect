import { RegtestUtils } from 'regtest-client';
import { networks } from 'bitcoinjs-lib';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { mnemonicToSeedSync } from 'bip39';
import {
  DescriptorsFactory,
  OutputInstance,
  scriptExpressions
} from '@bitcoinerlab/descriptors';
const { Output, BIP32 } = DescriptorsFactory(secp256k1);
const regtestUtils = new RegtestUtils();
import { size } from '../dist';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const network = networks.regtest;

describe('Size', () => {
  const inputs: Array<OutputInstance> = [];
  const outputs: Array<OutputInstance> = [];
  const masterNode = BIP32.fromSeed(mnemonicToSeedSync(MNEMONIC), network);
  test('Fund', async () => {
    const ATTEMPTS = 10;
    for (let i = 0; i < ATTEMPTS; i++) {
      try {
        await regtestUtils.height();
        break;
      } catch (err: unknown) {
        const message = (err as Error).message;
        console.warn(`Attempt #${i + 1} to access a node: ${message}`);
        // Wait for 1 sec except after the final attempt
        if (i < ATTEMPTS - 1)
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await regtestUtils.mine(100);

    const VALUE = 10000;
    inputs.push(
      new Output({
        descriptor: scriptExpressions.wpkhBIP32({
          masterNode,
          network,
          account: 0,
          keyPath: '/0/0'
        }),
        network
      })
    );
    if (!inputs[0]) throw new Error();
    const unspent = await regtestUtils.faucet(inputs[0].getAddress(), VALUE);
    expect(unspent.value).toEqual(VALUE);
  });
  test('Size', () => {
    outputs.push(
      new Output({
        descriptor: scriptExpressions.wpkhBIP32({
          masterNode,
          network,
          account: 0,
          keyPath: '/0/1'
        }),
        network
      })
    );
    expect(size(inputs, outputs)).toBe(1);
  });
});
