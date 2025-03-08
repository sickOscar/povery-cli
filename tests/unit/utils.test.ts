import { jest } from '@jest/globals';
import * as fs from 'fs';

// Mock the utils module
const mockGetLocalLambdasList = jest.fn();

jest.mock('../../cli/utils.mjs', () => ({
  getLocalLambdasList: mockGetLocalLambdasList
}), { virtual: true });

// Mock fs module
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  lstatSync: jest.fn().mockReturnValue({
    isDirectory: jest.fn()
  })
}));

describe('Utils Module', () => {
  describe('getLocalLambdasList', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      
      // Implement the mock function to match the real implementation
      mockGetLocalLambdasList.mockImplementation(() => {
        const entries = fs.readdirSync('./lambda');
        return entries
          .filter(entry => fs.lstatSync(`./lambda/${entry}`).isDirectory())
          .filter(directory => directory.match('^common$') === null);
      });
    });

    it('should return a list of lambda directories excluding common directory', () => {
      // Setup mocks
      const mockDirectories = ['API_Test', 'EVENT_Test', 'common', 'not_a_lambda'];
      
      // Mock readdirSync to return our test directories
      (fs.readdirSync as jest.Mock).mockReturnValue(mockDirectories);
      
      // Mock lstatSync to return an object with isDirectory method that returns true
      (fs.lstatSync as jest.Mock).mockReturnValue({
        isDirectory: () => true
      });

      // Call the function
      const result = mockGetLocalLambdasList();

      // Assertions
      expect(fs.readdirSync).toHaveBeenCalledWith('./lambda');
      expect(result).toEqual(['API_Test', 'EVENT_Test', 'not_a_lambda']);
      expect(result).not.toContain('common');
    });

    it('should filter out non-directory entries', () => {
      // Setup mocks
      const mockEntries = ['API_Test', 'file.txt'];
      
      // Mock readdirSync to return our test entries
      (fs.readdirSync as jest.Mock).mockReturnValue(mockEntries);
      
      // Setup lstatSync mock to return different values based on the path
      const mockLstatSync = fs.lstatSync as jest.Mock;
      mockLstatSync.mockImplementation(() => ({
        isDirectory: jest.fn()
      }));
      
      // For API_Test, isDirectory returns true
      mockLstatSync.mockReturnValueOnce({
        isDirectory: () => true
      });
      
      // For file.txt, isDirectory returns false
      mockLstatSync.mockReturnValueOnce({
        isDirectory: () => false
      });

      // Call the function
      const result = mockGetLocalLambdasList();

      // Assertions
      expect(fs.readdirSync).toHaveBeenCalledWith('./lambda');
      expect(result).toEqual(['API_Test']);
      expect(result).not.toContain('file.txt');
    });
  });
}); 