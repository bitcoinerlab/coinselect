import * as secp256k1 from '@bitcoinerlab/secp256k1';
import { DescriptorsFactory, OutputInstance } from '@bitcoinerlab/descriptors';
const { Output } = DescriptorsFactory(secp256k1);
import { vsize } from './vsize';
import { DUST_RELAY_FEE_RATE } from './index';

// https://github.com/bitcoin/bitcoin/blob/d752349029ec7a76f1fd440db2ec2e458d0f3c99/src/policy/policy.cpp#L26
export function isDust(
  output: OutputInstance,
  value: number,
  dustRelayFeeRate: number = DUST_RELAY_FEE_RATE
) {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`Invalid remainder value ${value}`);
  return (
    value <
    dustRelayFeeRate *
      vsize(
        [output],
        [
          new Output({
            descriptor: `${
              output.isSegwit() ? 'wpkh' : 'pkh'
            }(02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9)`
          })
        ]
      )
  );
}
