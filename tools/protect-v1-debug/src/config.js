'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === '') {
    throw new Error('Missing required environment variable: ' + name);
  }
  return String(value).trim();
}

function readConfig() {
  return {
    host: getRequiredEnv('PROTECT_HOST'),
    port: toInt(process.env.PROTECT_PORT || '443', 443),
    username: getRequiredEnv('PROTECT_USERNAME'),
    password: getRequiredEnv('PROTECT_PASSWORD'),
    runSeconds: toInt(process.env.RUN_SECONDS || '3600', 3600),
    outputDir: path.resolve(process.cwd(), process.env.OUTPUT_DIR || './output'),
    maxLogSizeBytes: toInt(process.env.MAX_LOG_SIZE_MB || '50', 50) * 1024 * 1024,
    reconnectDelayMs: toInt(process.env.RECONNECT_DELAY_MS || '5000', 5000),
  };
}

module.exports = {
  readConfig,
};
