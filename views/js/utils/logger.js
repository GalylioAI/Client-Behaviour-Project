
/**
 * Behaviour Tracker Logger Utility
 */
const BehaviourTrackerLogger = {
    /**
     * Log an information message
     * @param {string} message 
     * @param {object} data 
     */
    log: function (message, data = null) {
        if (data) {
            console.log(`[BehaviourTracker] ${message}`, data);
        } else {
            console.log(`[BehaviourTracker] ${message}`);
        }
    },

    /**
     * Log an error message
     * @param {string} message 
     * @param {object} error 
     */
    error: function (message, error = null) {
        if (error) {
            console.error(`[BehaviourTracker] Error: ${message}`, error);
        } else {
            console.error(`[BehaviourTracker] Error: ${message}`);
        }
    },

    /**
     * Log a warning (e.g. data missing)
     * @param {string} message 
     */
    warn: function (message) {
        console.warn(`[BehaviourTracker] Warning: ${message}`);
    }
};
