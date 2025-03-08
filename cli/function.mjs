import AdmZip from 'adm-zip';
import assert from 'assert';
import chalk from 'chalk';
import { exec as execChildProcess } from 'child_process';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import * as rimraf from 'rimraf';
import * as util from 'util';
const exec = util.promisify(execChildProcess);
import {Worker} from 'worker_threads';
import esbuild from 'esbuild';
import {
	LambdaClient,
	GetFunctionCommand,
	UpdateFunctionCodeCommand,
	UpdateAliasCommand,
	PublishVersionCommand
} from "@aws-sdk/client-lambda";

import { getLocalLambdasList } from './utils.mjs';
import {region} from "./const.mjs";
import JSON5 from "json5";

export async function promoteFunction(stage, functionName) {
	const lambdaClient = new LambdaClient({
		region
	});

	const startingAlias = stage === 'test' ? 'dev' : 'test';

	if (startingAlias === 'dev') {
		const newVersion = await versionFunction(functionName);
		await setAlias(functionName, newVersion, stage);
	} else {
		const getFunctionInfoCommand = new GetFunctionCommand({
			FunctionName: `${functionName}:${startingAlias}`,
		});
		const functionInfo = await lambdaClient.send(getFunctionInfoCommand);

		await setAlias(functionName, functionInfo.Configuration.Version, stage);
	}
}

export function getPoveryConfig() {
	try {
		const config = fs.readJSONSync(path.resolve(`./povery.json`));
		console.log(chalk.green('povery.json found'));
		return config;
	} catch (e) {
		console.log(chalk.red('povery.json not found'));
		return {};
	}
}

export async function handleFunctionCommand(answers) {
	const { functionName: selectedFunction, operation, confirm, options } = answers;

	console.log('Environment:', options.environment);
	const poveryConfig = getPoveryConfig();

	if (!selectedFunction) {
		inquirer
			.prompt([
				{
					type: 'list',
					name: 'functionName',
					message: 'Select Function:',
					choices: getLocalLambdasList(),
				},
			])
			.then(async function (answers) {
				const { functionName: lambdaName } = answers;
				await doOperationOnFunction(lambdaName, options);
			});
	} else {
		await doOperationOnFunction(selectedFunction, options);
	}

	async function doOperationOnFunction(functionName, options) {
		const lambdaClient = new LambdaClient({region});

		// check if lambda folder exists
		const lambdaFolder = path.resolve(`./lambda/${functionName}`);
		assert(fs.existsSync(lambdaFolder), `Lambda folder ${lambdaFolder} does not exist`);

		if (!confirm) {
			console.log('Aborted');
			return;
		}

		if (operation === 'build') {
			const noCache = options.nocache;
			await buildFunction(functionName, poveryConfig, {noCache});
			return;
		}

		if (operation === 'info') {
			console.log(`Info for ${functionName}`);
			getFunctionInfo(lambdaClient, functionName, options, poveryConfig);
			return;
		}

		if (operation === 'deploy') {
			await deployFunction(functionName, options, poveryConfig);
			return;
		}

		// if (operation === 'version') {
		//     await versionFunction(functionName);
		//     return;
		// }

		if (operation === 'invoke') {
			await invokeFunctionLocally(functionName, options);
			return;
		}

		if (operation === 'promote') {
			inquirer
				.prompt([
					{
						type: 'list',
						name: 'stage',
						message: 'Stage to promote to',
						choices: [
							{ name: 'dev -> test', value: 'test' },
							{ name: 'staging -> prod', value: 'prod' },
						],
					},
				])
				.then(async (answers) => {
					const { stage } = answers;

					await promoteFunction(stage, functionName);
				});

			return;
		}

		if (operation === 'clean') {
			cleanDist(functionName);
		}
	}
}

export async function invokeFunctionLocally(functionName, options) {

	const poveryCliPath = path.dirname(import.meta.url).replace(`file://`, ``);

	const lambda = {
		functionName,
		poveryCliPath,
		options
	};

	const worker = new Worker(`${poveryCliPath}/launcher.worker.mjs`, {
		workerData: {
			lambda,
			env: {}
		}
	});
	worker.on('message', (message) => {
		console.log(message);
	})

	worker.on('error', (error) => {
		console.error(error);
	})

	await new Promise((resolve, reject) => {
		worker.on('exit', (code) => {
			resolve();
		});
	})


}

export async function makeBuildZip(functionName) {
	const zip = new AdmZip();

	const addingSpinner = ora(`Adding ${functionName} to zip`).start();

	zip.addLocalFile(path.resolve(`./lambda/${functionName}/.dist/index.js`));
	zip.addLocalFile(path.resolve(`./lambda/${functionName}/.dist/index.js.map`));

	addingSpinner.succeed(`Added ${functionName} to zip`);

	const zipPath = `./lambda/${functionName}/.dist/${functionName}.zip`;
	const zippingSpinner = ora(`Writing zip to ${zipPath}`).start();
	await zip.writeZipPromise(zipPath, {});
	zippingSpinner.succeed(`Wrote zip to ${zipPath}`);

	return zipPath;
}

export function cleanDist(functionName) {
	rimraf.sync(`./lambda/${functionName}/.dist`);
}

/**
 * Install node modules only if they are not installed or if noCache is true
 * @param nodeModulesPath
 * @param noCache
 * @returns {boolean}
 */
function shouldInstallNodeModules(nodeModulesPath, noCache) {
	return !fs.existsSync(nodeModulesPath) || noCache;
}

export async function installNodeModules(functionName, poveryConfig, noCache) {
	const spinner = ora(`Installing npm packages`).start();
	try {
		// if temporary build_folder does not exists, create it
		const tempBuildFolderPath = `./.tmp`;
		if (!fs.existsSync(tempBuildFolderPath)) {
			fs.mkdirSync(tempBuildFolderPath);
		}

		if (shouldInstallNodeModules(`${tempBuildFolderPath}/node_modules`, noCache)) {
			// copy main package.json to temp folder
			fs.copyFileSync(`./package.json`, `${tempBuildFolderPath}/package.json`);

			let installCommand = "npm install --omit=dev"
			if (poveryConfig.installScript) {
				installCommand = poveryConfig.installScript
			}

			const { stderr, stdout } = await exec(`cd ${tempBuildFolderPath} && ${installCommand}`);
			console.error(stderr);
			console.log(stdout);
		}

		// copy node modules folder to lambda folder
		fs.symlinkSync(
			path.resolve(`.tmp/node_modules`),
			path.resolve(`./lambda/${functionName}/.dist/node_modules`)
		);

		spinner.stop();
	} catch (err) {
		spinner.stop();
		console.log(err);
	}
}

export async function checkDependencies(functionName) {
	const spinner = ora(`Checking dependencies`).start();
	try {
		const depcheckCommand = `(npx dependency-check . --missing --unused --no-dev --ignore-module request --ignore-module aws-sdk)`;
		const { stdout, stderr } = await exec(
			`cd ./lambda/${functionName}/.dist/lambda/${functionName} && ${depcheckCommand}`
		);
		spinner.succeed(`Dependencies are good`);
		console.error(stderr);
		console.log(stdout);
	} catch (err) {
		spinner.fail(`Dependencies are NOT good`);
		console.error(err);
		throw new Error(err);
	}
}

export async function compileTypescript(functionName, poveryConfig) {
	const spinner = ora(`Compiling typescript`).start();

	const tsconfigPath = `./tsconfig.json`;
	if (!fs.existsSync(tsconfigPath)) {
		throw new Error(`No tsconfig.json found in root directory. Please create one.`);
	}

	const tsConfig = JSON5.parse(fs.readFileSync(tsconfigPath, "utf8"));
	const paths = tsConfig.compilerOptions.paths;

	let symlinks = [];

	// map all paths to symlinks
	Object.keys(paths).forEach((key) => {
		const pathTokens = paths[key][0].split("/");
		const p = pathTokens.slice(0, pathTokens.length - 1).join("/");
		const symLinkDest = path.resolve(`./lambda/${functionName}/${p}`);
		fs.symlinkSync(
			path.resolve(p),
			symLinkDest
		);
		symlinks.push(symLinkDest);
	});


    const newTsConfig = JSON.parse(JSON.stringify(tsConfig));
	if (!newTsConfig.compilerOptions) {
		newTsConfig.compilerOptions = {};
	}
	newTsConfig.compilerOptions.experimentalDecorators = true;
	newTsConfig.compilerOptions.emitDecoratorMetadata = true;
	newTsConfig.compilerOptions.outDir = "./.dist";
	newTsConfig.compilerOptions.rootDir = "./";
	newTsConfig.compilerOptions.baseUrl = "./";
	newTsConfig.compilerOptions.paths = {
		...paths
	}
	newTsConfig.include = newTsConfig.include ? [...newTsConfig.include, "index.ts"] : ["index.ts"];

	// write tsconfig to lambda folder
	fs.writeFileSync(
		`./lambda/${functionName}/tsconfig.json`,
		JSON.stringify(newTsConfig, null, 2)
	);

	try {
		const { stdout, stderr } = await exec(`cd ./lambda/${functionName} && tsc --noEmit`);

		esbuild.buildSync({
			entryPoints: [`./lambda/${functionName}/index.ts`],
			bundle: true,
			outfile: `./lambda/${functionName}/.dist/index.js`,
			minify: true,
			platform: "node",
			sourcemap: true,
			external: poveryConfig.esbuild?.external || []
		})

		spinner.succeed(`Compiled typescript`);
		console.error(stderr);
		console.log(stdout);
	} catch (err) {
		spinner.fail(`Failed to compile typescript`);
		console.log(err);
		throw new Error(err);
	} finally {

		// remove tsconfig from lambda folder
		fs.unlinkSync(`./lambda/${functionName}/tsconfig.json`);
		// remove symlinks
		symlinks.forEach((symLink) => {
			fs.unlinkSync(symLink);
		})
	}

}

export async function buildFunction(functionName, poveryConfig, {noCache}) {
	console.log(chalk.green(`Building ${functionName}`));

	cleanDist(functionName);

	if (!fs.existsSync(path.resolve(`./lambda/${functionName}/.dist`))) {
		fs.mkdirSync(path.resolve(`./lambda/${functionName}/.dist`));
	}

	await installNodeModules(functionName, poveryConfig, noCache);
	await compileTypescript(functionName, poveryConfig);
	// await checkDependencies(functionName);
	return await makeBuildZip(functionName);
}

export function getFunctionInfo(lambdaClient, functionName, {environment}, {deployStrategy}) {
	const remoteFunctionName = getRemoteFunctionName(deployStrategy, environment, functionName);

	lambdaClient.send(new GetFunctionCommand({
		FunctionName: remoteFunctionName
	}))
		.then(console.log)
		.catch(console.error)

}

function getRemoteFunctionName(deployStrategy, environment, functionName) {
	switch (deployStrategy) {
		case 'STAGE_PREFIX':
			return `${environment}_${functionName}`;
		case 'STAGE_ALIAS':
			return functionName;
		default:
			return functionName;

	}
}

export async function updateFunctionCode(functionName, environment, deployStrategy) {
	const updateLambdaSpinner = ora(`Updating ${functionName}`).start();

	const remoteFunctionName = getRemoteFunctionName(deployStrategy, environment, functionName);

	const lambdaClient = new LambdaClient({region});
	await lambdaClient.send(new UpdateFunctionCodeCommand({
		FunctionName: remoteFunctionName,
		ZipFile: fs.readFileSync(path.resolve(`./lambda/${functionName}/.dist/${functionName}.zip`)),
	}))

	updateLambdaSpinner.succeed(`Updated ${functionName}`);
}

export async function deployFunction(functionName, { environment, nocache}, poveryConfig) {
	const noCache = nocache || false;
	const deployStrategy = poveryConfig.deployStrategy || '';
	await buildFunction(functionName, poveryConfig, {noCache});
	await updateFunctionCode(functionName, environment, deployStrategy);
	cleanDist(functionName);
}

export async function setAlias(lambdaName, version, aliasName) {
	const lambdaClient = new LambdaClient({region});
	const aliasSpinner = ora(`Setting alias ${lambdaName}`).start();
	await lambdaClient.send(new UpdateAliasCommand({
		FunctionName: lambdaName,
		Name: aliasName,
		FunctionVersion: version,
	}))

	aliasSpinner.succeed(`Set ${aliasName} alias ${lambdaName} to ${version}`);
}

export async function versionFunction(lambdaName) {
	const versionSpinner = ora(`Versioning ${lambdaName}`).start();
	// publish a new version of the function
	const lambdaClient = new LambdaClient({region});
	await lambdaClient.send(new PublishVersionCommand({
		FunctionName: lambdaName,
		Description: `Versioned ${new Date()}`,
	}));


	// const version = await lambdaClient
	// 	.publishVersion({
	// 		FunctionName: lambdaName,
	// 		Description: `Versioned ${new Date()}`,
	// 	})
	// 	.promise();
	versionSpinner.succeed(`Versioned ${lambdaName}: ${version.Version}`);
	await setAlias(lambdaName, '$LATEST', 'dev');

	return version.Version;
}
