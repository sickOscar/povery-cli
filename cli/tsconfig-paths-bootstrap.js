const JSON5 = require("json5");
const fs = require("fs-extra");
const path = require("path");
const {register} = require("tsconfig-paths");

const tsConfig = JSON5.parse(fs.readFileSync(path.resolve(`./tsconfig.json`)));

const registerOptions = {
    baseUrl: tsConfig.compilerOptions.baseUrl,
    paths: {
        ...tsConfig.compilerOptions.paths,
        povery: ['node_modules/povery']
    },
}

register(registerOptions);