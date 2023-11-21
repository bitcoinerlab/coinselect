//TODO: verify that all throws are preventable by checking the passed inputs. do not throw
//for an eventuality in the code. For example, if no inputs can be extracted for not
//passing enough value, will this make me throw on validatedFeeAndVsize or somewhere else?
//TODO: test throw because isDust one target, test throw if no inputs or no outputs
//TODO: Document: isDust is always applied. outputs will be checked agains it and
//it will prevent creating them if they are dusty
//TODO: Document: Only consider inputs with more value than the fee they require
//TODO: check for dusty outputs. Throw if dusty.
//TODO: Document isDust - export it. Tell users how to check if an output is dusty.
//  -> Will throw if passing empty inputs, empty outputs (or dusty)
//  -> Change may or may not be added depending on dust
//TODO: document differenfces wrt bitcoinjs/coinselect
//  dustRelayFeeRate, no inputs throws, no outputs throws on algos, it passes on coinselect for
//  sendMaxFunds. Create an algo sendMaxFunds. Must pass tagets = undefined or no pass
//TODO: throw if targets are empty in algos. Only allow empty targets in
//main.
//TODO: if my targets is [] then my algo is failing!
//  See the test that fails
//    -> Lo que pasa es que es normal q falle. De hecho deberia petar
//    lo que pasa es que no tiene porque seleccionar ninguna utxo, de hecho.
//    para que la iría a seleccinar? Si mi target son cero. Lo raro es que me
//    seleccione un utxo. Me está seleccionando un utxo y entonces dandome ese
//    cambio. No debetía ni de empezar
//    Se tiene que pedir sendMaxFunds NO pasando targets
//TODO: in coinselect to i test expect the fee?
//TODO: test send max funds
//TODO: return the final vsize and fee (which is more exact than returning the final feeRate)
//  -> assert that vsize and fee are integers indeed
//TODO: inputs and outputs are undefined if no solution
//TODO addr(sh) is assumed to be p2shp2wpkh, say so in documentation. If sh is wanted to be used for generic scripts then use sh(miniscript)
import type { OutputInstance } from '@bitcoinerlab/descriptors';
import { OutputWithValue, DUST_RELAY_FEE_RATE } from './index';
import { validateFeeRate, validateOutputWithValues } from './validation';
import { addUntilReach } from './algos/addUntilReach';
import { avoidChange } from './algos/avoidChange';
import { maxFunds } from './algos/maxFunds';
import { inputWeight } from './vsize';

// order by descending value, minus the inputs approximate fee
function utxoTransferredValue(
  outputAndValue: OutputWithValue,
  feeRate: number,
  isSegwitTx: boolean
) {
  return (
    outputAndValue.value -
    (feeRate * inputWeight(outputAndValue.output, isSegwitTx)) / 4
  );
}

export function coinselect({
  utxos,
  targets,
  remainder,
  feeRate,
  dustRelayFeeRate = DUST_RELAY_FEE_RATE
}: {
  utxos: Array<OutputWithValue>;
  targets?: Array<OutputWithValue>;
  remainder: OutputInstance;
  feeRate: number;
  dustRelayFeeRate?: number;
}) {
  validateOutputWithValues(utxos);
  if (targets) validateOutputWithValues(targets);
  validateFeeRate(feeRate);
  validateFeeRate(dustRelayFeeRate);

  //We will assume that the tx is segwit if there is at least one segwit
  //utxo for computing the utxo ordering. This is an approximation.
  //Note that having one segwit utxo does not mean the final tx will be segwit
  //(because the coinselect algo may end up choosing only non-segwit utxos).

  let coinselected;
  if (targets) {
    const isPossiblySegwitTx = utxos.some(utxo => utxo.output.isSegwit());
    //Sort in descending utxoTransferredValue
    //Using [...utxos] because sort mutates the input
    const sortedUtxos = [...utxos].sort(
      (a, b) =>
        utxoTransferredValue(b, feeRate, isPossiblySegwitTx) -
        utxoTransferredValue(a, feeRate, isPossiblySegwitTx)
    );
    coinselected =
      avoidChange({
        utxos: sortedUtxos,
        targets,
        remainder,
        feeRate,
        dustRelayFeeRate
      }) ||
      addUntilReach({
        utxos: sortedUtxos,
        targets,
        remainder,
        feeRate,
        dustRelayFeeRate
      });
  } else {
    coinselected = maxFunds({ utxos, remainder, feeRate, dustRelayFeeRate });
  }
  if (coinselected) {
    //return the same reference if nothing changed to interact nicely with
    //reactive components
    utxos =
      coinselected.utxos.length === utxos.length ? utxos : coinselected.utxos;
    targets =
      coinselected.targets.length === targets?.length
        ? targets
        : coinselected.targets;

    return { utxos, targets, fee: coinselected.fee, vsize: coinselected.vsize };
  } else return;
}
