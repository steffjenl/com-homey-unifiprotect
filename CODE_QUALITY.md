# Code Quality Standards

This document outlines the clean code principles and quality standards applied to the UniFi Protect Homey App codebase.

## Table of Contents

1. [Clean Code Principles Applied](#clean-code-principles-applied)
2. [Code Organization](#code-organization)
3. [Naming Conventions](#naming-conventions)
4. [Function Design](#function-design)
5. [Error Handling](#error-handling)
6. [Documentation Standards](#documentation-standards)
7. [Testing Guidelines](#testing-guidelines)
8. [Code Smells to Avoid](#code-smells-to-avoid)

## Clean Code Principles Applied

### 1. Single Responsibility Principle (SRP)

**Definition**: Each function/class should have one reason to change.

**Applied**:
```javascript
// Before: One large function doing multiple things
async onInit() {
    // Initialize everything
    // Setup listeners
    // Load settings
    // Connect APIs
}

// After: Broken into smaller, focused functions
async onInit() {
    this._initializeAuthenticationState();
    this._initializeAPIInstances();
    await this._initializeSubApplications();
    this._setupSettingsListeners();
    this._loadAndApplySettings();
    this._registerWidgetHandlers();
}

_initializeAuthenticationState() { /* focuses only on auth state */ }
_initializeAPIInstances() { /* focuses only on API setup */ }
```

### 2. DRY (Don't Repeat Yourself)

**Definition**: Avoid code duplication through extraction and reuse.

**Applied**:
```javascript
// Before: Repeated validation logic
if (typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
    // use key
}
if (typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
    // use key
}

// After: Extracted helper function
_isValidApiKey(apiKey) {
    return typeof apiKey !== 'undefined' && apiKey !== '';
}

if (this._isValidApiKey(tokens.accessApiKey)) { /* use key */ }
if (this._isValidApiKey(tokens.protectV2ApiKey)) { /* use key */ }
```

### 3. Meaningful Names

**Definition**: Names should reveal intent and be pronounceable.

**Applied**:
```javascript
// Before: Unclear abbreviations
const tz = this.homey.clock.getTimezone();
const d = new Date();

// After: Clear, descriptive names
const timezone = this.homey.clock.getTimezone();
const localTime = new Date();
```

### 4. Small Functions

**Definition**: Functions should be small and do one thing well.

**Applied**:
```javascript
// Before: Large function with multiple responsibilities
async debug(...args) {
    // Check debug mode
    // Log to console
    // Check file size
    // Write to file
    // All in one function
}

// After: Broken into smaller functions
async debug(...args) {
    if (Homey.env.DEBUG === 'true') {
        this._logToConsole('[debug]', ...args);
        this._cleanupLogFileIfExists();
    }
    
    const settings = this.homey.settings.get(SETTINGS_KEY_SETTINGS);
    if (settings && settings.saveLogToPersistentStorage) {
        await this._logToFile('[debug]', ...args);
    }
}

_logToConsole(prefix, ...args) { /* single purpose */ }
_cleanupLogFileIfExists() { /* single purpose */ }
async _logToFile(prefix, ...args) { /* single purpose */ }
```

### 5. Extract Constants

**Definition**: Replace magic numbers and strings with named constants.

**Applied**:
```javascript
// Before: Magic numbers
this.ignoreEventsNfcFingerprint = 5;
this._refreshAuthTokensnterval = 60 * 60 * 1000;
if (stats.size >= 25 * 1024 * 1024) {
    unlinkSync(logFile);
}

// After: Named constants
const DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS = 5;
const AUTH_TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MAX_LOG_FILE_SIZE_BYTES = 25 * 1024 * 1024;

this.ignoreEventsNfcFingerprint = DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS;
this._refreshAuthTokensInterval = AUTH_TOKEN_REFRESH_INTERVAL_MS;
if (stats.size >= MAX_LOG_FILE_SIZE_BYTES) {
    unlinkSync(LOG_FILE_PATH);
}
```

### 6. Prefer Polymorphism Over Conditionals

**Definition**: Use object-oriented patterns instead of switch/if chains.

**Applied**:
```javascript
// Before: Multiple if conditions
function getWebsocketConnectionStatus(api) {
    if (api === 'protect') {
        return homey.app.api.ws.isWebsocketConnected() ? 'Connected' : 'Unknown';
    }
    if (api === 'access') {
        return homey.app.accessApi.websocket.isWebsocketConnected() ? 'Connected' : 'Unknown';
    }
    // ... more conditions
}

// After: Helper function that works generically
function getWebsocketConnectionStatus(websocket) {
    return websocket.isWebsocketConnected() ? CONNECTION_STATUS_CONNECTED : CONNECTION_STATUS_UNKNOWN;
}

// Usage
getWebsocketConnectionStatus(homey.app.api.ws);
getWebsocketConnectionStatus(homey.app.accessApi.websocket);
```

### 7. Error Handling

**Definition**: Separate error handling from business logic.

**Applied**:
```javascript
// Before: Mixed error handling and logic
async testCredentials({homey, body}) {
    try {
        return new Promise((resolve, reject) => {
            // Complex logic with nested error handling
            if (res.statusCode === 401) {
                reject(new Error('Invalid credentials (401)'));
                return;
            }
            // More error checks inline
        }).then(result => {
            return { status: 'success' };
        }).catch(error => {
            return { status: 'failure', error };
        });
    } catch (error) {
        return { status: 'failure', error: error.message };
    }
}

// After: Separated concerns
async testCredentials({homey, body}) {
    try {
        await this._performCredentialTest(body);
        return { status: 'success' };
    } catch (error) {
        homey.log('testCredentials error', error);
        return { status: 'failure', error: error.message };
    }
}

async _performCredentialTest(credentials) {
    // Business logic only
}

_handleCredentialTestResponse(res, resolve, reject) {
    // Error handling only
}
```

## Code Organization

### File Structure Standards

Each file should follow this organization:

```javascript
'use strict';

// 1. Imports
const Homey = require('homey');
const LocalModule = require('./local');

// 2. Constants
const CONSTANT_VALUE = 100;
const SETTING_KEY = 'setting:key';

// 3. Helper functions (if module exports class)
function privateHelper() { }

// 4. Class/Module definition
class Example extends Homey.Device {
    // 4.1. Constructor
    constructor() { }
    
    // 4.2. Public lifecycle methods
    async onInit() { }
    async onAdded() { }
    
    // 4.3. Public methods
    publicMethod() { }
    
    // 4.4. Private methods (grouped by functionality)
    _privateHelper1() { }
    _privateHelper2() { }
    
    // 4.5. Static methods
    static utility() { }
}

// 5. Export
module.exports = Example;
```

### Grouping Related Code

```javascript
// Group related functionality together
class Camera extends Homey.Device {
    // === Initialization ===
    async onInit() { }
    async waitForBootstrap() { }
    async initCamera() { }
    
    // === Capability Management ===
    async _createMissingCapabilities() { }
    _registerCapabilityListeners() { }
    
    // === Event Handling ===
    _onMotionDetected() { }
    _onSmartDetection() { }
    
    // === Snapshot Management ===
    async _createSnapshotImage() { }
    async _updateSnapshot() { }
}
```

## Naming Conventions

### Variables and Functions

| Type | Convention | Example |
|------|------------|---------|
| Local variable | camelCase | `deviceName`, `retryCount` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT` |
| Private method | _camelCase | `_initDevice()`, `_updateState()` |
| Public method | camelCase | `getData()`, `updateDevice()` |
| Boolean | is/has/should prefix | `isConnected`, `hasCapability` |
| Class | PascalCase | `CameraDevice`, `ProtectAPI` |

### Meaningful Names Examples

✅ **Good**:
```javascript
const userAuthenticationToken = getToken();
const isDeviceOnline = checkStatus();
const eventDeduplicationWindowMs = 5000;

function _validateCredentials(username, password) { }
function getWebsocketConnectionStatus() { }
```

❌ **Bad**:
```javascript
const t = getToken();  // What kind of token?
const x = checkStatus();  // What does true/false mean?
const w = 5000;  // What is this window for?

function _vc(u, p) { }  // Unpronounceable
function gwcs() { }  // Meaningless abbreviation
```

## Function Design

### Function Size

**Target**: Functions should fit on one screen (< 30 lines ideal)

**Strategy**:
1. Extract helper functions
2. Use early returns to reduce nesting
3. Break complex logic into steps

```javascript
// Good: Small, focused function
async _loadAndApplySettings() {
    const settings = this._getStoredSettings();
    if (!settings) return;
    
    this._applyGeneralSettings(settings);
    this._applyTokenSettings(settings);
}

// Supporting helper functions
_getStoredSettings() {
    return this.homey.settings.get(SETTINGS_KEY_SETTINGS);
}

_applyGeneralSettings(settings) {
    this.useCameraSnapshot = settings.useCameraSnapshot;
    // ...
}
```

### Function Arguments

**Target**: 0-3 arguments ideal, avoid flag arguments

```javascript
// Good: Few arguments, clear purpose
function connectToWebsocket(host, port, apiKey) { }

// Better: Use object for multiple related parameters
function connectToWebsocket({ host, port, apiKey, timeout = 5000 }) { }

// Avoid: Flag arguments
function getData(includeMetadata) { }  // Bad

// Better: Separate functions
function getData() { }
function getDataWithMetadata() { }
```

### Single Level of Abstraction

```javascript
// Good: Consistent abstraction level
async initialize() {
    await this._connectToAPI();
    await this._loadDevices();
    await this._startWebsocket();
}

// Bad: Mixed abstraction levels
async initialize() {
    // High level
    await this._connectToAPI();
    
    // Low level details mixed in
    const options = { method: 'GET', headers: {...} };
    const response = await fetch(url, options);
    const data = await response.json();
    
    // High level again
    await this._startWebsocket();
}
```

## Error Handling

### Consistent Error Handling Pattern

```javascript
// Pattern 1: Try-catch for async operations
async performOperation() {
    try {
        const result = await this._riskyOperation();
        return result;
    } catch (error) {
        this.error('Operation failed:', error);
        throw new Error(`Failed to perform operation: ${error.message}`);
    }
}

// Pattern 2: Explicit error checking
async performOperation() {
    const result = await this._riskyOperation();
    
    if (!result || result.error) {
        throw new Error('Operation failed: Invalid result');
    }
    
    return result;
}

// Pattern 3: Promise.catch() for fire-and-forget
this.updateDevice()
    .catch(this.error);  // Log but don't block
```

### Validation

```javascript
// Validate early and explicitly
function processDevice(deviceData) {
    // Guard clauses at the top
    if (!deviceData) {
        throw new Error('Device data is required');
    }
    
    if (!deviceData.id) {
        throw new Error('Device ID is required');
    }
    
    // Main logic after validation
    return this._process(deviceData);
}
```

## Documentation Standards

### JSDoc Template

```javascript
/**
 * Brief one-line description of what the function does.
 * 
 * More detailed explanation if needed. Explain:
 * - What the function does
 * - When to use it
 * - Important side effects or behaviors
 * - Any constraints or requirements
 * 
 * @param {string} deviceId - Brief description of parameter
 * @param {Object} options - Configuration options
 * @param {boolean} [options.force=false] - Optional param with default
 * @param {number} options.timeout - Required option property
 * @returns {Promise<Object>} Description of return value
 * @throws {Error} When error occurs and why
 * 
 * @example
 * // Simple usage example
 * const device = await getDevice('camera-123');
 * 
 * @example
 * // Advanced usage with options
 * const device = await getDevice('camera-123', {
 *     force: true,
 *     timeout: 10000
 * });
 * 
 * @private  // If private method
 * @async    // If async method
 * @deprecated Use {@link newMethod} instead
 */
```

### Comment Guidelines

```javascript
// Good: Explain WHY, not WHAT
// Retry with exponential backoff to handle transient network issues
const delay = Math.pow(2, attempt) * 1000;

// Bad: Comment explains obvious code
// Increment counter by 1
counter++;

// Good: Explain complex business logic
// UniFi OS expects heartbeat every 15 seconds, we send at 10s
// to account for network latency and processing time
const HEARTBEAT_INTERVAL = 10;

// Good: Explain non-obvious solutions
// Using setTimeout instead of setInterval to prevent overlapping
// executions if the async operation takes longer than the interval
this.scheduleNextUpdate();
```

## Testing Guidelines

### Manual Testing Checklist

- [ ] Device pairing works for all device types
- [ ] Capabilities update correctly from API
- [ ] Events trigger flows reliably
- [ ] Reconnection works after network disruption
- [ ] Settings changes apply without restart
- [ ] Memory usage stable over 24+ hours
- [ ] Error messages are clear and helpful

### Test Scenarios to Cover

1. **Happy Path**: Normal operation with good network
2. **Error Path**: Network failures, invalid credentials
3. **Edge Cases**: Rapid events, device offline, API changes
4. **Performance**: Multiple devices, high event volume
5. **Recovery**: Reconnection after failures

## Code Smells to Avoid

### 1. Long Functions

❌ **Bad**: Function does too much (> 50 lines)  
✅ **Fix**: Extract smaller functions

### 2. Magic Numbers

❌ **Bad**: `if (timeout > 5000)`  
✅ **Fix**: `const MAX_TIMEOUT_MS = 5000; if (timeout > MAX_TIMEOUT_MS)`

### 3. Deep Nesting

❌ **Bad**: 4+ levels of nesting  
✅ **Fix**: Use early returns, extract functions

```javascript
// Bad
function process(data) {
    if (data) {
        if (data.valid) {
            if (data.active) {
                if (data.ready) {
                    // Do something
                }
            }
        }
    }
}

// Good
function process(data) {
    if (!data) return;
    if (!data.valid) return;
    if (!data.active) return;
    if (!data.ready) return;
    
    // Do something
}
```

### 4. Inconsistent Naming

❌ **Bad**: `getData()`, `fetchInfo()`, `retrieveStatus()` (pick one style)  
✅ **Fix**: `getData()`, `getInfo()`, `getStatus()` (consistent prefix)

### 5. Side Effects in Getters

❌ **Bad**: `getTemperature()` that also updates database  
✅ **Fix**: Separate `getTemperature()` and `updateTemperature()`

### 6. Callback Hell

❌ **Bad**: Nested callbacks  
✅ **Fix**: Use async/await or Promises

```javascript
// Bad
getData(id, (data) => {
    processData(data, (result) => {
        saveResult(result, (saved) => {
            // ...
        });
    });
});

// Good
const data = await getData(id);
const result = await processData(data);
const saved = await saveResult(result);
```

### 7. Hardcoded Strings

❌ **Bad**: `settings.get('ufp:credentials')`  
✅ **Fix**: `settings.get(SETTINGS_KEY_CREDENTIALS)`

## Refactoring Checklist

Before considering refactoring complete:

- [ ] All magic numbers extracted to constants
- [ ] Functions are small and focused (< 30 lines)
- [ ] Names are clear and reveal intent
- [ ] No code duplication
- [ ] Error handling is consistent
- [ ] JSDoc comments for all public APIs
- [ ] Complex logic has explanatory comments
- [ ] Consistent code style throughout
- [ ] No console.log() (use proper logging)
- [ ] Tests still pass
- [ ] Performance not degraded

## Metrics

### Code Quality Targets

| Metric | Target | Current |
|--------|--------|---------|
| Function length | < 30 lines | ✅ Improved |
| File length | < 500 lines | ✅ Most comply |
| Cyclomatic complexity | < 10 | ✅ Improved |
| Documentation coverage | > 80% | ✅ Core files done |
| Test coverage | > 70% | ⚠️ Manual testing |

## Continuous Improvement

This is a living document. When you find:
- Better patterns
- Common issues
- Useful refactoring techniques

Please update this document to help future contributors.

---

*Last Updated: February 2026*
