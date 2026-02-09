/**
 * Behaviour Tracker Buffer Utility
 * Handles batching of events and sending them to the server.
 */
const BehaviourTrackerBuffer = {
    buffer: [],
    config: {
        interval: 5000, // Default 5 seconds
        batchSize: 20,  // Default batch size
        webhookUrl: ''
    },
    timer: null,

    /**
     * Initialize the buffer
     * @param {object} config 
     */
    init: function (config = {}) {
        // Merge defaults with provided config
        if (config.BT_BUFFER_INTERVAL) {
            this.config.interval = parseInt(config.BT_BUFFER_INTERVAL, 10) * 1000;
        }
        if (typeof behaviourTrackerWebhookUrl !== 'undefined') {
            this.config.webhookUrl = behaviourTrackerWebhookUrl;
        }

        // Start the timer
        this.startTimer();

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.handleUnload();
        });

        BehaviourTrackerLogger.log('Buffer initialized with interval: ' + this.config.interval + 'ms');
    },

    /**
     * Start the flush timer
     */
    startTimer: function () {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush();
        }, this.config.interval);
    },

    /**
     * Add event to buffer
     * @param {object} eventData 
     */
    add: function (eventData) {
        this.buffer.push(eventData);
        BehaviourTrackerLogger.log('Event added to buffer', eventData);

        // Optional: Flush immediately if buffer gets too full
        if (this.buffer.length >= this.config.batchSize) {
            this.flush();
        }
    },

    /**
     * Flush buffer to server
     */
    flush: function () {
        if (this.buffer.length === 0) return;

        const eventsToSend = [...this.buffer];
        this.buffer = []; // Clear buffer immediately

        this.sendBatch(eventsToSend);
    },

    /**
     * Send batch of events
     * @param {Array} events 
     */
    sendBatch: function (events) {
        if (!this.config.webhookUrl) {
            BehaviourTrackerLogger.error('Webhook URL not defined.');
            return;
        }

        BehaviourTrackerLogger.log(`Flushing ${events.length} events to server...`);

        fetch(this.config.webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                batch_timestamp: new Date().toISOString(),
                events: events
            })
        }).catch(err => {
            BehaviourTrackerLogger.error('Failed to send event batch', err);
            // Optional: Retry logic or put back in buffer (careful of loop)
        });
    },

    /**
     * Handle unload (navigator.sendBeacon)
     */
    handleUnload: function () {
        if (this.buffer.length === 0) return;

        const payload = JSON.stringify({
            batch_timestamp: new Date().toISOString(),
            events: this.buffer,
            is_unload: true
        });

        if (navigator.sendBeacon && this.config.webhookUrl) {
            navigator.sendBeacon(this.config.webhookUrl, payload);
            BehaviourTrackerLogger.log('Sent remaining events via Beacon');
        } else {
            // Fallback for older browsers (might not complete)
            fetch(this.config.webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true // Important for unload
            });
        }
    }
};

// Auto-init if config is available
document.addEventListener('DOMContentLoaded', function () {
    if (typeof bt_config !== 'undefined') {
        BehaviourTrackerBuffer.init(bt_config);
    }
});
