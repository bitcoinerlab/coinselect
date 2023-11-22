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

Additionally, if you only need to compute the `vsize` for a specific set of inputs and outputs, you can use the following approach:

```typescript
import { vsize } from '@bitcoinerlab/coinselect';
const vsize = vsize(
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

To ensure transactions are relayable by Bitcoin nodes, this library enforces a dust threshold. Transactions with outputs below this threshold may not be accepted by the network. The library proactively throws an error for targets below the dust threshold to prevent the creation of such transactions.

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

- Returned `utxos` and `targets` retain their original references unless they are modified (e.g., removal of utxos or addition of targets).
- To detect if a change address has been added, compare `inputTargets` with `outputTargets`. Similarly, to check if all UTXOs were selected, compare `inputUtxos` with `outputUtxos`.
- If `inputTargets` differs from `outputTargets`, it indicates that change was added to the `remainder`. Change is always appended at the end of the `targets` array.
- To identify discarded UTXOs (when `inputUtxos` ≠ `outputUtxos`), use: `const nonSelectedUtxos = inputUtxos.filter(utxo => !outputUtxos.includes(utxo))`.

## Algorithms

The UTXO selection algorithms in this library draw inspiration from [bitcoinjs/coinselect](https://github.com/bitcoinjs/coinselect).

We extend our gratitude and acknowledge the significant contributions of the bitcoinjs-lib team. Their algorithms have been instrumental in numerous wallets and projects for almost a decade.

### Default Algorithm
TODO

### Sending Max Funds
TODO

### Avoid Change
TODO

### Add Until Reach
TODO

### Differences Relative to bitcoinjs/coinselect

Despite the similarities, there are notable differences from bitcoinjs/coinselect:

- Like bitcoinjs, this library avoids creating change if its value falls below a certain threshold. Here, the threshold is known as `dustThreshold` (detailed in the previous section), in line with Bitcoin Core's implementation. In contrast, bitcoinjs/coinselect uses a threshold that correlates with the specified `feeRate`.
- This library throws an error if a target value is below the `dustThreshold`.
- It utilizes descriptors to define input and output script types, as opposed to the assumption of P2PKH in bitcoinjs-lib. [Support for Segwit is also possible in bitcoinjs-lib](https://github.com/BlueWallet/BlueWallet/blob/8834f70ee655df09dfa9bc13adae74775f3baead/class/wallets/abstract-hd-electrum-wallet.ts#L1126).
- Decimal `feeRate` values are supported.

## Miniscript
TODO
