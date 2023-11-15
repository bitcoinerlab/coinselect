// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import { networks } from 'bitcoinjs-lib';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import {
  DescriptorsFactory,
  keyExpressionBIP32,
  scriptExpressions,
  OutputInstance
} from '@bitcoinerlab/descriptors';
import { mnemonicToSeedSync } from 'bip39';
const { encode: olderEncode } = require('bip68');
import { compilePolicy } from '@bitcoinerlab/miniscript';
const { Output, BIP32, parseKeyExpression } = DescriptorsFactory(secp256k1);

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const network = networks.regtest;
const masterNode = BIP32.fromSeed(mnemonicToSeedSync(MNEMONIC), network);

const POLICY = (older: number) =>
  `or(pk(@instantKey),99@and(pk(@delayedKey),older(${older})))`;
const LOCK = 1;

const delayedKey = keyExpressionBIP32({
  masterNode,
  originPath: "/0'",
  keyPath: '/0'
});
const delayedPubKey = parseKeyExpression({
  keyExpression: delayedKey,
  network
}).pubkey;
if (!delayedPubKey) throw new Error('Cound not compute delayedPubKey');
const instantKey = keyExpressionBIP32({
  masterNode,
  originPath: "/0'",
  keyPath: '/1'
});
const instantPubKey = parseKeyExpression({
  keyExpression: instantKey,
  network
}).pubkey;
if (!instantPubKey) throw new Error('Cound not compute instantPubKey');
const older = olderEncode({ blocks: LOCK });
const { miniscript: expandedMiniscript } = compilePolicy(POLICY(older));
const miniscript = expandedMiniscript
  .replace('@delayedKey', delayedKey)
  .replace('@instantKey', instantKey);

const outputsData: OutputsDataType = {
  pkh: new Output({
    descriptor: scriptExpressions.pkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    }),
    network
  }),
  wpkh: new Output({
    descriptor: scriptExpressions.wpkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    }),
    network
  }),
  shWpkh: new Output({
    descriptor: scriptExpressions.shWpkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    }),
    network
  }),
  wshDelayed: new Output({
    descriptor: `wsh(${miniscript})`,
    network,
    signersPubKeys: [delayedPubKey]
  }),
  wshInstant: new Output({
    descriptor: `wsh(${miniscript})`,
    network,
    signersPubKeys: [instantPubKey]
  }),
  shDelayed: new Output({
    allowMiniscriptInP2SH: true,
    descriptor: `sh(${miniscript})`,
    network,
    signersPubKeys: [delayedPubKey]
  }),
  shInstant: new Output({
    allowMiniscriptInP2SH: true,
    descriptor: `sh(${miniscript})`,
    network,
    signersPubKeys: [instantPubKey]
  }),
  shWshDelayed: new Output({
    descriptor: `sh(wsh(${miniscript}))`,
    network,
    signersPubKeys: [delayedPubKey]
  }),
  shWshInstant: new Output({
    descriptor: `sh(wsh(${miniscript}))`,
    network,
    signersPubKeys: [instantPubKey]
  })
};

interface OutputsDataType {
  [key: string]: OutputInstance;
}

// Function to generate all non-empty combinations of the properties of an object
function getAllCombinations(
  obj: OutputsDataType
): [OutputInstance[], string[]][] {
  const result: [OutputInstance[], string[]][] = [];
  const keys = Object.keys(obj);

  const combine = (
    prefix: OutputInstance[],
    keys: string[],
    prefixKeys: string[]
  ) => {
    for (let i = 0; i < keys.length; i++) {
      const newPrefix = prefix.concat(obj[keys[i]!]!);
      const newPrefixKeys = prefixKeys.concat(keys[i]!);
      result.push([newPrefix, newPrefixKeys]);
      combine(newPrefix, keys.slice(i + 1), newPrefixKeys);
    }
  };

  combine([], keys, []);
  return result.filter(combination => combination[0].length > 0); // Exclude empty sets
}

const inputCombinations = getAllCombinations(outputsData);
const outputKeys = [
  'pkh',
  'wpkh',
  'shWpkh',
  'wshDelayed',
  'shInstant',
  'shWshDelayed'
];

// Creating transactions with each combination as inputs
const transactions = inputCombinations.map(
  ([inputCombination, inputCombinationKeys]) => {
    const info = `Inputs: ${inputCombinationKeys.join(
      ', '
    )}, Outputs: ${outputKeys.join(', ')}`;

    return {
      inputs: inputCombination,
      outputs: outputKeys.map(outputKey => {
        const output = outputsData[outputKey];
        if (!output) throw new Error('Invalid output key');
        return output;
      }),
      info
    };
  }
);
const changeOutput = new Output({
  descriptor: scriptExpressions.pkhBIP32({
    masterNode,
    network,
    account: 0,
    keyPath: '/0/1'
  }),
  network
});
export { network, masterNode, transactions, changeOutput };
