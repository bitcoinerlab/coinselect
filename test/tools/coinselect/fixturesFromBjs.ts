import fs from 'fs';
import path from 'path';

//Get rid of the script in inputs and outputs too, since we compensate this
//setting different values (see below)
//Also, the fee is not correct on fixtures that had .script.length because of
//the compensation done below. So get rid of it.
function fixExpectedResult(expected: ExpectedResult) {
  const filteredInputs = expected.inputs?.map(input => {
    const { script, ...restInput } = input;
    if (script) console.log('Omitting script from expected results');
    return restInput;
  });

  const filteredOutputs = expected.outputs?.map(output => {
    const { script, ...restOutput } = output;
    if (script) console.log('Omitting script from expected results');
    return restOutput;
  });

  // Exclude the 'fee' from the result
  const { fee, ...restExpected } = expected;
  if (fee) console.log('Omitting fee from expected results');
  return {
    ...restExpected,
    inputs: filteredInputs,
    outputs: filteredOutputs
  };
}

interface ExpectedInput {
  i: number;
  value: number;
  address?: string;
  script?: { length: number };
}

interface ExpectedOutput {
  value: number;
  script?: { length: number };
}

interface ExpectedResult {
  inputs?: ExpectedInput[];
  outputs?: ExpectedOutput[];
  fee?: number;
}

interface Fixture {
  description: string;
  feeRate: number;
  inputs: (number | InputWithScript)[];
  outputs: (number | Output)[];
  expected: ExpectedResult;
}

interface InputWithScript {
  script?: {
    length: number;
  };
  value: number;
}

interface Output {
  value: number | string;
  script?: {
    length: number;
  };
}

const processFixtures = async (
  inputPath: string,
  outputPath: string,
  descriptor: string
) => {
  console.log(`Processing ${inputPath}`);
  const fixtures = (await import(inputPath)).default;

  const processedFixtures = fixtures
    .map((fixture: Fixture) => {
      const testFeeRate =
        typeof fixture.feeRate === 'number' &&
        Number.isInteger(fixture.feeRate) &&
        fixture.feeRate >= 1;
      if (fixture.description === '1 output, change expected, value > 2^32') {
        console.log(
          `Discarding speciffic test (See 'https://github.com/bitcoinjs/coinselect/issues/86#issuecomment-1822608202') - ${fixture.description}`
        );
        return;
      }
      if (!testFeeRate) {
        console.log(
          `Discarding (BAD FEE: ${fixture.feeRate}) - ${fixture.description}`
        );
        return;
      } else if (fixture.description.includes('NaN')) {
        console.log(`Discarding (NaN TESTS - ${fixture.description}`);
        return;
      } else {
        const feeRate = Number(fixture.feeRate);
        const utxos = fixture.inputs
          .map(input => {
            if (typeof input === 'number') {
              return {
                value: input,
                descriptor
              };
            } else if (typeof input === 'object') {
              let value = input.value;
              if ('script' in input) {
                if (
                  typeof input.script !== 'object' ||
                  !('length' in input.script)
                ) {
                  console.log(`Discarding (SCRIPT HAS NO LENGTH)`);
                  return;
                }
                if (!Number.isInteger(input.script.length)) {
                  console.log(
                    `Discarding (SCRIPT LENGTH FORMAT: ${input.script.length}`
                  );
                  return;
                }
                // In the input if script is HIGH then we compensate it by SUBSTRACTING output value
                value -= (input.script.length - 107) * feeRate;
                if (value < 1) {
                  console.log(
                    `Discarding (CANNOT COMPENSATE SCRIPT: ${value} - ${fixture.description}`
                  );
                  return;
                }
              }
              return {
                value,
                descriptor
              };
            } else {
              throw new Error('unhandled case');
            }
          })
          .filter(input => !!input);

        //is fixture.outputs [] or [{}] ?
        const noOutputs =
          Array.isArray(fixture.outputs) &&
          (fixture.outputs.length === 0 ||
            (fixture.outputs.length === 1 &&
              fixture.outputs[0] !== undefined &&
              typeof fixture.outputs[0] === 'object' &&
              !(fixture.outputs[0] instanceof Array) &&
              Object.keys(fixture.outputs[0]).length === 0));
        if (noOutputs)
          console.log(`Discarding (NO OUTPUTS) - ${fixture.description}`);
        if (fixture.inputs.length === 0)
          console.log(`Discarding (NO INPUTS) - ${fixture.description}`);

        const targets = (noOutputs ? [] : fixture.outputs)
          .map(output => {
            if (typeof output === 'number') {
              return {
                value: output,
                descriptor
              };
            } else if (typeof output === 'object') {
              let value;
              if (!('value' in output)) {
                console.log(
                  `Discarding (NO OUTPUT VALUE) - ${fixture.description}`
                );
                return;
              } else value = output.value;
              if (typeof value !== 'number') {
                console.log(
                  `Discarding (BAD OUTPUT VALUE ${value}) - ${fixture.description}`
                );
                return;
              }
              if ('script' in output) {
                if (
                  typeof output.script !== 'object' ||
                  !('length' in output.script)
                ) {
                  console.log(`Discarding (SCRIPT HAS NO LENGTH)`);
                  return;
                }
                if (!Number.isInteger(output.script.length)) {
                  console.log(
                    `Discarding (SCRIPT LENGTH FORMAT: ${output.script.length}`
                  );
                  return;
                }
                // In the output if script is HIGH then we compensate it by ADDING output value
                value += (output.script.length - 25) * feeRate;
              }
              return {
                value,
                descriptor
              };
            } else {
              throw new Error('unhandled case');
            }
          })
          .filter(output => !!output);
        if (
          utxos.length === fixture.inputs.length &&
          !noOutputs &&
          fixture.inputs.length > 0 &&
          targets.length === fixture.outputs.length
        ) {
          return {
            description: fixture.description,
            remainder: descriptor,
            feeRate: fixture.feeRate,
            expected: fixExpectedResult(fixture.expected),
            utxos,
            targets
          };
        } else return;
      }
    })
    .filter((fixture: Fixture) => fixture);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(processedFixtures, null, 2),
    'utf8'
  );
};

// Process both fixtures and write to respective output files
(async () => {
  await processFixtures(
    path.join(__dirname, './coinselectBjs.json'),
    path.join(__dirname, '../../fixtures/coinselect.json'),
    'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)'
  );
  await processFixtures(
    path.join(__dirname, './accumulativeBjs.json'),
    path.join(__dirname, '../../fixtures/addUntilReach.json'),
    'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)'
  );
})();
