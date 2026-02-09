/**
 * Marketing & Promotional Tracker
 */
const BehaviourTrackerMarketing = {
    init: function () {
        this.trackNewsletterSignup();
        this.trackPopupInteractions();
        this.trackBannerClicks();
        this.trackSocialShare();
    },

    /**
     * Track Newsletter Signup
     */
    trackNewsletterSignup: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_NEWSLETTER_SIGNUP == '0') return;

        const newsletterForms = document.querySelectorAll('#newsletter-subscription, [action*="newsletter"]');

        newsletterForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const email = form.querySelector('[name="email"]')?.value;

                const data = {
                    event: 'newsletter_signup',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    email: email,
                    signup_location: window.location.pathname
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Track Popup Interactions
     */
    trackPopupInteractions: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_POPUP_INTERACTION == '0') return;

        // Watch for modal/popup opens
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && (node.classList.contains('modal') || node.classList.contains('popup'))) {
                        const popupId = node.id || 'unknown';

                        const data = {
                            event: 'popup_opened',
                            timestamp: new Date().toISOString(),
                            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                            popup_id: popupId
                        };
                        this.sendData(data);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    /**
     * Track Banner Clicks
     */
    trackBannerClicks: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_BANNER_CLICK == '0') return;

        document.body.addEventListener('click', (e) => {
            const banner = e.target.closest('.banner, .promo-banner, [data-banner]');
            if (banner) {
                const bannerId = banner.id || banner.dataset.banner || 'unknown';
                const bannerHref = e.target.closest('a')?.href;

                const data = {
                    event: 'banner_click',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    banner_id: bannerId,
                    banner_url: bannerHref
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Social Sharing
     */
    trackSocialShare: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SOCIAL_SHARE == '0') return;

        document.body.addEventListener('click', (e) => {
            const shareBtn = e.target.closest('.social-share, [data-action="share"]');
            if (shareBtn) {
                const platform = shareBtn.dataset.share || shareBtn.className.match(/(facebook|twitter|pinterest|instagram)/i)?.[0] || 'unknown';

                const data = {
                    event: 'social_share',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    platform: platform,
                    page_url: window.location.href
                };
                this.sendData(data);
            }
        });
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
    BehaviourTrackerMarketing.init();
});
