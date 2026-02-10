/**
 * Checkout & Purchase Tracker
 */
const BehaviourTrackerCheckout = {
    init: function () {
        this.trackCheckoutStart();
        this.trackCheckoutSteps();
        this.trackShippingMethod();
        this.trackPaymentMethod();
        this.trackPurchaseCompleted();
        this.trackPaymentErrors();
    },

    /**
     * Track Checkout Start
     */
    trackCheckoutStart: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CHECKOUT_START == '0') return;

        // Detect if we're on checkout page
        if (document.body.id !== 'checkout') return;

        // Get cart data from PrestaShop
        const data = {
            event: 'checkout_start',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            checkout_type: (typeof bt_customer_id !== 'undefined' && bt_customer_id !== 'guest') ? 'registered' : 'guest',
            page_url: window.location.href
        };

        this.sendData(data);
    },

    /**
     * Track Checkout Steps
     */
    trackCheckoutSteps: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CHECKOUT_STEP == '0') return;

        // PrestaShop 1.7+ uses section-based checkout
        const checkoutSections = document.querySelectorAll('.checkout-step');

        checkoutSections.forEach((section, index) => {
            // Watch for completion class changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.target.classList.contains('-complete')) {
                        const stepName = section.id || `step_${index + 1}`;
                        this.sendStepCompleted(stepName, index + 1);
                    }
                });
            });

            observer.observe(section, { attributes: true, attributeFilter: ['class'] });
        });
    },

    sendStepCompleted: function (stepName, stepNumber) {
        const data = {
            event: 'checkout_step_completed',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            step_number: stepNumber,
            step_name: stepName
        };
        this.sendData(data);
    },

    /**
     * Track Shipping Method Selection
     */
    trackShippingMethod: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SHIPPING_METHOD == '0') return;

        // Listen for shipping method selection
        document.body.addEventListener('change', (e) => {
            if (e.target.name && e.target.name.includes('delivery_option')) {
                const selectedOption = e.target.closest('.delivery-option');
                if (selectedOption) {
                    const carrierName = selectedOption.querySelector('.carrier-name')?.innerText;
                    const shippingCost = selectedOption.querySelector('.carrier-price')?.innerText;

                    const data = {
                        event: 'checkout_shipping_method_selected',
                        event_type: 'CHECKOUT & PURCHASE EVENTS',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                        shipping_method: carrierName,
                        shipping_cost: shippingCost
                    };
                    this.sendData(data);
                }
            }
        });
    },

    /**
     * Track Payment Method Selection
     */
    trackPaymentMethod: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PAYMENT_METHOD == '0') return;

        // Listen for payment method selection
        document.body.addEventListener('change', (e) => {
            if (e.target.name && e.target.name.includes('payment-option')) {
                const paymentLabel = document.querySelector(`label[for="${e.target.id}"]`)?.innerText;

                const data = {
                    event: 'checkout_payment_method_selected',
                    event_type: 'CHECKOUT & PURCHASE EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    payment_method: paymentLabel || e.target.value
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Purchase Completed
     */
    trackPurchaseCompleted: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PURCHASE_COMPLETED == '0') return;

        // Check if we're on order confirmation page
        if (document.body.id !== 'order-confirmation') return;

        // Extract order details
        const orderReference = document.querySelector('.order-reference-value')?.innerText;
        const orderTotal = document.querySelector('.order-confirmation-total .value')?.innerText;

        const data = {
            event: 'purchase_completed',
            event_type: 'CHECKOUT & PURCHASE EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            customer_email: (typeof bt_customer_email !== 'undefined') ? bt_customer_email : null,
            order_reference: orderReference,
            order_total: orderTotal,
            page_url: window.location.href
        };

        this.sendData(data);
    },

    /**
     * Track Payment Errors
     */
    trackPaymentErrors: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PAYMENT_FAILED == '0') return;

        // Watch for error messages on checkout page
        const errorObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && (node.classList.contains('alert-danger') || node.classList.contains('error'))) {
                        const errorMessage = node.innerText;

                        const data = {
                            event: 'payment_failed',
                            event_type: 'CHECKOUT & PURCHASE EVENTS',
                            timestamp: new Date().toISOString(),
                            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                            error_message: errorMessage
                        };
                        this.sendData(data);
                    }
                });
            });
        });

        const checkoutContainer = document.querySelector('#checkout') || document.body;
        errorObserver.observe(checkoutContainer, { childList: true, subtree: true });
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

    BehaviourTrackerCheckout.init();
});
