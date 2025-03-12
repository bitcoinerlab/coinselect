// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import fs from 'fs';
import path from 'path';
import { Psbt, Network } from 'bitcoinjs-lib';
import { RegtestUtils } from 'regtest-client';
import {
  DescriptorsFactory,
  OutputInstance,
  signers
} from '@bitcoinerlab/descriptors';
import type { BIP32Interface } from 'bip32';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
const { Output } = DescriptorsFactory(secp256k1);

const regtestUtils = new RegtestUtils();
type InputOrigin = { txHex: string; vout: number };

const INPUT_VALUE = 10000;
const FEE_PER_OUTPUT = 10;

import { network, masterNode, transactions } from './combine';

const fixturesPath = path.join(__dirname, '../../fixtures/vsize.json');
import type { FixturesMap } from '../../vsize.test';

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
  //const signaturesPerInput = psbt.data.inputs.map(input => {
  //  const partialSig = input.partialSig;
  //  if (!partialSig) throw new Error('No signatures');
  //  return partialSig;
  //});
  const signaturesPerInput = psbt.data.inputs.map((input, index) => {
    if (input.tapKeySig) {
      if (input.tapScriptSig && input.tapScriptSig.length > 0)
        throw new Error(
          `Script path spending detected in input #${index}. This is not yet supported.`
        );
      if (!input.tapInternalKey)
        throw new Error(`single-key internal key not set`);
      return [
        {
          pubkey: input.tapInternalKey,
          signature: input.tapKeySig
        }
      ];
    }

    if (input.partialSig) return input.partialSig;

    throw new Error(`No signatures found for input #${index}`);
  });

  finalizers.forEach(finalizer => finalizer({ psbt }));

  return { signaturesPerInput, psbt };
}

const connectToRegtest = async () => {
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
};

const parse = (
  outputs: Array<{ descriptor: string; signersPubKeys?: Array<Buffer> }>
) =>
  outputs.map(output => {
    const parsed: {
      descriptor: string;
      signersPubKeys?: Array<string>;
      standardAddr?: string;
    } = {
      descriptor: output.descriptor
    };
    if (output.signersPubKeys) {
      //We pass signersPubKeys for wsh(MINISCRIPT), sh(MINISCRIPT), shWsh(MINISCRIPT)
      parsed.signersPubKeys = output.signersPubKeys.map(signerPubKey =>
        signerPubKey.toString('hex')
      );
    } else {
      //We also compute standard addresses for the rest (the non-miniscript based)
      parsed.standardAddr = new Output({ ...output, network }).getAddress();
    }
    return parsed;
  });

const generateFixtures = async () => {
  const fixtures: FixturesMap = {};
  for (const [index, transaction] of Object.entries(transactions)) {
    console.log(
      `Generating ${index}/${transactions.length} - ${transaction.info}`
    );
    const inputs = transaction.inputs.map(
      input => new Output({ ...input, allowMiniscriptInP2SH: true, network })
    );
    const outputs = transaction.outputs.map(
      output => new Output({ ...output, allowMiniscriptInP2SH: true, network })
    );

    const inputOrigins: Array<InputOrigin> = [];
    for (const input of inputs) {
      const unspent = await regtestUtils.faucetComplex(
        input.getScriptPubKey(),
        INPUT_VALUE
      );
      const { txHex } = await regtestUtils.fetch(unspent.txId);
      inputOrigins.push({ txHex, vout: unspent.vout });
      //expect(unspent.value).toEqual(INPUT_VALUE);
    }

    const { psbt, signaturesPerInput } = createPsbt({
      inputs,
      outputs,
      inputOrigins,
      masterNode,
      network
    });
    const tx = psbt.extractTransaction();
    const vsize = tx.virtualSize();

    // Serializing signaturesPerInput
    const serializedSignatures = signaturesPerInput.map(signatures =>
      signatures.map(sig => ({
        pubkey: sig.pubkey.toString('hex'),
        signature: sig.signature.toString('hex')
      }))
    );

    //Provide descriptors using script expresssions
    fixtures[transaction.info] = {
      fixture: transaction.info,
      //extract the standardAddr prop from the parsed object array:
      inputs: parse(transaction.inputs).map(({ standardAddr: _, ...r }) => r),
      outputs: parse(transaction.outputs).map(({ standardAddr: _, ...r }) => r),
      psbt: psbt.toBase64(),
      signaturesPerInput: serializedSignatures,
      vsize
    };

    //Also provide an alternative addr() descriptor format when not being
    //miniscript-based
    if (
      parse(transaction.inputs).some(input => 'standardAddr' in input) ||
      parse(transaction.outputs).some(output => 'standardAddr' in output)
    ) {
      const info = `Using addr() descriptors - ${transaction.info}`;
      console.log(
        `\tAlso generating addr() version: ${index}/${transactions.length} - ${transaction.info}`
      );
      fixtures[info] = {
        fixture: info,
        //Use the standardAddr prop from the parsed object array to create a new descriptor:
        inputs: parse(transaction.inputs).map(({ standardAddr, ...rest }) => ({
          ...rest,
          descriptor: standardAddr ? `addr(${standardAddr})` : rest.descriptor
        })),
        outputs: parse(transaction.outputs).map(
          ({ standardAddr, ...rest }) => ({
            ...rest,
            descriptor: standardAddr ? `addr(${standardAddr})` : rest.descriptor
          })
        ),

        psbt: psbt.toBase64(),
        signaturesPerInput: serializedSignatures,
        vsize
      };
    }
    if (Number(index) % 10 === 0) await regtestUtils.mine(1);
  }

  fs.writeFileSync(fixturesPath, JSON.stringify(fixtures, null, 2), 'utf8');
};

(async () => {
  await connectToRegtest();
  await generateFixtures();
})();
