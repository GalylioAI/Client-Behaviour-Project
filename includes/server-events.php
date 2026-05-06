<?php
/**
 * Server-Side Event Tracking
 * Handles events that must be tracked on the server
 */

if (!defined('ABSPATH')) {
    exit;
}

class BT_Server_Events
{
    const PURCHASE_TRACKED_META = '_bt_purchase_completed_tracked_at';
    const STATUS_TRACKED_META = '_bt_order_status_events_tracked';
    const PURCHASE_LOCK_PREFIX = 'bt_purchase_completed_lock_';

    public function __construct()
    {
        $this->init_hooks();
    }

    /**
     * Initialize WordPress/WooCommerce hooks
     */
    private function init_hooks()
    {
        // WooCommerce purchase tracking. Do not rely only on the thank-you page:
        // affiliate flows, blocked redirects, or abandoned browser sessions can still
        // create valid orders without loading that page.
        add_action('woocommerce_checkout_order_processed', array($this, 'track_purchase_completed'), 20, 1);
        add_action('woocommerce_thankyou', array($this, 'track_purchase_completed'), 10, 1);
        add_action('woocommerce_payment_complete', array($this, 'track_purchase_completed'), 20, 1);
        add_action('woocommerce_order_status_processing', array($this, 'track_purchase_completed'), 20, 1);
        add_action('woocommerce_order_status_completed', array($this, 'track_purchase_completed'), 20, 1);
        add_action('woocommerce_order_status_on-hold', array($this, 'track_purchase_completed'), 20, 1);
        add_action('woocommerce_order_status_changed', array($this, 'track_order_status_changed'), 20, 4);

        // User registration
        add_action('user_register', array($this, 'track_registration'), 10, 1);

        // User login
        add_action('wp_login', array($this, 'track_login'), 10, 2);

        // User logout
        add_action('wp_logout', array($this, 'track_logout'), 10, 1);
    }

    /**
     * Track purchase completed
     */
    public function track_purchase_completed($order_id)
    {
        if (!bt_is_event_enabled('bt_event_purchase_completed')) {
            return;
        }

        // wc_get_order() is HPOS-compatible and works with both traditional and HPOS storage
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        if ($this->should_skip_order($order)) {
            return;
        }

        $this->lock_purchase_tracking($order_id);

        // Build items array
        $items = array();
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $items[] = array(
                'product_id' => $item->get_product_id(),
                'product_name' => $item->get_name(),
                'product_sku' => $product ? $product->get_sku() : '',
                'quantity' => $item->get_quantity(),
                'price' => $item->get_total(),
            );
        }

        $customer_data = bt_get_customer_data();
        $customer_id = $order->get_customer_id();
        if (empty($customer_id)) {
            $customer_id = isset($customer_data['customer_id']) ? $customer_data['customer_id'] : 'guest';
        }

        $event_data = array(
            'event_id' => 'woocommerce_order_' . (int) $order_id . '_purchase_completed',
            'event' => 'purchase_completed',
            'event_type' => 'CHECKOUT & PURCHASE EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $customer_id,
            'customer_email' => $order->get_billing_email(),
            'order_id' => $order_id,
            'order_key' => $order->get_order_key(),
            'order_status' => $order->get_status(),
            'order_total' => $order->get_total(),
            'order_subtotal' => $order->get_subtotal(),
            'tax_amount' => $order->get_total_tax(),
            'shipping_cost' => $order->get_shipping_total(),
            'discount_amount' => $order->get_discount_total(),
            'payment_method' => $order->get_payment_method(),
            'shipping_method' => $order->get_shipping_method(),
            'currency' => $order->get_currency(),
            'items_purchased' => $items,
            'billing_country' => $order->get_billing_country(),
            'shipping_country' => $order->get_shipping_country(),
        );

        $sent = bt_send_event($event_data);
        if ($sent) {
            $order->update_meta_data(self::PURCHASE_TRACKED_META, current_time('mysql'));
            $order->save();
        } else {
            delete_transient($this->purchase_lock_key($order_id));
            if (get_option('bt_debug_mode', '0') === '1') {
                error_log('[Behaviour Tracker] Failed to send purchase_completed for order ' . $order_id);
            }
        }
    }

    /**
     * Prevent duplicate revenue and ignore orders that should not count as sales.
     */
    private function should_skip_order($order)
    {
        if ($order->get_meta(self::PURCHASE_TRACKED_META)) {
            return true;
        }

        if ($this->is_purchase_locked($order->get_id())) {
            return true;
        }

        $ignored_statuses = array('cancelled', 'failed', 'refunded', 'trash');
        return in_array($order->get_status(), $ignored_statuses, true);
    }

    private function purchase_lock_key($order_id)
    {
        return self::PURCHASE_LOCK_PREFIX . (int) $order_id;
    }

    private function is_purchase_locked($order_id)
    {
        return (bool) get_transient($this->purchase_lock_key($order_id));
    }

    private function lock_purchase_tracking($order_id)
    {
        set_transient($this->purchase_lock_key($order_id), '1', 10 * MINUTE_IN_SECONDS);
    }

    /**
     * Track backend/admin order status changes after the original purchase event.
     */
    public function track_order_status_changed($order_id, $from_status, $to_status, $order)
    {
        if (!bt_is_event_enabled('bt_event_order_status_changed')) {
            return;
        }

        if (!$order) {
            $order = wc_get_order($order_id);
        }
        if (!$order) {
            return;
        }

        $event_name = $this->event_name_for_order_status($to_status);
        $transition_key = sanitize_key($from_status . '_to_' . $to_status . '_' . gmdate('YmdHis'));
        $tracked = $order->get_meta(self::STATUS_TRACKED_META);
        $tracked = is_array($tracked) ? $tracked : array();

        if (isset($tracked[$transition_key])) {
            return;
        }

        $current_user = function_exists('wp_get_current_user') ? wp_get_current_user() : null;
        $actor_id = ($current_user && isset($current_user->ID)) ? (int) $current_user->ID : 0;

        $event_data = array(
            'event_id' => 'woocommerce_order_' . (int) $order_id . '_status_' . $transition_key,
            'event' => $event_name,
            'event_type' => 'ORDER LIFECYCLE EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $order->get_customer_id() ?: 'guest',
            'customer_email' => $order->get_billing_email(),
            'order_id' => $order_id,
            'order_key' => $order->get_order_key(),
            'order_status_previous' => $from_status,
            'order_status' => $to_status,
            'order_status_change_type' => $event_name,
            'order_total' => $order->get_total(),
            'order_subtotal' => $order->get_subtotal(),
            'tax_amount' => $order->get_total_tax(),
            'shipping_cost' => $order->get_shipping_total(),
            'discount_amount' => $order->get_discount_total(),
            'payment_method' => $order->get_payment_method(),
            'shipping_method' => $order->get_shipping_method(),
            'currency' => $order->get_currency(),
            'changed_by_user_id' => $actor_id,
            'changed_by_user_email' => ($current_user && !empty($current_user->user_email)) ? $current_user->user_email : '',
            'changed_in_admin' => is_admin(),
        );

        if (bt_send_event($event_data)) {
            $tracked[$transition_key] = current_time('mysql');
            $order->update_meta_data(self::STATUS_TRACKED_META, $tracked);
            $order->save();
        } elseif (get_option('bt_debug_mode', '0') === '1') {
            error_log('[Behaviour Tracker] Failed to send ' . $event_name . ' for order ' . $order_id);
        }
    }

    private function event_name_for_order_status($status)
    {
        if ($status === 'cancelled') {
            return 'order_cancelled';
        }
        if ($status === 'refunded') {
            return 'order_refunded';
        }
        if ($status === 'failed') {
            return 'order_failed';
        }

        return 'order_status_changed';
    }

    /**
     * Track user registration
     */
    public function track_registration($user_id)
    {
        if (!bt_is_event_enabled('bt_event_registration')) {
            return;
        }

        $user = get_userdata($user_id);
        if (!$user) {
            return;
        }

        $event_data = array(
            'event' => 'account_registration',
            'event_type' => 'USER ACCOUNT EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $user_id,
            'customer_email' => $user->user_email,
            'registration_method' => 'email',
            'registration_source' => is_checkout() ? 'checkout' : 'account_page',
        );

        bt_send_event($event_data);
    }

    /**
     * Track user login
     */
    public function track_login($user_login, $user)
    {
        if (!bt_is_event_enabled('bt_event_login')) {
            return;
        }

        $event_data = array(
            'event' => 'login',
            'event_type' => 'USER ACCOUNT EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $user->ID,
            'customer_email' => $user->user_email,
            'login_method' => 'email',
        );

        bt_send_event($event_data);
    }

    /**
     * Track user logout
     */
    public function track_logout($user_id)
    {
        if (!bt_is_event_enabled('bt_event_logout')) {
            return;
        }

        $event_data = array(
            'event' => 'logout',
            'event_type' => 'USER ACCOUNT EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $user_id,
        );

        bt_send_event($event_data);
    }
}

// Initialize server events
new BT_Server_Events();
