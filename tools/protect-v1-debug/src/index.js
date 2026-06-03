'use strict';

const { readConfig } = require('./config');
const { login, getBootstrap } = require('./client');
const { connectUpdates } = require('./ws');
const { SessionLogger } = require('./logger');

async function main() {
  const config = readConfig();
  const logger = new SessionLogger(config.outputDir, config.maxLogSizeBytes);

  let cookie = await login(config);
  const bootstrapResult = await getBootstrap(config, cookie);
  cookie = bootstrapResult.cookie;

  const bootstrap = bootstrapResult.bootstrap;
  const bootstrapPath = logger.writeBootstrap(bootstrap);

  const nvrName = bootstrap && bootstrap.nvr && bootstrap.nvr.name ? bootstrap.nvr.name : 'unknown-nvr';
  console.log('[debug] Login OK. NVR:', nvrName);
  console.log('[debug] Bootstrap saved:', bootstrapPath);

  let lastUpdateId = bootstrap.lastUpdateId;
  if (!lastUpdateId) {
    throw new Error('bootstrap.lastUpdateId is missing; cannot start websocket updates listener.');
  }

  let stopped = false;
  let socket = null;
  let reconnectTimer = null;

  function scheduleReconnect() {
    if (stopped) {
      return;
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startWebSocket();
    }, config.reconnectDelayMs);
  }

  function startWebSocket() {
    if (stopped) {
      return;
    }

    console.log('[debug] Connecting websocket with lastUpdateId:', lastUpdateId);

    socket = connectUpdates({
      host: config.host,
      lastUpdateId: lastUpdateId,
      cookie: cookie,
      onOpen: () => {
        console.log('[debug] Websocket connected');
      },
      onPong: () => {
        console.log('[debug] Websocket pong');
      },
      onMessage: ({ receivedAt, packetLength, decoded }) => {
        if (decoded && decoded.action && decoded.action.newUpdateId) {
          lastUpdateId = decoded.action.newUpdateId;
        }

        logger.writeDecoded({
          receivedAt: receivedAt,
          packetLength: packetLength,
          decoded: decoded,
        });
      },
      onError: (error) => {
        console.error('[debug] Websocket error:', error.message);
      },
      onClose: (code, reason) => {
        console.log('[debug] Websocket closed:', code, reason || 'no-reason');
        scheduleReconnect();
      },
    });
  }

  function shutdown(reason) {
    if (stopped) {
      return;
    }

    stopped = true;
    console.log('[debug] Stopping collector:', reason);

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket && socket.readyState < 2) {
      socket.close();
    }

    logger.close();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const runtimeMs = Math.max(1, config.runSeconds) * 1000;
  setTimeout(() => shutdown('RUN_SECONDS reached'), runtimeMs);

  startWebSocket();
}

main().catch((error) => {
  console.error('[fatal]', error.message);
  process.exitCode = 1;
});
