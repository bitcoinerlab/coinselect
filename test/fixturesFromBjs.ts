import fs from 'fs';
import path from 'path';

interface ExpectedInput {
  i: number;
  value: number;
  address?: string;
}

interface ExpectedOutput {
  value: number;
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

const processFixtures = (
  inputPath: string,
  outputPath: string,
  descriptor: string
) => {
  const fixtures = require(inputPath);

  const processedFixtures = fixtures
    .map((fixture: Fixture) => {
      const testFeeRate =
        typeof fixture.feeRate === 'number' &&
        Number.isInteger(fixture.feeRate) &&
        fixture.feeRate >= 1;
      if (!testFeeRate) {
        console.log(
          `Discarding (BAD FEE: ${fixture.feeRate}) - ${fixture.description}`
        );
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

        const targets = fixture.outputs
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
          targets.length === fixture.outputs.length
        ) {
          return {
            description: fixture.description,
            feeRate: fixture.feeRate,
            expected: fixture.expected,
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
processFixtures(
  './fixtures/coinselectBjs.json',
  path.join(__dirname, './fixtures/coinselect.json'),
  'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)'
);
//processFixtures(
//  './fixtures/accumulateBjs.json',
//  './fixtures/accumulate.json',
//  'addr(12higDjoCCNXSA95xZMWUdPvXNmkAduhWv)'
//);
