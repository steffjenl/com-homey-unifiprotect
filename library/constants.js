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
module.exports.ACTION_TAKE_PACKAGE_SNAPSHOT = 'ufv_take_package_snapshot';
module.exports.ACTION_SET_RECORDING_MODE_V2 = 'ufv_set_recording_mode_v2';
module.exports.ACTION_SET_CHIME_ONOFF = 'ufv_set_chime_turnonoff';
module.exports.ACTION_SET_NIGHT_VISION_MODE = 'ufv_set_nightvision_mode';
module.exports.ACTION_SET_LCD_MESSAGE = 'ufv_set_lcd_message';
module.exports.ACTION_SET_CAMERA_STATUS_LED = 'ufv_set_camera_status_led';
module.exports.ACTION_SET_DOORBELL_STATUS_LED = 'ufv_set_doorbell_status_led';
module.exports.ACTION_SET_DOORBELL_STATUS_SOUND = 'ufv_set_doorbell_status_sound';
module.exports.ACTION_SET_DEVICE_CAMERA_STATUS_LED = 'ufv_set_device_camera_status_led';
module.exports.ACTION_SET_DEVICE_DOORBELL_STATUS_LED = 'ufv_set_device_doorbell_status_led';
module.exports.ACTION_SET_DEVICE_DOORBELL_STATUS_SOUND = 'ufv_set_device_doorbell_status_sound';
module.exports.ACTION_SET_DEVICE_CAMERA_BLACKOUT = 'ufv_set_device_camera_blackout';
module.exports.ACTION_SET_DEVICE_DOORBELL_BLACKOUT = 'ufv_set_device_doorbell_blackout';
module.exports.ACTION_SET_DEVICE_PATROL_STOP = 'ufv_set_device_camera_patrol_stop';
module.exports.ACTION_SET_DEVICE_PATROL_START = 'ufv_set_device_camera_patrol_start';
module.exports.ACTION_SET_DEVICE_PTZ_HOME = 'ufv_set_device_camera_ptz_home';
module.exports.ACTION_SET_DEVICE_PTZ_PRESET = 'ufv_set_device_camera_ptz_preset';
module.exports.ACTION_SET_DEVICE_SET_COLOR_NIGHT_VISION = 'ufv_set_device_camera_set_color_night_vision';
module.exports.ACTION_SET_DEVICE_SET_AUTO_TRACKING = 'ufv_set_device_camera_set_auto_tracking';
module.exports.ACTION_SET_DEVICE_TEST_RINGTONE = 'ufv_set_device_doorbell_test_ringtone';
module.exports.ACTION_SET_DEVICE_TEST_SIREN = 'ufv_set_device_doorbell_test_siren';
module.exports.ACTION_SET_DEVICE_TEST_CHIME_TONE = 'ufv_set_device_chime_test_tone';
module.exports.ACTION_SET_DEVICE_DOORBELL_RING_VOLUME = 'ufp_set_device_doorbell_ring_volume';
module.exports.ACTION_SET_DEVICE_DOORBELL_CHIME_VOLUME = 'ufp_set_device_doorbell_chime_volume';

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
module.exports.EVENT_PACKAGE_SNAPSHOT_CREATED = 'ufv_package_snapshot_created';
module.exports.EVENT_CONNECTION_CHANGED = 'ufp_connection_changed';
module.exports.EVENT_DOORBELL_RINGING = 'ufp_doorbell_ringing';
module.exports.EVENT_SMART_DETECTION = 'ufp_smart_detection';
module.exports.EVENT_SMART_DETECTION_PERSON = 'ufp_smart_detection_person';
module.exports.EVENT_SMART_DETECTION_VEHICLE = 'ufp_smart_detection_vehicle';
module.exports.EVENT_SMART_DETECTION_ANIMAL = 'ufp_smart_detection_animal';
module.exports.EVENT_SMART_DETECTION_PACKAGE = 'ufp_smart_detection_package';
module.exports.EVENT_SMART_DETECTION_LICENSEPLATE = 'ufp_smart_detection_licenseplate';
module.exports.EVENT_SMART_DETECTION_FACE = 'ufp_smart_detection_face';
module.exports.EVENT_AUDIO_DETECTION = 'ufp_audio_detection';
module.exports.EVENT_DEVICE_DOORBELL_PRESET = 'ufp_device_doorbell_ringing';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION = 'ufp_device_camera_smart_detection';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PERSON = 'ufp_device_camera_smart_detection_person';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_VEHICLE = 'ufp_device_camera_smart_detection_vehicle';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_ANIMAL = 'ufp_device_camera_smart_detection_animal';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_PACKAGE = 'ufp_device_camera_smart_detection_package';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_LICENSEPLATE = 'ufp_device_camera_smart_detection_licenseplate';
module.exports.EVENT_DEVICE_CAMERA_SMART_DETECTION_FACE = 'ufp_device_camera_smart_detection_face';
module.exports.EVENT_DEVICE_CAMERA_AUDIO_DETECTION = 'ufp_device_camera_audio_detection';
module.exports.EVENT_DEVICE_DOORBELL_AUDIO_DETECTION = 'ufp_device_doorbell_audio_detection';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION = 'ufp_device_doorbell_smart_detection';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PERSON = 'ufp_device_doorbell_smart_detection_person';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_VEHICLE = 'ufp_device_doorbell_smart_detection_vehicle';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_ANIMAL = 'ufp_device_doorbell_smart_detection_animal';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PACKAGE = 'ufp_device_doorbell_smart_detection_package';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_LICENSEPLATE = 'ufp_device_doorbell_smart_detection_licenseplate';
module.exports.EVENT_DEVICE_DOORBELL_SMART_DETECTION_FACE = 'ufp_device_doorbell_smart_detection_face';
module.exports.EVENT_FINGERPRINT_IDENTIFIED = 'ufp_fingerprint_identified';
module.exports.EVENT_DEVICE_FINGERPRINT_IDENTIFIED = 'ufp_device_fingerprint_identified';
module.exports.EVENT_DOOR_ACCESS = 'ufp_door_access';
module.exports.EVENT_DEVICE_DOOR_ACCESS = 'ufp_device_door_access';
module.exports.EVENT_NFC_CARD_SCANNED = 'ufp_nfc_card_scanned';
module.exports.EVENT_DEVICE_NFC_CARD_SCANNED = 'ufp_device_nfc_card_scanned';
module.exports.EVENT_NFC_UNKNOWN_CARD_SCANNED = 'ufp_nfc_unknown_card_scanned';
module.exports.EVENT_DEVICE_NFC_UNKNOWN_CARD_SCANNED = 'ufp_device_nfc_unknown_card_scanned';

// UniFi Access — keypad / PIN access
module.exports.EVENT_ACCESS_KEYPAD_USED = 'ufv_access_keypad_used';
module.exports.EVENT_DEVICE_ACCESS_KEYPAD_USED = 'ufv_device_access_keypad_used';
module.exports.EVENT_DEVICE_ACCESS_GARAGEDOOR_KEYPAD_USED = 'ufv_device_access_garagedoor_keypad_used';
// Known credential_provider values that indicate keypad/PIN usage (discovered via live hardware logging)
module.exports.ACCESS_KEYPAD_CREDENTIAL_PROVIDERS = ['pin_code', 'keypad', 'pin'];

// NVR Alarm Manager
module.exports.EVENT_NVR_ALARM_STATE_CHANGED = 'ufp_nvr_alarm_state_changed';
module.exports.EVENT_NVR_ALARM_ARMED = 'ufp_nvr_alarm_armed';
module.exports.EVENT_NVR_ALARM_DISARMED = 'ufp_nvr_alarm_disarmed';
module.exports.EVENT_NVR_ALARM_BREACH = 'ufp_nvr_alarm_breach';

// Weather
module.exports.EVENT_WEATHER_UPDATED = 'ufp_weather_updated';
module.exports.WEATHER_POLL_INTERVAL_DEFAULT = 15;

// Weather Channel icon code → locale key (used as weather.conditions.<key>)
module.exports.WEATHER_ICON_CODES = {
  1: 'tornado',
  2: 'tropical_storm',
  3: 'hurricane',
  4: 'thunderstorms',
  5: 'rain_snow_mix',
  6: 'rain_sleet_mix',
  7: 'snow_sleet_mix',
  8: 'freezing_drizzle',
  9: 'drizzle',
  10: 'freezing_rain',
  11: 'showers',
  12: 'showers',
  13: 'snow_flurries',
  14: 'light_snow',
  15: 'blowing_snow',
  16: 'snow',
  17: 'hail',
  18: 'sleet',
  19: 'dust',
  20: 'fog',
  21: 'haze',
  22: 'smoke',
  23: 'windy',
  24: 'windy',
  25: 'frigid',
  26: 'cloudy',
  27: 'mostly_cloudy',
  28: 'mostly_cloudy',
  29: 'partly_cloudy',
  30: 'partly_cloudy',
  31: 'clear',
  32: 'sunny',
  33: 'fair',
  34: 'fair',
  35: 'rain_hail_mix',
  36: 'hot',
  37: 'isolated_thunderstorms',
  38: 'scattered_thunderstorms',
  39: 'scattered_showers',
  40: 'heavy_rain',
  41: 'scattered_snow',
  42: 'heavy_snow',
  43: 'blizzard',
  44: 'not_available',
  45: 'scattered_showers',
  46: 'scattered_snow',
  47: 'scattered_thunderstorms',
};

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
module.exports.PROTECT_MQTT_TOPIC = 'unifi/protect';
// How often, in seconds, should we check Protect controllers for new or removed devices.
// This will NOT impact motion or doorbell event detection on UniFi OS devices.
module.exports.PROTECT_NVR_UNIFIOS_REFRESH_INTERVAL = 10;

module.exports.PROTECT_SENSOR_MOTION_TIMER_WAIT_IN_SEC = 10 * 1000;
