# Povery CLI

[![Node.js CI](https://github.com/sickOscar/povery-cli/actions/workflows/main.yaml/badge.svg)](https://github.com/sickOscar/povery-cli/actions/workflows/main.yaml)

## Overview

[Povery](https://github.com/sickOscar/povery) is a framework for developing AWS Lambda functions with TypeScript. This CLI tool facilitates local development, testing, and deployment of serverless applications.

Povery CLI enables developers to:
- Locally serve multiple Lambda functions as an HTTP server
- Invoke Lambda functions locally via terminal
- Deploy Lambda functions to AWS environments

Unlike other serverless frameworks, Povery CLI focuses exclusively on Lambda function management without infrastructure provisioning. This adheres to the principle of separation of concerns between application logic and infrastructure management.

## Technical Foundation

The local development server functionality is built on top of the [Serverless Framework](https://github.com/serverless/serverless), leveraging its offline capabilities to simulate AWS Lambda and API Gateway locally. This integration provides a high-fidelity local development experience that closely mirrors the AWS production environment while maintaining a streamlined developer workflow.

## Project Structure Requirements

The CLI requires a specific project structure:

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

### Naming Conventions

- All Lambda functions must reside in the `lambda/` directory
- Each Lambda function requires `index.ts` as its entry point
- API Gateway Lambda functions must:
  - Use proxy integration for API requests
  - Use the prefix `API_` (e.g., `API_UserService`)
  - Start with a capital letter
- Event-driven Lambda functions must:
  - Use the prefix `EVENT_` (e.g., `EVENT_DataProcessor`)
  - Start with a capital letter

## Installation

### Local Installation (Recommended)

```bash
npm i -D povery-cli
```

Add to your `package.json`:

```json
{
  "scripts": {
    "povery": "povery-cli"
  }
}
```

Usage:
```bash
npm run povery
```

When passing options:
```bash
npm run povery function deploy API_UserService -- --stage dev
```

### Global Installation

```bash
npm i -g povery-cli
```

## Usage

### Command Reference

```bash
povery-cli --help
```

### Local API Testing

Configure routes in `povery.json`:

```json
{
  "lambdas": {
    "API_UserService": [
      {
        "method": "ANY",
        "path": "/{proxy+}"
      }
    ]
  }
}
```

Start the local server:
```bash
povery-cli start
```

### Local Lambda Invocation

Execute a Lambda function with the `event.json` file in its directory:
```bash
povery-cli function invoke EVENT_DataProcessor
```

## Module Resolution

When sharing code between Lambda functions, use TypeScript path aliases instead of relative imports:

```typescript
// Incorrect - will break transpilation
import { Something } from '../../common/something.ts';

// Correct
import { Something } from '@common/something.ts';
```

Configure `tsconfig.json` with appropriate path mappings:

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@common/*": "common/*",
      "povery": "node_modules/povery"
    }
  }
}
```

The explicit `povery` path mapping prevents esbuild transpilation issues.

## Configuration Options

The `povery.json` file supports the following configuration options:

### `deployStrategy`

- `""` (empty string): Deploys Lambda functions without prefix or alias (e.g., `API_UserService`)
- `STAGE_PREFIX`: Deploys with stage name as prefix (e.g., `dev_API_UserService`)
- `STAGE_ALIAS`: Deploys with stage name as alias (e.g., `API_UserService:dev`)

### `installScript`

Specifies a custom script to run instead of the default `npm install` during Lambda build.

### `esbuild`

Provides configuration options for esbuild:

```json
{
  "esbuild": {
    "external": ["pg"]
  }
}
```

This is particularly useful for:
- Excluding libraries that should be deployed as Lambda Layers
- Handling libraries with compilation errors or dynamic imports
- Optimizing large dependencies that could impact cold start performance

## Deployment

### Single Lambda Deployment

Interactive mode:
```bash
povery-cli function
```

Direct deployment:
```bash
povery-cli function deploy <lambda_name>
```

### Batch Deployment

Deploy all Lambda functions (ideal for CI/CD pipelines):
```bash
povery-cli deploy
```

## Function Building Process

Povery CLI follows a structured process when building Lambda functions:

1. **Clean Build Directory**: 
   - Removes the `.dist` directory for the specified Lambda function
   - Creates a fresh `.dist` directory for the build output

2. **Install Dependencies**:
   - Creates a temporary build folder (`.tmp`) if it doesn't exist
   - Copies the main `package.json` to the temporary folder
   - Runs `npm install --omit=dev` (or a custom install script specified in `povery.json`)
   - Creates a symbolic link from the temporary `node_modules` to the Lambda's `.dist/node_modules`

3. **TypeScript Compilation**:
   - Creates symbolic links for path aliases defined in `tsconfig.json`
   - Generates a temporary Lambda-specific `tsconfig.json` with appropriate settings
   - Validates TypeScript code with `tsc --noEmit`
   - Bundles the code using esbuild with:
     - Entry point: `./lambda/<functionName>/index.ts`
     - Output: `./lambda/<functionName>/.dist/index.js`
     - Minification enabled
     - Source maps generated
     - External dependencies excluded as specified in `povery.json`
   - Cleans up temporary files and symlinks

4. **Package Creation**:
   - Creates a ZIP file containing:
     - The compiled JavaScript file (`index.js`)
     - Source map file (`index.js.map`)
   - Outputs the ZIP to `./lambda/<functionName>/.dist/<functionName>.zip`

5. **Deployment** (if requested):
   - Uploads the ZIP file to AWS Lambda using the AWS SDK
   - Updates the function code with the new package
   - Applies the appropriate naming strategy based on `deployStrategy` in `povery.json`

This process can be initiated in several ways:

```bash
# Interactive mode
povery-cli function

# Direct build (package only)
povery-cli function build <functionName>

# Direct deployment (build and publish)
povery-cli function deploy <functionName>

# With environment option
povery-cli function deploy <functionName> --environment prod

# Force dependency reinstallation
povery-cli function deploy <functionName> --nocache
```

## Build Optimization

By default, Povery CLI:
- Minifies code
- Produces a single file with source map
- Optimizes for cold start performance

### Source Map Support

Enable source maps for debugging by adding this environment variable to your Lambda:
```
NODE_OPTIONS=--enable-source-maps
```

Note: This may impact performance and is not recommended for production environments. Consider using error tracking services like Sentry with uploaded source maps instead.

## Deployment Operations

Povery CLI provides several commands for managing the deployment lifecycle of your Lambda functions:

### Function Command

The `function` command is the primary interface for working with individual Lambda functions:

```bash
povery-cli function [operation] [functionName] [options]
```

Available operations:
- `info`: Retrieve information about a deployed Lambda function
- `build`: Build the Lambda package without deploying
- `deploy`: Build and deploy the Lambda function
- `promote`: Promote a Lambda function to a different stage
- `invoke`: Run the Lambda function locally with an event
- `clean`: Remove build artifacts

Options:
- `-p, --payload <payload>`: Specify a payload for function invocation
- `-e, --eventFilename <string>`: Specify an event file for invocation
- `-z, --environment <string>`: Target environment (default: 'dev')
- `-nc, --nocache`: Disable cache and force npm install
- `--auth`: Load claims file for authorization testing

If no operation or function name is provided, an interactive wizard will guide you through the process.

### Batch Deployment

To deploy all Lambda functions at once:

```bash
povery-cli deploy [options]
```

Options:
- `-y, --yes`: Automatically confirm all prompts
- `-nc, --nocache`: Disable cache and force npm install
- `-z, --environment <string>`: Target environment (default: 'dev')

### Versioning

To increment the version of all Lambda functions:

```bash
povery-cli version
```

This command:
1. Creates a new version of the `$LATEST` Lambda function
2. Sets the `dev` alias to point to `$LATEST`

### Lambda Layers

To upload a Lambda Layer:

```bash
povery-cli layers [functionName]
```

If no function name is provided, an interactive wizard will guide you through the process.

### Promotion

To promote Lambda functions between stages:

```bash
povery-cli promote [stage]
```

Available promotion paths:
- `dev -> test`: Promotes from development to testing
- `test -> prod`: Promotes from testing to production

The promotion process:
1. For `dev -> test`: Creates a new version and sets the `test` alias to that version
2. For other stages: Copies the version from the source stage to the target stage

### API Gateway Deployment

To deploy API Gateway configurations:

```bash
povery-cli api
```

This command allows you to select a stage (dev, staging, prod) and deploys the API Gateway configuration for all Lambda functions.

## Environment Variables

Create a `.envrc` file in your project root to define environment variables. All exported variables will be available during local Lambda execution.

## Version Control

Add the following to your `.gitignore` file:
```
.serverless.*
```

## Contributing

Contributions are welcome. Please feel free to submit issues and pull requests.

## License

MIT
