/**
 * Behaviour Tracker Buffer Utility
 * Handles batching of events and sending a standard payload to the server.
 */
const BehaviourTrackerBuffer = {
    buffer: [],
    config: {
        interval: 10000,
        batchSize: 50,
        webhookUrl: '',
        maxBuffer: 500,
        retryAttempts: 3,
        schemaVersion: '1.0',
        platform: 'prestashop',
        source: 'client_js',
        writeKey: ''
    },
    timer: null,
    isFlushing: false,
    visitorId: null,
    debug: false,
    storageKey: 'bt_event_buffer_v1',

    /**
     * Initialize the buffer
     * @param {object} config
     */
    init: function (config = {}) {
        if (config.BT_BUFFER_INTERVAL) {
            let interval = parseInt(config.BT_BUFFER_INTERVAL, 10);
            if (isNaN(interval) || interval < 1) interval = 10;
            this.config.interval = interval * 1000;
        }

        if (typeof behaviourTrackerWebhookUrl !== 'undefined') {
            this.config.webhookUrl = behaviourTrackerWebhookUrl;
        }

        this.config.platform = config.BT_PLATFORM || this.config.platform;
        this.config.source = config.BT_SOURCE || this.config.source;
        this.config.schemaVersion = config.BT_SCHEMA_VERSION || this.config.schemaVersion;
        this.config.writeKey = config.BT_WRITE_KEY || config.BT_PUBLIC_WRITE_KEY || this.config.writeKey;
        this.debug = config.BT_DEBUG_MODE === '1' || config.BT_DEBUG_MODE === true;
        this.visitorId = this.resolveVisitorId();
        this.loadPersistedBuffer();

        this.startTimer();

        window.addEventListener('beforeunload', () => {
            this.handleUnload();
        });

        if (this.debug) BehaviourTrackerLogger.log('Buffer initialized with interval: ' + this.config.interval + 'ms');
    },

    startTimer: function () {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush();
        }, this.config.interval);
    },

    /**
     * Add event to buffer after converting it to the shared event schema.
     * @param {object} eventData
     */
    add: function (eventData) {
        if (this.buffer.length >= this.config.maxBuffer) {
            this.buffer.shift();
            if (this.debug) BehaviourTrackerLogger.warn('Buffer full, dropping oldest event');
        }

        this.buffer.push(this.normalizeEvent(eventData));
        this.persistBuffer();
        if (this.debug) BehaviourTrackerLogger.log('Event added. Buffer size: ' + this.buffer.length);

        if (this.buffer.length >= this.config.batchSize) {
            if (this.debug) BehaviourTrackerLogger.log('Batch size reached, flushing...');
            this.flush();
        }
    },

    flush: function () {
        if (this.buffer.length === 0 || this.isFlushing) return;

        this.isFlushing = true;
        const eventsToSend = [...this.buffer];
        this.buffer = [];
        this.persistBuffer();

        this.sendBatch(eventsToSend);
    },

    /**
     * Send a standard batch envelope.
     * @param {Array} events
     * @param {number} retryCount
     */
    sendBatch: function (events, retryCount = 0) {
        if (!this.config.webhookUrl) {
            BehaviourTrackerLogger.error('Webhook URL not defined.');
            this.restoreEvents(events);
            this.isFlushing = false;
            return;
        }

        const payload = this.buildEnvelope(events, false);

        if (this.debug) BehaviourTrackerLogger.log(`Flushing ${events.length} events to server...`);

        fetch(this.config.webhookUrl, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP ${response.status}: ${text.slice(0, 250)}`);
                });
            }
            return response;
        }).then(() => {
            this.isFlushing = false;
            this.persistBuffer();
            if (this.debug) BehaviourTrackerLogger.log('Batch sent successfully');
        }).catch(err => {
            BehaviourTrackerLogger.error('Failed to send event batch', err);

            if (retryCount < this.config.retryAttempts) {
                setTimeout(() => {
                    this.sendBatch(events, retryCount + 1);
                }, 2000 * (retryCount + 1));
            } else {
                this.restoreEvents(events);
                this.isFlushing = false;
            }
        });
    },

    restoreEvents: function (events) {
        if (!Array.isArray(events) || events.length === 0) return;

        const room = Math.max(this.config.maxBuffer - this.buffer.length, 0);
        const restored = room > 0 ? events.slice(-room) : [];
        this.buffer = restored.concat(this.buffer);
        this.persistBuffer();

        if (this.debug) {
            BehaviourTrackerLogger.warn(`Restored ${restored.length} unsent events. Buffer size: ${this.buffer.length}`);
        }
    },

    persistBuffer: function () {
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.buffer.slice(-this.config.maxBuffer)));
        } catch (err) {
            if (this.debug) BehaviourTrackerLogger.warn('Could not persist event buffer', err);
        }
    },

    loadPersistedBuffer: function () {
        try {
            if (!window.localStorage) return;
            const stored = window.localStorage.getItem(this.storageKey);
            if (!stored) return;
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                this.buffer = parsed.filter(event => this.isPlainObject(event)).slice(-this.config.maxBuffer);
            }
        } catch (err) {
            this.buffer = [];
            if (this.debug) BehaviourTrackerLogger.warn('Could not load persisted event buffer', err);
        }
    },

    handleUnload: function () {
        if (this.buffer.length === 0) return;

        const payload = JSON.stringify(this.buildEnvelope(this.buffer, true));
        this.buffer = [];
        this.persistBuffer();

        if (navigator.sendBeacon && this.config.webhookUrl) {
            const success = navigator.sendBeacon(this.config.webhookUrl, payload);
            if (!success) {
                this.fallbackUnload(payload);
            }
        } else {
            this.fallbackUnload(payload);
        }
    },

    fallbackUnload: function (payload) {
        fetch(this.config.webhookUrl, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        });
    },

    buildEnvelope: function (events, isUnload = false) {
        return {
            schema_version: this.config.schemaVersion,
            site_id: this.getSiteId(),
            platform: this.getPlatform(),
            write_key: this.getWriteKey(),
            source: this.config.source,
            sent_at: new Date().toISOString(),
            batch_timestamp: new Date().toISOString(),
            is_unload: !!isUnload,
            events: events.map(event => this.isStandardEvent(event) ? event : this.normalizeEvent(event))
        };
    },

    normalizeEvent: function (eventData = {}) {
        const raw = this.isPlainObject(eventData) ? eventData : {};
        const eventName = raw.event_name || raw.event || raw.name || 'unknown';
        const eventCategory = this.normalizeCategory(raw.event_category || raw.event_type || raw.category, eventName);
        const page = this.extractPage(raw);
        const context = this.extractContext(raw);

        return {
            event_id: raw.event_id || this.generateUUID(),
            event_name: eventName,
            event_category: eventCategory,
            timestamp: raw.timestamp || new Date().toISOString(),
            session_id: raw.session_id || this.resolveSessionId(),
            visitor_id: raw.visitor_id || raw.user_id || this.resolveVisitorId(),
            customer_id: raw.customer_id || (typeof bt_customer_id !== 'undefined' ? bt_customer_id : 'guest'),
            customer_email: raw.customer_email || (typeof bt_customer_email !== 'undefined' ? bt_customer_email : null),
            page: page,
            properties: this.extractProperties(raw),
            context: context
        };
    },

    isStandardEvent: function (eventData) {
        return this.isPlainObject(eventData)
            && typeof eventData.event_name !== 'undefined'
            && typeof eventData.event_category !== 'undefined'
            && this.isPlainObject(eventData.properties)
            && this.isPlainObject(eventData.page);
    },

    extractPage: function (raw) {
        const page = this.isPlainObject(raw.page) ? { ...raw.page } : {};
        if (!page.url) page.url = raw.page_url || raw.url || (window.location ? window.location.pathname + window.location.search : '');
        if (!page.type) page.type = raw.page_type || (typeof bt_page_type !== 'undefined' ? bt_page_type : 'unknown');
        if (!page.title) page.title = raw.page_title || (document ? document.title : '');
        if (!page.referrer) page.referrer = raw.referrer_url || raw.referrer || (document ? document.referrer : '');
        return page;
    },

    extractContext: function (raw) {
        const context = this.isPlainObject(raw.context) ? { ...raw.context } : {};
        this.copyDefined(context, 'screen_resolution', raw.screen_resolution);
        this.copyDefined(context, 'viewport_size', raw.viewport_size);
        this.copyDefined(context, 'language', raw.language);
        this.copyDefined(context, 'device_type', raw.device_type);
        this.copyDefined(context, 'user_agent', raw.browser);
        return context;
    },

    extractProperties: function (raw) {
        const props = {};
        if (this.isPlainObject(raw.properties)) Object.assign(props, raw.properties);
        if (this.isPlainObject(raw.data)) Object.assign(props, raw.data);

        const reserved = [
            'schema_version', 'event_id', 'event', 'event_name', 'name', 'event_type', 'event_category', 'category',
            'timestamp', 'session_id', 'visitor_id', 'user_id', 'customer_id', 'customer_email',
            'page', 'page_url', 'url', 'page_type', 'page_title', 'referrer_url', 'referrer',
            'screen_resolution', 'viewport_size', 'language', 'device_type', 'browser',
            'site_id', 'siteId', 'website_id', 'write_key', 'public_write_key', 'server_secret_key', 'api_key',
            'context', 'properties', 'data'
        ];

        Object.keys(raw).forEach(key => {
            if (reserved.indexOf(key) === -1 && typeof raw[key] !== 'undefined') {
                props[key] = raw[key];
            }
        });

        return props;
    },

    normalizeCategory: function (category, eventName) {
        const value = (category || '').toString().toLowerCase();
        const name = (eventName || '').toString().toLowerCase();

        if (value.includes('session') || value.includes('navigation')) return 'session_navigation';
        if (value.includes('product')) return 'product';
        if (value.includes('cart')) return 'cart';
        if (value.includes('checkout') || value.includes('purchase') || value.includes('payment')) return 'checkout';
        if (value.includes('account') || value.includes('user')) return 'account';
        if (value.includes('search') || value.includes('filter')) return 'search';
        if (value.includes('marketing') || value.includes('promotional')) return 'marketing';

        if (name.includes('product')) return 'product';
        if (name.includes('cart') || name.includes('coupon')) return 'cart';
        if (name.includes('checkout') || name.includes('purchase') || name.includes('payment') || name.includes('shipping')) return 'checkout';
        if (name.includes('login') || name.includes('logout') || name.includes('registration') || name.includes('password') || name.includes('profile') || name.includes('wishlist') || name.includes('address')) return 'account';
        if (name.includes('search') || name.includes('filter') || name.includes('sort')) return 'search';
        if (name.includes('newsletter') || name.includes('banner') || name.includes('popup') || name.includes('social')) return 'marketing';

        return 'custom';
    },

    getSiteId: function () {
        if (typeof bt_config !== 'undefined') {
            return bt_config.BT_SITE_ID || bt_config.BT_WEBSITE_ID || '';
        }
        return '';
    },

    getPlatform: function () {
        if (typeof bt_config !== 'undefined') {
            return bt_config.BT_PLATFORM || this.config.platform;
        }
        return this.config.platform;
    },

    getWriteKey: function () {
        if (typeof bt_config !== 'undefined') {
            return bt_config.BT_WRITE_KEY || bt_config.BT_PUBLIC_WRITE_KEY || this.config.writeKey || '';
        }
        return this.config.writeKey || '';
    },

    getSelectors: function (key, defaults) {
        const base = Array.isArray(defaults) ? defaults : [];
        const extra = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS[key]))
            ? bt_config.BT_SELECTORS[key]
            : [];

        return Array.from(new Set(base.concat(extra))).join(',');
    },

    resolveSessionId: function () {
        if (typeof BehaviourTrackerSession !== 'undefined') {
            if (BehaviourTrackerSession.sessionId) return BehaviourTrackerSession.sessionId;
            if (typeof BehaviourTrackerSession.getOrCreateSessionId === 'function') {
                return BehaviourTrackerSession.getOrCreateSessionId();
            }
        }
        return this.getCookie('bt_session_id') || '';
    },

    resolveVisitorId: function () {
        if (typeof BehaviourTrackerSession !== 'undefined' && BehaviourTrackerSession.visitorId) {
            return BehaviourTrackerSession.visitorId;
        }

        let visitorId = this.getCookie('bt_visitor_id');
        if (!visitorId) {
            visitorId = this.generateUUID();
        }
        this.setCookie('bt_visitor_id', visitorId, 60 * 24 * 365 * 2);
        return visitorId;
    },

    generateUUID: function () {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    setCookie: function (name, value, minutes) {
        let expires = '';
        if (minutes) {
            const date = new Date();
            date.setTime(date.getTime() + (minutes * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
    },

    getCookie: function (name) {
        const nameEQ = name + '=';
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i];
            while (cookie.charAt(0) === ' ') cookie = cookie.substring(1, cookie.length);
            if (cookie.indexOf(nameEQ) === 0) return cookie.substring(nameEQ.length, cookie.length);
        }
        return null;
    },

    copyDefined: function (target, key, value) {
        if (typeof value !== 'undefined' && value !== null && value !== '') {
            target[key] = value;
        }
    },

    isPlainObject: function (value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }
};

document.addEventListener('DOMContentLoaded', function () {
    if (typeof bt_config !== 'undefined') {
        BehaviourTrackerBuffer.init(bt_config);
    }
});
