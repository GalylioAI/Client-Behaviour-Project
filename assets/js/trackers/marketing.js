/**
 * Marketing & Promotions Tracker
 * WordPress Integration
 */
const BehaviourTrackerMarketing = {
    init: function () {
        this.trackNewsletterSignups();
        this.trackBannerClicks();
        this.trackSocialShares();
    },

    /**
     * Track newsletter signups
     */
    trackNewsletterSignups: function () {
        // Common newsletter form selectors
        document.querySelectorAll('form.newsletter, form[class*="newsletter"], form.mc4wp-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.trackNewsletter(form);
            });
        });
    },

    /**
     * Track Newsletter
     */
    trackNewsletter: function (form) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_NEWSLETTER_SIGNUP == '0') return;

        const emailInput = form.querySelector('[type="email"], [name="email"], [name="EMAIL"]');
        const email = emailInput ? emailInput.value : null;

        // Determine source
        let source = 'footer';
        if (form.closest('.popup, .modal')) {
            source = 'popup';
        } else if (form.closest('aside, .sidebar')) {
            source = 'sidebar';
        }

        const data = {
            event: 'newsletter_subscription',
            event_type: 'PROMOTIONAL & MARKETING EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            email: email,
            source: source
        };

        this.sendData(data);
    },

    /**
     * Track banner clicks
     */
    trackBannerClicks: function () {
        // Track clicks on promotional banners
        document.body.addEventListener('click', (e) => {
            const banner = e.target.closest('[class*="banner"], [class*="promo"], .promotion');
            if (banner) {
                this.trackBanner(banner, e.target);
            }
        });
    },

    /**
     * Track Banner Click
     */
    trackBanner: function (banner, clickedElement) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_BANNER_CLICK == '0') return;

        const bannerId = banner.id || banner.className;
        const bannerText = banner.innerText?.substring(0, 100);
        const destinationUrl = clickedElement.href || null;

        const data = {
            event: 'banner_click',
            event_type: 'PROMOTIONAL & MARKETING EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            banner_id: bannerId,
            banner_text: bannerText,
            destination_url: destinationUrl
        };

        this.sendData(data);
    },

    /**
     * Track social shares
     */
    trackSocialShares: function () {
        // Track clicks on social share buttons
        document.body.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('[class*="share"], [class*="social-"]');
            if (shareBtn && (shareBtn.href || shareBtn.dataset.network)) {
                this.trackSocialShare(shareBtn);
            }
        });
    },

    /**
     * Track Social Share
     */
    trackSocialShare: function (button) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SOCIAL_SHARE == '0') return;

        // Detect platform from class or href
        let platform = 'unknown';
        const classes = button.className.toLowerCase();
        const href = button.href?.toLowerCase() || '';

        if (classes.includes('facebook') || href.includes('facebook')) {
            platform = 'facebook';
        } else if (classes.includes('twitter') || href.includes('twitter')) {
            platform = 'twitter';
        } else if (classes.includes('pinterest') || href.includes('pinterest')) {
            platform = 'pinterest';
        } else if (classes.includes('whatsapp') || href.includes('whatsapp')) {
            platform = 'whatsapp';
        } else if (classes.includes('linkedin') || href.includes('linkedin')) {
            platform = 'linkedin';
        }

        const data = {
            event: 'social_share',
            event_type: 'PROMOTIONAL & MARKETING EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            platform: platform,
            share_url: window.location.href
        };

        this.sendData(data);
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
        bt_config.BT_ENABLED_SECTIONS.marketing === false) {
        BehaviourTrackerLogger.log('Marketing tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerMarketing.init();
});
