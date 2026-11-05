// Compile Noble's ESM dependencies to CommonJS for Jest, as in descriptors.
const ts = require('typescript');

module.exports = {
  process(src, filename) {
    const { outputText } = ts.transpileModule(src, {
      fileName: filename,
      compilerOptions: {
        allowJs: true,
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        sourceMap: false,
        target: ts.ScriptTarget.ES2021
      }
    });
    return { code: outputText };
  }
};
