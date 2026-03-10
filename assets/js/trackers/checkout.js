/**
 * Checkout & Purchase Tracker
 * WooCommerce Integration
 */
const BehaviourTrackerCheckout = {
    init: function () {
        this.trackCheckoutStart();
        this.trackCheckoutInteractions();
    },

    /**
     * Track Checkout Start
     */
    trackCheckoutStart: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CHECKOUT_START == '0') return;

        // Check if on checkout page
        if (!document.body.classList.contains('woocommerce-checkout')) return;

        const data = {
            event: 'checkout_start',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            checkout_type: (typeof bt_customer_id !== 'undefined' && bt_customer_id !== 'guest') ? 'registered' : 'guest'
        };

        this.sendData(data);
    },

    /**
     * Track checkout interactions
     */
    trackCheckoutInteractions: function () {
        // Shipping method selection
        (function () {
            const defaultSelectors = ['input[name^="shipping_method"]'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.shipping_method_inputs))
                ? bt_config.BT_SELECTORS.shipping_method_inputs
                : [];
            const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
            const selectorString = allSelectors.join(',');

            jQuery(document.body).on('change', selectorString, (e) => {
                this.trackShippingMethod(e.currentTarget);
            });
        }).call(this);

        // Payment method selection
        (function () {
            const defaultSelectors = ['input[name="payment_method"]'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.payment_method_inputs))
                ? bt_config.BT_SELECTORS.payment_method_inputs
                : [];
            const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
            const selectorString = allSelectors.join(',');

            jQuery(document.body).on('change', selectorString, (e) => {
                this.trackPaymentMethod(e.currentTarget);
            });
        }).call(this);
    },

    /**
     * Track Shipping Method Selection
     */
    trackShippingMethod: function (input) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SHIPPING_METHOD == '0') return;

        const shippingMethod = input.value;
        const label = input.closest('li, tr')?.querySelector('label')?.innerText || shippingMethod;

        const data = {
            event: 'checkout_shipping_method_selected',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            shipping_method: label
        };

        this.sendData(data);
    },

    /**
     * Track Payment Method Selection
     */
    trackPaymentMethod: function (input) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PAYMENT_METHOD == '0') return;

        const paymentMethod = input.value;
        const label = input.closest('li')?.querySelector('label')?.innerText || paymentMethod;

        const data = {
            event: 'checkout_payment_method_selected',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            payment_method: paymentMethod,
            payment_method_label: label
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
        bt_config.BT_ENABLED_SECTIONS.checkout === false) {
        BehaviourTrackerLogger.log('Checkout tracker section is disabled in config.php');
        return;
    }

    // Check if jQuery is available (WooCommerce dependency)
    if (typeof jQuery !== 'undefined') {
        BehaviourTrackerCheckout.init();
    } else {
        BehaviourTrackerLogger.warn('jQuery not available, checkout tracking disabled');
    }
});
