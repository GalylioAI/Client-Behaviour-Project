/**
 * Cart Tracker
 */
const BehaviourTrackerCart = {
    recentAddToCart: {},

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
                this.trackAddToCartButton(btn);
            }
        });
    },

    trackAddToCartButton: function (button) {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_UPDATE == '0') return;

        const form = button.closest('form');
        const productId = button.getAttribute('data-id-product') ||
            button.getAttribute('data-product-id') ||
            form?.querySelector('[name="id_product"]')?.value ||
            form?.querySelector('[name="id_product_attribute"]')?.value ||
            '';
        const productName = button.getAttribute('data-product-name') ||
            document.querySelector('h1, .h1, .product-title')?.innerText ||
            button.closest('.product-miniature')?.querySelector('.product-title, h2, h3')?.innerText ||
            '';
        const quantity = form?.querySelector('[name="qty"], [name="quantity_wanted"]')?.value || 1;

        if (this.isDuplicateAddToCart(productId || productName || 'unknown')) {
            return;
        }

        this.sendData({
            event: 'add_to_cart',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            product_id: productId,
            product_name: productName,
            quantity_added: parseInt(quantity, 10) || 1,
            source: document.body.id === 'product' ? 'product_page' : 'product_list'
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
                    event_type: 'SHOPPING CART EVENTS',
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

                const productId = event.reason.idProduct || event.reason.id_product || event.reason.idProductAttribute || '';
                if (data.event === 'add_to_cart' && this.isDuplicateAddToCart(productId || 'unknown')) {
                    return;
                }

                if (productId) {
                    data.product_id = productId;
                }

                this.sendData(data);
            }
        });
    },

    isDuplicateAddToCart: function (key) {
        const now = Date.now();
        const last = this.recentAddToCart[key] || 0;
        this.recentAddToCart[key] = now;
        return now - last < 1500;
    },

    /**
     * Track Cart View
     */
    trackCartVisuals: function () {
        if (document.body.id === 'cart') {
            if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_VIEW == '0') return;

            const data = {
                event: 'cart_view',
                event_type: 'SHOPPING CART EVENTS',
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
                    event_type: 'SHOPPING CART EVENTS',
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
                        event_type: 'SHOPPING CART EVENTS',
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
                    event_type: 'SHOPPING CART EVENTS',
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
    // Check if this section is enabled
    if (typeof bt_config !== 'undefined' &&
        bt_config.BT_ENABLED_SECTIONS &&
        bt_config.BT_ENABLED_SECTIONS.cart === false) {
        BehaviourTrackerLogger.log('Cart tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerCart.init();
});
