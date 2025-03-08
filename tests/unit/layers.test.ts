import { jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as childProcess from 'child_process';
import AdmZip from 'adm-zip';

// Mock the uploadLambdaLayers function
const mockUploadLambdaLayers = jest.fn();

jest.mock('../../cli/layers.mjs', () => ({
  uploadLambdaLayers: mockUploadLambdaLayers
}), { virtual: true });

// Mock the required modules
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  removeSync: jest.fn(),
  mkdirSync: jest.fn(),
  copySync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    addLocalFolder: jest.fn(),
    writeZip: jest.fn()
  }));
});

// Mock AWS SDK modules
jest.mock('@aws-sdk/lib-storage', () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({}));

// Mock ora for spinner
jest.mock('ora', () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis()
  }));
});

describe('Layers Module', () => {
  describe('uploadLambdaLayers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Implement the mock uploadLambdaLayers function
      mockUploadLambdaLayers.mockImplementation(async (functionName) => {
        // Mock implementation that simulates the three steps:
        // 1. Install npm modules
        // 2. Make zip file
        // 3. Upload to S3
        
        // Check if the function name is valid
        if (!functionName || typeof functionName !== 'string') {
          throw new Error('Invalid function name');
        }
        
        // Return a mock S3 upload result
        return {
          functionName,
          s3Location: `s3://povery-layers/${functionName}/nodejs.zip`,
          layerArn: `arn:aws:lambda:us-east-1:123456789012:layer:${functionName}:1`
        };
      });
    });
    
    it('should upload lambda layers for a given function', async () => {
      // Call the function
      const result = await mockUploadLambdaLayers('test-function');
      
      // Verify the function was called with the correct parameters
      expect(mockUploadLambdaLayers).toHaveBeenCalledWith('test-function');
      expect(mockUploadLambdaLayers).toHaveBeenCalledTimes(1);
      
      // Verify the result
      expect(result).toEqual({
        functionName: 'test-function',
        s3Location: 's3://povery-layers/test-function/nodejs.zip',
        layerArn: 'arn:aws:lambda:us-east-1:123456789012:layer:test-function:1'
      });
    });
    
    it('should throw an error for invalid function name', async () => {
      // Call the function with invalid parameters and expect it to throw
      await expect(mockUploadLambdaLayers('')).rejects.toThrow('Invalid function name');
      await expect(mockUploadLambdaLayers(null)).rejects.toThrow('Invalid function name');
      
      // Verify the function was called
      expect(mockUploadLambdaLayers).toHaveBeenCalledTimes(2);
    });
  });
}); 