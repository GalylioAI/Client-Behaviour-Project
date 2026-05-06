<?php
/**
 * Helper Functions for Behaviour Tracker
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Get current customer data
 */
function bt_get_customer_data()
{
    $current_user = wp_get_current_user();

    return array(
        'customer_id' => $current_user->ID > 0 ? $current_user->ID : 'guest',
        'customer_email' => $current_user->ID > 0 ? $current_user->user_email : null,
        'is_logged_in' => is_user_logged_in(),
    );
}

/**
 * Get product data
 */
function bt_get_product_data($product_id)
{
    if (!function_exists('wc_get_product')) {
        return null;
    }

    $product = wc_get_product($product_id);
    if (!$product) {
        return null;
    }

    $categories = array();
    $terms = get_the_terms($product_id, 'product_cat');
    if ($terms && !is_wp_error($terms)) {
        foreach ($terms as $term) {
            $categories[] = $term->name;
        }
    }

    return array(
        'product_id' => $product_id,
        'product_name' => $product->get_name(),
        'product_sku' => $product->get_sku(),
        'product_price' => $product->get_price(),
        'product_category' => implode(' > ', $categories),
        'product_type' => $product->get_type(),
    );
}

/**
 * Get cart data
 */
function bt_get_cart_data()
{
    if (!function_exists('WC') || !WC()->cart) {
        return null;
    }

    $cart = WC()->cart;
    $items = array();

    foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
        $product = $cart_item['data'];
        $items[] = array(
            'product_id' => $cart_item['product_id'],
            'product_name' => $product->get_name(),
            'quantity' => $cart_item['quantity'],
            'price' => $product->get_price(),
        );
    }

    return array(
        'cart_items' => $items,
        'cart_total_items' => $cart->get_cart_contents_count(),
        'cart_total_value' => $cart->get_cart_contents_total(),
    );
}

/**
 * Send event to webhook (server-side)
 */
function bt_send_event($event_data)
{
    $config_file = BT_PLUGIN_DIR . 'config.php';
    if (!file_exists($config_file)) {
        return false;
    }

    $config = include($config_file);
    $webhook_url = isset($config['webhook_url']) ? $config['webhook_url'] : '';
    $server_secret_key = isset($config['server_secret_key'])
        ? $config['server_secret_key']
        : (isset($config['secret_key']) ? $config['secret_key'] : '');

    if (empty($webhook_url)) {
        return false;
    }

    // Add site ID if available (admin setting takes precedence over config.php)
    if (!isset($event_data['site_id'])) {
        $website_id_override = get_option('bt_website_id', '');
        if (!empty($website_id_override)) {
            $event_data['site_id'] = $website_id_override;
        } elseif (isset($config['site_id']) && !empty($config['site_id'])) {
            $event_data['site_id'] = $config['site_id'];
        } elseif (isset($config['website_id']) && !empty($config['website_id'])) {
            $event_data['site_id'] = $config['website_id'];
        }
    }

    // Add session ID if available
    if (!isset($event_data['session_id'])) {
        $event_data['session_id'] = isset($_COOKIE['bt_session_id']) ? $_COOKIE['bt_session_id'] : null;
    }

    $site_id = isset($event_data['site_id']) ? $event_data['site_id'] : '';
    $standard_event = bt_standardize_event($event_data);

    // Send standard envelope to webhook
    $response = wp_remote_post($webhook_url, array(
        'method' => 'POST',
        'timeout' => 5,
        'headers' => array(
            'Content-Type' => 'application/json',
        ),
        'body' => json_encode(array(
            'schema_version' => '1.0',
            'site_id' => $site_id,
            'platform' => 'wordpress',
            'write_key' => $server_secret_key,
            'source' => 'server_php',
            'sent_at' => current_time('c'),
            'batch_timestamp' => current_time('c'),
            'events' => array($standard_event),
            'server_side' => true,
        )),
    ));

    if (is_wp_error($response)) {
        if (get_option('bt_debug_mode', '0') === '1') {
            error_log('[Behaviour Tracker] Server event send failed: ' . $response->get_error_message());
        }
        return false;
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code < 200 || $status_code >= 300) {
        if (get_option('bt_debug_mode', '0') === '1') {
            error_log('[Behaviour Tracker] Server event rejected with HTTP ' . $status_code . ': ' . wp_remote_retrieve_body($response));
        }
        return false;
    }

    return true;
}

/**
 * Convert a raw PHP/WooCommerce event to the shared SaaS event shape.
 */
function bt_standardize_event($event_data)
{
    $reserved = array(
        'schema_version', 'event_id', 'event', 'event_name', 'name', 'event_type', 'event_category', 'category',
        'timestamp', 'session_id', 'visitor_id', 'user_id', 'customer_id', 'customer_email',
        'page', 'page_url', 'url', 'page_type', 'page_title', 'referrer_url', 'referrer',
        'site_id', 'siteId', 'website_id', 'context', 'properties', 'data'
    );

    $properties = array();
    if (isset($event_data['properties']) && is_array($event_data['properties'])) {
        $properties = array_merge($properties, $event_data['properties']);
    }
    if (isset($event_data['data']) && is_array($event_data['data'])) {
        $properties = array_merge($properties, $event_data['data']);
    }

    foreach ($event_data as $key => $value) {
        if (!in_array($key, $reserved, true)) {
            $properties[$key] = $value;
        }
    }

    $page = isset($event_data['page']) && is_array($event_data['page']) ? $event_data['page'] : array();
    if (isset($event_data['page_url']) && !isset($page['url'])) {
        $page['url'] = $event_data['page_url'];
    }
    if (isset($event_data['page_type']) && !isset($page['type'])) {
        $page['type'] = $event_data['page_type'];
    }
    if (isset($event_data['page_title']) && !isset($page['title'])) {
        $page['title'] = $event_data['page_title'];
    }
    if (isset($event_data['referrer_url']) && !isset($page['referrer'])) {
        $page['referrer'] = $event_data['referrer_url'];
    }

    $event_name = isset($event_data['event_name'])
        ? $event_data['event_name']
        : (isset($event_data['event']) ? $event_data['event'] : 'unknown');

    $category_source = isset($event_data['event_category'])
        ? $event_data['event_category']
        : (isset($event_data['event_type']) ? $event_data['event_type'] : '');

    return array(
        'event_id' => isset($event_data['event_id']) ? $event_data['event_id'] : wp_generate_uuid4(),
        'event_name' => $event_name,
        'event_category' => bt_normalize_event_category($category_source, $event_name),
        'timestamp' => isset($event_data['timestamp']) ? $event_data['timestamp'] : current_time('c'),
        'session_id' => isset($event_data['session_id']) ? $event_data['session_id'] : '',
        'visitor_id' => isset($event_data['visitor_id']) ? $event_data['visitor_id'] : '',
        'customer_id' => isset($event_data['customer_id']) ? $event_data['customer_id'] : 'guest',
        'customer_email' => isset($event_data['customer_email']) ? $event_data['customer_email'] : null,
        'page' => $page,
        'properties' => $properties,
        'context' => isset($event_data['context']) && is_array($event_data['context']) ? $event_data['context'] : array(),
    );
}

/**
 * Normalize old long event type labels to compact category names.
 */
function bt_normalize_event_category($category, $event_name = '')
{
    $value = strtolower((string) $category);
    $name = strtolower((string) $event_name);

    if (strpos($value, 'session') !== false || strpos($value, 'navigation') !== false) {
        return 'session_navigation';
    }
    if (strpos($value, 'product') !== false) {
        return 'product';
    }
    if (strpos($value, 'cart') !== false) {
        return 'cart';
    }
    if (strpos($value, 'checkout') !== false || strpos($value, 'purchase') !== false || strpos($value, 'payment') !== false) {
        return 'checkout';
    }
    if (strpos($value, 'account') !== false || strpos($value, 'user') !== false) {
        return 'account';
    }
    if (strpos($value, 'search') !== false || strpos($value, 'filter') !== false) {
        return 'search';
    }
    if (strpos($value, 'marketing') !== false || strpos($value, 'promotional') !== false) {
        return 'marketing';
    }

    if (strpos($name, 'product') !== false) {
        return 'product';
    }
    if (strpos($name, 'cart') !== false || strpos($name, 'coupon') !== false) {
        return 'cart';
    }
    if (strpos($name, 'checkout') !== false || strpos($name, 'purchase') !== false || strpos($name, 'payment') !== false || strpos($name, 'shipping') !== false) {
        return 'checkout';
    }
    if (strpos($name, 'login') !== false || strpos($name, 'logout') !== false || strpos($name, 'registration') !== false || strpos($name, 'password') !== false || strpos($name, 'profile') !== false || strpos($name, 'wishlist') !== false || strpos($name, 'address') !== false) {
        return 'account';
    }
    if (strpos($name, 'search') !== false || strpos($name, 'filter') !== false || strpos($name, 'sort') !== false) {
        return 'search';
    }
    if (strpos($name, 'newsletter') !== false || strpos($name, 'banner') !== false || strpos($name, 'popup') !== false || strpos($name, 'social') !== false) {
        return 'marketing';
    }

    return 'custom';
}

/**
 * Check if event tracking is enabled
 */
function bt_is_event_enabled($event_name)
{
    return get_option($event_name, '1') === '1';
}

/**
 * Generate session ID
 */
function bt_generate_session_id()
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}
