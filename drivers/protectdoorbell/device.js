'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const UfvConstants = require('../../library/constants');

class Doorbell extends Homey.Device {
    /**
     * onInit is called when the device is initialized.
     */
    async onInit() {
        this.device = this;
        await this.waitForBootstrap();
        this.homey.app.debug('UnifiDoorbell Device has been initialized');
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded() {
        this.homey.app.debug('UnifiDoorbell Device has been added');
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
        this.homey.app.debug('UnifiDoorbell Device settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name) {
        this.homey.app.debug('UnifiDoorbell Device was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onDeleted() {
        this.homey.app.debug('UnifiDoorbell Device has been deleted');
    }

    async initDoorbell() {
        this.registerCapabilityListener('camera_microphone_volume', async (value) => {
            this.homey.app.debug('camera_microphone_volume');
            this.homey.app.api.setMicVolume(this.getData(), value)
                .catch(this.error);
        });

        this.registerCapabilityListener('camera_nightvision_set', async (value) => {
            this.homey.app.debug('camera_nightvision_set');
            this.homey.app.api.setNightVisionMode(this.getData(), value)
                .catch(this.error);
        });

        await this._createMissingCapabilities();
        await this._initDoorbellData();
        await this._createSnapshotImage();
    }

    async waitForBootstrap() {
        if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
            await this.initDoorbell();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
        }
    }

    async _createMissingCapabilities() {
        if (this.getClass() !== 'doorbell') {
            this.homey.app.debug(`changed class to doorbell for ${this.getName()}`);
            await this.setClass('doorbell');
        }

        // Doorbell_nightvision_status
        if (!this.hasCapability('camera_nightvision_status')) {
            await this.addCapability('camera_nightvision_status');
            this.homey.app.debug(`created capability camera_nightvision_status for ${this.getName()}`);
        }

        if (!this.hasCapability('camera_nightvision_set')) {
            await this.addCapability('camera_nightvision_set');
            this.homey.app.debug(`created capability camera_nightvision_set for ${this.getName()}`);
        }

        if (!this.hasCapability('last_motion_score')) {
            await this.addCapability('last_motion_score');
            this.homey.app.debug(`created capability last_motion_score for ${this.getName()}`);
        }

        if (!this.hasCapability('last_motion_thumbnail')) {
            await this.addCapability('last_motion_thumbnail');
            this.homey.app.debug(`created capability last_motion_thumbnail for ${this.getName()}`);
        }
        if (!this.hasCapability('last_motion_heatmap')) {
            await this.addCapability('last_motion_heatmap');
            this.homey.app.debug(`created capability last_motion_heatmap for ${this.getName()}`);
        }
        if (this.hasCapability('last_motion_datetime')) {
            await this.removeCapability('last_motion_datetime');
            this.homey.app.debug(`removed capability last_motion_datetime for ${this.getName()}`);
        }
        if (!this.hasCapability('last_motion_date')) {
            await this.addCapability('last_motion_date');
            this.homey.app.debug(`created capability last_motion_date for ${this.getName()}`);
        }
        if (!this.hasCapability('last_motion_time')) {
            await this.addCapability('last_motion_time');
            this.homey.app.debug(`created capability last_motion_time for ${this.getName()}`);
        }

        if (!this.hasCapability('camera_recording_mode')) {
            await this.addCapability('camera_recording_mode');
            this.homey.app.debug(`created capability camera_recording_mode for ${this.getName()}`);
        }
        if (!this.hasCapability('camera_microphone_status')) {
            await this.addCapability('camera_microphone_status');
            this.homey.app.debug(`created capability camera_microphone_status for ${this.getName()}`);
        }
        if (!this.hasCapability('camera_microphone_volume')) {
            await this.addCapability('camera_microphone_volume');
            this.homey.app.debug(`created capability camera_microphone_volume for ${this.getName()}`);
        }
        if (!this.hasCapability('camera_connection_status')) {
            await this.addCapability('camera_connection_status');
            this.homey.app.debug(`created capability camera_connection_status for ${this.getName()}`);
        }
        if (!this.hasCapability('last_ring_at')) {
            await this.addCapability('last_ring_at');
            this.homey.app.debug(`created capability last_ring_at for ${this.getName()}`);
        }
        if (!this.hasCapability('last_smart_detection_at')) {
            await this.addCapability('last_smart_detection_at');
            this.homey.app.debug(`created capability last_smart_detection_at for ${this.getName()}`);
        }
        if (!this.hasCapability('last_smart_detection_score')) {
            await this.addCapability('last_smart_detection_score');
            this.homey.app.debug(`created capability last_smart_detection_score for ${this.getName()}`);
        }
        if (!this.hasCapability('last_smart_detection_date')) {
            await this.addCapability('last_smart_detection_date');
            this.homey.app.debug(`created capability last_smart_detection_date for ${this.getName()}`);
        }
        if (!this.hasCapability('last_smart_detection_time')) {
            await this.addCapability('last_smart_detection_time');
            this.homey.app.debug(`created capability last_smart_detection_time for ${this.getName()}`);
        }
        if (!this.hasCapability('ip_address')) {
            await this.addCapability('ip_address');
            this.homey.app.debug(`created capability ip_address for ${this.getName()}`);
        }

    }

    async _initDoorbellData() {
        const DoorbellData = this.homey.app.api.getBootstrap();

        if (DoorbellData) {
            DoorbellData.cameras.forEach((Doorbell) => {
                if (Doorbell.id === this.getData().id) {
                    if (this.hasCapability('ip_address')) {
                        this.setCapabilityValue('ip_address', Doorbell.host);
                    }
                    if (this.hasCapability('camera_recording_status')) {
                        this.setCapabilityValue('camera_recording_status', Doorbell.isRecording);
                    }
                    if (this.hasCapability('camera_recording_mode')) {
                        this.setCapabilityValue('camera_recording_mode',
                            this.homey.__(`events.doorbell.${String(Doorbell.recordingSettings.mode)
                                .toLowerCase()}`));
                    }
                    if (this.hasCapability('camera_microphone_status')) {
                        this.setCapabilityValue('camera_microphone_status', Doorbell.isMicEnabled);
                    }
                    if (this.hasCapability('camera_nightvision_status')) {
                        this.setCapabilityValue('camera_nightvision_status', Doorbell.isDark);
                    }
                    if (this.hasCapability('camera_microphone_volume')) {
                        this.setCapabilityValue('camera_microphone_volume', Doorbell.micVolume);
                    }
                    if (this.hasCapability('camera_connection_status')) {
                        if (this.getCapabilityValue('camera_connection_status') !== Doorbell.isConnected) {
                            this.onConnectionChanged(Doorbell.isConnected);
                        }
                        this.setCapabilityValue('camera_connection_status', Doorbell.isConnected);
                    }
                    if (this.hasCapability('camera_nightvision_set')) {
                        this.setCapabilityValue('camera_nightvision_set', Doorbell.ispSettings.irLedMode);
                    }

                }
            });
        }
    }

    onMotionStart() {
        this.homey.app.debug('onMotionStart');
        this.setCapabilityValue('alarm_motion', true);
    }

    onMotionEnd() {
        this.homey.app.debug('onMotionEnd');
        this.setCapabilityValue('alarm_motion', false);
    }

    onIsDark(isDark) {
        // Debug information about playload
        if (this.hasCapability('camera_nightvision_status')) {
            this.setCapabilityValue('camera_nightvision_status', isDark);
        }
    }

    onNightVisionMode(mode) {
        // Debug information about playload
        if (this.hasCapability('camera_nightvision_set')) {
            this.setCapabilityValue('camera_nightvision_set', mode);
        }
    }

    onDoorbellRinging(lastRing) {
        const lastRingAt = this.getCapabilityValue('last_ring_at');

        // Check if the event date is newer
        if (!lastRingAt || lastRing > lastRingAt) {
            this.homey.app._doorbellRingingTrigger.trigger({
                ufp_ringing_camera: this.getName(),
            });

            this.driver._doorbellPressetTrigger.trigger(this, {
                ufp_pressed_camera: this.getName(),
            });
        }

        if (!lastRingAt) {
            if (this.homey.env.DEBUG) this.homey.app.debug(`set last_ring_at to last datetime: ${this.getData().id}`);
            this.setCapabilityValue('last_ring_at', lastRing)
                .catch(this.error);
            return;
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
            const lastMotion = new Date(lastMotionTime);
            this.homey.app.debug(`new motion detected on Doorbell: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

            this.setCapabilityValue('last_motion_at', lastMotionTime)
                .catch(this.error);
            this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
                .catch(this.error);
            this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
                .catch(this.error);
            this.onMotionStart();
        } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
            const lastMotion = new Date(lastMotionTime);
            this.homey.app.debug(`motion detected ended on Doorbell: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
            this.onMotionEnd();
            this.setCapabilityValue('last_motion_at', lastMotionTime)
                .catch(this.error);
        }
    }

    onSmartDetection(lastDetectionAt, smartDetectTypes, score) {
        const lastDetection = new Date(lastDetectionAt);
        // Set last smart detection to current datetime
        this.setCapabilityValue('last_smart_detection_at', lastDetectionAt)
            .catch(this.error);
        this.setCapabilityValue('last_smart_detection_date', lastDetection.toLocaleDateString())
            .catch(this.error);
        this.setCapabilityValue('last_smart_detection_time', lastDetection.toLocaleTimeString())
            .catch(this.error);
        this.setCapabilityValue('last_smart_detection_score', score)
            .catch(this.error);

        // const smartDetectionType = smartDetectTypes.join(',');

        // fire trigger (per detection type)
        for (let smartDetectionType of smartDetectTypes) {
            this.homey.app.debug(`smart detection event on Doorbell ${this.getData().id}, with type ${smartDetectionType}`);
            this.homey.app._smartDetectionTrigger.trigger({
                ufp_smart_detection_camera: this.getName(),
                smart_detection_type: smartDetectionType,
                score: score
            });
        }
    }

    onConnectionChanged(connectionStatus) {
        this.homey.app._connectionStatusTrigger.trigger({
            ufp_connection_status: connectionStatus,
            ufp_connection_camera: this.getName(),
        });
    }

    onIsRecording(isRecording) {
        // Debug information about playload
        if (this.hasCapability('camera_recording_status')) {
            this.setCapabilityValue('camera_recording_status', isRecording);
        }
    }

    onIsMicEnabled(isMicEnabled) {
        // Debug information about playload
        if (this.hasCapability('camera_microphone_status')) {
            this.setCapabilityValue('camera_microphone_status', isMicEnabled);
        }
    }

    onIsConnected(isConnected) {
        // Debug information about playload
        if (this.getCapabilityValue('camera_connection_status') !== isConnected) {
            this.onConnectionChanged(isConnected);
        }
        this.setCapabilityValue('camera_connection_status', isConnected);
    }

    onMicVolume(micVolume) {
        // Debug information about playload
        if (this.hasCapability('camera_microphone_volume')) {
            this.setCapabilityValue('camera_microphone_volume', micVolume);
        }
    }

    onRecordingMode(mode) {
        // Debug information about playload
        if (this.hasCapability('camera_recording_mode')) {
            this.setCapabilityValue('camera_recording_mode',
                this.homey.__(`events.Doorbell.${String(mode)
                    .toLowerCase()}`));
        }
    }

    async getSnapshot() {
        this._snapshotImage = await this.homey.images.createImage();
        this._snapshotImage.setStream(async stream => {
            let snapshotUrl = `https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg`;
            // Fetch image
            const res = await fetch(snapshotUrl);
            if (!res.ok) throw new Error('Could not fetch snapshot image.');

            return res.body.pipe(stream);
        });
        this.setCameraImage('snapshot', this.getName(), this._snapshotImage);
    }

    async _createSnapshotImage(triggerFlow = false) {
        this.homey.app.debug('Creating snapshot image for doorbell ' + this.getName() + '.');

        this._snapshotImage = await this.homey.images.createImage();

        const ipAddress = this.getCapabilityValue('ip_address');

        this._snapshotImage.setStream(async stream => {
            // Obtain snapshot URL
            let snapshotUrl = null;

            if (this.homey.app.useCameraSnapshot) {
                snapshotUrl = `https://${ipAddress}/snap.jpeg`;
            }
            else {
                await this.homey.app.api.createSnapshotUrl(this.getData())
                    .then(url => {
                        snapshotUrl = url;
                    })
                    .catch(this.error.bind(this, 'Could not create snapshot URL.'));
            }

            if (!snapshotUrl) {
                throw new Error('Invalid snapshot url.');
            }

            const headers = {};
            headers['Cookie'] = this.homey.app.api.getProxyCookieToken();

            const agent = new https.Agent({
                rejectUnauthorized: false,
                keepAlive: false,
            });

            // Fetch image
            const res = await fetch(snapshotUrl, {
                agent,
                headers
            });
            if (!res.ok) throw new Error('Could not fetch snapshot image.');

            return res.body.pipe(stream);
        });

        if (triggerFlow) {
            this.homey.app.api.getStreamUrl(this.getData()).then((rtspUrl => {
                this.homey.app.triggerSnapshotTrigger({
                    ufv_snapshot_token: this._snapshotImage,
                    ufv_snapshot_camera: this.getName(),
                    ufv_snapshot_snapshot_url: this._snapshotImage.cloudUrl,
                    ufv_snapshot_stream_url: rtspUrl
                });
            })).catch(this.homey.app.debug);
        }

        this.setCameraImage('snapshot', this.getName(), this._snapshotImage);

        this.homey.app.debug('Created snapshot image for doorbell ' + this.getName() + '.');
    }

}

module.exports = Doorbell;
