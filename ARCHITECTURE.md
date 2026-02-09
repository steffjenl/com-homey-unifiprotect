# UniFi Protect Homey App - Architecture Documentation

## Overview

This Homey application integrates UniFi Protect and UniFi Access systems with the Athom Homey smart home platform. It enables real-time monitoring, control, and automation of UniFi security cameras, doorbells, access control devices, and sensors.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Core Components](#core-components)
3. [API Architecture](#api-architecture)
4. [Device Drivers](#device-drivers)
5. [Event System](#event-system)
6. [Authentication Flow](#authentication-flow)
7. [Websocket Communication](#websocket-communication)
8. [Data Flow](#data-flow)
9. [Key Design Patterns](#key-design-patterns)

## Project Structure

```
com-homey-unifiprotect/
├── app.js                      # Main application entry point
├── api.js                      # Homey API endpoints for settings
├── library/                    # Core library modules
│   ├── baseclass.js           # Base class for library components
│   ├── constants.js           # Application constants and event IDs
│   ├── protectapi.js          # UniFi Protect API (Legacy)
│   ├── webclient.js           # HTTP client for API requests
│   ├── websocket.js           # Websocket client for real-time updates
│   ├── app-protect.js         # Protect application logic
│   ├── app-access.js          # Access application logic
│   ├── protect-api-v2/        # UniFi Protect API V2
│   │   ├── protect-api.js
│   │   ├── web-client.js
│   │   ├── web-socket-devices.js
│   │   └── web-socket-events.js
│   ├── access-api-v2/         # UniFi Access API V2
│   │   ├── access-api.js
│   │   ├── base-class.js
│   │   ├── web-client.js
│   │   └── web-socket.js
│   └── Models/                # Data models
│       └── SmartDetectionEvent.js
├── drivers/                    # Device drivers
│   ├── protectcamera/         # Camera driver
│   ├── protectdoorbell/       # Doorbell driver
│   ├── protectchime/          # Chime driver
│   ├── protectlight/          # Floodlight driver
│   ├── protectsensor/         # Sensor driver
│   ├── protect-siren/         # Siren driver
│   ├── access-door/           # Door driver
│   ├── access-garagedoor/     # Garage door driver
│   ├── access-hub/            # Access hub driver
│   ├── access-reader/         # Card reader driver
│   └── unifi-os/              # UniFi OS controller driver
├── widgets/                    # Dashboard widgets
│   ├── camera/                # Camera widget
│   └── doorbell/              # Doorbell widget
├── settings/                   # App settings interface
└── locales/                    # Internationalization files
```

## Core Components

### 1. Main Application (`app.js`)

The `UniFiProtect` class is the central application controller that:

- **Initializes API instances** for both Protect and Access systems
- **Manages authentication state** and token refresh cycles
- **Coordinates event distribution** to devices and flows
- **Handles settings synchronization** between Homey and UniFi systems
- **Provides logging utilities** with persistent storage option

#### Key Responsibilities:

- API lifecycle management
- Settings event listeners
- Widget autocomplete registration
- Debug logging with file rotation
- Timezone conversions

### 2. API Layer (`api.js`)

Exposes HTTP endpoints for the Homey settings interface:

- **Status endpoints**: Check login and connection status
- **Websocket monitoring**: Track connection health
- **Credential testing**: Validate UniFi Protect credentials

### 3. Library Components

#### BaseClass (`library/baseclass.js`)

Base class providing:
- Homey instance management
- Common initialization patterns
- Shared utility methods

#### Constants (`library/constants.js`)

Centralized constant definitions:
- **Platform identifiers**: Camera model types
- **Device types**: Camera, NVR, sensor classifications
- **Action IDs**: Flow action identifiers
- **Event names**: Websocket and flow event identifiers
- **Configuration values**: Timeouts, intervals, defaults

## API Architecture

### Dual API System

The application supports two API versions:

#### Legacy API (`library/protectapi.js`)
- Cookie-based authentication
- CSRF token management
- Bootstrap data retrieval
- Direct HTTP/HTTPS communication

#### V2 API (`library/protect-api-v2/`)
- API key authentication
- Enhanced websocket support
- Modular architecture
- Better event granularity

### API Client Structure

```
ProtectAPI / ProtectAPIV2
    ├── WebClient         # HTTP requests
    ├── WebSocket         # Real-time updates
    └── Bootstrap         # Device/system state
```

## Device Drivers

### Camera Driver (`drivers/protectcamera/`)

**Capabilities:**
- Motion detection
- Smart detection (person, vehicle, animal, package)
- Night vision control
- Audio detection
- Snapshot capture
- Video streaming

**Lifecycle:**
1. Wait for bootstrap data
2. Create missing capabilities
3. Initialize camera data
4. Set up snapshot image
5. Configure video URL
6. Register websocket listeners

### Doorbell Driver (`drivers/protectdoorbell/`)

Extends camera functionality with:
- Doorbell ring detection
- LCD message display
- Chime control
- Visitor detection

### Access Control Drivers

- **Door**: Lock/unlock control, access events
- **Reader**: NFC card, fingerprint detection
- **Hub**: Central access control management
- **Garage Door**: Open/close control

### Sensor Driver (`drivers/protectsensor/`)

- Motion detection
- Contact sensor monitoring
- Temperature/humidity (if supported)
- Battery status

## Event System

### Event Flow

```
UniFi Device Event
    ↓
Websocket Message
    ↓
API Parser
    ↓
Event Distribution
    ↓
├── Device Capabilities (update state)
├── Flow Cards (trigger flows)
└── Notifications (alerts)
```

### Event Types

1. **Motion Events**: Camera motion, person/vehicle detection
2. **Doorbell Events**: Ring, package detection, visitor identification
3. **Access Events**: Door access, NFC card scan, fingerprint
4. **System Events**: Connection changes, health status

### Event Deduplication

The app implements event deduplication to prevent spam:
- **NFC/Fingerprint**: 5-second default ignore window
- **Doorbell**: 5-second default ignore window
- Configurable via app settings

## Authentication Flow

### Initial Authentication

```
1. User enters credentials (host, port, username, password)
    ↓
2. App requests CSRF token (Legacy API)
    ↓
3. Perform login request
    ↓
4. Store authentication cookies/tokens
    ↓
5. Retrieve bootstrap data
    ↓
6. Initialize websocket connection
```

### Token Refresh

- **Interval**: Every 1800 seconds (30 minutes)
- **Method**: Silent background refresh
- **Fallback**: Re-login if refresh fails

### V2 API Key Flow

```
1. User provides API key
    ↓
2. Validate API key with test request
    ↓
3. Store key in settings
    ↓
4. Initialize V2 API instances
    ↓
5. Connect to V2 websockets
```

## Websocket Communication

### Connection Management

Each API maintains persistent websocket connections:

- **Protect Legacy**: `/proxy/protect/ws/updates`
- **Protect V2**: Enhanced event stream
- **Access**: Door and reader events

### Heartbeat Mechanism

- **Interval**: 10 seconds (configurable)
- **Purpose**: Keep connection alive, detect disconnects
- **Recovery**: Automatic reconnection on failure

### Message Processing

```javascript
Websocket Message
    ↓
Header Parsing (8 bytes)
    ↓
Payload Extraction
    ↓
JSON Parsing
    ↓
Event Type Identification
    ↓
Device Matching
    ↓
State Update / Flow Trigger
```

## Data Flow

### Bootstrap Data

Initial device state retrieved on connection:

```json
{
  "nvr": {...},
  "cameras": [...],
  "sensors": [...],
  "lights": [...],
  "doorbells": [...]
}
```

### Update Events

Real-time changes delivered via websocket:

```json
{
  "action": "update",
  "id": "device-id",
  "modelKey": "camera",
  "newUpdateId": "...",
  "data": {...}
}
```

### Snapshot Retrieval

```
Request Snapshot
    ↓
Generate anonymous token
    ↓
Construct URL with token
    ↓
Fetch image
    ↓
Cache locally
    ↓
Provide to Homey
```

## Key Design Patterns

### 1. Singleton Pattern (API Instances)

**Purpose**: Single API instance shared across all devices

**Benefits**:
- Efficient resource usage
- Consistent state management
- Centralized connection handling

### 2. Observer Pattern (Event System)

**Purpose**: Decouple event producers from consumers

**Implementation**:
- Websocket events trigger device updates
- Homey flow triggers subscribe to device events
- Settings changes notify interested components

### 3. Factory Pattern (Device Creation)

**Purpose**: Standardized device initialization

**Flow**:
1. User pairs new device
2. Driver creates device instance
3. Bootstrap data populates device state
4. Capabilities registered based on device type

### 4. Retry Pattern (API Requests)

**Purpose**: Handle transient network failures

**Strategy**:
- Exponential backoff for failed requests
- Maximum retry count (typically 3)
- Timeout handling

### 5. Module Pattern (Library Organization)

**Purpose**: Encapsulation and separation of concerns

**Structure**:
- Each module exports specific functionality
- Private helpers not exposed
- Clear interface boundaries

## Configuration Management

### Settings Storage

Homey settings API stores:

```javascript
{
  'ufp:credentials': {username, password},
  'ufp:nvrip': 'host',
  'ufp:nvrport': port,
  'ufp:tokens': {accessApiKey, protectV2ApiKey},
  'ufp:settings': {
    useCameraSnapshot: boolean,
    ignoreEventsNfcFingerprint: number,
    ignoreEventsDoorbell: number,
    saveLogToPersistentStorage: boolean
  }
}
```

### Settings Synchronization

Settings changes trigger:
1. Event listener in `app.js`
2. Re-authentication if credentials changed
3. API reconfiguration
4. Device state refresh

## Error Handling

### Connection Errors

- **Detection**: Websocket disconnect, HTTP timeout
- **Response**: Log error, attempt reconnection
- **User Feedback**: Update connection status in settings

### Authentication Errors

- **Detection**: 401/403 HTTP status codes
- **Response**: Clear tokens, prompt re-authentication
- **Recovery**: User must re-enter credentials

### Device Errors

- **Detection**: Missing capabilities, invalid state
- **Response**: Log warning, skip problematic operation
- **Recovery**: Device repair via Homey app

## Performance Considerations

### Resource Management

- **Single API instance**: Minimize memory footprint
- **Connection pooling**: Reuse HTTP connections
- **Event throttling**: Prevent notification spam

### Caching Strategy

- **Bootstrap data**: Cached in memory
- **Snapshots**: Short-term cache with TTL
- **Device state**: Updated incrementally via websocket

### Logging

- **Debug mode**: Console output only
- **Persistent logs**: Optional, with 25MB size limit
- **Log rotation**: Automatic cleanup when limit reached

## Security Considerations

### Credential Storage

- **Homey settings**: Encrypted at platform level
- **HTTPS required**: All API communication over TLS
- **Certificate validation**: Disabled for self-signed certs (UniFi default)

### Token Management

- **Automatic refresh**: Reduces exposure window
- **Secure transmission**: HTTPS only
- **No client-side logging**: Credentials never logged in production

## Extending the Application

### Adding a New Device Driver

1. Create driver directory in `drivers/`
2. Implement device class extending `Homey.Device`
3. Define capabilities in `driver.compose.json`
4. Implement pairing logic
5. Register websocket event handlers
6. Add flow cards if needed

### Adding a New Flow Action

1. Define action in `driver.flow.compose.json`
2. Implement handler in device class
3. Test with Homey developer tools

### Adding API Support

1. Extend API class with new method
2. Add constants for new event types
3. Update websocket parser for new events
4. Document new functionality

## Troubleshooting Guide

### Common Issues

1. **Websocket disconnections**
   - Check network stability
   - Verify firewall rules
   - Review heartbeat logs

2. **Missing devices after pairing**
   - Verify bootstrap data retrieval
   - Check device compatibility
   - Review pairing logs

3. **Authentication failures**
   - Confirm credentials are correct
   - Check UniFi Protect version compatibility
   - Verify network connectivity

## Version History

- **1.5.0**: Current version with dual API support
- Support for Legacy API and V2 API
- Enhanced event detection
- Improved stability

## Future Enhancements

- [ ] Support for additional device types
- [ ] Advanced automation rules
- [ ] Cloud API integration
- [ ] Enhanced dashboard widgets
- [ ] Multi-NVR support

## Contributing

When contributing to this project:

1. Follow existing code style and patterns
2. Add JSDoc documentation for new functions
3. Update this architecture document for structural changes
4. Test with real UniFi Protect hardware
5. Ensure backward compatibility

## References

- [UniFi Protect API Documentation](https://ubntwiki.com/products/software/unifi-protect)
- [Homey Apps SDK](https://apps.developer.homey.app/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

*Last Updated: February 2026*
