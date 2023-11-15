// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import { Psbt, Network } from 'bitcoinjs-lib';
import { RegtestUtils } from 'regtest-client';
import { OutputInstance, signers } from '@bitcoinerlab/descriptors';
import type { BIP32Interface } from 'bip32';

const regtestUtils = new RegtestUtils();
import { size, coinselect, InputOrigin } from '../dist';

const INPUT_VALUE = 10000;
const FEE_PER_OUTPUT = 10;

import { network, masterNode, transactions, changeOutput } from './fixtures';

function createPsbt({
  inputs,
  inputOrigins,
  outputs,
  masterNode,
  network
}: {
  inputs: Array<OutputInstance>;
  inputOrigins: Array<InputOrigin>;
  outputs: Array<OutputInstance>;
  masterNode: BIP32Interface;
  network: Network;
}) {
  const psbt = new Psbt({ network });

  const finalizers = [];
  for (const [i, input] of inputs.entries()) {
    const inputOrigin = inputOrigins[i];
    if (!inputOrigin) throw new Error('Invalid inputOrigins');
    finalizers.push(input.updatePsbtAsInput({ psbt, ...inputOrigin }));
  }
  outputs.forEach(output => {
    output.updatePsbtAsOutput({
      psbt,
      value: Math.round(
        (inputs.length * INPUT_VALUE) / outputs.length - FEE_PER_OUTPUT
      )
    });
  });
  signers.signBIP32({ psbt, masterNode });
  const signaturesPerInput = psbt.data.inputs.map(input => {
    const partialSig = input.partialSig;
    if (!partialSig) throw new Error('No signatures');
    return partialSig;
  });
  finalizers.forEach(finalizer => finalizer({ psbt }));

  return { signaturesPerInput, psbt };
}

describe('Size', () => {
  test('Connect the regtest server', async () => {
    const ATTEMPTS = 10;
    for (let i = 0; i < ATTEMPTS; i++) {
      try {
        await regtestUtils.height();
        break;
      } catch (err: unknown) {
        const message = (err as Error).message;
        console.warn(
          `Attempt #${i + 1} to connect to the regtest node: ${message}`
        );
        // Wait for 1 sec except after the final attempt
        if (i < ATTEMPTS - 1)
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    await regtestUtils.mine(100);
  });

  for (const [index, transaction] of Object.entries(transactions)) {
    test(
      `${transaction.info}`,
      async () => {
        console.log(
          `Test ${index}/${transactions.length} - ${transaction.info}`
        );
        const inputs = transaction.inputs;
        const outputs = transaction.outputs;

        const inputOrigins: Array<InputOrigin> = [];
        for (const input of inputs) {
          const unspent = await regtestUtils.faucet(
            input.getAddress(),
            INPUT_VALUE
          );
          const { txHex } = await regtestUtils.fetch(unspent.txId);
          inputOrigins.push({ txHex, vout: unspent.vout });
          expect(unspent.value).toEqual(INPUT_VALUE);
        }

        const { signaturesPerInput, psbt } = createPsbt({
          inputs,
          outputs,
          inputOrigins,
          masterNode,
          network
        });
        const expectedSize = psbt.extractTransaction().virtualSize();

        coinselect({
          utxos: inputs.map(input => ({ output: input, value: 1000 })),
          targets: outputs.map(output => ({ output, value: 10 })),
          feeRate: 1,
          changeOutput
        });

        //Pass signatures to estimate exact tx vsize (this is not how this
        //lib will be used but is handy for tests):
        const txSize = size(inputs, outputs, signaturesPerInput);

        //Without passing signatures (this will be the normal operation mode):
        const bestGuessTxSize = size(inputs, outputs);

        // Check if the transaction size using signatures is exactly the
        // same as the signed one:
        if (txSize !== expectedSize)
          console.error(psbt.extractTransaction().toHex());
        expect(txSize).toBe(expectedSize);

        // Check if the best guess transaction size is within the expected range:
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
      //This is a long test - 10 minutes
      10 * 60 * 60 * 1000
    );
  }
});
