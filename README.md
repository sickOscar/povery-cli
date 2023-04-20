# Povery CLI

#### [Povery](https://github.com/sickOscar/povery) is a framework for building things on AWS Lambda with Typescript

This is the CLI for Povery. 


You can easily serve locally many lambdas as an http server, or you can invoke them locally from the terminal. 

Unlike other things like this, it does not want to create lambdas or any kind of infrastructure 
on AWS for you (just deploy them, if you wish). 

We firmly believe on separation of concerns between code that handles application logic and code for infra.
Mixing those things, it always gets messy at some point...


### General rules to follow to structure your project

- Every lambda has a named folder under `lambda` folder.
- The entrypoint of the lambda MUST BE `index.ts` file.
- API Gateway MUST USE proxy integration to respond to api request.
- Lambdas that serve API Gateway SHOULD BE prefixed with `API_` (e.g. `API_Something`) and start with a capital letter.
- Lambdas that serve ant other events SHOULD BE prefixed with `EVENT_` (e.g. `EVENT_Something`) and start with a capital letter.

### Project Structure

As rules are clear, this cli needs a defined structure to work properly. The structure is as follows:

```
/<project_root>
  lambda/
    API_Something/
      index.ts
    EVENT_Something/
      index.ts
      event.json
  povery.json
```
## Install

If you want to install it globally, you can run:

```bash
npm i -g povery-cli
```

### Avoid global install
A better choice is to install it locally on your project as a dev dependency, in which case you can run:

```bash
npm i -D povery-cli
```

In this case, you can add a script to your `package.json` file to run it:

```json
{
  "scripts": {
    "povery-cli": "povery-cli"
  }
}
```

And call it like this:
```bash
npm run povery-cli
```

Just remeber that in this way, specific options to `povery-cli` must be passed after `--` 
```bash
npm run povery-cli function deploy API_Something  -- --stage dev
```

## Getting started

```bash
povery-cli --help
```

### Testing APIs on local machine

To start a local web server for testing, configure `povery.json` file with the routes you need.
```
// povery.json
{
  "lambdas": {
    "API_Something": [
      {
        "method": "ANY",
        "path": "/{proxy+}"
      }
    ]
  }
}

```
Then run:
```bash
povery-cli start
```

### Invoke a lambda locally
It runs your ts code with the json file `event.json` in the lambda folder.
```
povery-cli function invoke EVENT_Something
```
## Imports and tsconfig.json

Working with shared code beteen your lambdas, you will want to add some kind of "common" folders outside of your `lambda` folder.
Importing file into index.ts code with relative imports will break transpilations

```typescript
// WRONG LAMBDA CODE on index.ts
// THIS BREAKS STUFF
import { Something } from '.../.../common/something.ts';
```

You should instead use aliases and import external deps with them

```typescript
import { Something } from '@common/something.ts'
```
and configure your `tsconfig.json` properly like this
```
"compilerOptions": {
    ...
    "baseUrl": "./",
    "paths": {
        "@common/*": "common/*",
        "povery": "node_modules/povery"
    }
    ...
}
```
Note the path to `povery` needed to avoid misinterpretation of povery import from esbuild ts transpilation.
## Configuration

There are more options you can specify on your `povery.json` file:

#### `deployStrategy`
- `` (enpty string): It will deploy your lambdas without any prefix or alias. Example: `API_Something`
- `STAGE_PREFIX`: It will deploy your lambdas with the stage name as prefix. Example: `dev_API_Something`
- `STAGE_ALIAS`: It will deploy your lambdas with the stage name as alias. Example: `API_Something:dev`

#### `installScript`
You can specify a script to run instead of the default `npm install` when building your lambdas.

#### `esbuild`
You can give specific configurations for esbuild stage, like this
```json
{
    "esbuild": {
       "external": ["pg"]
    }
}
```

This is particularly useful for excluding from bundling particular libreries that you want to put on a Lambda Layer,
for example libraries that gives compilation errors (for example, libraries that have dynamic imports) o big libraries 
that makes your index file huge and slows down cold starts.


## Deploying

You can deploy any lambda or all of them at once. 

To deploy a single lambda, you can follow the wizard once you enter

```bash
povery-cli function
```
Or, if you know exaclty the name of the lambda you need to deploy, you can run:
```bash
povery-cli function deploy <lambda_name>
```

To deploy all of your lambdas, you can run:
```bash
povery-cli deploy
```
This is particularly useful for CI/CD pipelines.

### Notes for building
By default, povery.cli will minify your code and will produce a single file and a source map. This is for performance reasons, because it will be order of magnitudes farter to execute the code, in particular during cold starts. The stack traces may result unreadable, but you can actually enable the source maps generated by enabling them via env variable. To do so, add this env variable to your lambda:
```
NODE_OPTIONS=--enable-source-maps
```
Note that this can cause a performance hit, so it's not very recommended to use it in production. We suggest to use an error tracking software like Sentry and to upload source maps there.

### .gitignore file

Please add this to your `.gitignore` file:
```
.serverless.*
```

### env variables
There should be a `.envrc` file in the root of your project, defining the env variables for the project. Every exported variable in this file will be available to the execution of your local lambdas.


## Contributing

Feel free to open issues and PRs. We will be happy to review them.

## License

MIT
