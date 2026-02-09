# UniFi Protect Alarm Manager - Implementation Summary

## Overview

This document summarizes the implementation of the UniFi Protect Alarm Manager driver, which adds comprehensive alarm system control to the Homey UniFi Protect integration.

## Files Created

### Driver Files

1. **`drivers/protect-alarm/driver.compose.json`**
   - Driver metadata and configuration
   - Device class: `homealarm`
   - Capabilities: `homealarm_state`, `alarm_generic`
   - Pairing configuration

2. **`drivers/protect-alarm/driver.js`**
   - Driver logic
   - Pairing handlers
   - Flow card registration
   - Websocket message parsing
   - Device discovery

3. **`drivers/protect-alarm/device.js`**
   - Device logic
   - Capability listeners
   - Alarm state management
   - Websocket event handling
   - Bootstrap data initialization

4. **`drivers/protect-alarm/driver.flow.compose.json`**
   - Flow card definitions
   - Triggers: alarm_triggered
   - Actions: arm_alarm, disarm_alarm
   - Tokens: timestamp

### Documentation

5. **`ALARM_MANAGER_README.md`**
   - User documentation
   - Feature descriptions
   - Usage examples
   - Troubleshooting guide

6. **`drivers/protect-alarm/assets/IMAGES_README.md`**
   - Image asset requirements
   - Design recommendations

## API Changes

### Modified Files

1. **`library/protect-api-v2/protect-api.js`**
   - Added `setNVR()` method for updating NVR settings
   - Enables alarm enable/disable functionality
   - Uses PATCH `/proxy/protect/integration/v1/nvrs/{id}` endpoint

2. **`library/websocket.js`**
   - Enhanced NVR websocket message handling
   - Added alarm manager device updates
   - Graceful handling when alarm driver not installed

## Features Implemented

### 1. Alarm State Control
- **Arm**: Sets `isAlarmsEnabled` to `true` on the NVR
- **Disarm**: Sets `isAlarmsEnabled` to `false` on the NVR
- **State Sync**: Real-time updates via websocket

### 2. Alarm Event Detection
- Monitors `lastAlarmAt` timestamp from NVR
- Triggers when alarm events occur
- Debounced to prevent duplicate triggers
- Auto-resets alarm indicator after 5 seconds

### 3. Homey Integration
- Uses standard `homealarm` device class
- Compatible with Homey security system
- `homealarm_state` capability (armed/disarmed/partially_armed)
- `alarm_generic` capability (boolean alarm indicator)

### 4. Flow Cards
- **Trigger**: "Alarm was triggered" with timestamp token
- **Actions**: "Arm alarm", "Disarm alarm"
- Device-specific cards for alarm manager

### 5. Real-time Updates
- Websocket integration for instant state changes
- Bidirectional sync with UniFi Protect console
- Low latency command execution

## Architecture

### Data Flow

```
User Action (Homey)
  ↓
Device.setCapabilityValue('homealarm_state', 'armed')
  ↓
Device._setAlarmState()
  ↓
apiV2.setNVR(id, {isAlarmsEnabled: true})
  ↓
PATCH /proxy/protect/integration/v1/nvrs/{id}
  ↓
UniFi Protect NVR
  ↓
Websocket Update (modelKey: 'nvr')
  ↓
websocket.js → driver.onParseWebsocketMessage()
  ↓
device.onAlarmStateChange()
  ↓
Update capability in Homey
```

### Alarm Trigger Flow

```
UniFi Protect Alarm Event
  ↓
NVR updates lastAlarmAt timestamp
  ↓
Websocket Update (modelKey: 'nvr', payload.lastAlarmAt)
  ↓
device.onAlarmTriggered(timestamp)
  ↓
Set alarm_generic capability to true
  ↓
Trigger flow card with timestamp token
  ↓
Auto-reset alarm_generic after 5 seconds
```

## Technical Details

### API Endpoints Used
- **GET** `/proxy/protect/integration/v1/nvrs` - Get NVR info
- **PATCH** `/proxy/protect/integration/v1/nvrs/{id}` - Update NVR settings

### Websocket Events
- **modelKey**: `nvr`
- **Monitored Fields**:
  - `isAlarmsEnabled` - Alarm armed/disarmed state
  - `lastAlarmAt` - Timestamp of last alarm event

### Bootstrap Initialization
- Waits for API bootstrap data
- Polls every 250ms until available
- Loads initial alarm state from NVR

## Usage Examples

### Flow: Auto-arm when leaving home
```
WHEN: Last person leaves (presence)
THEN: Arm alarm [Alarm Manager]
```

### Flow: Respond to alarm
```
WHEN: Alarm was triggered [Alarm Manager]
THEN:
  - Turn on all lights
  - Send notification "Alarm triggered at [timestamp]"
  - Start siren
  - Set recording mode to "always" for all cameras
```

### Flow: Smart disarming
```
WHEN: Homey alarm is armed
AND: Front door opens (contact sensor)
THEN: Disarm alarm [Alarm Manager]
```

## Additional Features for Future

The implementation is designed to be extensible. Potential enhancements:

### 1. Alarm Zones
```javascript
// Support for arming specific camera zones
async setAlarmZones(zones) {
  // Implementation for zone-based arming
}
```

### 2. Alarm Modes
```javascript
// Support for different arming modes
async setAlarmMode(mode) {
  // 'home', 'away', 'night', 'vacation'
}
```

### 3. Alarm History
```javascript
// Track alarm events
onAlarmTriggered(timestamp) {
  this.addAlarmToHistory(timestamp);
  // Store last 10 alarm events
}
```

### 4. Smart Detection Integration
```javascript
// Trigger alarm based on smart detections
onSmartDetection(type) {
  if (this.isArmed && type === 'person') {
    this.triggerAlarm();
  }
}
```

### 5. Geofencing
```javascript
// Auto arm/disarm based on location
onLocationChange(location) {
  if (location.distance > 500) {
    this.armAlarm();
  }
}
```

### 6. Schedule-based Arming
```javascript
// Automatic arming on schedule
onSchedule(time) {
  // Arm at 11 PM, disarm at 7 AM
}
```

## Testing Checklist

- [ ] Device pairing works
- [ ] Arm alarm command succeeds
- [ ] Disarm alarm command succeeds  
- [ ] Alarm state updates in Homey UI
- [ ] Websocket updates work bidirectionally
- [ ] Flow trigger fires when alarm triggered
- [ ] Timestamp token is correct
- [ ] alarm_generic resets after 5 seconds
- [ ] Multiple alarm managers (if multiple NVRs)
- [ ] Error handling for missing NVR
- [ ] Graceful degradation if websocket fails

## Known Limitations

1. **Image Assets**: Placeholder images need to be replaced with proper alarm manager icons
2. **Single NVR**: Currently only supports first NVR in multi-NVR setups
3. **Alarm Details**: No detailed information about what triggered the alarm
4. **Partial Arming**: `partially_armed` state maps to `armed` in API (no native UniFi Protect support)

## Dependencies

### Required
- UniFi Protect with API access
- NVR with alarm functionality
- Homey SDK 3
- Active websocket connection

### Optional
- Other UniFi Protect devices for automation
- Sirens for alarm response
- Smart detection for trigger logic

## Security Considerations

1. **API Key**: Requires API key with write permissions to NVR
2. **Local Network**: Best used on local network (no cloud access)
3. **State Sync**: Alarm state synced with UniFi Protect console
4. **No PIN**: No PIN protection at Homey level (use Homey's security features)

## Maintenance

### Regular Tasks
- Monitor websocket connection status
- Check for API changes in UniFi Protect updates
- Update error handling as needed
- Review alarm trigger accuracy

### Monitoring
```javascript
// Check alarm manager health
this.homey.app.debug('Alarm manager status:', {
  armed: device.getCapabilityValue('homealarm_state'),
  lastAlarm: device.lastAlarmAt,
  websocketConnected: this.homey.app.api.ws.isWebsocketConnected()
});
```

## Support & Documentation

- Main README: `/README.md`
- User Guide: `/ALARM_MANAGER_README.md`
- Architecture: `/ARCHITECTURE.md`
- API Reference: See UniFi Protect API documentation

## Changelog

### Version 1.0.0 (Initial Implementation)
- ✅ Basic arm/disarm functionality
- ✅ Alarm triggered event
- ✅ Websocket integration
- ✅ Flow cards (triggers & actions)
- ✅ Real-time state sync
- ✅ Bootstrap initialization
- ✅ Error handling
- ✅ Documentation

## Contributors

- Implementation follows existing driver patterns from:
  - `drivers/protect-siren/` - for device/driver structure
  - `drivers/unifi-os/` - for NVR integration
  - `library/websocket.js` - for event handling

---

**Status**: Implementation complete and ready for testing
**Last Updated**: February 9, 2026

