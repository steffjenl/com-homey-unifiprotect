'use strict';

class SmartDetectionEvent {

  constructor(detectionTime, detectionTypes, detectionScore, detectionEventId) {
    this.detectionTime = detectionTime;
    this.detectionTypes = detectionTypes;
    this.detectionScore = detectionScore;
    this.detectionEventId = detectionEventId;
  }


}

module.exports = SmartDetectionEvent;