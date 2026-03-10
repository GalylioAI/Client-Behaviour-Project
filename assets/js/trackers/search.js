/**
 * Search & Filter Tracker
 * WordPress/WooCommerce Integration
 */
const BehaviourTrackerSearch = {
    init: function () {
        this.trackSearchSubmissions();
        this.trackFilterChanges();
        this.trackSortChanges();
    },

    /**
     * Track search submissions
     */
    trackSearchSubmissions: function () {
        const attachSubmitHandler = (selectors) => {
            const selectorString = Array.isArray(selectors) ? selectors.join(',') : selectors;
            document.querySelectorAll(selectorString).forEach(form => {
                form.addEventListener('submit', (e) => {
                    // Prevent duplicate submissions and infinite loops
                    if (form.dataset.btTracking === 'true') return;
                    
                    e.preventDefault();
                    form.dataset.btTracking = 'true';
                    
                    this.trackSearch(form);
                    
                    // Allow the buffer to queue the event before navigating away
                    setTimeout(() => {
                        form.submit();
                    }, 300);
                });
            });
        };

        // Build selector list (defaults + optional overrides from config)
        const defaultSelectors = [
            // WordPress search forms
            'form.search-form',
            'form[role="search"]',
            '.searchform',
            // WooCommerce product search
            'form.woocommerce-product-search'
        ];

        const extraSelectors = (typeof bt_config !== 'undefined' &&
            bt_config.BT_SELECTORS &&
            Array.isArray(bt_config.BT_SELECTORS.search_forms))
            ? bt_config.BT_SELECTORS.search_forms
            : [];

        const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
        attachSubmitHandler(allSelectors);
    },

    /**
     * Track Search
     */
    trackSearch: function (form) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SEARCH_QUERY == '0') return;

        const searchInput = form.querySelector('[name="s"], [type="search"]');
        const searchTerm = searchInput ? searchInput.value : null;

        // Count results if on search results page
        const resultsCount = document.querySelectorAll('.search-results .product, .search-results article').length;

        const data = {
            event: 'search_query',
            event_type: 'SEARCH & FILTER EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            search_term: searchTerm,
            search_results_count: resultsCount,
            search_type: 'site_search',
            zero_results: resultsCount === 0
        };

        this.sendData(data);
    },

    /**
     * Track filter changes
     */
    trackFilterChanges: function () {
        // WooCommerce layered nav
        document.body.addEventListener('change', (e) => {
            const target = e.target;

            // Check if it's a filter checkbox or select
            const defaultSelectors = ['.woocommerce-widget-layered-nav', '.widget_layered_nav'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.filter_containers))
                ? bt_config.BT_SELECTORS.filter_containers
                : [];
            const allSelectors = Array.from(new Set(defaultSelectors.concat(extraSelectors)));
            const selectorString = allSelectors.join(',');

            if (target.closest(selectorString)) {
                this.trackFilterApplied(target);
            }
        });
    },

    /**
     * Track Filter Applied
     */
    trackFilterApplied: function (input) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_FILTER_APPLIED == '0') return;

        const filterType = input.name || 'unknown';
        const filterValue = input.value || input.innerText;

        const data = {
            event: 'filter_applied',
            event_type: 'SEARCH & FILTER EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            filter_type: filterType,
            filter_value: filterValue,
            page_url: window.location.href
        };

        this.sendData(data);
    },

    /**
     * Track sort changes
     */
    trackSortChanges: function () {
        // WooCommerce orderby dropdown
        document.body.addEventListener('change', (e) => {
            const target = e.target;

            const defaultSelectors = ['orderby'];
            const extraSelectors = (typeof bt_config !== 'undefined' &&
                bt_config.BT_SELECTORS &&
                Array.isArray(bt_config.BT_SELECTORS.sort_selects))
                ? bt_config.BT_SELECTORS.sort_selects
                : [];

            // If configured with full selectors, check those as well; otherwise fall back to class/name
            const fullSelectorMatch = extraSelectors.length
                ? target.matches(extraSelectors.join(','))
                : false;

            if (fullSelectorMatch || target.classList.contains('orderby') || target.name === 'orderby') {
                this.trackSortChanged(target);
            }
        });
    },

    /**
     * Track Sort Changed
     */
    trackSortChanged: function (select) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SORT_CHANGED == '0') return;

        const newSort = select.value;
        const label = select.options[select.selectedIndex]?.text || newSort;

        const data = {
            event: 'sort_changed',
            event_type: 'SEARCH & FILTER EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
            new_sort: newSort,
            sort_label: label,
            page_url: window.location.href
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
        bt_config.BT_ENABLED_SECTIONS.search === false) {
        BehaviourTrackerLogger.log('Search tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerSearch.init();
});
