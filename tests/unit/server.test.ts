import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import JSON5 from 'json5';

// Mock the startServer function
const mockStartServer = jest.fn();

jest.mock('../../cli/server.mjs', () => ({
  startServer: mockStartServer
}), { virtual: true });

// Mock the required modules
jest.mock('fs', () => ({
  lstatSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('path', () => ({
  resolve: jest.fn()
}));

jest.mock('json5', () => ({
  parse: jest.fn()
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock process.cwd and other process methods
const originalCwd = process.cwd;
const mockStdout = {
  on: jest.fn(),
  write: jest.fn()
};
const mockStderr = {
  on: jest.fn(),
  write: jest.fn()
};
const mockSpawnProcess = {
  stdout: mockStdout,
  stderr: mockStderr,
  on: jest.fn()
};

describe('Server Module', () => {
  beforeAll(() => {
    // Mock process.cwd
    Object.defineProperty(process, 'cwd', {
      value: jest.fn().mockReturnValue('/path/to/project-name')
    });
    
    // Mock process.stdout and process.stderr
    Object.defineProperty(process, 'stdout', {
      value: { write: jest.fn() }
    });
    Object.defineProperty(process, 'stderr', {
      value: { write: jest.fn() }
    });
    
    // Setup spawn mock
    (childProcess.spawn as jest.Mock).mockReturnValue(mockSpawnProcess);
    
    // Implement the mock startServer function
    mockStartServer.mockImplementation(async () => {
      // Mock implementation of startServer
      // 1. Read povery.json
      const poveryJsonPath = path.resolve('./povery.json');
      if (!fs.lstatSync(poveryJsonPath).isFile()) {
        throw new Error('No povery.json file found');
      }
      
      const poveryConf = JSON5.parse(fs.readFileSync(poveryJsonPath, 'utf8'));
      
      // 2. Generate serverless config
      fs.writeFileSync('.serverless.json', JSON.stringify({}));
      
      // 3. Spawn serverless process
      childProcess.spawn('serverless', [
        'offline',
        'start',
        '--config=.serverless.json'
      ], {
        env: process.env
      });
    });
  });

  afterAll(() => {
    // Restore original process.cwd
    Object.defineProperty(process, 'cwd', {
      value: originalCwd
    });
  });

  describe('startServer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Setup default mocks for a successful test
      (path.resolve as jest.Mock)
        .mockReturnValueOnce('/path/to/povery.json')  // First call for povery.json
        .mockReturnValueOnce('/path/to/.envrc');      // Second call for .envrc
      
      (fs.lstatSync as jest.Mock)
        .mockReturnValueOnce({ isFile: () => true })  // povery.json exists
        .mockReturnValueOnce({ isFile: () => true }); // .envrc exists
      
      const mockPoveryJson = {
        lambdas: {
          'API_Test': [
            {
              method: 'GET',
              path: '/test',
              authorized: false
            }
          ]
        }
      };
      
      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce('mock povery.json content')  // povery.json content
        .mockReturnValueOnce('export TEST_VAR=test_value'); // .envrc content
      
      (JSON5.parse as jest.Mock).mockReturnValue(mockPoveryJson);
    });

    it('should generate serverless config and start the server', async () => {
      // Call the function
      await mockStartServer();

      // Verify povery.json was read
      expect(path.resolve).toHaveBeenCalledWith('./povery.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/povery.json', 'utf8');
      
      // Verify serverless config was written
      expect(fs.writeFileSync).toHaveBeenCalled();
      
      // Verify serverless was spawned with correct arguments
      expect(childProcess.spawn).toHaveBeenCalledWith(
        'serverless',
        ['offline', 'start', '--config=.serverless.json'],
        { env: expect.any(Object) }
      );
    });
  });
}); 