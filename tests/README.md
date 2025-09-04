# Secretary-Sidekick Integration Tests

This directory contains comprehensive test suites for the Secretary-Sidekick realtime web application, addressing GitHub issue #9 requirements for integration testing.

## Test Structure

### Test Files

- **`basic.test.js`** - Basic environment verification tests
- **`integration.test.js`** - General integration tests with mock implementations
- **`secretary-sidekick.test.js`** - Specific tests for Secretary-Sidekick interaction (Issue #9)
- **`setup.js`** - Test environment configuration and global mocks

### Test Categories

#### 1. Secretary Pause/Resume Tests
Tests that verify Secretary automatically pauses during Sidekick PTT sessions and resumes afterward.

**Key Test Cases:**
- Secretary start and status verification
- PTT activation triggering Secretary pause
- PTT release triggering Secretary resume
- Auto-pause setting toggle functionality

#### 2. WebRTC Audio Flow Tests
Tests that verify audio track switching works correctly during PTT sessions without renegotiation.

**Key Test Cases:**
- WebRTC connection establishment
- Single audio sender verification during PTT
- Track ID changes on press/release
- Audio reaching OpenAI API through data channels
- Connection stability during interactions

#### 3. Transcript Ingestion Tests
Tests that verify transcripts are properly formatted and stored in the database.

**Key Test Cases:**
- PTT conversation transcript format (`You: [user] \n Sidekick: [assistant]`)
- Typed input conversation ingestion
- Mixed PTT and typed conversation handling
- Transcript content accuracy and format verification

#### 4. End-to-End Flow Tests
Tests that verify complete interaction flow between user, Secretary, and Sidekick.

**Key Test Cases:**
- Complete Secretary-Sidekick interaction workflow
- Rapid PTT press handling
- WebRTC connection stability during interactions
- Concurrent operations handling
- Resource cleanup verification
- Network interruption recovery

## Running Tests

### Prerequisites

Ensure you have the following installed:
- Node.js 18.0.0 or higher
- All project dependencies (`npm install`)

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage reporting
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch

# Run specific test file
npx jest tests/secretary-sidekick.test.js

# Run specific test suite
npx jest --testNamePattern="Secretary Pause/Resume"

# Run tests with verbose output
npx jest --verbose
```

### Advanced Test Options

```bash
# Run tests with detailed output
npx jest --verbose --no-cache

# Run specific test scenarios
npx jest --testNamePattern="Test Scenario 1"

# Run only integration tests
npx jest tests/integration.test.js tests/secretary-sidekick.test.js

# Generate coverage report
npx jest --coverage --coverageDirectory=./coverage

# Run tests with custom timeout
npx jest --testTimeout=30000
```

## Test Environment

### Mock Implementation

The tests use comprehensive mocks for:

- **WebRTC APIs**: Complete mock implementation of RTCPeerConnection, RTCDataChannel, and media streams
- **DOM Environment**: JSDOM provides browser-like environment for UI interaction testing
- **Network Requests**: Jest mocks for fetch API and server endpoints
- **Media Devices**: Mock getUserMedia for audio input simulation

### Global Test Utilities

Available via `global.TestUtils`:

- `waitFor(ms)` - Wait for async operations
- `createMockPeerConnection()` - Create mock WebRTC peer connection
- `createMockMediaStream()` - Create mock media streams
- `triggerEvent()` - Simulate DOM events

### Configuration

Test configuration in `package.json`:
```json
{
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"],
    "testMatch": ["**/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "public/**/*.js",
      "server.js",
      "db.js"
    ]
  }
}
```

## Verifying Test Results

### Expected Outcomes

All tests should pass with the following verifications:

1. **Secretary Pause/Resume**:
   - ✅ Secretary pauses when PTT is pressed
   - ✅ Secretary resumes when PTT is released
   - ✅ Status indicators update correctly
   - ✅ Auto-pause setting controls behavior

2. **WebRTC Audio Flow**:
   - ✅ Single audio sender maintained throughout PTT cycle
   - ✅ Track IDs change on press/release
   - ✅ No WebRTC renegotiation occurs
   - ✅ Audio data reaches OpenAI API via data channels

3. **Transcript Ingestion**:
   - ✅ PTT conversations formatted as "You: [text]\\nSidekick: [reply]"
   - ✅ Typed conversations also properly formatted
   - ✅ All transcript content stored in database
   - ✅ Mixed interaction types handled correctly

4. **End-to-End Flow**:
   - ✅ Complete workflow from Secretary → Sidekick → Database
   - ✅ Context awareness between Secretary and Sidekick
   - ✅ Stable WebRTC connections during interactions
   - ✅ Proper resource cleanup after sessions

### Coverage Targets

Target coverage metrics:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Key files covered:
- `public/sidekick.js` - Sidekick WebRTC functionality
- `server.js` - API endpoints and session management
- `db.js` - Database operations and transcript storage

## Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for slow tests
npx jest --testTimeout=30000
```

#### Mock Issues
```bash
# Clear Jest cache if mocks behave unexpectedly
npx jest --clearCache
```

#### DOM Element Not Found
- Ensure `setupDOM()` includes all required HTML elements
- Check element IDs match between tests and DOM setup

#### WebRTC Connection Failures
- Verify mock WebRTC classes implement all required methods
- Check async timing in connection establishment tests

### Debug Mode

Enable detailed logging:
```javascript
// In test files, temporarily restore console
beforeEach(() => {
  global.restoreConsole();
});
```

Run specific failing tests:
```bash
npx jest --testNamePattern="failing test name" --verbose
```

## Continuous Integration

### GitHub Actions Integration

Tests run automatically on:
- Pull request creation/updates
- Push to main branch
- Manual workflow dispatch

CI configuration runs:
```bash
npm ci
npm test
npm run test:coverage
```

### Pre-commit Hooks

Optional: Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm test
```

## Manual Testing Integration

These automated tests complement the manual testing procedures in `/docs/TESTING.md`. 

**Recommended workflow:**
1. Run automated tests during development (`npm run test:watch`)
2. Execute manual test scenarios before releases
3. Use both automated and manual results for comprehensive validation

## Contributing to Tests

### Adding New Tests

1. **Identify the component/feature** to test
2. **Choose the appropriate test file**:
   - Use `secretary-sidekick.test.js` for Secretary-Sidekick interactions
   - Use `integration.test.js` for general integration scenarios
   - Create new files for major new features

3. **Follow test naming convention**:
   ```javascript
   describe('Component/Feature Name', () => {
     test('Should perform specific action when condition met', () => {
       // Test implementation
     });
   });
   ```

4. **Include proper mocking**:
   ```javascript
   beforeEach(() => {
     jest.clearAllMocks();
     // Setup mocks
   });
   ```

5. **Verify both success and failure cases**
6. **Add test documentation** to this README

### Mock Guidelines

- **Keep mocks simple** but functionally complete
- **Track method calls** with Jest spies for verification
- **Simulate realistic async behavior** with proper timing
- **Clean up resources** in afterEach hooks

### Best Practices

- **Test behavior, not implementation** details
- **Use descriptive test names** that explain expected behavior
- **Keep tests isolated** - each test should be independent
- **Mock external dependencies** - don't rely on real APIs or network
- **Verify error conditions** alongside success cases

## Test Coverage Reports

Generate detailed coverage reports:

```bash
# HTML coverage report
npm run test:coverage
open coverage/lcov-report/index.html

# Text coverage summary
npx jest --coverage --coverageReporters=text-summary
```

Critical areas for coverage:
- WebRTC connection handling
- Secretary-Sidekick coordination
- Transcript ingestion pipeline
- Error handling and recovery
- Settings integration

---

For specific test scenario details and manual testing procedures, see `/docs/TESTING.md`.