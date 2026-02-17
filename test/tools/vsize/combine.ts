// Copyright (c) 2023 Jose-Luis Landabaso - https://bitcoinerlab.com
// Distributed under the MIT software license

import { networks } from 'bitcoinjs-lib';
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import {
  DescriptorsFactory,
  keyExpressionBIP32,
  scriptExpressions
} from '@bitcoinerlab/descriptors';
import { mnemonicToSeedSync } from 'bip39';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encode: olderEncode } = require('bip68');
import { compilePolicy } from '@bitcoinerlab/miniscript-policies';
const { BIP32, parseKeyExpression } = DescriptorsFactory(secp256k1);

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

interface OutputsDataType {
  [key: string]: { descriptor: string; signersPubKeys?: Array<Uint8Array> };
}

const outputsData: OutputsDataType = {
  pkh: {
    descriptor: scriptExpressions.pkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    })
  },
  wpkh: {
    descriptor: scriptExpressions.wpkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    })
  },
  trSingleKey: {
    descriptor: scriptExpressions.trBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    })
  },
  shWpkh: {
    descriptor: scriptExpressions.shWpkhBIP32({
      masterNode,
      network,
      account: 0,
      keyPath: '/0/0'
    })
  },
  wshDelayed: {
    descriptor: `wsh(${miniscript})`,
    signersPubKeys: [delayedPubKey]
  },
  wshInstant: {
    descriptor: `wsh(${miniscript})`,
    signersPubKeys: [instantPubKey]
  },
  shDelayed: {
    descriptor: `sh(${miniscript})`,
    signersPubKeys: [delayedPubKey]
  },
  shInstant: {
    descriptor: `sh(${miniscript})`,
    signersPubKeys: [instantPubKey]
  },
  shWshDelayed: {
    descriptor: `sh(wsh(${miniscript}))`,
    signersPubKeys: [delayedPubKey]
  },
  shWshInstant: {
    descriptor: `sh(wsh(${miniscript}))`,
    signersPubKeys: [instantPubKey]
  }
};

// Function to generate all non-empty combinations of the properties of an object
function getAllCombinations(
  obj: OutputsDataType
): [
  Array<{ descriptor: string; signersPubKeys?: Array<Uint8Array> }>,
  string[]
][] {
  const result: [
    Array<{ descriptor: string; signersPubKeys?: Array<Uint8Array> }>,
    string[]
  ][] = [];
  const keys = Object.keys(obj);

  const combine = (
    prefix: Array<{ descriptor: string; signersPubKeys?: Array<Uint8Array> }>,
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
  'trSingleKey',
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

export { network, masterNode, transactions };
