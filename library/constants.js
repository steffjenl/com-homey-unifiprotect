'use strict';

module.exports.PLATFORM_UVC_NVR = 'UniFi Video';
module.exports.PLATFORM_UVC_G3 = 'UVC G3';
module.exports.PLATFORM_UVC_G3_DOME = 'UVC G3 Dome';
module.exports.PLATFORM_UVC_G3_FLEX = 'UVC G3 Flex';
module.exports.PLATFORM_UVC_G3_MICRO = 'UVC G3 Micro';
module.exports.PLATFORM_UVC_G3_PRO = 'UVC G3 Pro';
module.exports.PLATFORM_UVC_G4_PRO = 'UVC G4 Pro';
module.exports.PLATFORM_UVC_G4_BULLET = 'UVC G4 Bullet';
module.exports.PLATFORM_UVC_G4_DOORBELL = 'UVC G4 Doorbell';

module.exports.DEVICE_ANY = 'ufv_device_any';
module.exports.DEVICE_NVR = 'ufv_device_nvr';
module.exports.DEVICE_CAMERA = 'ufv_device_camera';

module.exports.ACTION_TAKE_SNAPSHOT = 'ufv_take_snapshot';
module.exports.ACTION_SET_RECORDING_MODE = 'ufv_set_recording_mode';
module.exports.ACTION_TAKE_SNAPSHOT_V2 = 'ufv_take_snapshot_v2';
module.exports.ACTION_SET_RECORDING_MODE_V2 = 'ufv_set_recording_mode_v2';
module.exports.ACTION_SET_CHIME_ONOFF = 'ufv_chime_turnonoff';
module.exports.ACTION_SET_NIGHT_VISION_MODE = 'ufv_set_nightvision_mode';
module.exports.ACTION_SET_LCD_MESSAGE = 'ufv_set_lcd_message';

module.exports.EVENT_CONNECTION_KEEPALIVE = 'ufv_event_connection_keepalive';
module.exports.EVENT_CONNECTION_ERROR = 'ufv_event_connection_error';
module.exports.EVENT_CONNECTION_CLOSED = 'ufv_event_connection_closed';

module.exports.EVENT_NVR_CAMERA = 'ufv_event_nvr_camera';
module.exports.EVENT_NVR_HEALTH = 'ufv_event_nvr_health';
module.exports.EVENT_NVR_MOTION = 'ufv_event_nvr_motion';
module.exports.EVENT_NVR_RECORDING = 'ufv_event_nvr_recording';
module.exports.EVENT_NVR_SERVER = 'ufv_event_nvr_server';
module.exports.EVENT_NVR_OTHER = 'ufv_event_nvr_other';

module.exports.EVENT_PAIR_API_HOST = 'ufv_pair_apihost';
module.exports.EVENT_PAIR_API_KEY = 'ufv_pair_apikey';
module.exports.EVENT_SNAPSHOT_CREATED = 'ufv_snapshot_created';
module.exports.EVENT_CONNECTION_CHANGED = 'ufp_connection_changed';
module.exports.EVENT_DOORBELL_RINGING = 'ufp_doorbell_ringing';
module.exports.EVENT_SMART_DETECTION = 'ufp_smart_detection';
module.exports.EVENT_SMART_DETECTION_PERSON = 'ufp_smart_detection_person';
module.exports.EVENT_SMART_DETECTION_VEHICLE = 'ufp_smart_detection_vehicle';
module.exports.EVENT_SMART_DETECTION_ANIMAL = 'ufp_smart_detection_animal';
module.exports.EVENT_SMART_DETECTION_PACKAGE = 'ufp_smart_detection_package';
module.exports.EVENT_DEVICE_DOORBELL_PRESET = 'ufp_device_doorbell_ringing';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION = 'ufp_device_camera_smart_detection';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PERSON = 'ufp_device_camera_smart_detection_person';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_VEHICLE = 'ufp_device_camera_smart_detection_vehicle';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_ANIMAL = 'ufp_device_camera_smart_detection_animal';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PACKAGE = 'ufp_device_camera_smart_detection_package';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION = 'ufp_device_doorbell_smart_detection';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PERSON = 'ufp_device_doorbell_smart_detection_person';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_VEHICLE = 'ufp_device_doorbell_smart_detection_vehicle';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_ANIMAL = 'ufp_device_doorbell_smart_detection_animal';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PACKAGE = 'ufp_device_doorbell_smart_detection_package';

module.exports.EVENT_SETTINGS_DEBUG = 'com.ubnt.unifiprotect.debug';
module.exports.EVENT_SETTINGS_STATUS = 'com.ubnt.unifiprotect.status';
module.exports.EVENT_SETTINGS_WEBSOCKET_STATUS = 'com.ubnt.unifiprotect.websocket.status';
module.exports.EVENT_SETTINGS_WEBSOCKET_LASTPONG = 'com.ubnt.unifiprotect.websocket.lastpong';
module.exports.EVENT_SETTINGS_WEBSOCKET_LASTMESSAGE = 'com.ubnt.unifiprotect.websocket.lastmessage';

module.exports.UPDATE_PACKET_HEADER_SIZE = 8;

// Heartbeat interval, in seconds, for the realtime Protect API on UniFI OS devices.
// UniFi OS expects to hear from us every 15 seconds.
module.exports.PROTECT_EVENTS_HEARTBEAT_INTERVAL = 10;

// How often, in seconds, should we refresh our Protect login credentials.
module.exports.PROTECT_LOGIN_REFRESH_INTERVAL = 1800;
// Default duration, in seconds, of motion events. Setting this too low will potentially cause a lot of notification spam.
module.exports.PROTECT_MOTION_DURATION = 10;
// How often, in seconds, should we try to reconnect with an MQTT broker, if we have one configured.
module.exports.PROTECT_MQTT_RECONNECT_INTERVAL = 60;
// Default MQTT topic to use when publishing events. This is in the form of: unifi/protect/camera/event
module.exports.PROTECT_MQTT_TOPIC = "unifi/protect";
// How often, in seconds, should we check Protect controllers for new or removed devices.
// This will NOT impact motion or doorbell event detection on UniFi OS devices.
module.exports.PROTECT_NVR_UNIFIOS_REFRESH_INTERVAL = 10;


module.exports.PROTECT_SENSOR_MOTION_TIMER_WAIT_IN_SEC = 10 * 1000;