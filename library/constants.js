'use strict';

/**
 * Constants for UniFi Protect and UniFi Video integration.
 * 
 * This module contains all constant values used throughout the application,
 * including platform identifiers, device types, action IDs, event names,
 * and configuration values.
 * 
 * @module constants
 */

// ============================================================================
// Platform Identifiers
// ============================================================================

/**
 * UniFi Video NVR platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_NVR = 'UniFi Video';

/**
 * UVC G3 camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G3 = 'UVC G3';

/**
 * UVC G3 Dome camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G3_DOME = 'UVC G3 Dome';

/**
 * UVC G3 Flex camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G3_FLEX = 'UVC G3 Flex';

/**
 * UVC G3 Micro camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G3_MICRO = 'UVC G3 Micro';

/**
 * UVC G3 Pro camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G3_PRO = 'UVC G3 Pro';

/**
 * UVC G4 Pro camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G4_PRO = 'UVC G4 Pro';

/**
 * UVC G4 Bullet camera platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G4_BULLET = 'UVC G4 Bullet';

/**
 * UVC G4 Doorbell platform identifier.
 * @constant {string}
 */
module.exports.PLATFORM_UVC_G4_DOORBELL = 'UVC G4 Doorbell';

// ============================================================================
// Device Type Identifiers
// ============================================================================

/**
 * Any UniFi Video device type.
 * @constant {string}
 */
module.exports.DEVICE_ANY = 'ufv_device_any';

/**
 * UniFi Video NVR device type.
 * @constant {string}
 */
module.exports.DEVICE_NVR = 'ufv_device_nvr';

/**
 * UniFi Video camera device type.
 * @constant {string}
 */
module.exports.DEVICE_CAMERA = 'ufv_device_camera';

// ============================================================================
// Action Identifiers
// ============================================================================

/**
 * Take snapshot action identifier.
 * @constant {string}
 */
module.exports.ACTION_TAKE_SNAPSHOT = 'ufv_take_snapshot';

/**
 * Set recording mode action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_RECORDING_MODE = 'ufv_set_recording_mode';

/**
 * Take snapshot action identifier (V2 API).
 * @constant {string}
 */
module.exports.ACTION_TAKE_SNAPSHOT_V2 = 'ufv_take_snapshot_v2';

/**
 * Take package snapshot action identifier.
 * @constant {string}
 */
module.exports.ACTION_TAKE_PACKAGE_SNAPSHOT = 'ufv_take_package_snapshot';

/**
 * Set recording mode action identifier (V2 API).
 * @constant {string}
 */
module.exports.ACTION_SET_RECORDING_MODE_V2 = 'ufv_set_recording_mode_v2';

/**
 * Set chime on/off action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_CHIME_ONOFF = 'ufv_set_chime_turnonoff';

/**
 * Set night vision mode action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_NIGHT_VISION_MODE = 'ufv_set_nightvision_mode';

/**
 * Set LCD message action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_LCD_MESSAGE = 'ufv_set_lcd_message';

/**
 * Set camera status LED action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_CAMERA_STATUS_LED = 'ufv_set_camera_status_led';

/**
 * Set doorbell status LED action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DOORBELL_STATUS_LED = 'ufv_set_doorbell_status_led';

/**
 * Set doorbell status sound action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DOORBELL_STATUS_SOUND = 'ufv_set_doorbell_status_sound';

/**
 * Set device camera status LED action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_CAMERA_STATUS_LED = 'ufv_set_device_camera_status_led';

/**
 * Set device doorbell status LED action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_DOORBELL_STATUS_LED = 'ufv_set_device_doorbell_status_led';

/**
 * Set device doorbell status sound action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_DOORBELL_STATUS_SOUND = 'ufv_set_device_doorbell_status_sound';

/**
 * Set device camera blackout action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_CAMERA_BLACKOUT = 'ufv_set_device_camera_blackout';

/**
 * Set device doorbell blackout action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_DOORBELL_BLACKOUT = 'ufv_set_device_doorbell_blackout';

/**
 * Stop device patrol action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_PATROL_STOP = 'ufv_set_device_camera_patrol_stop';

/**
 * Start device patrol action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_PATROL_START = 'ufv_set_device_camera_patrol_start';

/**
 * Set device PTZ home position action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_PTZ_HOME = 'ufv_set_device_camera_ptz_home';

/**
 * Set device PTZ preset action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_PTZ_PRESET = 'ufv_set_device_camera_ptz_preset';

/**
 * Set device color night vision action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_SET_COLOR_NIGHT_VISION = 'ufv_set_device_camera_set_color_night_vision';

/**
 * Set device auto tracking action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_SET_AUTO_TRACKING = 'ufv_set_device_camera_set_auto_tracking';

/**
 * Test doorbell ringtone action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_TEST_RINGTONE = 'ufv_set_device_doorbell_test_ringtone';

/**
 * Test device siren action identifier.
 * @constant {string}
 */
module.exports.ACTION_SET_DEVICE_TEST_SIREN = 'ufv_set_device_doorbell_test_siren';

// ============================================================================
// Connection Event Identifiers
// ============================================================================

/**
 * Connection keepalive event identifier.
 * @constant {string}
 */
module.exports.EVENT_CONNECTION_KEEPALIVE = 'ufv_event_connection_keepalive';

/**
 * Connection error event identifier.
 * @constant {string}
 */
module.exports.EVENT_CONNECTION_ERROR = 'ufv_event_connection_error';

/**
 * Connection closed event identifier.
 * @constant {string}
 */
module.exports.EVENT_CONNECTION_CLOSED = 'ufv_event_connection_closed';

// ============================================================================
// NVR Event Identifiers
// ============================================================================

/**
 * NVR camera event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_CAMERA = 'ufv_event_nvr_camera';

/**
 * NVR health event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_HEALTH = 'ufv_event_nvr_health';

/**
 * NVR motion event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_MOTION = 'ufv_event_nvr_motion';

/**
 * NVR recording event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_RECORDING = 'ufv_event_nvr_recording';

/**
 * NVR server event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_SERVER = 'ufv_event_nvr_server';

/**
 * NVR other event identifier.
 * @constant {string}
 */
module.exports.EVENT_NVR_OTHER = 'ufv_event_nvr_other';

// ============================================================================
// Pairing and Snapshot Event Identifiers
// ============================================================================

/**
 * Pair API host event identifier.
 * @constant {string}
 */
module.exports.EVENT_PAIR_API_HOST = 'ufv_pair_apihost';

/**
 * Pair API key event identifier.
 * @constant {string}
 */
module.exports.EVENT_PAIR_API_KEY = 'ufv_pair_apikey';

/**
 * Snapshot created event identifier.
 * @constant {string}
 */
module.exports.EVENT_SNAPSHOT_CREATED = 'ufv_snapshot_created';

/**
 * Package snapshot created event identifier.
 * @constant {string}
 */
module.exports.EVENT_PACKAGE_SNAPSHOT_CREATED = 'ufv_package_snapshot_created';

/**
 * Connection changed event identifier.
 * @constant {string}
 */
module.exports.EVENT_CONNECTION_CHANGED = 'ufp_connection_changed';

// ============================================================================
// Doorbell Event Identifiers
// ============================================================================

/**
 * Doorbell ringing event identifier.
 * @constant {string}
 */
module.exports.EVENT_DOORBELL_RINGING = 'ufp_doorbell_ringing';

/**
 * Device doorbell preset event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_PRESET = 'ufp_device_doorbell_ringing';

// ============================================================================
// Smart Detection Event Identifiers (Global)
// ============================================================================

/**
 * Smart detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION = 'ufp_smart_detection';

/**
 * Person detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_PERSON = 'ufp_smart_detection_person';

/**
 * Vehicle detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_VEHICLE = 'ufp_smart_detection_vehicle';

/**
 * Animal detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_ANIMAL = 'ufp_smart_detection_animal';

/**
 * Package detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_PACKAGE = 'ufp_smart_detection_package';

/**
 * License plate detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_LICENSEPLATE = 'ufp_smart_detection_licenseplate';

/**
 * Face detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_SMART_DETECTION_FACE = 'ufp_smart_detection_face';

/**
 * Audio detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_AUDIO_DETECTION = 'ufp_audio_detection';

// ============================================================================
// Camera Smart Detection Event Identifiers
// ============================================================================

/**
 * Device camera smart detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION = 'ufp_device_camera_smart_detection';

/**
 * Device camera person detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PERSON = 'ufp_device_camera_smart_detection_person';

/**
 * Device camera vehicle detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_VEHICLE = 'ufp_device_camera_smart_detection_vehicle';

/**
 * Device camera animal detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_ANIMAL = 'ufp_device_camera_smart_detection_animal';

/**
 * Device camera package detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PACKAGE = 'ufp_device_camera_smart_detection_package';

/**
 * Device camera license plate detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_LICENSEPLATE = 'ufp_device_camera_smart_detection_licenseplate';

/**
 * Device camera face detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_FACE = 'ufp_device_camera_smart_detection_face';

/**
 * Device camera audio detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_CAMERA_AUDIO_DETECTION = 'ufp_device_camera_audio_detection';

// ============================================================================
// Doorbell Smart Detection Event Identifiers
// ============================================================================

/**
 * Device doorbell audio detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_AUDIO_DETECTION = 'ufp_device_doorbell_audio_detection';

/**
 * Device doorbell smart detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION = 'ufp_device_doorbell_smart_detection';

/**
 * Device doorbell person detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PERSON = 'ufp_device_doorbell_smart_detection_person';

/**
 * Device doorbell vehicle detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_VEHICLE = 'ufp_device_doorbell_smart_detection_vehicle';

/**
 * Device doorbell animal detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_ANIMAL = 'ufp_device_doorbell_smart_detection_animal';

/**
 * Device doorbell package detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PACKAGE = 'ufp_device_doorbell_smart_detection_package';

/**
 * Device doorbell license plate detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_LICENSEPLATE = 'ufp_device_doorbell_smart_detection_licenseplate';

/**
 * Device doorbell face detection event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_FACE = 'ufp_device_doorbell_smart_detection_face';

// ============================================================================
// Access Control Event Identifiers
// ============================================================================

/**
 * Fingerprint identified event identifier.
 * @constant {string}
 */
module.exports.EVENT_FINGERPRINT_IDENTIFIED = 'ufp_fingerprint_identified';

/**
 * Device fingerprint identified event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_FINGERPRINT_IDENTIFIED = 'ufp_device_fingerprint_identified';

/**
 * Door access event identifier.
 * @constant {string}
 */
module.exports.EVENT_DOOR_ACCESS = 'ufp_door_access';

/**
 * Device door access event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_DOOR_ACCESS = 'ufp_device_door_access';

/**
 * NFC card scanned event identifier.
 * @constant {string}
 */
module.exports.EVENT_NFC_CARD_SCANNED = 'ufp_nfc_card_scanned';

/**
 * Device NFC card scanned event identifier.
 * @constant {string}
 */
module.exports.EVENT_DEVICE_NFC_CARD_SCANNED = 'ufp_device_nfc_card_scanned';

// ============================================================================
// Settings Event Identifiers
// ============================================================================

/**
 * Settings debug event identifier.
 * @constant {string}
 */
module.exports.EVENT_SETTINGS_DEBUG = 'com.ubnt.unifiprotect.debug';

/**
 * Settings status event identifier.
 * @constant {string}
 */
module.exports.EVENT_SETTINGS_STATUS = 'com.ubnt.unifiprotect.status';

/**
 * Settings websocket status event identifier.
 * @constant {string}
 */
module.exports.EVENT_SETTINGS_WEBSOCKET_STATUS = 'com.ubnt.unifiprotect.websocket.status';

/**
 * Settings websocket last pong event identifier.
 * @constant {string}
 */
module.exports.EVENT_SETTINGS_WEBSOCKET_LASTPONG = 'com.ubnt.unifiprotect.websocket.lastpong';

/**
 * Settings websocket last message event identifier.
 * @constant {string}
 */
module.exports.EVENT_SETTINGS_WEBSOCKET_LASTMESSAGE = 'com.ubnt.unifiprotect.websocket.lastmessage';

// ============================================================================
// Protocol Constants
// ============================================================================

/**
 * Size of the update packet header in bytes.
 * @constant {number}
 */
module.exports.UPDATE_PACKET_HEADER_SIZE = 8;

// ============================================================================
// Timing Configuration
// ============================================================================

/**
 * Heartbeat interval for the realtime Protect API on UniFi OS devices (in seconds).
 * UniFi OS expects to hear from clients every 15 seconds.
 * @constant {number}
 */
module.exports.PROTECT_EVENTS_HEARTBEAT_INTERVAL = 10;

/**
 * How often (in seconds) to refresh Protect login credentials.
 * @constant {number}
 */
module.exports.PROTECT_LOGIN_REFRESH_INTERVAL = 1800;

/**
 * Default duration (in seconds) of motion events.
 * Setting this too low will potentially cause excessive notification spam.
 * @constant {number}
 */
module.exports.PROTECT_MOTION_DURATION = 10;

/**
 * How often (in seconds) to attempt reconnection with an MQTT broker.
 * @constant {number}
 */
module.exports.PROTECT_MQTT_RECONNECT_INTERVAL = 60;

/**
 * Default MQTT topic to use when publishing events.
 * Events are published in the format: unifi/protect/camera/event
 * @constant {string}
 */
module.exports.PROTECT_MQTT_TOPIC = 'unifi/protect';

/**
 * How often (in seconds) to check Protect controllers for new or removed devices.
 * This will NOT impact motion or doorbell event detection on UniFi OS devices.
 * @constant {number}
 */
module.exports.PROTECT_NVR_UNIFIOS_REFRESH_INTERVAL = 10;

/**
 * Wait time (in milliseconds) for sensor motion timer.
 * @constant {number}
 */
module.exports.PROTECT_SENSOR_MOTION_TIMER_WAIT_IN_SEC = 10 * 1000;
