'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// Constants
const BOOTSTRAP_POLL_INTERVAL_MS = 250;
const MOTION_TIMER_UNSET = -1;

/**
 * UniFi Protect Sensor Device Driver
 * 
 * Manages UniFi Protect sensor devices, including motion detection,
 * door/window contact sensors, temperature/humidity monitoring,
 * and integrated LED lighting control.
 * 
 * @class Sensor
 * @extends {Homey.Device}
 */
class Sensor extends Homey.Device {

    /**
     * Motion timer ID for managing motion event duration.
     * @type {number}
     * @default -1
     */
    motion_timer_id = MOTION_TIMER_UNSET;

    /**
     * Initialize the sensor device.
     * 
     * Called when the device is initialized. Waits for bootstrap data
     * before completing initialization.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this.waitForBootstrap();
        this.homey.app.debug('UnifiSensor Device has been initialized');
    }

    /**
     * Handle device addition.
     * 
     * Called when the user adds the device, just after pairing completes.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onAdded() {
        this.homey.app.debug('UnifiSensor Device has been added');
    }

    /**
     * Handle device settings changes.
     * 
     * Called when the user updates the device's settings in the Homey app.
     * 
     * @async
     * @param {Object} event - The onSettings event data
     * @param {Object} event.oldSettings - The previous settings object
     * @param {Object} event.newSettings - The updated settings object
     * @param {string[]} event.changedKeys - Array of keys that changed
     * @returns {Promise<string|void>} Optional custom message to display to user
     */
    async onSettings({oldSettings, newSettings, changedKeys}) {
        this.homey.app.debug('UnifiSensor Device settings where changed');
    }

    /**
     * Handle device rename.
     * 
     * Called when the user updates the device's name.
     * Can be used to synchronize the name with the physical device.
     * 
     * @async
     * @param {string} name - The new device name
     * @returns {Promise<void>}
     */
    async onRenamed(name) {
        this.homey.app.debug('UnifiSensor Device was renamed');
    }

    /**
     * Handle device deletion.
     * 
     * Called when the user deletes the device from Homey.
     * Cleans up any active motion timers.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onDeleted() {
        this._clearMotionTimer();
        this.homey.app.debug('UnifiSensor Device has been deleted');
    }

    /**
     * Initialize sensor-specific functionality.
     * 
     * Sets up capability listeners for LED control, creates missing capabilities,
     * and initializes sensor data.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initSensor() {
        this._registerCapabilityListeners();
        await this._createMissingCapabilities();
        await this._initSensorData();
    }

    /**
     * Register capability listeners for sensor controls.
     * @private
     */
    _registerCapabilityListeners() {
        // LED light on/off control
        this.registerCapabilityListener("onoff", (value) => {
            return this.homey.app.api.setLightOn(this.getData(), value);
        });

        // LED brightness control
        this.registerCapabilityListener("dim", (value) => {
            return this.homey.app.api.setLightLevel(this.getData(), this.translateLedLevel(value, true));
        });

        // LED mode control (auto, on, off)
        this.registerCapabilityListener("light_mode", (value) => {
            return this.homey.app.api.setLightMode(this.getData(), value);
        });
    }

    /**
     * Wait for bootstrap data to become available.
     * 
     * Polls until the API has bootstrap data loaded, then initializes the sensor.
     * Uses recursive timeout to avoid blocking.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async waitForBootstrap() {
        const lastUpdateId = this.homey.app.api.getLastUpdateId();
        
        if (typeof lastUpdateId !== 'undefined' && lastUpdateId !== null) {
            await this.initSensor();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), BOOTSTRAP_POLL_INTERVAL_MS);
        }
    }

    /**
     * Clear active motion timer if set.
     * @private
     */
    _clearMotionTimer() {
        if (this.motion_timer_id !== MOTION_TIMER_UNSET) {
            this.homey.clearTimeout(this.motion_timer_id);
            this.motion_timer_id = MOTION_TIMER_UNSET;
        }
    }

    /**
     * Create missing capabilities for the sensor device.
     * 
     * Dynamically adds or removes capabilities based on the sensor's features
     * as reported by the UniFi Protect bootstrap data.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        // Ensure device class is set to 'sensor'
        if (this.getClass() !== 'sensor') {
            this.homey.app.debug(`changed class to sensor for ${this.getName()}`);
            await this.setClass('sensor');
        }
        
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (!bootstrapData) return;
        
        const sensor = this._findSensorInBootstrap(bootstrapData);
        if (!sensor) return;
        
        await this._manageLuminanceCapability(sensor);
    }

    /**
     * Find this sensor in the bootstrap data.
     * @private
     * @param {Object} bootstrapData - The bootstrap data
     * @returns {Object|null} The sensor data or null if not found
     */
    _findSensorInBootstrap(bootstrapData) {
        if (!bootstrapData.sensors) return null;
        
        return bootstrapData.sensors.find(sensor => 
            sensor.id === this.getData().id
        ) || null;
    }

    /**
     * Manage luminance capability based on sensor features.
     * @private
     * @async
     * @param {Object} sensor - The sensor data from bootstrap
     * @returns {Promise<void>}
     */
    async _manageLuminanceCapability(sensor) {
        const hasLightSensor = this._sensorHasLightMeasurement(sensor);
        
        if (hasLightSensor && !this.hasCapability('measure_luminance')) {
            await this.addCapability('measure_luminance');
            this.homey.app.debug(`created capability measure_luminance for ${this.getName()}`);
        } else if (!hasLightSensor && this.hasCapability('measure_luminance')) {
            await this.removeCapability('measure_luminance');
            this.homey.app.debug(`removed capability measure_luminance for ${this.getName()}`);
        }
    }

    /**
     * Check if sensor has light measurement capability.
     * @private
     * @param {Object} sensor - The sensor data
     * @returns {boolean} True if sensor has light measurement
     */
    _sensorHasLightMeasurement(sensor) {
        return typeof sensor.stats?.light?.value !== 'undefined' && 
               sensor.stats.light.value !== null;
    }

                    if (typeof sensor.stats.humidity !== 'undefined' && typeof sensor.stats.humidity.value !== 'undefined' && sensor.stats.humidity.value !== null)
                    {
                        if (!this.hasCapability('measure_humidity')) {
                            await this.addCapability('measure_humidity');
                            this.homey.app.debug(`created capability measure_humidity for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('measure_humidity')) {
                            await this.removeCapability('measure_humidity');
                            this.homey.app.debug(`removed capability measure_humidity for ${this.getName()}`);
                        }
                    }

                    if (typeof sensor.stats.temperature !== 'undefined' && typeof sensor.stats.temperature.value !== 'undefined' && sensor.stats.temperature.value !== null)
                    {
                        if (!this.hasCapability('measure_temperature')) {
                            await this.addCapability('measure_temperature');
                            this.homey.app.debug(`created capability measure_temperature for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('measure_temperature')) {
                            await this.removeCapability('measure_temperature');
                            this.homey.app.debug(`removed capability measure_temperature for ${this.getName()}`);
                        }
                    }

                    if (typeof sensor.motionSettings !== 'undefined' && sensor.motionSettings.isEnabled) {
                        // alarm_motion
                        if (!this.hasCapability('alarm_motion')) {
                            await this.addç('alarm_motion');
                            this.homey.app.debug(`created capability alarm_motion for ${this.getName()}`);
                        }
                        if (!this.hasCapability('last_motion_at')) {
                            await this.addCapability('last_motion_at');
                            this.homey.app.debug(`created capability last_motion_at for ${this.getName()}`);
                        }
                        if (!this.hasCapability('last_motion_date')) {
                            await this.addCapability('last_motion_date');
                            this.homey.app.debug(`created capability last_motion_date for ${this.getName()}`);
                        }
                        if (!this.hasCapability('last_motion_time')) {
                            await this.addCapability('last_motion_time');
                            this.homey.app.debug(`created capability last_motion_time for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('alarm_motion')) {
                            await this.removeCapability('alarm_motion');
                            this.homey.app.debug(`removed capability alarm_motion for ${this.getName()}`);
                        }
                        if (this.hasCapability('last_motion_at')) {
                            await this.removeCapability('last_motion_at');
                            this.homey.app.debug(`removed capability last_motion_at for ${this.getName()}`);
                        }
                        if (this.hasCapability('last_motion_date')) {
                            await this.removeCapability('last_motion_date');
                            this.homey.app.debug(`removed capability last_motion_date for ${this.getName()}`);
                        }
                        if (this.hasCapability('last_motion_time')) {
                            await this.removeCapability('last_motion_time');
                            this.homey.app.debug(`removed capability last_motion_time for ${this.getName()}`);
                        }
                    }

                    if (!this.hasCapability('alarm_contact')) {
                        await this.addCapability('alarm_contact');
                        this.homey.app.debug(`created capability alarm_contact for ${this.getName()}`);
                    }

                }
            }
        }
    }

    async _initSensorData() {
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (bootstrapData) {
            bootstrapData.sensors.forEach((sensor) => {
                if (sensor.id === this.getData().id) {
                    if (this.hasCapability('measure_humidity')) {
                        this.setCapabilityValue('measure_humidity', sensor.stats.humidity.value);
                    }
                    if (this.hasCapability('measure_temperature')) {
                        this.setCapabilityValue('measure_temperature', sensor.stats.temperature.value);
                    }
                    if (this.hasCapability('measure_luminance')) {
                        this.setCapabilityValue('measure_luminance', sensor.stats.light.value);
                    }
                    if (this.hasCapability('alarm_contact')) {
                        this.setCapabilityValue('alarm_contact', sensor.isOpened);
                    }
                }
            });
        }
    }

    refreshSensorData() {
        this.homey.app.api.getBootstrapInfo().then(() => {
            this._initSensorData();
        }).catch(error => this.homey.app.debug(error));
    }

    onMotionStart() {
        if (this.getCapabilityValue('alarm_motion') !== true) {
            this.homey.app.debug('onMotionStart');
            this.setCapabilityValue('alarm_motion', true);

            this.motion_timer_id = this.homey.setTimeout(() => {
                this.onMotionEnd();
            }, UfvConstants.PROTECT_SENSOR_MOTION_TIMER_WAIT_IN_SEC);
        } else {
            this.homey.app.debug('onMotionStart reset timer');
            this.homey.clearTimeout(this.motion_timer_id)
            this.motion_timer_id = this.homey.setTimeout(() => {
                this.onMotionEnd();
            }, UfvConstants.PROTECT_SENSOR_MOTION_TIMER_WAIT_IN_SEC);
        }
    }

    onMotionEnd() {
        this.homey.app.debug('onMotionEnd');
        this.setCapabilityValue('alarm_motion', false);
    }

    onIsLightOn(isLightOn) {
        if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', isLightOn);
        }
    }

    onHumidityChange(humidity) {
        this.homey.app.debug('onHumidityChange');
        if (this.hasCapability('measure_humidity')) {
            this.setCapabilityValue('measure_humidity', humidity);
        }
    }

    onTemperatureChange(temperature) {
        this.homey.app.debug('onTemperatureChange');
        if (this.hasCapability('measure_temperature')) {
            this.setCapabilityValue('measure_temperature', temperature);
        }
    }

    onLightChange(light) {
        this.homey.app.debug('onLightChange');
        if (this.hasCapability('measure_luminance')) {
            this.setCapabilityValue('measure_luminance', light);
        }
    }

    onDoorChange(isOpened) {
        this.homey.app.debug('onDoorChange');
        if (this.hasCapability('alarm_contact')) {
            this.setCapabilityValue('alarm_contact', isOpened);
        }
    }

    onLedLevelChange(ledLevel) {
        this.homey.app.debug('onLedLevelChange');
        if (this.hasCapability('dim')) {
            this.setCapabilityValue('dim', this.translateLedLevel(ledLevel, false));
        }
    }

    onLightModeChange(settings) {
        this.homey.app.debug('onLightModeChange');
        if (this.hasCapability('light_mode')) {
            this.setCapabilityValue('light_mode', this.translateLightMode(settings));
        }
    }

    translateLightMode(settings) {
        if (settings.mode === "motion" && settings.enableAt === "fulltime") {
            return "motion";
        } else if (settings.mode === "motion" && settings.enableAt === "dark") {
            return "dark";
        } else {
            return settings.mode;
        }
    }

    translateLedLevel(ledLevel, homey) {
        if (homey) {
            if (ledLevel <= 0.16) {
                return 1;
            } else if (ledLevel <= 0.32) {
                return 2;
            } else if (ledLevel <= 0.48) {
                return 3;
            } else if (ledLevel <= 0.64) {
                return 4;
            } else if (ledLevel <= 0.80) {
                return 5;
            } else {
                return 6;
            }
        } else {
            if (ledLevel === 1) {
                return 0.16;
            } else if (ledLevel === 2) {
                return 0.32;
            } else if (ledLevel === 2) {
                return 0.48;
            } else if (ledLevel === 2) {
                return 0.64;
            } else if (ledLevel === 2) {
                return 0.80;
            } else {
                return 1;
            }
        }
    }

    onMotionDetected(lastMotionTime, isMotionDetected) {
        const lastMotionAt = this.getCapabilityValue('last_motion_at');

        if (!lastMotionAt) {
            this.homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
            this.setCapabilityValue('last_motion_at', lastMotionTime)
                .catch(this.error);
            return;
        }

        // Check if the event date is newer
        if (isMotionDetected && lastMotionTime > lastMotionAt) {
            const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));
            this.homey.app.debug(`new motion detected on sensor: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

            this.setCapabilityValue('last_motion_at', lastMotionTime)
                .catch(this.error);
            this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
                .catch(this.error);
            this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
                .catch(this.error);
            this.onMotionStart();
        }
    }
}

module.exports = Sensor;
