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

    if (empty($webhook_url)) {
        return false;
    }

    // Add website ID if available (admin setting takes precedence over config.php)
    if (!isset($event_data['website_id'])) {
        $website_id_override = get_option('bt_website_id', '');
        if (!empty($website_id_override)) {
            $event_data['website_id'] = $website_id_override;
        } elseif (isset($config['website_id']) && !empty($config['website_id'])) {
            $event_data['website_id'] = $config['website_id'];
        }
    }

    // Add session ID if available
    if (!isset($event_data['session_id'])) {
        $event_data['session_id'] = isset($_COOKIE['bt_session_id']) ? $_COOKIE['bt_session_id'] : null;
    }

    // Send to webhook
    $response = wp_remote_post($webhook_url, array(
        'method' => 'POST',
        'timeout' => 5,
        'headers' => array(
            'Content-Type' => 'application/json',
        ),
        'body' => json_encode(array(
            'batch_timestamp' => current_time('c'),
            'events' => array($event_data),
            'server_side' => true,
        )),
    ));

    return !is_wp_error($response);
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
