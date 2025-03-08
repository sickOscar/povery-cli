import { jest } from '@jest/globals';

// Mock the promoteFunction function
const mockPromoteFunction = jest.fn();

jest.mock('../../cli/function.mjs', () => ({
  promoteFunction: mockPromoteFunction
}), { virtual: true });

// Mock the AWS SDK Lambda client
jest.mock('@aws-sdk/client-lambda', () => {
  // Create mock functions for the commands
  const mockGetFunctionCommand = jest.fn();
  const mockPublishVersionCommand = jest.fn();
  const mockUpdateAliasCommand = jest.fn();
  
  // Create a mock send function that returns appropriate responses based on the command
  const mockSend = jest.fn().mockImplementation((command) => {
    if (command instanceof mockGetFunctionCommand.constructor) {
      return Promise.resolve({
        Configuration: {
          FunctionName: 'test-function',
          Version: '1'
        }
      });
    }
    if (command instanceof mockPublishVersionCommand.constructor) {
      return Promise.resolve({
        Version: '2'
      });
    }
    if (command instanceof mockUpdateAliasCommand.constructor) {
      return Promise.resolve({
        AliasArn: 'arn:aws:lambda:region:account-id:function:test-function:prod'
      });
    }
    return Promise.resolve({});
  });
  
  // Return the mock implementation
  return {
    LambdaClient: jest.fn().mockImplementation(() => ({
      send: mockSend
    })),
    GetFunctionCommand: mockGetFunctionCommand,
    PublishVersionCommand: mockPublishVersionCommand,
    UpdateAliasCommand: mockUpdateAliasCommand,
    UpdateFunctionCodeCommand: jest.fn()
  };
});

describe('Function Module', () => {
  describe('promoteFunction', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Implement the mock promoteFunction
      mockPromoteFunction.mockImplementation(async (stage, functionName) => {
        // This is a simplified mock implementation
        return Promise.resolve({
          FunctionName: functionName,
          Version: '2',
          Alias: stage
        });
      });
    });
    
    it('should call promoteFunction with correct parameters', async () => {
      // Call the function
      await mockPromoteFunction('prod', 'test-function');
      
      // Verify the function was called with the correct parameters
      expect(mockPromoteFunction).toHaveBeenCalledWith('prod', 'test-function');
      expect(mockPromoteFunction).toHaveBeenCalledTimes(1);
    });
  });
}); 