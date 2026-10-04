module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/main/features/ai/router.js',
    'src/main/features/ai/orchestrator.js',
    'src/main/features/voice/whisperService.js',
    'src/main/features/contacts/contactsService.js',
    'src/renderer/shared/markdown.js',
    'src/main/features/history/historyService.js'
  ],
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50
    }
  }
};