import AdmZip from 'adm-zip';
import assert from 'assert';
import aws from 'aws-sdk';
import chalk from 'chalk';
import { exec as execChildProcess } from 'child_process';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
import rimraf from 'rimraf';
import * as util from 'util';
const exec = util.promisify(execChildProcess);
import {Worker, workerData} from 'worker_threads';

import { getLocalLambdasList } from './utils.mjs';
import {region} from "./const.mjs";

export async function promoteFunction(stage, functionName) {
	const lambdaService = new aws.Lambda({
		region: region,
	});

	const startingAlias = stage === 'test' ? 'dev' : 'test';

	if (startingAlias === 'dev') {
		const newVersion = await versionFunction(functionName);
		await setAlias(functionName, newVersion, stage);
	} else {
		const functionInfo = await lambdaService
			.getFunction({
				FunctionName: `${functionName}:${startingAlias}`,
			})
			.promise();

		await setAlias(functionName, functionInfo.Configuration.Version, stage);
	}
}

function getPoveryConfig() {
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
				await localExec(lambdaName, options);
			});
	} else {
		await localExec(selectedFunction, options);
	}

	async function localExec(functionName, options) {
		const lambdaService = new aws.Lambda({
			region: region,
		});

		// check if lambda folder exists
		const lambdaFolder = path.resolve(`./lambda/${functionName}`);
		assert(fs.existsSync(lambdaFolder), `Lambda folder ${lambdaFolder} does not exist`);




		if (!confirm) {
			console.log('Aborted');
			return;
		}

		if (operation === 'build') {
			await buildFunction(functionName, poveryConfig);
			return;
		}

		if (operation === 'info') {
			console.log(`Info for ${functionName}`);
			getFunctionInfo(lambdaService, functionName, options, poveryConfig);
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
	zip.addLocalFolder(path.resolve(`./lambda/${functionName}/.dist`));
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

export async function installNodeModules(functionName, poveryConfig) {
	const spinner = ora(`Installing npm packages`).start();
	try {
		// if temporary build_folder does not exists, create it
		const tempBuildFolderPath = `./.tmp`;
		if (!fs.existsSync(tempBuildFolderPath)) {
			fs.mkdirSync(tempBuildFolderPath);
		}

		if (!fs.existsSync(`${tempBuildFolderPath}/node_modules`)) {
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

export async function compileTypescript(functionName) {
	const spinner = ora(`Compiling typescript`).start();
	try {
		const { stdout, stderr } = await exec(`cd ./lambda/${functionName} && tsc --outdir .dist --experimentalDecorators true index.ts`);
		spinner.succeed(`Compiled typescript`);
		console.error(stderr);
		console.log(stdout);

		// await exec(`cp ./lambda/${functionName}/package.json ./lambda/${functionName}/.dist/lambda/${functionName}/package.json`)
	} catch (err) {
		spinner.fail(`Failed to compile typescript`);
		console.log(err);
		throw new Error(err);
	}
}

export async function buildFunction(functionName, poveryConfig) {
	console.log(chalk.green(`Building ${functionName}`));

	cleanDist(functionName);

	if (!fs.existsSync(path.resolve(`./lambda/${functionName}/.dist`))) {
		fs.mkdirSync(path.resolve(`./lambda/${functionName}/.dist`));
	}

	await installNodeModules(functionName, poveryConfig);
	await compileTypescript(functionName);
	// await checkDependencies(functionName);
	return await makeBuildZip(functionName);
}

export function getFunctionInfo(lambdaService, functionName, {environment}, {deployStrategy}) {
	const remoteFunctionName = getRemoteFunctionName(deployStrategy, environment, functionName);
	lambdaService.getFunction(
		{
			FunctionName: remoteFunctionName,
		},
		(err, data) => {
			if (err) {
				console.log(err, err.stack);
			} else {
				console.log(data);
			}
		}
	);
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

	const lambdaService = new aws.Lambda({region});
	await lambdaService
		.updateFunctionCode({
			FunctionName: remoteFunctionName,
			ZipFile: fs.readFileSync(path.resolve(`./lambda/${functionName}/.dist/${functionName}.zip`)),
		})
		.promise();
	updateLambdaSpinner.succeed(`Updated ${functionName}`);
}

export async function deployFunction(functionName, { environment}, {deployStrategy, installScript} ) {
	await buildFunction(functionName, {installScript});
	await updateFunctionCode(functionName, environment, deployStrategy);
	cleanDist(functionName);
}

export async function setAlias(lambdaName, version, aliasName) {
	const lambdaService = new aws.Lambda({
		region: region,
	});
	const aliasSpinner = ora(`Setting alias ${lambdaName}`).start();
	// point function dev alias to the newly created version
	const alias = await lambdaService
		.updateAlias({
			FunctionName: lambdaName,
			Name: aliasName,
			FunctionVersion: version,
		})
		.promise();
	aliasSpinner.succeed(`Set ${aliasName} alias ${lambdaName} to ${version}`);
}

export async function versionFunction(lambdaName) {
	const versionSpinner = ora(`Versioning ${lambdaName}`).start();
	// publish a new version of the function
	const lambdaService = new aws.Lambda({
		region: region,
	});
	const version = await lambdaService
		.publishVersion({
			FunctionName: lambdaName,
			Description: `Versioned ${new Date()}`,
		})
		.promise();
	versionSpinner.succeed(`Versioned ${lambdaName}: ${version.Version}`);
	await setAlias(lambdaName, '$LATEST', 'dev');

	return version.Version;
}
