# Coinselect

## Overview
Coinselect is a TypeScript library designed for Bitcoin transaction management. It leverages Bitcoin Descriptors to define inputs and outputs, enabling optimal UTXO (Unspent Transaction Output) selection and accurate transaction size calculations.

For an introduction to Bitcoin descriptors, please refer to [@bitcoinerlab/descriptors](https://bitcoinerlab.com/modules/descriptors) if you're unfamiliar with them.

## Important Notice
**Project Status: In Development**

Please be aware that this project is currently in its initial stages of development. The core functionalities, as described, are under active construction and have not yet been implemented / can change. 

## Features

- Utilizes Bitcoin Descriptor notation for expressing UTXOs and targets.

- Accurately calculates witness sizes in UTXOs for miniscript-based descriptors, even when multiple spending paths exist. Users can select the specific spending path for determining the witness size using the method outlined in @bitcoinerlab/descriptors. A detailed example is available in the Miniscript section below.

- Prevents the creation of outputs below the dust threshold, which Bitcoin nodes typically do not relay.

## Usage

To get started, first install the necessary dependencies:

```bash
npm install @bitcoinerlab/secp256k1 \
            @bitcoinerlab/descriptors \
            @bitcoinerlab/coinselect
```

Here's a straightforward example using the `addr` descriptor:

Imagine you have two UTXOs:

- `2000` sats in an output with the address `bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60`.
- `4000` sats in an output with the address `12higDjoCCNXSA95xZMWUdPvXNmkAduhWv`.

Suppose you wish to send `3000` sats to `bc1qxtuy67s0rnz7uq2cyejqx5lj8p25mh0fz2pltm` and want the change sent to `bc1qwfh5mj2kms4rrf8amr66f7d5ckmpdqdzlpr082`. Here's how you can achieve this:

```typescript
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);
import { coinselect } from '@bitcoinerlab/coinselect';

const { utxos, targets, fee, vsize } = coinselect({
  utxos: [
    {
      output: new Output({ descriptor: 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)' }),
      value: 2000
    },
    {
      output: new Output({ descriptor: 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)' }),
      value: 4000
    }
  ],
  targets: [
    {
      output: new Output({ descriptor: 'addr(bc1qxtuy67s0rnz7uq2cyejqx5lj8p25mh0fz2pltm)' }),
      value: 3000
    }
  ],
  remainder: new Output({ descriptor: 'addr(bc1qwfh5mj2kms4rrf8amr66f7d5ckmpdqdzlpr082)' }),
  feeRate: 1.34
});
```

This code produces the following result:

```typescript
{
  "utxos": [
    {
      "output": {}, // The same OutputInstance as above: utxos[0].output
      "value": 4000
    }
  ],
  "targets": [
    {
      "output": {}, // The same OutputInstance as above: targets[0].output
      "value": 3000
    },
    {
      "output": {}, // A new OutputInstance corresponding to the change
                    // address passed in remainder
      "value": 705  // The final change value that you will receive
    }
  ],
  "fee": 295,       // The theoretical fee to pay (approximation before tx signing)
  "vsize": 220      // The theoretical virtual size (in bytes) of the tx
                    // (approximation before tx signing)
}
```

**Note on No Solutions:** If `coinselect` and similar algorithms in this library can't find a feasible combination of UTXOs for the specified targets, they return `undefined`. This means the transaction isn't viable with the given inputs and constraints. Ensure to handle such cases in your code, perhaps by informing the user or modifying the input parameters.

Additionally, if you only need to compute the `vsize` for a specific set of inputs and outputs, you can use the following approach:

```typescript
import { vsize } from '@bitcoinerlab/coinselect';
const numBytes = vsize(
  [
    new Output({ descriptor: 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)' }),
    new Output({ descriptor: 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)' })
  ],
  [ new Output({ descriptor: 'addr(bc1qxtuy67s0rnz7uq2cyejqx5lj8p25mh0fz2pltm)' }) ]
);
```

Having gone through the basic usage of the library, let's now focus on some essential concepts that enhance your understanding and effective utilization of the library. These include understanding *Dust*, managing *Fee Rates and Virtual Size*, and grasping the principles of *Immutability*.

#### Dust

If you'd pay more in fees than the value of the output to spend something, then this is considered dust.

To ensure transactions are relayable by Bitcoin nodes, this library enforces a dust threshold. Transactions with outputs below this threshold may not be accepted by the network. The library proactively throws an error for targets below the dust threshold to prevent the creation of such transactions. Also, the library does not generate change if it is below the dust threshold.

Use the [`dustThreshold`](https://bitcoinerlab.com/modules/coinselect/api/functions/dustThreshold.html) function prior to creating targets to ensure that output values exceed the minimum threshold (`minOutputValue`):

```typescript
import { dustThreshold } from '@bitcoinerlab/coinselect';
const minOutputValue = dustThreshold(
  new Output({ descriptor: 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)' })
);
```

For a more detailed explanation, refer to [the API documentation](https://bitcoinerlab.com/modules/coinselect/api/functions/dustThreshold.html).

#### Fee Rates and Virtual Size

The rate (`fee / vsize`) returned by `coinselect` may be higher than the specified `feeRate`. This discrepancy is due to rounding effects (target values must be integers in satoshis) and the possibility of not creating change if it falls below the dust threshold, as illustrated in the first code snippet.

After signing, the final `vsize` might be lower than the initial estimate provided by `coinselect()`/`vsize()`. This is because `vsize` is calculated assuming DER-encoded signatures of 72 bytes, though they can occasionally be 71 bytes. Consequently, the final `feeRate` might exceed the pre-signing estimate. In summary, `feeRateAfterSigning >= (fee / vsize) >= feeRate`.

#### Immutability

This library adheres to [Immutability principles](https://en.wikipedia.org/wiki/Immutable_object) for smoother integration with Reactive UI frameworks.

- Returned `utxos` and `targets` retain their original references unless they are modified (e.g., removal of utxos or addition of change in targets).
- To detect if a change address has been added, compare `inputTargets` with `outputTargets`. Similarly, to check if all UTXOs were selected, compare `inputUtxos` with `outputUtxos`.
- If `inputTargets` differs from `outputTargets`, it indicates that change was added to the `remainder`. Change is always appended at the end of the `targets` array.
- To identify discarded UTXOs (when `inputUtxos` ≠ `outputUtxos`), use: `nonSelectedUtxos = inputUtxos.filter(utxo => !outputUtxos.includes(utxo))`.

## Algorithms

The UTXO selection algorithms in this library draw inspiration from [bitcoinjs/coinselect](https://github.com/bitcoinjs/coinselect).

We extend our gratitude and acknowledge the significant contributions of the bitcoinjs-lib team. Their algorithms have been instrumental in numerous wallets and projects for almost a decade.

### Default Algorithm

The default algorithm within the `coinselect` library, as shown in the earlier example, sorts UTXOs by their descending net value (each UTXO's value minus the fees needed to spend it). It initially attempts to find a solution using the `avoidChange` algorithm, which aims to select UTXOs such that no change is required. If this is not possible, it then applies the `addUntilReach` algorithm, which adds UTXOs until the total value exceeds the target value plus fees. Change is added only if it's above the dust threshold. The `avoidChange` and `addUntilReach` algorithms are further elaborated on in subsequent sections.

### Sending Max Funds

This algorithm is designed for scenarios where you want to transfer all funds from your UTXOs to a recipient address. Specify the recipient in the `remainder` argument and omit the `targets`. 

Example:
```typescript
import { sendMaxFunds } from '@bitcoinerlab/coinselect';

const { utxos, targets, fee, vsize } = sendMaxFunds({
  utxos: [
    {
      output: new Output({ descriptor: 'addr(bc1qzne9qykh9j55qt8ccqamusp099spdfr49tje60)' }),
      value: 2000
    },
    {
      output: new Output({ descriptor: 'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)' }),
      value: 4000
    }
  ],
  remainder: new Output({ descriptor: 'addr(bc1qwfh5mj2kms4rrf8amr66f7d5ckmpdqdzlpr082)' }),
  feeRate: 1.34
});
```

To calculate the recipient value in the transaction, use: `recipientValue = utxos.reduce((a, u) => a + u.value, 0) - fee`.

### Avoid Change

The `avoidChange` function seeks a selection of UTXOs that does not necessitate change. Though the function signature is the same as the standard `coinselect` (requiring a `remainder`), change is never created. The `remainder` is used to assess whether hypothetical change would be considered dust and hence not viable.

This function does not reorder UTXOs prior to selection.

### Add Until Reach

Similar to default `coinselect`, the `addUntilReach` algorithm continuously adds UTXOs until the combined value surpasses the targets plus fees. This function does not reorder UTXOs before selection. It assesses whether creating change is feasible, taking into account if the change exceeds the dust threshold.

### Differences Relative to bitcoinjs/coinselect

The algorithms in this library are inspired by `bitcoinjs/coinselect`. The default algorithm corresponds to the main `coinselect` algorithm from bitcoinjs. Similarly, `avoidChange` is adapted from bitcoinjs's `blackjack`, and `addUntilReach` is based on their `accumulative` algorithm.

Despite the similarities, there are notable differences from bitcoinjs/coinselect:

- Like bitcoinjs, this library avoids creating change if its value falls below a certain threshold. Here, the threshold is known as `dustThreshold` (detailed in previous sections), in line with Bitcoin Core's implementation. In contrast, bitcoinjs/coinselect uses a threshold that correlates with the specified `feeRate`.
- This library throws an error if a target value is below the `dustThreshold`.
- It utilizes descriptors to define input and output script types, as opposed to the assumption of P2PKH in bitcoinjs-lib. [Support for Segwit is also possible in bitcoinjs-lib](https://github.com/BlueWallet/BlueWallet/blob/8834f70ee655df09dfa9bc13adae74775f3baead/class/wallets/abstract-hd-electrum-wallet.ts#L1126).
- Decimal `feeRate` values are supported.


## Miniscript

This library supports handling arbitrary scripts through Miniscript-based descriptors, offering advanced functionalities beyond standard address usage.

### Understanding Miniscript

Miniscript is a structured way to express Bitcoin scripts, enhancing the readability and flexibility of script writing. For those primarily interested in standard addresses, as discussed earlier, this advanced feature might not be necessary. However, Miniscript unlocks a broader range of possibilities for script creation and interpretation.

### Example of a Miniscript Descriptor

Consider a Miniscript descriptor representing a UTXO:

```typescript
wsh(
    andor(
        pk(Key1),
        older(10),

        pkh(Key2)
    )
)
```

In this example, `Key1` and `Key2` are Key Expressions which can be represented in various forms, including as [hex-encoded public keys or using BIP32 notation](https://github.com/bitcoin/bitcoin/blob/master/doc/descriptors.md). An example to illustrate this will be provided in the following sections.

The descriptor above defines control over a UTXO with two spending conditions:

1. **First Branch**:
   - Signature from the private key corresponding to `Key1`.
   - Wait for 10 blocks since the UTXO's previous transaction was mined.

2. **Second Branch**:
   - Signature from the private key corresponding to `Key2`.

The vsize of a transaction involving a Miniscript UTXO depends on the chosen spending path, as the required witness varies.

### Script Translation and Witness Size

The Miniscript above translates into the following Bitcoin witnessScript/lockingScript: `<a> OP_CHECKSIG OP_NOTIF OP_DUP OP_HASH160 <HASH160(b)> OP_EQUALVERIFY OP_CHECKSIG OP_ELSE 10 OP_CHECKSEQUENCEVERIFY OP_ENDIF`.

To spend using the first branch, the scriptWitness/unlockingScript should be: `<sig(Key1)>` (with the tx `nSequence` set to `10`). For the second branch, the scriptWitness/unlockingScript is: `<sig(Key2)> <Key2> 0`. Note that the input's weight differs depending on the spending path, impacting the overall transaction size.

### Specifying Spending Branch in UTXOs

The [@bitcoinerlab/descriptors](https://bitcoinerlab.com/modules/descriptors) library provides a method to designate spending paths in Miniscript. For instance, when creating an `Output`, you can specify the expected spending path:

```typescript
import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { OutputInstance, DescriptorsFactory } from '@bitcoinerlab/descriptors';
const { parseKeyExpression, Output } = DescriptorsFactory(secp256k1);

const Key1: string = "[73c5da0a/44'/0'/0']xpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba/0/0"

const pubKey1: Buffer = parseKeyExpression({ keyExpression: Key1 }).pubkey;
const output: OutputInstance = new Output({
    descriptor: `wsh(andor(pk(${Key1}),older(10),pkh(${Key2})))`, 
    signersPubKeys: [pubKey1]
});
```

This setup informs the `OutputInstance` of the expected spending path, enabling the coinselect algorithms to precisely calculate the witness size. The library constructs a satisfaction (unlockingScript/scriptWitness) based on the assumption that only signatures specified in `signersPubKeys` are available, selecting the most size-efficient witness possible. If the spending path depends on pre-images, you should also include a `preimages` parameter. For a detailed understanding, refer to the [API documentation](https://bitcoinerlab.com/modules/descriptors/api/classes/_Internal_.Output.html#constructor).

It's important to note that when calculating the witness size, actual signatures are not yet present. Therefore, the assumption is made for 72-byte DER-encoded signatures. Consequently, the final vsize after the transaction has been signed may be slightly smaller than the initial estimate.

### Integrating with Coinselect Algorithm

Once you have prepared the `OutputInstance` with a defined spending path, you can incorporate it into the `coinselect` algorithm. Simply include this `Output` as part of the `utxos` array, along with its corresponding value. The `coinselect` algorithm will then consider this `Output` in its selection process, factoring in the specified spending path and witness size for an accurate and optimized transaction calculation.

For example:

```typescript
import { coinselect } from '@bitcoinerlab/coinselect';

// Assuming 'output' is the OutputInstance from the previous example
// and 'outputValue' is the value associated with this output
const result = coinselect({
    utxos: [
        { output: output, value: outputValue },
        // ... other UTXOs
    ],
    // ... targets, remainder, and feeRate
});
```

In this way, the `coinselect` algorithm can effectively handle complex script conditions, ensuring transactions are constructed efficiently and accurately according to your specified requirements.

## Authors and Contributors

The project was initially developed and is currently maintained by [Jose-Luis Landabaso](https://github.com/landabaso). Contributions and help from other developers are welcome.

Before committing any code, make sure it passes all tests:
```bash
npm run test
```

Here are some resources to help you get started with contributing:

### Building from source

To download the source code and build the project, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/bitcoinerlab/coinselect.git
```

2. Install the dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

This will build the project and generate the necessary files in the `dist` directory.

### License

This project is licensed under the MIT License.
