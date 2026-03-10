/**
 * Shopping Cart Tracker
 * WooCommerce Integration
 */
const BehaviourTrackerCart = {
    init: function () {
        this.trackCartView();
        this.hookWooCommerceEvents();
        this.trackCartInteractions();
    },

    /**
     * Track Cart Page View
     */
    trackCartView: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_VIEW == '0') return;

        // Check if on cart page
        if (!document.body.classList.contains('woocommerce-cart')) return;

        const cartData = this.getCartData();

        const data = {
            event: 'cart_view',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            cart_items: cartData.items,
            cart_total_items: cartData.total_items,
            cart_total_value: cartData.total_value
        };

        this.sendData(data);
    },

    /**
     * Hook into WooCommerce events
     */
    hookWooCommerceEvents: function () {
        // Add to cart event (WooCommerce triggers this)
        jQuery(document.body).on('added_to_cart', (event, fragments, cart_hash, button) => {
            this.trackAddToCart(button);
        });

        // Removed from cart (listen to remove button clicks)
        jQuery(document.body).on('click', '.remove, a.remove', (e) => {
            const target = e.currentTarget;
            if (target.closest('.woocommerce-cart-form, .cart_item')) {
                this.trackRemoveFromCart(target);
            }
        });
    },

    /**
     * Track Add to Cart
     */
    trackAddToCart: function (button) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_UPDATE == '0') return;

        const productId = button?.getAttribute('data-product_id') ||
            button?.closest('[data-product_id]')?.getAttribute('data-product_id');
        const productName = button?.getAttribute('data-product_name') ||
            button?.closest('.product')?.querySelector('.product_title, h2, h3')?.innerText;
        const quantity = button?.getAttribute('data-quantity') || 1;

        const data = {
            event: 'add_to_cart',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_id: productId,
            product_name: productName,
            quantity_added: parseInt(quantity),
            source: document.body.classList.contains('single-product') ? 'product_page' : 'product_list'
        };

        this.sendData(data);
    },

    /**
     * Track Remove from Cart
     */
    trackRemoveFromCart: function (removeButton) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_UPDATE == '0') return;

        const cartItem = removeButton.closest('.cart_item, tr');
        const productName = cartItem?.querySelector('.product-name, td a')?.innerText;
        const productId = removeButton.getAttribute('data-product_id') ||
            removeButton.getAttribute('data-cart_item_key');

        const data = {
            event: 'remove_from_cart',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_id: productId,
            product_name: productName
        };

        this.sendData(data);
    },

    /**
     * Track cart interactions
     */
    trackCartInteractions: function () {
        // Quantity change
        (function () {
            const defaultSelectors = ['.qty', 'input.qty'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.cart_quantity_inputs))
                ? bt_config.BT_SELECTORS.cart_quantity_inputs
                : [];
            const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
            const selectorString = allSelectors.join(',');

            jQuery(document.body).on('change', selectorString, (e) => {
                this.trackQuantityChange(e.currentTarget);
            });
        }).call(this);

        // Coupon apply
        (function () {
            const defaultSelectors = ['form.checkout_coupon', 'form.woocommerce-form-coupon'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.coupon_forms))
                ? bt_config.BT_SELECTORS.coupon_forms
                : [];
            const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
            const selectorString = allSelectors.join(',');

            jQuery(document.body).on('submit', selectorString, (e) => {
                this.trackCouponApply(e.currentTarget);
            });
        }).call(this);
    },

    /**
     * Track Quantity Change
     */
    trackQuantityChange: function (input) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_CART_QUANTITY_CHANGE == '0') return;

        const cartItem = input.closest('.cart_item, tr');
        const productName = cartItem?.querySelector('.product-name, td a')?.innerText;
        const newQuantity = input.value;

        const data = {
            event: 'cart_quantity_change',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_name: productName,
            new_quantity: parseInt(newQuantity)
        };

        this.sendData(data);
    },

    /**
     * Track Coupon Apply
     */
    trackCouponApply: function (form) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_COUPON_APPLY == '0') return;

        const couponInput = form.querySelector('[name="coupon_code"]');
        const couponCode = couponInput ? couponInput.value : null;

        const data = {
            event: 'apply_coupon',
            event_type: 'SHOPPING CART EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            coupon_code: couponCode
        };

        this.sendData(data);
    },

    /**
     * Helper: Get Cart Data
     */
    getCartData: function () {
        const items = [];
        let totalValue = 0;

        const defaultRowSelectors = ['.cart_item', 'tr.woocommerce-cart-form__cart-item'];
        const extraRowSelectors = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS.cart_rows))
            ? bt_config.BT_SELECTORS.cart_rows
            : [];
        const allRowSelectors = Array.from(new Set(defaultRowSelectors.concat(extraRowSelectors)));

        document.querySelectorAll(allRowSelectors.join(',')).forEach(row => {
            const name = row.querySelector('.product-name, td a')?.innerText;
            const qtyInput = row.querySelector('.qty');
            const quantity = qtyInput ? parseInt(qtyInput.value) : 1;

            items.push({
                product_name: name,
                quantity: quantity
            });
        });

        // Try to get total
        const totalElement = document.querySelector('.order-total .amount, .cart-subtotal .amount');
        if (totalElement) {
            const totalText = totalElement.innerText;
            const match = totalText.match(/[\d,]+\.?\d*/);
            totalValue = match ? parseFloat(match[0].replace(',', '')) : 0;
        }

        return {
            items: items,
            total_items: items.length,
            total_value: totalValue
        };
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

    // Check if jQuery is available (WooCommerce dependency)
    if (typeof jQuery !== 'undefined') {
        BehaviourTrackerCart.init();
    } else {
        BehaviourTrackerLogger.warn('jQuery not available, cart tracking disabled');
    }
});
