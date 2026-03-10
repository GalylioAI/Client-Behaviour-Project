
/**
 * Navigation Tracker
 */
const BehaviourTrackerNavigation = {
    init: function () {
        this.trackPageView();
        this.initScrollTracking();
        this.initClickTracking();
    },

    /**
     * Track Page View
     */
    trackPageView: function () {
        // Check Configuration
        if (typeof bt_config !== 'undefined') {
            if (bt_config.BT_SEC_SESSION_NAV == '0') return;
            if (bt_config.BT_EVENT_PAGE_VIEW == '0') return;
        }

        // Wait for session to be initialized if needed, though usually sync
        const data = {
            event: 'page_view',
            event_type: 'USER SESSION & NAVIGATION EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            customer_email: (typeof bt_customer_email !== 'undefined') ? bt_customer_email : null,
            page_type: (typeof bt_page_type !== 'undefined') ? bt_page_type : 'unknown',
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            viewport_size: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language
        };

        // Conditionally add elements based on config
        if (typeof bt_config === 'undefined' || bt_config.BT_EL_PV_URL == '1') {
            data.page_url = window.location.pathname + window.location.search;
        }
        if (typeof bt_config === 'undefined' || bt_config.BT_EL_PV_TITLE == '1') {
            data.page_title = document.title;
        }
        if (typeof bt_config === 'undefined' || bt_config.BT_EL_PV_REF == '1') {
            data.referrer_url = document.referrer;
        }
        if (typeof bt_config === 'undefined' || bt_config.BT_EL_PV_UA == '1') {
            data.browser = navigator.userAgent; // Simplified browser string
            data.device_type = BehaviourTrackerSession.getDeviceType(); // Derived from UA
        }

        this.sendData(data);
    },

    /**
     * Scroll Tracking
     */
    initScrollTracking: function () {
        // Check Config
        if (typeof bt_config !== 'undefined') {
            if (bt_config.BT_SEC_SESSION_NAV == '0') return;
            if (bt_config.BT_EVENT_SCROLL_DEPTH == '0') return;
        }

        let maxScroll = 0;
        let sentDepths = { 25: false, 50: false, 75: false, 100: false };

        window.addEventListener('scroll', this.throttle(() => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / docHeight) * 100);

            if (scrollPercent > maxScroll) maxScroll = scrollPercent;

            [25, 50, 75, 100].forEach(threshold => {
                if (scrollPercent >= threshold && !sentDepths[threshold]) {
                    sentDepths[threshold] = true;
                    this.sendScrollEvent(threshold);
                }
            });
        }, 500));
    },

    sendScrollEvent: function (percentage) {
        const data = {
            event: 'scroll_depth',
            event_type: 'USER SESSION & NAVIGATION EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            page_url: window.location.pathname,
            scroll_percentage: percentage
        };
        this.sendData(data);
    },

    /**
     * Click Tracking
     */
    initClickTracking: function () {
        // Check Config
        if (typeof bt_config !== 'undefined') {
            if (bt_config.BT_SEC_SESSION_NAV == '0') return;
            if (bt_config.BT_EVENT_CLICK == '0') return;
        }

        const defaultSelectors = [
            'a',
            'button',
            'input[type="submit"]',
            'input[type="button"]',
            '[role="button"]',
            '.btn',
            '.button',
            '.cta'
        ];

        const extraSelectors = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS.click_elements))
            ? bt_config.BT_SELECTORS.click_elements
            : [];

        const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
        const selectorString = allSelectors.join(',');

        document.addEventListener('click', (e) => {
            const target = e.target.closest(selectorString);
            if (target) {
                this.sendClickEvent(target, e);
            }
        });
    },

    sendClickEvent: function (element, event) {
        const data = {
            event: 'click',
            event_type: 'USER SESSION & NAVIGATION EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            page_url: window.location.pathname,
            element_type: element.tagName.toLowerCase(),
            element_id: element.id || null,
            element_text: element.innerText ? element.innerText.substring(0, 50) : null, // Limit text
            element_classes: element.className,
            click_coordinates: { x: event.clientX, y: event.clientY }
        };
        this.sendData(data);
    },

    /**
     * Utility: Throttle
     */
    throttle: function (func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
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

    BehaviourTrackerNavigation.init();
});
