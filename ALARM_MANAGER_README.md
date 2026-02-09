# UniFi Protect Alarm Manager

## Overview

The UniFi Protect Alarm Manager is a new driver that provides comprehensive alarm system control for your UniFi Protect setup. This integration allows you to arm/disarm the alarm system and receive notifications when alarms are triggered.

## Features

### 1. **Alarm State Control**
- **Arm Alarm**: Enable the UniFi Protect alarm system
- **Disarm Alarm**: Disable the UniFi Protect alarm system
- **State Monitoring**: Real-time updates on alarm armed/disarmed status

### 2. **Alarm Triggers**
- **Alarm Triggered Event**: Flow card trigger when an alarm is activated
- **Timestamp Token**: Get the exact time when the alarm was triggered
- **Generic Alarm Indicator**: Visual indicator in Homey when alarm is active

### 3. **Flow Card Integration**

#### Trigger Cards
- **"Alarm was triggered"**: Triggers when the UniFi Protect alarm system detects an intrusion or event
  - Provides timestamp token for when the alarm occurred

#### Action Cards
- **"Arm alarm"**: Arms the UniFi Protect alarm system
- **"Disarm alarm"**: Disarms the UniFi Protect alarm system

### 4. **Capabilities**
- `homealarm_state`: Controls and displays the current alarm state (armed/disarmed)
- `alarm_generic`: Boolean indicator that shows when an alarm event has occurred

## Installation & Setup

1. **Add the Device**:
   - Go to Devices → Add Device
   - Select "UniFi Protect and Access"
   - Choose "Alarm Manager"
   - The system will automatically detect your NVR and create the alarm device

2. **Configure Flows**:
   - Use the alarm manager in your Homey flows to automate security responses
   - Example: When alarm triggers, turn on all lights and send notification

## Use Cases

### Home Security Automation
```
WHEN: Alarm was triggered
THEN: 
  - Turn on all lights
  - Send push notification
  - Start recording on all cameras
  - Play siren sound
```

### Automatic Arming
```
WHEN: Last person leaves home (presence detection)
THEN: Arm the alarm
```

### Smart Disarming
```
WHEN: First person arrives home
AND: Time is between sunset and sunrise
THEN: Disarm the alarm
```

## Additional Features

The alarm manager integrates seamlessly with your existing UniFi Protect setup:

- **Real-time Updates**: State changes are reflected immediately via websocket
- **Automatic Sync**: Alarm state syncs with your UniFi Protect console
- **Low Latency**: Fast response times for arm/disarm commands
- **Reliable**: Uses the official UniFi Protect API

## Technical Details

### API Integration
The alarm manager uses the UniFi Protect API V2 to:
- Get NVR alarm status (`isAlarmsEnabled`)
- Set NVR alarm state
- Monitor alarm events (`lastAlarmAt`)
- Receive real-time websocket updates

### Device Class
- Implements Homey's `homealarm` device class for native alarm system integration
- Compatible with Homey's security system automation features

## Troubleshooting

### Alarm Not Appearing
- Ensure your UniFi Protect system is properly configured in settings
- Verify API token has correct permissions
- Check that your NVR firmware is up to date

### State Not Updating
- Check websocket connection status
- Verify network connectivity to your NVR
- Review app logs for error messages

## Future Enhancements

Potential features for future releases:
- **Partial Arming Modes**: Support for home/away/night modes
- **Zone-based Arming**: Arm specific camera zones
- **Alarm History**: Track when and why alarms were triggered
- **Smart Detection Integration**: Trigger alarms based on person/vehicle detection
- **Geofencing**: Automatic arm/disarm based on location
- **Schedule-based Arming**: Automatic arming/disarming on schedule

## Compatibility

- **Minimum Requirements**: 
  - UniFi Protect with NVR
  - API access enabled
  - Homey Pro (2016-2023) or Homey Pro (2023-)
  
- **Supported Devices**:
  - UniFi Dream Machine Pro
  - UniFi Network Video Recorder
  - UniFi Cloud Key Gen2 Plus
  - UniFi Dream Machine SE

## Support

For issues, feature requests, or questions:
- Check the main app documentation
- Review existing GitHub issues
- Create a new issue with detailed information

---

**Note**: The alarm manager integrates with UniFi Protect's built-in alarm functionality. The specific behavior and features depend on your UniFi Protect configuration and firmware version.

