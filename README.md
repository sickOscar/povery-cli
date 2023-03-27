# Povery CLI

#### [Povery](https://github.com/sickOscar/povery) is a framework for building things on AWS Lambda with Typescript

This is the CLI for Povery. 


## Install

```bash
npm i povery-cli
```

## Getting started

### Project Structure

[Povery](https://github.com/sickOscar/povery) is an opinionated framework to build things on AWS lambda with Typescript. 

As such, it needs a defined structure to work properly. The structure is as follows:

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
## Configuration

### `povery.json` reference
```
{
  // .. other fields, mainly for local serve, see povery for reference
  "deployStrategy": "STAGE_PREFIX" | "STAGE_ALIAS",
  "installScript": "npm install",
}
```

#### `deployStrategy`
- `` (enpty string): It will deploy your lambdas without any prefix or alias. Example: `API_Something`
- `STAGE_PREFIX`: It will deploy your lambdas with the stage name as prefix. Example: `dev_API_Something`
- `STAGE_ALIAS`: It will deploy your lambdas with the stage name as alias. Example: `API_Something:dev`

#### `installScript`
You can specify a script to run instead of the default `npm install` when building your lambdas.

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