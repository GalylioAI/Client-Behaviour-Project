/**
 * Search & Filter Tracker
 */
const BehaviourTrackerSearch = {
    init: function () {
        this.trackSearchQuery();
        this.trackAutocomplete();
        this.trackFilters();
        this.trackSort();
        this.trackZeroResults();
    },

    /**
     * Track Search Query
     */
    trackSearchQuery: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SEARCH_QUERY == '0') return;

        // Find search forms
        const searchSelector = (typeof BehaviourTrackerBuffer !== 'undefined')
            ? BehaviourTrackerBuffer.getSelectors('search_forms', ['#search_widget form', '[action*="search"]'])
            : '#search_widget form, [action*="search"]';
        const searchForms = document.querySelectorAll(searchSelector);

        searchForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const searchInput = form.querySelector('[name="s"], [name="search_query"]');
                const searchTerm = searchInput?.value;

                if (searchTerm) {
                    const data = {
                        event: 'search_query',
                        event_type: 'SEARCH & FILTER EVENTS',
                        timestamp: new Date().toISOString(),
                        session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                        customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                        search_term: searchTerm,
                        search_type: 'site_search'
                    };
                    this.sendData(data);
                }
            });
        });
    },

    /**
     * Track Autocomplete Clicks
     */
    trackAutocomplete: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SEARCH_AUTOCOMPLETE == '0') return;

        // Watch for autocomplete interactions
        document.body.addEventListener('click', (e) => {
            const autocompleteItem = e.target.closest('.ui-autocomplete li, .search-suggestion');
            if (autocompleteItem) {
                const suggestion = autocompleteItem.innerText;

                const data = {
                    event: 'search_autocomplete_click',
                    event_type: 'SEARCH & FILTER EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    clicked_suggestion: suggestion
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Filter Application
     */
    trackFilters: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_FILTER_APPLIED == '0') return;

        const filterSelector = (typeof BehaviourTrackerBuffer !== 'undefined')
            ? BehaviourTrackerBuffer.getSelectors('filter_inputs', ['.facet-checkbox input', '[data-search-url]'])
            : '.facet-checkbox input, [data-search-url]';

        // Watch for faceted navigation / filter checkboxes
        document.body.addEventListener('change', (e) => {
            const filterInput = e.target.closest(filterSelector);
            if (filterInput) {
                const filterLabel = filterInput.closest('label')?.innerText || filterInput.name;
                const filterValue = filterInput.value;

                const data = {
                    event: 'filter_applied',
                    event_type: 'SEARCH & FILTER EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    filter_name: filterLabel,
                    filter_value: filterValue,
                    page_url: window.location.pathname
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Sort Changes
     */
    trackSort: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_SORT_CHANGED == '0') return;

        const sortSelector = (typeof BehaviourTrackerBuffer !== 'undefined')
            ? BehaviourTrackerBuffer.getSelectors('sort_selects', ['.products-sort-order select', '[name*="order"]'])
            : '.products-sort-order select, [name*="order"]';

        // Watch for sort dropdown changes
        document.body.addEventListener('change', (e) => {
            const sortSelect = e.target.closest(sortSelector);
            if (sortSelect) {
                const sortOption = sortSelect.options[sortSelect.selectedIndex]?.text;

                const data = {
                    event: 'sort_changed',
                    event_type: 'SEARCH & FILTER EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    sort_option: sortOption,
                    page_url: window.location.pathname
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Zero Results
     */
    trackZeroResults: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_ZERO_RESULTS == '0') return;

        // Check for zero results message on search/category pages
        const noResultsMsg = document.querySelector('.no-products, .no-results, #search .alert-warning');
        if (noResultsMsg) {
            const searchTerm = new URLSearchParams(window.location.search).get('s') ||
                new URLSearchParams(window.location.search).get('search_query');

            if (searchTerm) {
                const data = {
                    event: 'search_zero_results',
                    event_type: 'SEARCH & FILTER EVENTS',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest',
                    search_term: searchTerm
                };
                this.sendData(data);
            }
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
        bt_config.BT_ENABLED_SECTIONS.search === false) {
        BehaviourTrackerLogger.log('Search tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerSearch.init();
});
