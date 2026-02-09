/**
 * Cart Tracker
 */
const BehaviourTrackerCart = {
    init: function () {
        this.trackAddToCart();
        this.trackCartVisuals();
        this.initAdvancedTracking();
        // PrestaShop 1.7+ uses prestashop object for events
        if (typeof prestashop !== 'undefined') {
            this.trackPrestaShopEvents();
        }
    },

    /**
     * Track Add to Cart (Button Clicks)
     * Fallback if PrestaShop events fail
     */
    trackAddToCart: function () {
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-to-cart');
            if (btn) {
                // We might not have full product info here immediately, 
                // but we can track the intent.
                // Ideally we rely on the 'updateCart' event from PrestaShop
            }
        });
    },

    /**
     * Track PrestaShop specific events
     */
    trackPrestaShopEvents: function () {
        // updateCart event covers add/remove/quantity changes
        prestashop.on('updateCart', (event) => {
            if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_UPDATE == '0') return;

            if (event && event.reason) {
                const data = {
                    event: 'cart_update', // Generic update, can be refined based on reason
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    reason: event.reason,
                    // event.resp contains cart info usually
                };

                // Refine event name
                if (event.reason.linkAction === 'add-to-cart') {
                    data.event = 'add_to_cart';
                } else if (event.reason.linkAction === 'delete-from-cart') {
                    data.event = 'remove_from_cart';
                }

                this.sendData(data);
            }
        });
    },

    /**
     * Track Cart View
     */
    trackCartVisuals: function () {
        if (document.body.id === 'cart') {
            if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_VIEW == '0') return;

            const data = {
                event: 'cart_view',
                timestamp: new Date().toISOString(),
                session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                page_url: window.location.href
            };
            this.sendData(data);
        }
    },

    /**
     * Track Quantity Changes
     */
    trackQuantityChange: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_QUANTITY_CHANGE == '0') return;

        document.body.addEventListener('change', (e) => {
            const qtyInput = e.target.closest('.cart-line-product-quantity input[type="number"]');
            if (qtyInput) {
                const data = {
                    event: 'cart_quantity_change',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    new_quantity: qtyInput.value
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Coupon Operations
     */
    trackCouponOperations: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_COUPON_APPLY == '0') return;

        // Track coupon application
        const couponForms = document.querySelectorAll('[data-action="show-voucher"], #promo-code');
        couponForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const couponInput = form.querySelector('[name="discount_name"]');
                const couponCode = couponInput?.value;

                if (couponCode) {
                    const data = {
                        event: 'apply_coupon',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        coupon_code: couponCode
                    };
                    this.sendData(data);
                }
            });
        });

        // Track coupon removal
        document.body.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-voucher"]');
            if (removeBtn) {
                const data = {
                    event: 'remove_coupon',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId()
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Initialize Advanced Cart Tracking
     */
    initAdvancedTracking: function () {
        this.trackQuantityChange();
        this.trackCouponOperations();
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
    BehaviourTrackerCart.init();
});
