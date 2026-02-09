# Developer Guide

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Code Style Guidelines](#code-style-guidelines)
4. [Testing](#testing)
5. [Debugging](#debugging)
6. [Common Development Tasks](#common-development-tasks)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)

## Development Setup

### Prerequisites

- Node.js >= 12.16.1
- npm or yarn
- Homey Developer Account
- UniFi Protect system (physical or Cloud Key Gen2+ / UDM Pro)

### Installation

```bash
# Clone the repository
git clone https://github.com/steffjenl/com-ubnt-unifiprotect.git
cd com-ubnt-unifiprotect

# Install dependencies
npm install

# Install Homey CLI (if not already installed)
npm install -g homey
```

### Running Locally

```bash
# Run the app on your Homey device
homey app run

# Install to actual Homey device
homey app install

# View logs
homey app log
```

## Project Structure

### Core Files

- **`app.js`** - Main application class, handles initialization and coordination
- **`api.js`** - HTTP API endpoints for settings interface
- **`app.json`** - App manifest defining capabilities, drivers, and flow cards

### Library Directory (`library/`)

#### Core Classes

- **`baseclass.js`** - Base class providing Homey instance management
- **`constants.js`** - All constant definitions (events, actions, configs)
- **`protectapi.js`** - Legacy UniFi Protect API implementation
- **`webclient.js`** - HTTP client wrapper
- **`websocket.js`** - Websocket client for real-time updates

#### Application Logic

- **`app-protect.js`** - UniFi Protect application coordination
- **`app-access.js`** - UniFi Access application coordination

#### V2 APIs

- **`protect-api-v2/`** - Modern Protect API with improved architecture
- **`access-api-v2/`** - Modern Access API with improved architecture

#### Models

- **`Models/SmartDetectionEvent.js`** - Data model for smart detection events

### Drivers Directory (`drivers/`)

Each driver follows this structure:

```
driver-name/
├── device.js                   # Device class implementation
├── driver.js                   # Driver class implementation
├── driver.compose.json         # Device capabilities and settings
├── driver.flow.compose.json    # Flow cards definition
├── driver.settings.compose.json # Device settings (optional)
├── assets/
│   └── images/                # Device icons
└── pair/
    └── validate.html          # Pairing validation interface
```

#### Supported Drivers

- **Protect Devices**: cameras, doorbells, lights, sensors, chimes, sirens
- **Access Devices**: doors, garage doors, hubs, readers
- **Controllers**: UniFi OS

## Code Style Guidelines

### JavaScript Style

Follow the existing code style:

```javascript
'use strict';

// Use ES6+ features where appropriate
const modernCode = true;

// Use async/await for asynchronous operations
async function fetchData() {
    const result = await api.getData();
    return result;
}

// Prefer const over let, avoid var
const CONSTANT_VALUE = 100;
let mutableValue = 0;
```

### Naming Conventions

#### Variables and Functions

```javascript
// camelCase for variables and functions
const deviceName = 'Camera'; 
function getDeviceData() { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// Descriptive names for booleans (use verbs)
const isConnected = true;
const hasCapability = false;
const shouldRetry = true;
```

#### Classes

```javascript
// PascalCase for classes
class CameraDevice extends Homey.Device { }
class ProtectAPI extends BaseClass { }
```

#### Private Methods

```javascript
class Example {
    // Prefix private methods with underscore
    _privateMethod() { }
    
    // Public methods without prefix
    publicMethod() { }
}
```

### Documentation Standards

#### JSDoc Comments

All public functions, classes, and modules should have JSDoc comments:

```javascript
/**
 * Brief description of the function.
 * 
 * Detailed description explaining what the function does,
 * any side effects, and important behavior notes.
 * 
 * @param {string} deviceId - The unique device identifier
 * @param {Object} options - Configuration options
 * @param {boolean} options.force - Force update even if unchanged
 * @param {number} [options.timeout=5000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Device data object
 * @throws {Error} If device not found or request fails
 * 
 * @example
 * const data = await getDeviceData('camera-123', { force: true });
 */
async function getDeviceData(deviceId, options) {
    // Implementation
}
```

#### Class Documentation

```javascript
/**
 * Camera device driver for UniFi Protect cameras.
 * 
 * Manages camera lifecycle, capabilities, event detection,
 * and real-time updates via websocket communication.
 * 
 * @class Camera
 * @extends {Homey.Device}
 */
class Camera extends Homey.Device {
    /**
     * Initialize the camera device.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        // Implementation
    }
}
```

### File Organization

#### Imports

```javascript
'use strict';

// Node.js built-in modules first
const https = require('https');
const fs = require('fs');

// Third-party modules second
const Homey = require('homey');
const fetch = require('node-fetch');

// Local modules last
const ProtectAPI = require('./library/protectapi');
const constants = require('./library/constants');

// Constants after imports
const MAX_RETRIES = 3;
const API_TIMEOUT = 5000;
```

#### Function Organization

```javascript
class Example {
    // Constructor first
    constructor() { }
    
    // Public lifecycle methods
    async onInit() { }
    async onAdded() { }
    async onDeleted() { }
    
    // Public methods
    publicMethod() { }
    
    // Private helper methods (grouped by functionality)
    _privateHelper1() { }
    _privateHelper2() { }
    
    // Static methods last
    static utilityMethod() { }
}
```

## Testing

### Manual Testing

1. **Install on Test Homey**:
   ```bash
   homey app install --run
   ```

2. **Test Device Pairing**:
   - Add each device type via Homey app
   - Verify capabilities appear correctly
   - Test capability controls (e.g., night vision toggle)

3. **Test Events**:
   - Trigger motion detection
   - Test smart detection events
   - Verify doorbell ring detection
   - Check access control events

4. **Test Flow Cards**:
   - Create flows using trigger cards
   - Test action cards (snapshot, recording mode)
   - Verify token values in flows

### Debugging Flow

```javascript
// Enable debug mode in app settings
// OR set environment variable
// Then check logs:
homey app log
```

### Common Test Scenarios

1. **Connection Handling**:
   - Test initial connection
   - Disconnect network and verify reconnection
   - Test credential changes

2. **Event Processing**:
   - Rapid successive events (test deduplication)
   - Multiple devices triggering simultaneously
   - Event during reconnection

3. **Error Handling**:
   - Invalid credentials
   - Network timeout
   - Device offline
   - API version mismatch

## Debugging

### Debug Logging

```javascript
// In app code
this.homey.app.debug('Debug message', data);

// View logs
homey app log

// Enable persistent logging (in app settings)
// Logs saved to: /userdata/application-log.log
```

### Websocket Debugging

```javascript
// Check websocket status via API
GET https://homey-local-ip/api/app/com.ubnt.unifiprotect/getWebsocketStatus

// Monitor last message time
GET https://homey-local-ip/api/app/com.ubnt.unifiprotect/getLastWebsocketMessageTime
```

### Common Debugging Tasks

#### Debug Authentication Issues

```javascript
// Check current login status
console.log('Login status:', this.homey.app.api.loggedInStatus);

// Verify stored credentials
const credentials = this.homey.settings.get('ufp:credentials');
console.log('Has credentials:', !!credentials);
```

#### Debug Device Events

```javascript
// Add logging to device class
async onInit() {
    this.log('Device initialized:', this.getName());
    this.log('Device data:', this.getData());
    this.log('Device settings:', this.getSettings());
}
```

#### Debug Websocket Messages

```javascript
// In websocket.js, add logging:
onMessage(data) {
    this.homey.app.debug('Websocket message:', JSON.stringify(data));
    // Process message
}
```

## Common Development Tasks

### Adding a New Device Driver

1. **Create Driver Structure**:
   ```bash
   mkdir -p drivers/new-device/{assets/images,pair}
   ```

2. **Create Base Files**:
   - `device.js` - Device implementation
   - `driver.js` - Driver implementation
   - `driver.compose.json` - Capabilities definition
   - `driver.flow.compose.json` - Flow cards (if needed)

3. **Implement Device Class**:
   ```javascript
   'use strict';
   
   const Homey = require('homey');
   
   class NewDevice extends Homey.Device {
       async onInit() {
           // Initialize device
           await this.waitForBootstrap();
       }
       
       async waitForBootstrap() {
           // Wait for API data to be available
       }
   }
   
   module.exports = NewDevice;
   ```

4. **Define Capabilities** (`driver.compose.json`):
   ```json
   {
       "name": { "en": "New Device" },
       "class": "sensor",
       "capabilities": ["alarm_motion"],
       "images": {
           "small": "./assets/images/small.png",
           "large": "./assets/images/large.png"
       }
   }
   ```

5. **Test and Iterate**:
   ```bash
   homey app run
   ```

### Adding a New Flow Card

1. **Define in `driver.flow.compose.json`**:
   ```json
   {
       "triggers": [{
           "id": "new_event_triggered",
           "title": { "en": "New Event Detected" },
           "tokens": [{
               "name": "event_type",
               "type": "string",
               "title": { "en": "Event Type" }
           }]
       }]
   }
   ```

2. **Implement Handler in Device**:
   ```javascript
   // Trigger the flow card
   this.homey.flow.getDeviceTriggerCard('new_event_triggered')
       .trigger(this, {
           event_type: 'motion'
       })
       .catch(this.error);
   ```

### Adding a New API Method

1. **Add to API Class**:
   ```javascript
   async newApiMethod(deviceData, value) {
       const endpoint = `/api/new-endpoint/${deviceData.id}`;
       const options = {
           method: 'POST',
           body: JSON.stringify({ value })
       };
       
       return this.webclient.request(endpoint, options);
   }
   ```

2. **Add Constants** (if needed):
   ```javascript
   // In constants.js
   module.exports.ACTION_NEW_METHOD = 'ufv_new_method';
   ```

3. **Document the Method**:
   ```javascript
   /**
    * Perform new API operation.
    * 
    * @param {Object} deviceData - Device identification data
    * @param {*} value - Value to set
    * @returns {Promise<Object>} API response
    */
   async newApiMethod(deviceData, value) {
       // Implementation
   }
   ```

## API Reference

### Main App API (`app.js`)

#### Properties

- `api` - ProtectAPI instance (legacy)
- `apiV2` - ProtectAPIV2 instance
- `accessApi` - AccessAPI instance
- `appProtect` - AppProtect instance
- `appAccess` - AppAccess instance

#### Methods

- `toLocalTime(homeyTime)` - Convert to local timezone
- `getUnixTimestamp()` - Get current Unix timestamp
- `onParseWebsocketMessage(payload)` - Handle websocket messages
- `debug(...args)` - Debug logging with persistence

### Device Base Methods

All device drivers inherit from `Homey.Device`:

- `async onInit()` - Device initialization
- `async onAdded()` - Called when device added
- `async onSettings({oldSettings, newSettings, changedKeys})` - Settings changed
- `async onRenamed(name)` - Device renamed
- `async onDeleted()` - Device deleted
- `getData()` - Get device data object
- `getSettings()` - Get device settings
- `setCapabilityValue(capability, value)` - Update capability
- `registerCapabilityListener(capability, callback)` - Listen to capability changes

## Best Practices

### Error Handling

```javascript
// Always handle errors in async functions
async function riskyOperation() {
    try {
        const result = await api.request();
        return result;
    } catch (error) {
        this.error('Operation failed:', error);
        throw new Error(`Failed to perform operation: ${error.message}`);
    }
}

// Use .catch() for fire-and-forget operations
this.updateDevice().catch(this.error);
```

### Resource Management

```javascript
// Clean up resources in onDeleted
async onDeleted() {
    // Remove event listeners
    this.removeListener('data', this.onData);
    
    // Clear intervals/timeouts
    if (this.updateInterval) {
        this.homey.clearInterval(this.updateInterval);
    }
    
    // Close connections
    if (this.connection) {
        await this.connection.close();
    }
}
```

### Capability Management

```javascript
// Check before using capabilities
if (this.hasCapability('alarm_motion')) {
    await this.setCapabilityValue('alarm_motion', true);
}

// Add capabilities dynamically if needed
if (!this.hasCapability('new_capability')) {
    await this.addCapability('new_capability');
}
```

### Event Deduplication

```javascript
// Prevent event spam
this.lastEventTime = 0;
const MIN_EVENT_INTERVAL = 5000; // 5 seconds

function triggerEvent() {
    const now = Date.now();
    if (now - this.lastEventTime < MIN_EVENT_INTERVAL) {
        return; // Skip event
    }
    
    this.lastEventTime = now;
    // Trigger event
}
```

### Async/Await Best Practices

```javascript
// Good: Sequential when needed
const bootstrap = await api.getBootstrap();
const devices = await api.getDevices(bootstrap.nvrId);

// Better: Parallel when possible
const [bootstrap, settings] = await Promise.all([
    api.getBootstrap(),
    api.getSettings()
]);

// Handling errors in parallel operations
const results = await Promise.allSettled([
    operation1(),
    operation2(),
    operation3()
]);

results.forEach((result, index) => {
    if (result.status === 'rejected') {
        console.error(`Operation ${index} failed:`, result.reason);
    }
});
```

### Memory Management

```javascript
// Clear large data structures when done
function processLargeData() {
    let largeArray = fetchLargeDataset();
    
    // Process data
    const result = process(largeArray);
    
    // Clear reference to allow garbage collection
    largeArray = null;
    
    return result;
}
```

### Websocket Best Practices

```javascript
// Always implement reconnection logic
onWebsocketClose() {
    this.log('Websocket closed, reconnecting...');
    this.reconnectTimer = setTimeout(() => {
        this.connect();
    }, 5000);
}

// Clean up on intentional disconnect
async disconnect() {
    if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
    }
    if (this.websocket) {
        this.websocket.close();
    }
}
```

## Code Review Checklist

Before submitting changes:

- [ ] All new functions have JSDoc documentation
- [ ] Error handling implemented for async operations
- [ ] Resources cleaned up properly (listeners, timers, connections)
- [ ] Constants used instead of magic numbers
- [ ] Code follows existing style conventions
- [ ] Tested with real hardware
- [ ] No console.log() statements (use this.log() or debug())
- [ ] Backward compatibility maintained
- [ ] ARCHITECTURE.md updated if structure changed

## Performance Tips

1. **Minimize API Calls**: Cache frequently accessed data
2. **Use Websockets**: Real-time updates instead of polling
3. **Batch Operations**: Group multiple API calls when possible
4. **Lazy Loading**: Initialize devices only when needed
5. **Efficient Event Handling**: Use debouncing for rapid events

## Useful Resources

- [Homey Apps SDK Documentation](https://apps.developer.homey.app/)
- [UniFi Protect API (Community)](https://github.com/hjdhjd/homebridge-unifi-protect)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript Clean Code](https://github.com/ryanmcdermott/clean-code-javascript)

---

*For questions or issues, please open a GitHub issue or discussion.*
