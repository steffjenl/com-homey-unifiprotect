'use strict';

const Homey = require('homey');

/**
 * Base class for UniFi Protect library classes.
 * 
 * Provides common functionality for all library classes, including
 * Homey instance management and shared initialization patterns.
 * 
 * @class BaseClass
 * @extends {Homey.SimpleClass}
 */
class BaseClass extends Homey.SimpleClass {
    /**
     * Create a new BaseClass instance.
     * 
     * @param {...*} props - Additional properties passed to parent class
     */
    constructor(...props) {
        super(...props);
        
        /**
         * Reference to the Homey application instance.
         * @type {Object|null}
         * @protected
         */
        this.homey = null;
    }

    /**
     * Set the Homey application instance.
     * 
     * This method should be called after instantiation to provide
     * the class with access to the Homey API and application context.
     * 
     * @param {Object} homey - The Homey application instance
     */
    setHomeyObject(homey) {
        this.homey = homey;
    }
}

module.exports = BaseClass;
