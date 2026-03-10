/**
 * Behaviour Tracker Buffer Utility
 * Handles batching of events and sending them to the server.
 */
const BehaviourTrackerBuffer = {
    buffer: [],
    config: {
        interval: 10000, // Default 10 seconds (safer default)
        batchSize: 50,   // Increased batch size
        webhookUrl: '',
        maxBuffer: 500,  // Max events to hold in memory
        retryAttempts: 3 // Retry failed batches
    },
    timer: null,
    isFlushing: false,

    /**
     * Initialize the buffer
     * @param {object} config 
     */
    init: function (config = {}) {
        // Merge defaults with provided config
        if (config.BT_BUFFER_INTERVAL) {
            let interval = parseInt(config.BT_BUFFER_INTERVAL, 10);
            if (isNaN(interval) || interval < 1) interval = 10; // Enforce minimum 1s
            this.config.interval = interval * 1000;
        }

        if (typeof behaviourTrackerWebhookUrl !== 'undefined') {
            this.config.webhookUrl = behaviourTrackerWebhookUrl;
        }

        // Add debug mode
        this.debug = config.BT_DEBUG_MODE === '1';

        // Start the timer
        this.startTimer();

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.handleUnload();
        });

        if (this.debug) BehaviourTrackerLogger.log('Buffer initialized with interval: ' + this.config.interval + 'ms');
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
     * Automatically injects visitor_id into every event
     * @param {object} eventData 
     */
    add: function (eventData) {
        if (this.buffer.length >= this.config.maxBuffer) {
            // Drop oldest event if buffer full (prevent memory leak)
            this.buffer.shift();
            if (this.debug) BehaviourTrackerLogger.warn('Buffer full, dropping oldest event');
        }

        // Auto-inject visitor_id if not already present
        if (!eventData.visitor_id && typeof BehaviourTrackerSession !== 'undefined' && BehaviourTrackerSession.visitorId) {
            eventData.visitor_id = BehaviourTrackerSession.visitorId;
        }

        this.buffer.push(eventData);
        if (this.debug) BehaviourTrackerLogger.log('Event added. Buffer size: ' + this.buffer.length);

        // Optional: Flush immediately if buffer gets too full
        if (this.buffer.length >= this.config.batchSize) {
            if (this.debug) BehaviourTrackerLogger.log('Batch size reached, flushing...');
            this.flush();
        }
    },

    /**
     * Flush buffer to server
     */
    flush: function () {
        if (this.buffer.length === 0 || this.isFlushing) return;

        this.isFlushing = true;

        // Take a snapshot of current buffer
        const eventsToSend = [...this.buffer];
        // DO NOT clear buffer yet. Wait for success or use optimistic sending with retry queue.
        // Simple approach: Clear buffer now, but in real app use persistent queue.
        // For this user: we clear now to avoid duplicate sending if fetch is slow.
        // If fetch fails, we re-add them.
        this.buffer = [];

        this.sendBatch(eventsToSend);
    },

    /**
     * Send batch of events
     * @param {Array} events 
     * @param {number} retryCount 
     */
    sendBatch: function (events, retryCount = 0) {
        if (!this.config.webhookUrl) {
            BehaviourTrackerLogger.error('Webhook URL not defined.');
            this.isFlushing = false;
            return;
        }

        if (this.debug) BehaviourTrackerLogger.log(`Flushing ${events.length} events to server...`);

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
        }).then(() => {
            // Success (or opaque response)
            this.isFlushing = false;
            if (this.debug) BehaviourTrackerLogger.log('Batch sent successfully');
        }).catch(err => {
            BehaviourTrackerLogger.error('Failed to send event batch', err);

            // Retry logic
            if (retryCount < this.config.retryAttempts) {
                setTimeout(() => {
                    this.sendBatch(events, retryCount + 1);
                }, 2000 * (retryCount + 1)); // Exponential backoffish
            } else {
                // Give up, maybe re-add to buffer? 
                // Careful: this changes order and might cause infinite loops if persistent error.
                // For now, accept loss after retries to keep complexity low.
                this.isFlushing = false;
            }
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
            const success = navigator.sendBeacon(this.config.webhookUrl, payload);
            if (!success) {
                // Determine if we should fallback? usually sendBeacon returns false if queue full or data too big
                // Fallback to synchronous XHR or fetch keepalive
                this.fallbackUnload(payload);
            }
        } else {
            this.fallbackUnload(payload);
        }
    },

    fallbackUnload: function (payload) {
        fetch(this.config.webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        });
    }
};

// Auto-init if config is available
document.addEventListener('DOMContentLoaded', function () {
    if (typeof bt_config !== 'undefined') {
        BehaviourTrackerBuffer.init(bt_config);
    }
});
