# Povery CLI

#### Povery is a framework for building things on AWS Lambda with Typescript

This is the CLI for Povery.


## Install

```bash
npm i povery-cli
```

## Project structure

Example:
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

### Start a web server
Configure `povery.json` file with the routes you need.
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

### `povery.json` reference
```
{
  // .. other fields, mainly for local serve, see povery for reference
  "deployStrategy": "STAGE_PREFIX" | "STAGE_ALIAS"
}
```

#### `deployStrategy`
- `STAGE_PREFIX`: It will deploy your lambdas with the stage name as prefix. Example: `dev_API_Something`
- `STAGE_ALIAS`: It will deploy your lambdas with the stage name as alias. Example: `API_Something:dev`

#### `installScript`
You can specify a script to run instead of the default `npm install` when building your lambdas.

### .gitignore file

Please add this to your `.gitignore` file:
```
.serverless.*
```

### env variables
There should be a `.envrc` file in the root of your project, defining the env variables for the project. Every exported variable in this file will be available to the execution of your local lambdas.