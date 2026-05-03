<?php
/**
 * Configuration for Behaviour Tracker Plugin
 */

return [
    // The URL where the tracking data is sent
    'webhook_url' => 'https://server.yatootunisie.tn/webhook',

    // Unique identifier for this website/store (sent as site_id)
    'site_id' => 'your-store-id',

    // Buffer interval in seconds (how often to send batched events)
    // Minimum: 1 second, Recommended: 5-10 seconds
    'buffer_interval' => 3,

    // ========================================
    // MASTER TRACKER SECTION CONTROLS
    // Enable/disable entire tracker sections for isolated testing
    // Set to false to completely disable a section
    // ========================================

    'enabled_sections' => [
        'session_navigation' => true,   // Session & Navigation tracking (session.js, navigation.js)
        'product' => true,              // Product Discovery tracking (product.js)
        'cart' => true,                 // Shopping Cart tracking (cart.js)
        'checkout' => true,             // Checkout & Purchase tracking (checkout.js)
        'account' => true,              // User Account tracking (account.js)
        'search' => true,               // Search & Filters tracking (search.js)
        'marketing' => true,            // Marketing & Promotions tracking (marketing.js)
    ],

    // ========================================
    // OPTIONAL SELECTOR OVERRIDES
    // Use these to support custom themes / builders.
    // Each key is an array of additional CSS selectors that will be
    // MERGED with the plugin's defaults in JS.
    // If you leave them empty, the default behaviour is unchanged.
    // ========================================

    'selectors' => [
        // Session & navigation
        'click_elements' => [
            // e.g. '.my-custom-button'
        ],

        // Product discovery
        'product_page_containers' => [
            // e.g. '.single-product-wrapper'
        ],
        'product_list_items' => [
            // e.g. '.my-product-list .product-card'
        ],

        // Cart
        'cart_rows' => [
            // e.g. '.my-cart-row'
        ],
        'cart_quantity_inputs' => [
            // e.g. 'input.my-qty'
        ],
        'coupon_forms' => [
            // e.g. 'form.my-coupon-form'
        ],

        // Checkout
        'shipping_method_inputs' => [
            // e.g. 'input[name="my_shipping_method"]'
        ],
        'payment_method_inputs' => [
            // e.g. 'input[name="my_payment_method"]'
        ],

        // Account
        'login_forms' => [
            // e.g. 'form.my-login-form'
        ],
        'register_forms' => [
            // e.g. 'form.my-register-form'
        ],
        'edit_account_forms' => [
            // e.g. 'form.my-edit-account'
        ],
        'reset_password_forms' => [
            // e.g. 'form.my-reset-password'
        ],

        // Search & filters
        'search_forms' => [
            // e.g. 'form.header-search'
        ],
        'filter_containers' => [
            // e.g. '.my-filter-widget'
        ],
        'sort_selects' => [
            // e.g. 'select.my-orderby'
        ],

        // Marketing & promotions
        'newsletter_forms' => [
            // e.g. 'form.my-newsletter'
        ],
        'banner_elements' => [
            // e.g. '.my-banner'
        ],
        'social_share_buttons' => [
            // e.g. '.my-share-button'
        ],
    ],
];
