import {getLocalLambdasList} from "./utils.mjs";
import {Worker, workerData} from 'worker_threads';
import * as path from 'path';
import {getPoveryConfig} from "./function.mjs";
import fs from "fs-extra";
import {fileURLToPath} from "url";
const MAX_CONCURRENT_TASKS = 1;

export async function deployAllFunctions(opts) {
    const lambdasList = getLocalLambdasList();

    fs.removeSync(path.resolve('.tmp'));

    const poveryConfig = getPoveryConfig();

    // split lambdaList into chunks of MAX_CONCURRENT_TASKS elements
    const chunks = [];
    for (let i = 0; i < lambdasList.length; i += MAX_CONCURRENT_TASKS) {
        chunks.push(lambdasList.slice(i, i + MAX_CONCURRENT_TASKS));
    }
    
    for(const tasks of chunks) {
        await Promise.all(tasks.map(async (lambda) => {
            await createLambdaWorker(lambda, opts, poveryConfig);
        }));
    }

}

function createLambdaWorker(lambda, opts, poveryConfig) {
    return new Promise((resolve, reject) => {

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        const worker = new Worker(path.join(__dirname, 'deploy.worker.mjs'), {
            workerData: {lambda, opts, poveryConfig}
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}
