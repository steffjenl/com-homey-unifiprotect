
class SmartDetectionEvent {
    detectionTime   = null;
    detectionTypes = null;
    detectionScore  = null;
    detectionEventId = null;
    constructor(detectionTime, detectionTypes, detectionScore, detectionEventId) {
        this.detectionTime = detectionTime;
        this.detectionTypes = detectionTypes;
        this.detectionScore = detectionScore;
        this.detectionEventId = detectionEventId;
    }

    get detectionTime() {
        return this.detectionTime;
    }
    get detectionTypes() {
        return this.detectionTypes;
    }
    get detectionScore() {
        return this.detectionScore;
    }
    get detectionEventId() {
        return this.detectionEventId;
    }

}

module.exports = SmartDetectionEvent;