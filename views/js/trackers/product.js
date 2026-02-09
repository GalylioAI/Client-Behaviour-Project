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

    /**
     * Track Product View
     * (Assumes standard PrestaShop product page structure)
     */
    trackProductView: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PRODUCT_VIEW == '0') return;

        // Detect if we are on a product page
        const productContainer = document.querySelector('[itemtype="https://schema.org/Product"], #product');
        if (!productContainer || document.body.id !== 'product') return;

        const productIdInput = document.querySelector('#product_page_product_id');
        const productId = productIdInput ? productIdInput.value : null;

        // Extract basic data (best effort scraping)
        const name = document.querySelector('h1')?.innerText;
        const price = document.querySelector('.current-price span[itemprop="price"]')?.content;

        const data = {
            event: 'product_view',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            product_id: productId,
            product_name: name,
            product_price: price,
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
        const products = document.querySelectorAll('.product-miniature');
        if (products.length === 0) return;

        const productList = [];
        products.forEach((el, index) => {
            const id = el.dataset.idParam || el.getAttribute('data-id-product');
            const name = el.querySelector('.product-title a')?.innerText;

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

        const data = {
            event: 'product_quick_view',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            // Try to find product ID from parent container
            product_id: el.closest('.product-miniature')?.dataset.idProduct
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
    BehaviourTrackerProduct.init();
});
