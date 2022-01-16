'use strict';

const Homey = require('homey');
const UfvConstants = require('./constants');

class BaseClass extends Homey.SimpleClass {
    constructor(...props) {
        super(...props);
        this.homey = null;
    }

    setHomeyObject(homey) {
        this.homey = homey;
    }

}

module.exports = BaseClass;
