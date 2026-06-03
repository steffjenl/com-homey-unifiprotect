'use strict';

const fs = require('fs');
const path = require('path');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function timestampKey(date) {
  return date.getFullYear()
    + pad2(date.getMonth() + 1)
    + pad2(date.getDate())
    + '-'
    + pad2(date.getHours())
    + pad2(date.getMinutes())
    + pad2(date.getSeconds());
}

class SessionLogger {
  constructor(outputDir, maxBytes) {
    this.outputDir = outputDir;
    this.maxBytes = maxBytes;
    this.currentDate = null;
    this.currentIndex = 0;
    this.currentPath = null;
    this.currentStream = null;
    this.currentBytes = 0;
  }

  ensureDir() {
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  writeBootstrap(bootstrap) {
    this.ensureDir();
    const filePath = path.join(this.outputDir, 'bootstrap-' + timestampKey(new Date()) + '.json');
    fs.writeFileSync(filePath, JSON.stringify(bootstrap, null, 2), 'utf8');
    return filePath;
  }

  rotateIfNeeded() {
    this.ensureDir();

    const now = new Date();
    const today = dateKey(now);

    if (!this.currentStream || this.currentDate !== today) {
      this.close();
      this.currentDate = today;
      this.currentIndex = 0;
      this.openCurrentFile();
      return;
    }

    if (this.currentBytes >= this.maxBytes) {
      this.close();
      this.currentIndex += 1;
      this.openCurrentFile();
    }
  }

  openCurrentFile() {
    const suffix = this.currentIndex > 0 ? '-' + this.currentIndex : '';
    this.currentPath = path.join(this.outputDir, 'decoded-' + this.currentDate + suffix + '.ndjson');
    const exists = fs.existsSync(this.currentPath);
    this.currentBytes = exists ? fs.statSync(this.currentPath).size : 0;
    this.currentStream = fs.createWriteStream(this.currentPath, { flags: 'a' });
  }

  writeDecoded(entry) {
    this.rotateIfNeeded();
    const line = JSON.stringify(entry) + '\n';
    this.currentStream.write(line, 'utf8');
    this.currentBytes += Buffer.byteLength(line);
  }

  close() {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

module.exports = {
  SessionLogger,
};
