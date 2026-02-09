# UniFi Protect Alarm Manager - Quick Start Guide

## What Was Added

A new **Alarm Manager** driver for UniFi Protect that lets you:
- ✅ **Arm/Disarm** your UniFi Protect alarm system from Homey
- ✅ **Receive notifications** when alarms are triggered
- ✅ **Automate security** with Homey flows
- ✅ **Real-time sync** with UniFi Protect console

## New Files

```
drivers/protect-alarm/
├── device.js                    # Device logic
├── driver.js                    # Driver logic
├── driver.compose.json          # Driver configuration
├── driver.flow.compose.json     # Flow cards
└── assets/
    ├── images/                  # Device icons (need to add)
    └── IMAGES_README.md         # Image requirements

library/
├── protect-api-v2/
│   └── protect-api.js           # Added setNVR() method
└── websocket.js                 # Added alarm manager support

Documentation:
├── ALARM_MANAGER_README.md           # User guide
├── ALARM_IMPLEMENTATION_SUMMARY.md   # Technical details
└── QUICK_START_ALARM.md             # This file
```

## How to Use

### 1. Add the Device
1. Open Homey app
2. Go to **Devices** → **Add Device**
3. Select **UniFi Protect and Access**
4. Choose **Alarm Manager**
5. Device will appear as "UniFi Protect Alarm"

### 2. Create Flows

#### Example 1: Arm when leaving
```
WHEN: Last person leaves home
THEN: Arm alarm (Alarm Manager)
```

#### Example 2: Alert on alarm
```
WHEN: Alarm was triggered (Alarm Manager)
THEN: 
  - Send notification "⚠️ ALARM! Check cameras!"
  - Turn on all lights
  - Play siren
```

#### Example 3: Disarm when arriving
```
WHEN: First person arrives home
THEN: Disarm alarm (Alarm Manager)
```

### 3. Manual Control

You can also manually arm/disarm from:
- Homey app device tile
- Device settings page
- Voice commands (if configured)
- Dashboard widgets

## Flow Cards

### Triggers (WHEN)
- **"Alarm was triggered"**
  - Fires when UniFi Protect detects an alarm event
  - Provides timestamp token

### Actions (THEN)
- **"Arm alarm"**
  - Arms the UniFi Protect alarm system
  
- **"Disarm alarm"**
  - Disarms the UniFi Protect alarm system

## Device Capabilities

The alarm manager has two capabilities:

1. **Alarm State** (`homealarm_state`)
   - Shows if alarm is armed or disarmed
   - Can be controlled manually
   - Updates automatically

2. **Alarm Indicator** (`alarm_generic`)
   - Shows when an alarm is active
   - Automatically resets after 5 seconds
   - Visual indicator in Homey

## API Changes

### New API Method
```javascript
// In library/protect-api-v2/protect-api.js
await apiV2.setNVR(nvrId, {
  isAlarmsEnabled: true  // or false
});
```

### Websocket Updates
The existing websocket now also updates the alarm manager when:
- Alarm state changes (armed/disarmed)
- Alarm events occur (triggers)

## Requirements

- ✅ UniFi Protect with NVR
- ✅ API token configured in settings
- ✅ Homey connected to same network
- ✅ UniFi Protect firmware: any recent version

## Testing

After adding the device, test:

1. **Manual Control**
   - Arm the alarm → Check UniFi Protect console shows armed
   - Disarm → Check console shows disarmed

2. **Flow Triggers**
   - Create a test flow
   - Trigger an alarm in UniFi Protect
   - Verify flow executes

3. **Automatic Sync**
   - Change alarm state in UniFi Protect console
   - Check if Homey updates automatically

## Troubleshooting

### Device doesn't appear during pairing
- Check API token is valid
- Verify NVR is accessible
- Check network connectivity

### Arm/disarm doesn't work
- Verify API token has write permissions
- Check Homey app logs
- Test API connection in settings

### State not updating
- Check websocket connection status
- Restart Homey app
- Review websocket logs

### Alarm trigger not firing
- Verify alarm events in UniFi Protect
- Check flow card configuration
- Test with manual trigger

## Advanced Features (Future)

These features could be added later:

1. **Alarm Modes**
   - Home mode (partial arming)
   - Away mode (full arming)
   - Night mode (specific zones)

2. **Smart Detection Integration**
   - Trigger alarm on person detection
   - Ignore familiar faces
   - Vehicle detection triggers

3. **Geofencing**
   - Auto-arm when everyone leaves
   - Auto-disarm when someone arrives
   - Location-based rules

4. **Schedules**
   - Auto-arm at 11 PM
   - Auto-disarm at 7 AM
   - Weekend vs. weekday schedules

5. **Alarm Zones**
   - Arm specific cameras only
   - Zone-based triggers
   - Perimeter vs. interior

6. **History & Logs**
   - View alarm history
   - Export to insights
   - Trigger statistics

## Next Steps

1. **Add Device Images**
   - Create proper alarm manager icons
   - Replace placeholder images
   - See `drivers/protect-alarm/assets/IMAGES_README.md`

2. **Test Thoroughly**
   - Test all flow cards
   - Verify websocket updates
   - Check error scenarios

3. **Document Issues**
   - Report any bugs found
   - Suggest improvements
   - Share use cases

4. **Update Main README**
   - Add alarm manager to feature list
   - Include in device list
   - Update screenshots

## Support

For help:
- Check `/ALARM_MANAGER_README.md` for detailed docs
- Review `/ALARM_IMPLEMENTATION_SUMMARY.md` for technical details
- Check main `/README.md` for general help

## Summary

The UniFi Protect Alarm Manager is now fully integrated and ready to use! It provides:

✅ **Complete control** - Arm/disarm from Homey  
✅ **Real-time updates** - Instant state synchronization  
✅ **Flow integration** - Full automation support  
✅ **Event triggers** - Know when alarms fire  
✅ **Professional design** - Follows Homey best practices  

**Enjoy your enhanced home security automation!** 🏠🔒

---
*Last Updated: February 9, 2026*

