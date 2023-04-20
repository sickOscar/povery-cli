import {workerData} from 'worker_threads';
import {deployFunction} from "./function.mjs";
import chalk from 'chalk';

const {lambda, opts, poveryConfig} = workerData;

deployFunction(lambda, opts, poveryConfig)
    .catch(err => {
        console.error(chalk.red(err))
    })