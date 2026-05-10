
/**
 * Session Tracker
 */
const BehaviourTrackerSession = {
    sessionId: null,
    visitorId: null,

    init: function () {
        this.visitorId = this.getOrCreateVisitorId();
        this.sessionId = this.getOrCreateSessionId();
        this.trackSessionStart();
        this.checkVisitorIdentification();

        // Session End is tricky in JS. We can try to hook into visibility change or unload, 
        // but it's not guaranteed. True "session end" usually calculated on backend via timeout.
        // We will send a beacon on unload if possible.
        window.addEventListener('beforeunload', this.handleUnload.bind(this));
    },

    /**
     * Get or create persistent Visitor ID (survives browser restarts).
     */
    getOrCreateVisitorId: function () {
        let visitorId = this.getCookie('bt_visitor_id');
        if (!visitorId) {
            visitorId = this.generateUUID();
            this.setCookie('bt_visitor_id', visitorId, 60 * 24 * 365 * 2);
            this.isNewVisitor = true;
        } else {
            this.setCookie('bt_visitor_id', visitorId, 60 * 24 * 365 * 2);
            this.isNewVisitor = false;
        }
        return visitorId;
    },

    /**
     * Get existing session ID from cookie or create new one
     */
    getOrCreateSessionId: function () {
        let sid = this.getCookie('bt_session_id');
        if (!sid) {
            sid = this.generateUUID();
            this.setCookie('bt_session_id', sid, 30); // 30 mins session usually
            this.isNewSession = true;
        } else {
            // Refresh cookie expiration
            this.setCookie('bt_session_id', sid, 30);
            this.isNewSession = false;
        }
        return sid;
    },

    /**
     * Link the anonymous visitor cookie to the logged-in customer once.
     */
    checkVisitorIdentification: function () {
        const customerId = (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest';
        if (customerId === 'guest' || customerId === 0 || customerId === '0') return;

        const identifiedKey = 'bt_identified_' + customerId;
        if (this.getCookie(identifiedKey)) return;

        this.setCookie(identifiedKey, '1', 60 * 24 * 365 * 2);
        this.sendData({
            event: 'visitor_identified',
            event_type: 'USER ACCOUNT EVENTS',
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            visitor_id: this.visitorId,
            customer_id: customerId,
            customer_email: (typeof bt_customer_email !== 'undefined') ? bt_customer_email : null,
            identification_method: 'login',
            is_new_visitor: this.isNewVisitor
        });
    },

    /**
     * Generate UUID
     */
    generateUUID: function () {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Set Cookie
     */
    setCookie: function (name, value, minutes) {
        var expires = "";
        if (minutes) {
            var date = new Date();
            date.setTime(date.getTime() + (minutes * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
    },

    /**
     * Get Cookie
     */
    getCookie: function (name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    /**
     * Track Session Start
     */
    trackSessionStart: function () {
        if (!this.isNewSession) return;

        // Check Configuration
        if (typeof bt_config !== 'undefined') {
            // Master toggle for Section 1
            if (bt_config.BT_SEC_SESSION_NAV == '0') return;
            // Toggle for Session Start Event
            if (bt_config.BT_EVENT_SESSION_START == '0') return;
        }

        const data = {
            event: 'session_start',
            event_type: 'USER SESSION & NAVIGATION EVENTS',
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            visitor_id: this.visitorId,
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            is_new_visitor: this.isNewVisitor,
            entry_page: window.location.pathname,
            referrer: document.referrer,
            device_type: this.getDeviceType(),
            // Add UTM params parsing here if needed
        };

        this.sendData(data);
    },

    /**
     * Handle Unload (Session End attempt)
     */
    handleUnload: function () {
        // Check Configuration
        if (typeof bt_config !== 'undefined') {
            // Master toggle for Section 1
            if (bt_config.BT_SEC_SESSION_NAV == '0') return;
            // Toggle for Session End Event
            if (bt_config.BT_EVENT_SESSION_END == '0') return;
        }

        // This is best effort. navigate.sendBeacon is better for unload.
        const data = {
            event: 'session_end', // This is technically page unload, but can signal end if no more events come
            event_type: 'USER SESSION & NAVIGATION EVENTS',
            timestamp: new Date().toISOString(),
            session_id: this.sessionId,
            visitor_id: this.visitorId,
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
        };

        // Buffer auto-injects site_id, but this direct unload beacon bypasses the buffer.
        if (typeof bt_config !== 'undefined' && (bt_config.BT_SITE_ID || bt_config.BT_WEBSITE_ID)) {
            data.site_id = bt_config.BT_SITE_ID || bt_config.BT_WEBSITE_ID;
        }

        // Use the shared standard envelope even for direct unload events.
        if (navigator.sendBeacon && typeof behaviourTrackerWebhookUrl !== 'undefined') {
            const payload = (typeof BehaviourTrackerBuffer !== 'undefined' && typeof BehaviourTrackerBuffer.buildEnvelope === 'function')
                ? JSON.stringify(BehaviourTrackerBuffer.buildEnvelope([data], true))
                : JSON.stringify(data);
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(behaviourTrackerWebhookUrl, blob);
        }
    },

    /**
     * Helper: Get Device Type
     */
    getDeviceType: function () {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return "tablet";
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return "mobile";
        }
        return "desktop";
    },

    /**
     * Send Data (Delegated to Buffer)
     */
    sendData: function (data) {
        if (typeof BehaviourTrackerBuffer !== 'undefined') {
            BehaviourTrackerBuffer.add(data);
        } else {
            BehaviourTrackerLogger.error('BehaviourTrackerBuffer not defined.');
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    // Check if this section is enabled
    if (typeof bt_config !== 'undefined' &&
        bt_config.BT_ENABLED_SECTIONS &&
        bt_config.BT_ENABLED_SECTIONS.session_navigation === false) {
        BehaviourTrackerLogger.log('Session/Navigation tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerSession.init();
});
