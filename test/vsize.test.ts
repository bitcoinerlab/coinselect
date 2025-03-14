// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import { networks, Psbt } from 'bitcoinjs-lib';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
import fixturesVsize from './fixtures/vsize.json';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
const { Output } = DescriptorsFactory(secp256k1);

import { vsize } from '../dist';

const network = networks.regtest;

interface TransactionFixture {
  fixture: string;
  inputs: Array<{
    descriptor: string;
    signersPubKeys?: Array<string>;
  }>;
  outputs: Array<{
    descriptor: string;
    signersPubKeys?: Array<string>;
  }>;
  psbt: string;
  vsize: number;
  signaturesPerInput: Array<
    Array<{
      pubkey: string;
      signature: string;
    }>
  >;
}
export type FixturesMap = Record<string, TransactionFixture>;

describe('vsize', () => {
  for (const [info, fixture] of Object.entries(fixturesVsize as FixturesMap)) {
    test(
      `${info}`,
      () => {
        const inputs = fixture.inputs.map(input => {
          const signersPubKeys =
            'signersPubKeys' in input &&
            input.signersPubKeys.map((hexString: string) =>
              Buffer.from(hexString, 'hex')
            );
          return new Output({
            allowMiniscriptInP2SH: true,
            descriptor: input.descriptor,
            ...(signersPubKeys ? { signersPubKeys } : {}),
            network
          });
        });
        const outputs = fixture.outputs.map(
          output =>
            new Output({
              allowMiniscriptInP2SH: true,
              descriptor: output.descriptor,
              network
            })
        );

        const psbt = Psbt.fromBase64(fixture.psbt);
        // Deserialize signaturesPerInput
        const signaturesPerInput = fixture.signaturesPerInput.map(signatures =>
          signatures.map(sig => ({
            pubkey: Buffer.from(sig.pubkey, 'hex'),
            signature: Buffer.from(sig.signature, 'hex')
          }))
        );

        const expectedSize = fixture.vsize;

        //Pass signatures to estimate exact tx vsize (this is not how this
        //lib will be used but is handy for tests):
        const txSize = vsize(inputs, outputs, signaturesPerInput);

        //Without passing signatures (this will be the normal operation mode):
        const bestGuessTxSize = vsize(inputs, outputs);

        // Check if the fixture size using signatures is exactly the
        // same as the signed one:
        if (txSize !== expectedSize)
          console.error({ info, txSize, expectedSize, psbt: psbt.toHex() });
        expect(txSize).toBe(expectedSize);

        // Check if the best guess fixture size is within the expected range:
        expect(bestGuessTxSize).toBeGreaterThanOrEqual(txSize);
        //If signatures where, in fact, size 71, then we are computing
        //larger txs. Discount it to test for the upper limt:
        const upperLimit = inputs.reduce((accumulator, input, index) => {
          const signaturesCount = signaturesPerInput[index]!.length;
          return accumulator + signaturesCount * (input.isSegwit() ? 0.25 : 1);
        }, 0);

        expect(bestGuessTxSize).toBeLessThanOrEqual(
          txSize + Math.ceil(upperLimit)
        );
      },
      //This is a long test - leave it couple of minutes
      2 * 60 * 1000
    );
  }
});
