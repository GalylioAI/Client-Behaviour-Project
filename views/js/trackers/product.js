/**
 * Product Discovery Tracker
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

    isGenericProductName: function (value) {
        const normalized = this.cleanText(value).toLowerCase();
        return [
            'accueil',
            'home',
            'recherche',
            'search',
            'produit',
            'produits',
            'product',
            'products',
            'promos',
            'promotion',
            'الرئيسية'
        ].includes(normalized);
    },

    textFromSelector: function (root, selectors) {
        const scope = root || document;
        for (const selector of selectors) {
            const element = scope.querySelector(selector);
            const text = this.cleanText(element?.innerText || element?.textContent || element?.getAttribute('content'));
            if (text && !this.isGenericProductName(text)) return text;
        }
        return '';
    },

    metaContent: function (selectors) {
        for (const selector of selectors) {
            const value = this.cleanText(document.querySelector(selector)?.getAttribute('content'));
            if (value && !this.isGenericProductName(value)) return value;
        }
        return '';
    },

    productNameFromUrl: function (url) {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.origin);
            const segment = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
            return this.cleanText(
                segment
                    .replace(/\.html?$/i, '')
                    .replace(/^\d+[-_]/, '')
                    .replace(/[-_]+/g, ' ')
            );
        } catch (e) {
            return '';
        }
    },

    getProductIdFromElement: function (element) {
        if (!element) return null;
        const nested = element.querySelector('[data-id-product], [data-product-id], [data-id-param], [data-product_id]');
        return element.dataset?.idProduct ||
            element.dataset?.productId ||
            element.dataset?.idParam ||
            element.getAttribute('data-id-product') ||
            element.getAttribute('data-product-id') ||
            element.getAttribute('data-id-param') ||
            element.getAttribute('data-product_id') ||
            nested?.dataset?.idProduct ||
            nested?.dataset?.productId ||
            nested?.dataset?.idParam ||
            nested?.getAttribute('data-id-product') ||
            nested?.getAttribute('data-product-id') ||
            nested?.getAttribute('data-id-param') ||
            nested?.getAttribute('data-product_id') ||
            null;
    },

    getProductUrlFromElement: function (element) {
        if (!element) return '';
        const link = element.matches?.('a[href]') ? element : element.querySelector(
            '.product-title a[href], .product-name a[href], .product-link[href], a.product-link[href], a[href*=".html"], a[href]'
        );
        const href = link?.href || element.closest?.('a[href]')?.href || '';
        return href && !href.startsWith('javascript:') ? href : '';
    },

    getProductNameFromElement: function (element) {
        if (!element) return '';
        const selectors = [
            '[itemprop="name"]',
            '.product-title a',
            '.product-title',
            '.product-name a',
            '.product-name',
            '.product_name',
            '.product-link',
            'a.product-link',
            '.product-description a',
            'h1',
            'h2',
            'h3',
            '.h1',
            '.h2',
            '.h3',
            'a[title]'
        ];
        const text = this.textFromSelector(element, selectors);
        if (text && !this.isGenericProductName(text)) return text;

        const title = this.cleanText((element.getAttribute ? element.getAttribute('data-name') : '') ||
            (element.getAttribute ? element.getAttribute('data-product-name') : '') ||
            element.querySelector('a[title]')?.getAttribute('title') ||
            element.querySelector('img[alt]')?.getAttribute('alt'));
        if (title && !this.isGenericProductName(title)) return title;

        return this.productNameFromUrl(this.getProductUrlFromElement(element));
    },

    getCurrentProductName: function (productContainer) {
        const pageTitle = this.textFromSelector(document, [
            'h1[itemprop="name"]',
            '.product-information h1',
            '.product-detail-name',
            '.product-title-main',
            '.product_header_container h1',
            '.page-title h1',
            'h1.h1',
            'h1'
        ]);
        if (pageTitle) return pageTitle;

        const meta = this.metaContent([
            'meta[property="og:title"]',
            'meta[name="twitter:title"]',
            'meta[name="title"]'
        ]);
        if (meta) {
            const cleanMeta = this.cleanText(meta.replace(/\s*[|-]\s*[^|-]+$/, ''));
            if (cleanMeta && !this.isGenericProductName(cleanMeta)) return cleanMeta;
        }

        const text = this.getProductNameFromElement(productContainer || document);
        if (text && !this.isGenericProductName(text)) return text;

        const title = this.cleanText(document.title);
        if (title) {
            const cleanTitle = this.cleanText(title.replace(/\s*[|-]\s*[^|-]+$/, ''));
            if (cleanTitle && !this.isGenericProductName(cleanTitle)) return cleanTitle;
        }

        return this.productNameFromUrl(window.location.href);
    },

    getCurrentProductUrl: function () {
        return this.metaContent(['meta[property="og:url"]']) ||
            document.querySelector('link[rel="canonical"]')?.href ||
            window.location.href;
    },

    getCurrentProductPrice: function () {
        const priceElement = document.querySelector('.current-price span[itemprop="price"], [itemprop="price"], .current-price, .product-price');
        return priceElement?.getAttribute('content') || priceElement?.content || this.cleanText(priceElement?.innerText);
    },

    /**
     * Track Product View
     * (Assumes standard PrestaShop product page structure)
     */
    trackProductView: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_VIEW == '0') return;

        // Detect if we are on a product page
        const productPageSelector = (typeof BehaviourTrackerBuffer !== 'undefined')
            ? BehaviourTrackerBuffer.getSelectors('product_page_containers', ['[itemtype="https://schema.org/Product"]', '#product'])
            : '[itemtype="https://schema.org/Product"], #product';
        const productContainer = document.querySelector(productPageSelector);
        if (!productContainer || document.body.id !== 'product') return;

        const productIdInput = document.querySelector('#product_page_product_id');
        const productId = productIdInput ? productIdInput.value : null;

        // Extract basic data (best effort scraping across themes)
        const name = this.getCurrentProductName(productContainer);
        const price = this.getCurrentProductPrice();
        const productUrl = this.getCurrentProductUrl();

        const data = {
            event: 'product_view',
            event_type: 'PRODUCT DISCOVERY EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            product_id: productId,
            product_name: name,
            product_price: price,
            product_url: productUrl,
            page_url: window.location.href
        };

        this.sendData(data);
    },

    /**
     * Track Product Impressions (List/Category pages)
     * Limit to what's visible or simple list detection
     */
    trackProductImpressions: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_IMPRESSION == '0') return;

        // Common PrestaShop selector for product lists
        const productListSelector = (typeof BehaviourTrackerBuffer !== 'undefined')
            ? BehaviourTrackerBuffer.getSelectors('product_list_items', ['.product-miniature'])
            : '.product-miniature';
        const products = document.querySelectorAll(productListSelector);
        if (products.length === 0) return;

        const productList = [];
        products.forEach((el, index) => {
            const id = this.getProductIdFromElement(el);
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
                products: productList, // May be large, buffer handles it
                page_url: window.location.href
            };
            this.sendData(data);
        }
    },

    /**
     * Track specialized interactions
     */
    trackProductInteractions: function () {
        // Quick View (Ajax load usually)
        // We can listen for clicks on quick view buttons
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.quick-view')) {
                this.trackQuickView(e.target.closest('.quick-view'));
            }
        });
    },

    trackQuickView: function (el) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_QUICK_VIEW == '0') return;

        const productElement = el.closest('.product-miniature, [data-id-product], [data-product-id]') || el;
        const data = {
            event: 'product_quick_view',
            event_type: 'PRODUCT DISCOVERY EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            product_id: this.getProductIdFromElement(productElement),
            product_name: this.getProductNameFromElement(productElement),
            product_url: this.getProductUrlFromElement(productElement)
        };
        this.sendData(data);
    },

    /**
     * Initialize Advanced Tracking
     */
    initAdvancedTracking: function () {
        // Product Comparison
        if (typeof bt_config === 'undefined' || bt_config.BT_EVENT_PRODUCT_COMPARISON != '0') {
            document.body.addEventListener('click', (e) => {
                const compareBtn = e.target.closest('.compare, [data-action="add-to-compare"]');
                if (compareBtn) {
                    const productElement = compareBtn.closest('.product-miniature, [data-id-product], [data-product-id]') || compareBtn;

                    const data = {
                        event: 'product_comparison_add',
                        event_type: 'PRODUCT DISCOVERY EVENTS',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        product_id: this.getProductIdFromElement(productElement),
                        product_name: this.getProductNameFromElement(productElement),
                        product_url: this.getProductUrlFromElement(productElement)
                    };
                    this.sendData(data);
                }
            });
        }

        // Image Zoom
        if (typeof bt_config === 'undefined' || bt_config.BT_EVENT_PRODUCT_ZOOM != '0') {
            document.body.addEventListener('click', (e) => {
                const zoomBtn = e.target.closest('.js-zoom, [data-zoom]');
                if (zoomBtn) {
                    const productIdInput = document.querySelector('#product_page_product_id');
                    const productId = productIdInput ? productIdInput.value : null;
                    const productContainer = document.querySelector('[itemtype="https://schema.org/Product"], #product');

                    const data = {
                        event: 'product_zoom',
                        event_type: 'PRODUCT DISCOVERY EVENTS',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        product_id: productId,
                        product_name: this.getCurrentProductName(productContainer),
                        product_url: this.getCurrentProductUrl()
                    };
                    this.sendData(data);
                }
            });
        }

        // Review Tab Click
        if (typeof bt_config === 'undefined' || bt_config.BT_EVENT_PRODUCT_REVIEW_READ != '0') {
            document.body.addEventListener('click', (e) => {
                const reviewTab = e.target.closest('[href="#product-review"], .reviews-tab');
                if (reviewTab) {
                    const productIdInput = document.querySelector('#product_page_product_id');
                    const productId = productIdInput ? productIdInput.value : null;
                    const productContainer = document.querySelector('[itemtype="https://schema.org/Product"], #product');

                    const data = {
                        event: 'product_review_read',
                        event_type: 'PRODUCT DISCOVERY EVENTS',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        product_id: productId,
                        product_name: this.getCurrentProductName(productContainer),
                        product_url: this.getCurrentProductUrl()
                    };
                    this.sendData(data);
                }
            });
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
        bt_config.BT_ENABLED_SECTIONS.product === false) {
        BehaviourTrackerLogger.log('Product tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerProduct.init();
});
