# Povery CLI

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
