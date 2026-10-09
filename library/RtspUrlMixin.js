'use strict';

const { getRtspStreamUrl } = require('./rtsp-stream-url');
const { SETTING_STREAM_QUALITY, SETTING_VIDEO_CODEC, VIDEO_CODEC_AUTO } = require('./constants');

// Backoff between RTSP URL lookups while the controller/API is not ready yet.
const RTSP_RETRY_DELAYS_MS = [5000, 15000, 30000, 60000, 120000];

/**
 * Shared RTSP URL handling for camera and doorbell devices.
 * Resolves the URL (with retry), keeps the device warning in sync and flags H.265 streams.
 */
const RtspUrlMixin = {
  /**
   * Returns the camera videoCodec from the (cached) V1 bootstrap, or null when unknown (e.g. V2 only).
   */
  _getCameraVideoCodec() {
    try {
      const bootstrap = this.homey.app.api && this.homey.app.api.getBootstrap();
      const cameras = bootstrap && Array.isArray(bootstrap.cameras) ? bootstrap.cameras : [];
      const camera = cameras.find((cam) => String(cam.id) === String(this.getData().id));
      return camera && camera.videoCodec ? String(camera.videoCodec).toLowerCase() : null;
    } catch (error) {
      this.error('[RtspUrlMixin] Unable to read videoCodec', error);
      return null;
    }
  },

  /**
   * Demuxer for the main live stream: the device setting, or (auto) derived from the camera codec.
   * @returns {'h264'|'hevc'}
   */
  _getDemuxer() {
    const override = this.getSetting(SETTING_VIDEO_CODEC);
    if (override && override !== VIDEO_CODEC_AUTO) {
      return override === 'hevc' ? 'hevc' : 'h264';
    }
    const codec = this._getCameraVideoCodec();
    return codec === 'h265' || codec === 'hevc' ? 'hevc' : 'h264';
  },

  /**
   * (Re)creates the main live video with the right demuxer and registers it on the device.
   */
  async _createMainVideo() {
    this.video = await this.homey.videos.createVideoRTSP({
      allowInvalidCertificates: true,
      demuxer: this._getDemuxer(),
    });

    this.video.registerVideoUrlListener(async () => {
      if (!this.rtspUrl) {
        await this._refreshRtspUrl();
      }
      return {
        url: this.rtspUrl,
      };
    });

    await this.setCameraVideo('snapshot', `${this.getName()} Video`, this.video);
  },

  /**
   * Sets the single device warning: missing RTSP URL first, then H.265 notice, otherwise cleared.
   */
  _updateVideoWarning() {
    const codec = this._getCameraVideoCodec();
    let warning = null;
    if (!this.rtspUrl) {
      warning = this.homey.__('warnings.no_rtsp_url');
    } else if ((codec === 'h265' || codec === 'hevc') && this._getDemuxer() !== 'hevc') {
      warning = this.homey.__('warnings.h265_stream');
    }
    return this.setWarning(warning).catch(this.error);
  },

  /**
   * Looks up the RTSP URL, updates the warning and schedules a retry while the URL is empty.
   * @param {string} [quality] stream quality override, defaults to the device setting
   * @returns {Promise<string>} the RTSP URL ('' when unavailable)
   */
  async _refreshRtspUrl(quality) {
    this._clearRtspRetry();
    try {
      this.rtspUrl = await getRtspStreamUrl(this.homey.app, this.getData(), {
        quality: quality || this.getSetting(SETTING_STREAM_QUALITY),
      });
    } catch (error) {
      this.error('[RtspUrlMixin] RTSP URL lookup failed', error);
      this.rtspUrl = '';
    }

    await this._updateVideoWarning();

    if (this.rtspUrl) {
      this._rtspRetryCount = 0;
      this.log(`RTSP URL configured for ${this.getName()}.`);
    } else {
      this.homey.app.debug(`No RTSP URL available for ${this.getName()}.`);
      this._scheduleRtspRetry();
    }
    return this.rtspUrl;
  },

  _scheduleRtspRetry() {
    const attempt = this._rtspRetryCount || 0;
    if (attempt >= RTSP_RETRY_DELAYS_MS.length) {
      return;
    }
    this._rtspRetryCount = attempt + 1;
    this._rtspRetryTimer = this.homey.setTimeout(() => {
      this._rtspRetryTimer = null;
      this._refreshRtspUrl().catch((error) => this.error(error));
    }, RTSP_RETRY_DELAYS_MS[attempt]);
  },

  _clearRtspRetry() {
    if (this._rtspRetryTimer) {
      this.homey.clearTimeout(this._rtspRetryTimer);
      this._rtspRetryTimer = null;
    }
  },
};

module.exports = RtspUrlMixin;
