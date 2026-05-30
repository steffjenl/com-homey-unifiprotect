'use strict';

class SmartDetectionEvent {

  constructor(detectionTime, detectionTypes, detectionScore, detectionEventId) {
    this.detectionTime = detectionTime;
    this.detectionTypes = detectionTypes;
    this.detectionScore = detectionScore;
    this.detectionEventId = detectionEventId;
    // Types already triggered for this event, so each fires once (no flood).
    this.triggered = new Set();
  }


}

module.exports = SmartDetectionEvent;