/**
 * Product Discovery Tracker
 * WordPress/WooCommerce Integration
 */
const BehaviourTrackerProduct = {
    init: function () {
        this.trackProductView();
        this.trackProductImpressions();
        this.trackProductInteractions();
        this.initAdvancedTracking();
    },

    /**
     * Track Product View
     * (Detects WooCommerce product pages)
     */
    trackProductView: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_VIEW == '0') return;

        // Detect if we are on a product page (WooCommerce)
        const productContainer = document.querySelector('.product, .single-product');
        if (!productContainer || !document.body.classList.contains('single-product')) return;

        // Extract product data from WooCommerce
        const productId = this.getProductId();
        const name = document.querySelector('.product_title, h1.entry-title')?.innerText;
        const priceElement = document.querySelector('.price .woocommerce-Price-amount, .price ins .amount, .price .amount');
        const price = priceElement ? this.extractPrice(priceElement.innerText) : null;

        // Get category from breadcrumbs or body classes
        const category = this.getProductCategory();

        const data = {
            event: 'product_view',
            event_type: 'PRODUCT DISCOVERY EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_id: productId,
            product_name: name,
            product_price: price,
            product_category: category,
            page_url: window.location.href
        };

        this.sendData(data);
    },

    /**
     * Track Product Impressions (List/Category pages)
     */
    trackProductImpressions: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_IMPRESSION == '0') return;

        // WooCommerce product list selector
        const products = document.querySelectorAll('.products .product, ul.products li.product');
        if (products.length === 0) return;

        const productList = [];
        products.forEach((el, index) => {
            const id = el.getAttribute('data-product_id') ||
                el.querySelector('[data-product_id]')?.getAttribute('data-product_id');
            const nameEl = el.querySelector('.woocommerce-loop-product__title, h2, h3');
            const name = nameEl ? nameEl.innerText : null;

            if (id) {
                productList.push({
                    product_id: id,
                    product_name: name,
                    position: index + 1
                });
            }
        });

        if (productList.length > 0) {
            const data = {
                event: 'product_impression',
                event_type: 'PRODUCT DISCOVERY EVENTS',
                timestamp: new Date().toISOString(),
                session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                products: productList,
                page_url: window.location.href
            };
            this.sendData(data);
        }
    },

    /**
     * Track specialized interactions
     */
    trackProductInteractions: function () {
        // Quick View (if theme supports it)
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.quick-view, [class*="quick-view"]')) {
                this.trackQuickView(e.target.closest('.quick-view, [class*="quick-view"]'));
            }
        });
    },

    trackQuickView: function (el) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_QUICK_VIEW == '0') return;

        const productId = el.getAttribute('data-product_id') ||
            el.closest('[data-product_id]')?.getAttribute('data-product_id');

        const data = {
            event: 'product_quick_view',
            event_type: 'PRODUCT DISCOVERY EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_id: productId
        };
        this.sendData(data);
    },

    /**
     * Initialize Advanced Tracking
     */
    initAdvancedTracking: function () {
        // Product Image Zoom
        document.body.addEventListener('click', (e) => {
            const zoomBtn = e.target.closest('.woocommerce-product-gallery__trigger, [class*="zoom"]');
            if (zoomBtn) {
                const productId = this.getProductId();
                const data = {
                    event: 'product_zoom',
                    event_type: 'PRODUCT DISCOVERY EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    product_id: productId
                };
                this.sendData(data);
            }
        });

        // Review Tab Click
        document.body.addEventListener('click', (e) => {
            const reviewTab = e.target.closest('[href="#reviews"], .reviews_tab, [href="#tab-reviews"]');
            if (reviewTab) {
                const productId = this.getProductId();
                const data = {
                    event: 'product_review_read',
                    event_type: 'PRODUCT DISCOVERY EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    product_id: productId
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Helper: Get Product ID
     */
    getProductId: function () {
        // Try multiple methods to get product ID
        const form = document.querySelector('form.cart');
        if (form) {
            const input = form.querySelector('[name="product_id"], [name="add-to-cart"]');
            if (input) return input.value;
        }

        // Try from body class
        const bodyClasses = document.body.className.match(/postid-(\d+)/);
        if (bodyClasses) return bodyClasses[1];

        return null;
    },

    /**
     * Helper: Get Product Category
     */
    getProductCategory: function () {
        // Try breadcrumbs
        const breadcrumb = document.querySelector('.woocommerce-breadcrumb');
        if (breadcrumb) {
            return breadcrumb.innerText.replace(/\s*\/\s*/g, ' > ').trim();
        }

        // Try from posted_in
        const postedIn = document.querySelector('.posted_in a');
        if (postedIn) return postedIn.innerText;

        return null;
    },

    /**
     * Helper: Extract numeric price
     */
    extractPrice: function (priceText) {
        const match = priceText.match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(',', '')) : null;
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
        bt_config.BT_ENABLED_SECTIONS.product === false) {
        BehaviourTrackerLogger.log('Product tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerProduct.init();
});
