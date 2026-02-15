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

    public function __construct()
    {
        $this->init_hooks();
    }

    /**
     * Initialize WordPress/WooCommerce hooks
     */
    private function init_hooks()
    {
        // WooCommerce order completed
        add_action('woocommerce_thankyou', array($this, 'track_purchase_completed'), 10, 1);

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

        $customer_data = bt_get_customer_data();

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

        $event_data = array(
            'event' => 'purchase_completed',
            'event_type' => 'CHECKOUT & PURCHASE EVENTS',
            'timestamp' => current_time('c'),
            'customer_id' => $customer_data['customer_id'],
            'customer_email' => $order->get_billing_email(),
            'order_id' => $order_id,
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

        bt_send_event($event_data);
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
