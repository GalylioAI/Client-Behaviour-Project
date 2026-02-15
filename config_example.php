<?php
/**
 * Configuration for Behaviour Tracker Plugin
 */

return [
    // The URL where the tracking data is sent
    'webhook_url' => 'https://webhook.site/adad65df-bsdadasdasdasda302f5dc',

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
        'product' => true,   // Product Discovery tracking (product.js)
        'cart' => true,   // Shopping Cart tracking (cart.js)
        'checkout' => true,   // Checkout & Purchase tracking (checkout.js)
        'account' => true,   // User Account tracking (account.js)
        'search' => true,   // Search & Filters tracking (search.js)
        'marketing' => true,   // Marketing & Promotions tracking (marketing.js)
    ],
];
