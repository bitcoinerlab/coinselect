import { RegtestUtils } from 'regtest-client';
import { Psbt, networks } from 'bitcoinjs-lib';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { mnemonicToSeedSync } from 'bip39';
const { encode: olderEncode } = require('bip68');
import { compilePolicy } from '@bitcoinerlab/miniscript';

import {
  DescriptorsFactory,
  OutputInstance,
  scriptExpressions,
  signers
} from '@bitcoinerlab/descriptors';
const { Output, BIP32, ECPair } = DescriptorsFactory(secp256k1);
const regtestUtils = new RegtestUtils();
import { size } from '../dist';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const network = networks.regtest;

const INPUT_VALUE = 10000;
const FEE_PER_OUTPUT = 10;
const LOCK = 1;

const POLICY = (older: number) =>
  `or(pk(@panicKey),99@and(pk(@unvaultKey),older(${older})))`;

const panicPair = ECPair.makeRandom();
const panicPubKey = panicPair.publicKey;
const unvaultPair = ECPair.makeRandom();
const unvaultPubKey = unvaultPair.publicKey;
describe('Size', () => {
  const inputs: Array<OutputInstance> = [];
  const outputs: Array<OutputInstance> = [];
  const inputOrigins: Array<{ txHex: string; vout: number }> = [];
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

    let input = new Output({
      descriptor: scriptExpressions.wpkhBIP32({
        masterNode,
        network,
        account: 0,
        keyPath: '/0/0'
      }),
      network
    });

    inputs.push(input);

    let unspent = await regtestUtils.faucet(input.getAddress(), INPUT_VALUE);
    let { txHex } = await regtestUtils.fetch(unspent.txId);
    inputOrigins.push({ txHex, vout: unspent.vout });
    expect(unspent.value).toEqual(INPUT_VALUE);

    //Discard pkh
    inputs.shift();
    inputOrigins.shift();
    console.log({ inputs });

    const older = olderEncode({ blocks: LOCK });
    const { miniscript } = compilePolicy(POLICY(older));

    const triggerDescriptor = `sh(wsh(${miniscript
      .replace('@unvaultKey', unvaultPubKey.toString('hex'))
      .replace('@panicKey', panicPubKey.toString('hex'))}))`;

    input = new Output({
      descriptor: triggerDescriptor,
      allowMiniscriptInP2SH: true,
      network,
      signersPubKeys: [panicPubKey]
    });
    inputs.push(input);

    unspent = await regtestUtils.faucet(input.getAddress(), INPUT_VALUE);
    ({ txHex } = await regtestUtils.fetch(unspent.txId));
    inputOrigins.push({ txHex, vout: unspent.vout });
    expect(unspent.value).toEqual(INPUT_VALUE);
  });

  test('Size', () => {
    const psbt = new Psbt({ network });

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

    const finalizers = [];
    for (const [i, input] of inputs.entries()) {
      const inputOrigin = inputOrigins[i];
      if (!inputOrigin) throw new Error('Invalid inputOrigins');
      finalizers.push(input.updatePsbtAsInput({ psbt, ...inputOrigin }));
    }
    outputs.forEach(output => {
      output.updatePsbtAsOutput({
        psbt,
        value: (inputs.length * INPUT_VALUE) / outputs.length - FEE_PER_OUTPUT
      });
    });
    //Discard pkh
    //signers.signBIP32({ psbt, masterNode });
    signers.signECPair({ psbt, ecpair: panicPair });
    finalizers.forEach(finalizer => finalizer({ psbt }));

    //I always count 126 (assuming 2 different data pushes)
    //Sometimes i get 127

    console.log('SIGNED SIZE', psbt.extractTransaction().virtualSize());
    expect(psbt.extractTransaction().virtualSize()).toBe(size(inputs, outputs));
  });
});
