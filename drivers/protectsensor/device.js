'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// UP-AirQuality reports continuous readings under sensor.airQuality (bootstrap) /
// payload.airQuality (websocket update), keyed by metric name. Confirmed against a real
// device bootstrap capture - this is NOT documented in the official v2 OpenAPI spec (only
// available via the v1 legacy bootstrap/websocket this app already uses), but is reliable.
// All map to Homey *system* capabilities except measure_pm4 (no PM4.0 tier in Homey's set).
const AIR_QUALITY_METRIC_CAPABILITIES = {
    aqi: 'measure_aqi',
    voc: 'measure_tvoc_index',
    tvoc: 'measure_tvoc',
    co2: 'measure_co2',
    pm1p0: 'measure_pm1',
    pm2p5: 'measure_pm25',
    pm4p0: 'measure_pm4',
    pm10p0: 'measure_pm10',
};

class Sensor extends Homey.Device {

    motion_timer_id = -1;

    /**
     * onInit is called when the device is initialized.
     */
    async onInit() {
        await this.waitForBootstrap();
        this.homey.app.debug('UnifiSensor Device has been initialized');
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.homey.app.debug('UnifiSensor Device has been added');
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
    async onSettings({oldSettings, newSettings, changedKeys}) {
        this.homey.app.debug('UnifiSensor Device settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name) {
        this.homey.app.debug('UnifiSensor Device was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        this.homey.app.debug('UnifiSensor Device has been deleted');
    }

    async initSensor() {
        this.registerCapabilityListener("onoff", (value) => {
            return this.homey.app.api.setLightOn(this.getData(), value);
        });

        this.registerCapabilityListener("dim", (value) => {
            return this.homey.app.api.setLightLevel(this.getData(), this.translateLedLevel(value, true));
        });

        this.registerCapabilityListener("light_mode", (value) => {
            return this.homey.app.api.setLightMode(this.getData(), value);
        });

        await this._createMissingCapabilities();
        await this._initSensorData();
    }

    async waitForBootstrap() {
        const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
        const v2Ready = this.homey.app.isV2Available();

        if (v1Ready || v2Ready) {
            await this.initSensor();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
        }
    }

    async _createMissingCapabilities() {
        if (this.getClass() !== 'sensor') {
            this.homey.app.debug(`changed class to sensor for ${this.getName()}`);
            await this.setClass('sensor');
        }
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (bootstrapData) {
            for (const sensor of bootstrapData.sensors) {
                if (sensor.id === this.getData().id) {

                    if (typeof sensor.stats.light !== 'undefined' && typeof sensor.stats.light.value !== 'undefined' && sensor.stats.light.value !== null)
                    {
                        if (!this.hasCapability('measure_luminance')) {
                            await this.addCapability('measure_luminance');
                            this.homey.app.debug(`created capability measure_luminance for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('measure_luminance')) {
                            await this.removeCapability('measure_luminance');
                            this.homey.app.debug(`removed capability measure_luminance for ${this.getName()}`);
                        }
                    }

                    // UP-AirQuality doesn't populate sensor.stats.humidity (stays null) - it
                    // reports humidity under sensor.airQuality.humidity instead. Fall back to
                    // that so this device still gets measure_humidity/measure_temperature.
                    const airQuality = sensor.airQuality;

                    if ((typeof sensor.stats.humidity !== 'undefined' && typeof sensor.stats.humidity.value !== 'undefined' && sensor.stats.humidity.value !== null)
                        || (airQuality && airQuality.humidity && typeof airQuality.humidity.value !== 'undefined' && airQuality.humidity.value !== null))
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

                    if ((typeof sensor.stats.temperature !== 'undefined' && typeof sensor.stats.temperature.value !== 'undefined' && sensor.stats.temperature.value !== null)
                        || (airQuality && airQuality.temperature && typeof airQuality.temperature.value !== 'undefined' && airQuality.temperature.value !== null))
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
                            await this.addCapability('alarm_motion');
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

                    // Smoke + CO alarm sensor (sensor.alarmSettings, added in API v7.1.87)
                    if (typeof sensor.alarmSettings !== 'undefined' && sensor.alarmSettings.isEnabled) {
                        if (!this.hasCapability('alarm_smoke')) {
                            await this.addCapability('alarm_smoke');
                            this.homey.app.debug(`created capability alarm_smoke for ${this.getName()}`);
                        }
                        if (!this.hasCapability('alarm_co')) {
                            await this.addCapability('alarm_co');
                            this.homey.app.debug(`created capability alarm_co for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('alarm_smoke')) {
                            await this.removeCapability('alarm_smoke');
                            this.homey.app.debug(`removed capability alarm_smoke for ${this.getName()}`);
                        }
                        if (this.hasCapability('alarm_co')) {
                            await this.removeCapability('alarm_co');
                            this.homey.app.debug(`removed capability alarm_co for ${this.getName()}`);
                        }
                    }

                    // Glass break sensor (sensor.glassBreakSettings, added in API v7.1.87)
                    if (typeof sensor.glassBreakSettings !== 'undefined' && sensor.glassBreakSettings.isEnabled) {
                        if (!this.hasCapability('alarm_glassbreak')) {
                            await this.addCapability('alarm_glassbreak');
                            this.homey.app.debug(`created capability alarm_glassbreak for ${this.getName()}`);
                        }
                    } else {
                        if (this.hasCapability('alarm_glassbreak')) {
                            await this.removeCapability('alarm_glassbreak');
                            this.homey.app.debug(`removed capability alarm_glassbreak for ${this.getName()}`);
                        }
                    }

                    if (!this.hasCapability('alarm_tamper')) {
                        await this.addCapability('alarm_tamper');
                        this.homey.app.debug(`created capability alarm_tamper for ${this.getName()}`);
                    }

                    // UP-AirQuality: continuous AQI/CO2/VOC/TVOC/PM readings, confirmed present
                    // in sensor.airQuality on a real device (undocumented in the official v2
                    // OpenAPI spec, only available via the v1 legacy bootstrap/websocket this
                    // app already uses). Gated on presence so plain motion/contact sensors -
                    // which don't have this key at all - stay untouched.
                    for (const [metric, capability] of Object.entries(AIR_QUALITY_METRIC_CAPABILITIES)) {
                        const hasValue = airQuality && airQuality[metric]
                            && typeof airQuality[metric].value !== 'undefined' && airQuality[metric].value !== null;
                        if (hasValue) {
                            if (!this.hasCapability(capability)) {
                                await this.addCapability(capability);
                                this.homey.app.debug(`created capability ${capability} for ${this.getName()}`);
                            }
                        } else if (this.hasCapability(capability)) {
                            await this.removeCapability(capability);
                            this.homey.app.debug(`removed capability ${capability} for ${this.getName()}`);
                        }
                    }

                    // Vape detection (UP-AirQuality). airQuality.vape is present structurally
                    // even when vape alerting is disabled in settings, so gate on presence here
                    // (same idiom as the metrics above); onVapeDetected also lazily adds it as a
                    // fallback in case a vape event ever arrives for a sensor we didn't detect
                    // this on at bootstrap time.
                    if (airQuality && typeof airQuality.vape !== 'undefined') {
                        if (!this.hasCapability('alarm_vape')) {
                            await this.addCapability('alarm_vape');
                            this.homey.app.debug(`created capability alarm_vape for ${this.getName()}`);
                        }
                    } else if (this.hasCapability('alarm_vape')) {
                        await this.removeCapability('alarm_vape');
                        this.homey.app.debug(`removed capability alarm_vape for ${this.getName()}`);
                    }

                    // Battery status is reported for every sensor (sensor.batteryStatus);
                    // percentage stays null on wired/PoE units like UP-AirQuality, so only add
                    // measure_battery when a real percentage is reported.
                    if (typeof sensor.batteryStatus !== 'undefined' && sensor.batteryStatus !== null) {
                        if (!this.hasCapability('alarm_battery')) {
                            await this.addCapability('alarm_battery');
                            this.homey.app.debug(`created capability alarm_battery for ${this.getName()}`);
                        }
                        if (typeof sensor.batteryStatus.percentage !== 'undefined' && sensor.batteryStatus.percentage !== null) {
                            if (!this.hasCapability('measure_battery')) {
                                await this.addCapability('measure_battery');
                                this.homey.app.debug(`created capability measure_battery for ${this.getName()}`);
                            }
                        } else if (this.hasCapability('measure_battery')) {
                            await this.removeCapability('measure_battery');
                            this.homey.app.debug(`removed capability measure_battery for ${this.getName()}`);
                        }
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
                    const airQuality = sensor.airQuality;

                    // Prefer sensor.stats (generic Sensor), fall back to sensor.airQuality
                    // (UP-AirQuality reports humidity/temperature there instead).
                    if (this.hasCapability('measure_humidity')) {
                        const value = (sensor.stats.humidity && sensor.stats.humidity.value !== null)
                            ? sensor.stats.humidity.value
                            : (airQuality && airQuality.humidity ? airQuality.humidity.value : null);
                        this.setCapabilityValue('measure_humidity', value);
                    }
                    if (this.hasCapability('measure_temperature')) {
                        const value = (sensor.stats.temperature && sensor.stats.temperature.value !== null)
                            ? sensor.stats.temperature.value
                            : (airQuality && airQuality.temperature ? airQuality.temperature.value : null);
                        this.setCapabilityValue('measure_temperature', value);
                    }
                    if (this.hasCapability('measure_luminance')) {
                        this.setCapabilityValue('measure_luminance', sensor.stats.light.value);
                    }
                    if (this.hasCapability('alarm_contact')) {
                        this.setCapabilityValue('alarm_contact', sensor.isOpened);
                    }

                    for (const [metric, capability] of Object.entries(AIR_QUALITY_METRIC_CAPABILITIES)) {
                        if (this.hasCapability(capability) && airQuality && airQuality[metric]) {
                            this.setCapabilityValue(capability, airQuality[metric].value);
                        }
                    }

                    if (this.hasCapability('alarm_battery') && sensor.batteryStatus) {
                        this.setCapabilityValue('alarm_battery', !!sensor.batteryStatus.isLow);
                    }
                    if (this.hasCapability('measure_battery') && sensor.batteryStatus) {
                        this.setCapabilityValue('measure_battery', sensor.batteryStatus.percentage);
                    }

                    // Continuous smoke/CO state (sensor.smokeStatus), complements the discrete
                    // sensorAlarmEvent handled in onSensorAlarm.
                    if (sensor.smokeStatus) {
                        if (this.hasCapability('alarm_smoke')) {
                            this.setCapabilityValue('alarm_smoke', !!sensor.smokeStatus.smokeAlarm);
                        }
                        if (this.hasCapability('alarm_co')) {
                            this.setCapabilityValue('alarm_co', !!sensor.smokeStatus.coAlarm);
                        }
                    }
                }
            });
        }
    }

    async refreshSensorData() {
        try {
            await this.homey.app.api.getBootstrapInfo();
            await this._initSensorData();
        } catch (error) {
            this.homey.app.debug(error);
        }
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

    /**
     * Continuous UP-AirQuality reading update (payload.airQuality on the device-state
     * websocket, v1 or v2). Reuses onHumidityChange/onTemperatureChange for the two metrics
     * this device reports outside of sensor.stats.
     */
    onAirQualityChange(airQuality) {
        this.homey.app.debug('onAirQualityChange');
        if (!airQuality) {
            return;
        }

        for (const [metric, capability] of Object.entries(AIR_QUALITY_METRIC_CAPABILITIES)) {
            if (this.hasCapability(capability) && airQuality[metric] && typeof airQuality[metric].value !== 'undefined' && airQuality[metric].value !== null) {
                this.setCapabilityValue(capability, airQuality[metric].value).catch(this.error);
            }
        }

        if (airQuality.humidity && typeof airQuality.humidity.value !== 'undefined' && airQuality.humidity.value !== null) {
            this.onHumidityChange(airQuality.humidity.value);
        }
        if (airQuality.temperature && typeof airQuality.temperature.value !== 'undefined' && airQuality.temperature.value !== null) {
            this.onTemperatureChange(airQuality.temperature.value);
        }
    }

    onBatteryStatusChange(batteryStatus) {
        this.homey.app.debug('onBatteryStatusChange');
        if (!batteryStatus) {
            return;
        }
        if (this.hasCapability('alarm_battery')) {
            this.setCapabilityValue('alarm_battery', !!batteryStatus.isLow).catch(this.error);
        }
        if (this.hasCapability('measure_battery') && typeof batteryStatus.percentage !== 'undefined' && batteryStatus.percentage !== null) {
            this.setCapabilityValue('measure_battery', batteryStatus.percentage).catch(this.error);
        }
    }

    /**
     * Continuous smoke/CO state (payload.smokeStatus), complements the discrete
     * sensorAlarmEvent handled in onSensorAlarm.
     */
    onSmokeStatusChange(smokeStatus) {
        this.homey.app.debug('onSmokeStatusChange');
        if (!smokeStatus) {
            return;
        }
        if (this.hasCapability('alarm_smoke')) {
            this.setCapabilityValue('alarm_smoke', !!smokeStatus.smokeAlarm).catch(this.error);
        }
        if (this.hasCapability('alarm_co')) {
            this.setCapabilityValue('alarm_co', !!smokeStatus.coAlarm).catch(this.error);
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

    async _ensureCapability(capability) {
        if (!this.hasCapability(capability)) {
            try {
                await this.addCapability(capability);
                this.homey.app.debug(`created capability ${capability} for ${this.getName()}`);
            } catch (error) {
                this.homey.app.debug(`failed to add capability ${capability} for ${this.getName()}: ${error}`);
            }
        }
    }

    /**
     * Vape detected/cleared (sensorVapeEvent, UP-AirQuality). Lazily creates alarm_vape
     * since bootstrap gives no way to know a sensor supports vape detection up front.
     */
    async onVapeDetected(eventType, start, end) {
        await this._ensureCapability('alarm_vape');
        if (eventType === 'add') {
            this.homey.app.debug(`vape detected on ${this.getName()}`);
            this.setCapabilityValue('alarm_vape', true).catch(this.error);
        } else if (eventType === 'update' && end) {
            this.setCapabilityValue('alarm_vape', false).catch(this.error);
        }
    }

    /**
     * A metric (AQI/CO2/VOC/TVOC/PM/temperature/humidity/light) went in or out of its
     * configured range (sensorExtremeValueEvent). This is event-driven only, fired on
     * threshold crossing - it is NOT a continuous feed like measure_temperature is via the
     * device-state websocket. See specs/unifi-protect-api-notes.md.
     */
    async onExtremeValue(metric, value, status) {
        const numericValue = value !== null && value !== undefined ? parseFloat(value) : null;
        if (numericValue === null || Number.isNaN(numericValue)) {
            return;
        }

        const capability = AIR_QUALITY_METRIC_CAPABILITIES[metric];
        if (!capability) {
            // 'vape' extreme-value crossings are covered by alarm_vape (onVapeDetected);
            // temperature/humidity/light are already handled via the device-state websocket.
            return;
        }

        await this._ensureCapability(capability);
        this.setCapabilityValue(capability, numericValue).catch(this.error);
    }

    /**
     * Sensor alarm state started/ended (sensorAlarmEvent): smoke, CO, glassBreak, tamper.
     * short/cut/sensorButtonPress have no capability mapping (yet).
     */
    async onSensorAlarm(alarmType, eventType, end) {
        const alarmCapabilityMap = {
            smoke: 'alarm_smoke',
            CO: 'alarm_co',
            glassBreak: 'alarm_glassbreak',
            tamper: 'alarm_tamper',
        };

        const capability = alarmCapabilityMap[alarmType];
        if (!capability) {
            return;
        }

        await this._ensureCapability(capability);
        const isActive = eventType === 'add' || !end;
        this.setCapabilityValue(capability, isActive).catch(this.error);
    }

    async onTamperDetected() {
        await this._ensureCapability('alarm_tamper');
        this.setCapabilityValue('alarm_tamper', true).catch(this.error);
    }

    onBatteryLow() {
        if (this.hasCapability('alarm_battery')) {
            this.setCapabilityValue('alarm_battery', true).catch(this.error);
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
