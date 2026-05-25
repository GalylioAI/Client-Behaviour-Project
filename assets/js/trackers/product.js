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

    cleanText: function (value) {
        return (value || '').toString().replace(/\s+/g, ' ').trim();
    },

    textFromSelector: function (root, selectors) {
        const scope = root || document;
        for (const selector of selectors) {
            const element = scope.querySelector(selector);
            const text = this.cleanText(element?.innerText || element?.textContent || element?.getAttribute('content'));
            if (text) return text;
        }
        return '';
    },

    metaContent: function (selectors) {
        for (const selector of selectors) {
            const value = this.cleanText(document.querySelector(selector)?.getAttribute('content'));
            if (value) return value;
        }
        return '';
    },

    productNameFromUrl: function (url) {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.origin);
            const segment = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
            return this.cleanText(segment.replace(/[-_]+/g, ' '));
        } catch (e) {
            return '';
        }
    },

    getProductUrlFromElement: function (element) {
        if (!element) return '';
        const link = element.matches?.('a[href]') ? element : element.querySelector(
            '.woocommerce-loop-product__link[href], a.woocommerce-LoopProduct-link[href], a[href]'
        );
        const href = link?.href || element.closest?.('a[href]')?.href || '';
        return href && !href.startsWith('javascript:') ? href : '';
    },

    getProductNameFromElement: function (element) {
        if (!element) return '';
        const text = this.textFromSelector(element, [
            '.product_title',
            'h1.entry-title',
            '.woocommerce-loop-product__title',
            '[itemprop="name"]',
            'h2',
            'h3',
            'a[title]'
        ]);
        if (text) return text;

        const title = this.cleanText((element.getAttribute ? element.getAttribute('data-product_name') : '') ||
            (element.getAttribute ? element.getAttribute('data-name') : '') ||
            element.querySelector('a[title]')?.getAttribute('title') ||
            element.querySelector('img[alt]')?.getAttribute('alt'));
        if (title) return title;

        return this.productNameFromUrl(this.getProductUrlFromElement(element));
    },

    getCurrentProductName: function (productContainer) {
        const text = this.getProductNameFromElement(productContainer || document);
        if (text) return text;

        const meta = this.metaContent([
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
            'meta[name="title"]'
        ]);
        if (meta) return meta.replace(/\s*[|-]\s*[^|-]+$/, '').trim();

        const title = this.cleanText(document.title);
        if (title) return title.replace(/\s*[|-]\s*[^|-]+$/, '').trim();

        return this.productNameFromUrl(window.location.href);
    },

    getCurrentProductUrl: function () {
        return this.metaContent(['meta[property="og:url"]']) ||
            document.querySelector('link[rel="canonical"]')?.href ||
            window.location.href;
    },

    /**
     * Track Product View
     * (Detects WooCommerce product pages)
     */
    trackProductView: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_VIEW == '0') return;

        // Detect if we are on a product page (WooCommerce)
        const defaultSelectors = ['.product', '.single-product'];
        const extraSelectors = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS.product_page_containers))
            ? bt_config.BT_SELECTORS.product_page_containers
            : [];
        const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
        const productContainer = document.querySelector(allSelectors.join(','));
        if (!productContainer || !document.body.classList.contains('single-product')) return;

        // Extract product data from WooCommerce
        const productId = this.getProductId();
        const name = this.getCurrentProductName(productContainer);
        const priceElement = document.querySelector('.price .woocommerce-Price-amount, .price ins .amount, .price .amount');
        const price = priceElement ? this.extractPrice(priceElement.innerText) : null;
        const productUrl = this.getCurrentProductUrl();

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
            product_url: productUrl,
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
        const defaultSelectors = ['.products .product', 'ul.products li.product'];
        const extraSelectors = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS.product_list_items))
            ? bt_config.BT_SELECTORS.product_list_items
            : [];
        const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
        const products = document.querySelectorAll(allSelectors.join(','));
        if (products.length === 0) return;

        const productList = [];
        products.forEach((el, index) => {
            const id = el.getAttribute('data-product_id') ||
                el.querySelector('[data-product_id]')?.getAttribute('data-product_id');
            const name = this.getProductNameFromElement(el);
            const productUrl = this.getProductUrlFromElement(el);

            if (id || name || productUrl) {
                productList.push({
                    product_id: id,
                    product_name: name,
                    product_url: productUrl,
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

        const productElement = el.closest('.product, [data-product_id]') || el;
        const productId = productElement.getAttribute('data-product_id') ||
            productElement.closest('[data-product_id]')?.getAttribute('data-product_id');

        const data = {
            event: 'product_quick_view',
            event_type: 'PRODUCT DISCOVERY EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            product_id: productId,
            product_name: this.getProductNameFromElement(productElement),
            product_url: this.getProductUrlFromElement(productElement)
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
                const productContainer = document.querySelector('.product, .single-product');
                const data = {
                    event: 'product_zoom',
                    event_type: 'PRODUCT DISCOVERY EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    product_id: productId,
                    product_name: this.getCurrentProductName(productContainer),
                    product_url: this.getCurrentProductUrl()
                };
                this.sendData(data);
            }
        });

        // Review Tab Click
        document.body.addEventListener('click', (e) => {
            const reviewTab = e.target.closest('[href="#reviews"], .reviews_tab, [href="#tab-reviews"]');
            if (reviewTab) {
                const productId = this.getProductId();
                const productContainer = document.querySelector('.product, .single-product');
                const data = {
                    event: 'product_review_read',
                    event_type: 'PRODUCT DISCOVERY EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    product_id: productId,
                    product_name: this.getCurrentProductName(productContainer),
                    product_url: this.getCurrentProductUrl()
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
