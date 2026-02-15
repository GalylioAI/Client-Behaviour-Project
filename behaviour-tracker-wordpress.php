<?php
/**
 * Plugin Name: Behaviour Tracker for WordPress
 * Plugin URI: https://github.com/yourusername/behaviour-tracker-wordpress
 * Description: Tracks customer behaviour and sends data to a webhook for analysis. WordPress/WooCommerce equivalent of PrestaShop Behaviour Tracker.
 * Version: 1.0.0
 * Author: Galylio
 * Author URI: https://galylio.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: behaviour-tracker
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * WC requires at least: 3.0
 * WC tested up to: 8.0
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Define plugin constants
define('BT_VERSION', '1.0.0');
define('BT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BT_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main Behaviour Tracker Class
 */
class BehaviourTrackerWordPress
{

    /**
     * Single instance of the class
     */
    private static $instance = null;

    /**
     * Configuration
     */
    private $config = array();

    /**
     * Get instance
     */
    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct()
    {
        $this->load_config();
        $this->init_hooks();
    }

    /**
     * Load configuration from config.php
     */
    private function load_config()
    {
        $config_file = BT_PLUGIN_DIR . 'config.php';
        if (file_exists($config_file)) {
            $this->config = include($config_file);
        } else {
            // Default configuration
            $this->config = array(
                'webhook_url' => '',
                'buffer_interval' => 10,
                'enabled_sections' => array(
                    'session_navigation' => true,
                    'product' => true,
                    'cart' => true,
                    'checkout' => true,
                    'account' => true,
                    'search' => true,
                    'marketing' => true,
                ),
            );
        }
    }

    /**
     * Initialize WordPress hooks
     */
    private function init_hooks()
    {
        // Activation/Deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Declare HPOS compatibility
        add_action('before_woocommerce_init', array($this, 'declare_hpos_compatibility'));

        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));

        // Frontend hooks
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'inject_tracking_init'), 999);

        // Server-side tracking hooks
        add_action('init', array($this, 'load_includes'));
    }

    /**
     * Declare WooCommerce HPOS compatibility
     */
    public function declare_hpos_compatibility()
    {
        if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
                'custom_order_tables',
                __FILE__,
                true
            );
        }
    }

    /**
     * Plugin activation
     */
    public function activate()
    {
        // Set default options
        $this->install_default_settings();
    }

    /**
     * Install default settings
     */
    private function install_default_settings()
    {
        // Section 1: Session & Navigation
        add_option('bt_sec_session_nav', '1');
        add_option('bt_event_page_view', '1');
        add_option('bt_el_pv_url', '1');
        add_option('bt_el_pv_title', '1');
        add_option('bt_el_pv_ref', '1');
        add_option('bt_el_pv_ua', '1');
        add_option('bt_event_session_start', '1');
        add_option('bt_event_session_end', '1');
        add_option('bt_event_scroll_depth', '1');
        add_option('bt_event_click', '1');
        add_option('bt_debug_mode', '0');

        // Section 2: Product Discovery
        add_option('bt_event_product_view', '1');
        add_option('bt_event_product_impression', '1');
        add_option('bt_event_product_quick_view', '1');

        // Section 3: Cart
        add_option('bt_event_cart_update', '1');
        add_option('bt_event_cart_view', '1');
        add_option('bt_event_cart_quantity_change', '1');
        add_option('bt_event_coupon_apply', '1');

        // Section 4: Checkout
        add_option('bt_event_checkout_start', '1');
        add_option('bt_event_checkout_step', '1');
        add_option('bt_event_shipping_method', '1');
        add_option('bt_event_payment_method', '1');
        add_option('bt_event_purchase_completed', '1');
        add_option('bt_event_payment_failed', '1');

        // Section 5: Account
        add_option('bt_event_registration', '1');
        add_option('bt_event_login', '1');
        add_option('bt_event_logout', '1');
        add_option('bt_event_password_reset', '1');
        add_option('bt_event_profile_update', '1');
        add_option('bt_event_wishlist', '1');
        add_option('bt_event_address_book', '1');

        // Section 6: Search
        add_option('bt_event_search_query', '1');
        add_option('bt_event_search_autocomplete', '1');
        add_option('bt_event_filter_applied', '1');
        add_option('bt_event_sort_changed', '1');
        add_option('bt_event_zero_results', '1');

        // Section 7: Marketing
        add_option('bt_event_newsletter_signup', '1');
        add_option('bt_event_popup_interaction', '1');
        add_option('bt_event_banner_click', '1');
        add_option('bt_event_social_share', '1');
    }

    /**
     * Plugin deactivation
     */
    public function deactivate()
    {
        // Cleanup if needed
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu()
    {
        add_options_page(
            __('Behaviour Tracker Settings', 'behaviour-tracker'),
            __('Behaviour Tracker', 'behaviour-tracker'),
            'manage_options',
            'behaviour-tracker',
            array($this, 'render_admin_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings()
    {
        // Get all settings
        $settings = $this->get_all_setting_keys();

        foreach ($settings as $setting) {
            register_setting('bt_settings_group', $setting);
        }
    }

    /**
     * Get all setting keys
     */
    private function get_all_setting_keys()
    {
        return array(
            'bt_sec_session_nav',
            'bt_event_page_view',
            'bt_el_pv_url',
            'bt_el_pv_title',
            'bt_el_pv_ref',
            'bt_el_pv_ua',
            'bt_event_session_start',
            'bt_event_session_end',
            'bt_event_scroll_depth',
            'bt_event_click',
            'bt_debug_mode',
            'bt_event_product_view',
            'bt_event_product_impression',
            'bt_event_product_quick_view',
            'bt_event_cart_update',
            'bt_event_cart_view',
            'bt_event_cart_quantity_change',
            'bt_event_coupon_apply',
            'bt_event_checkout_start',
            'bt_event_checkout_step',
            'bt_event_shipping_method',
            'bt_event_payment_method',
            'bt_event_purchase_completed',
            'bt_event_payment_failed',
            'bt_event_registration',
            'bt_event_login',
            'bt_event_logout',
            'bt_event_password_reset',
            'bt_event_profile_update',
            'bt_event_wishlist',
            'bt_event_address_book',
            'bt_event_search_query',
            'bt_event_search_autocomplete',
            'bt_event_filter_applied',
            'bt_event_sort_changed',
            'bt_event_zero_results',
            'bt_event_newsletter_signup',
            'bt_event_popup_interaction',
            'bt_event_banner_click',
            'bt_event_social_share',
        );
    }

    /**
     * Render admin page
     */
    public function render_admin_page()
    {
        require_once BT_PLUGIN_DIR . 'admin/settings-page.php';
    }

    /**
     * Enqueue scripts
     */
    public function enqueue_scripts()
    {
        // Enqueue utility scripts
        wp_enqueue_script(
            'bt-logger',
            BT_PLUGIN_URL . 'assets/js/utils/logger.js',
            array(),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-buffer',
            BT_PLUGIN_URL . 'assets/js/utils/buffer.js',
            array('bt-logger'),
            BT_VERSION,
            true
        );

        // Enqueue tracker scripts
        wp_enqueue_script(
            'bt-session',
            BT_PLUGIN_URL . 'assets/js/trackers/session.js',
            array('bt-buffer'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-navigation',
            BT_PLUGIN_URL . 'assets/js/trackers/navigation.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-product',
            BT_PLUGIN_URL . 'assets/js/trackers/product.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-cart',
            BT_PLUGIN_URL . 'assets/js/trackers/cart.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-checkout',
            BT_PLUGIN_URL . 'assets/js/trackers/checkout.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-account',
            BT_PLUGIN_URL . 'assets/js/trackers/account.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-search',
            BT_PLUGIN_URL . 'assets/js/trackers/search.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        wp_enqueue_script(
            'bt-marketing',
            BT_PLUGIN_URL . 'assets/js/trackers/marketing.js',
            array('bt-buffer', 'bt-session'),
            BT_VERSION,
            true
        );

        // Localize script with configuration
        $this->localize_scripts();
    }

    /**
     * Localize scripts with configuration
     */
    private function localize_scripts()
    {
        $current_user = wp_get_current_user();

        // Get page type
        $page_type = $this->get_page_type();

        // Build config array
        $config = array(
            'BT_SEC_SESSION_NAV' => get_option('bt_sec_session_nav', '1'),
            'BT_EVENT_PAGE_VIEW' => get_option('bt_event_page_view', '1'),
            'BT_EL_PV_URL' => get_option('bt_el_pv_url', '1'),
            'BT_EL_PV_TITLE' => get_option('bt_el_pv_title', '1'),
            'BT_EL_PV_REF' => get_option('bt_el_pv_ref', '1'),
            'BT_EL_PV_UA' => get_option('bt_el_pv_ua', '1'),
            'BT_EVENT_SESSION_START' => get_option('bt_event_session_start', '1'),
            'BT_EVENT_SESSION_END' => get_option('bt_event_session_end', '1'),
            'BT_EVENT_SCROLL_DEPTH' => get_option('bt_event_scroll_depth', '1'),
            'BT_EVENT_CLICK' => get_option('bt_event_click', '1'),
            'BT_DEBUG_MODE' => get_option('bt_debug_mode', '0'),
            'BT_BUFFER_INTERVAL' => isset($this->config['buffer_interval']) ? $this->config['buffer_interval'] : 10,
            'BT_ENABLED_SECTIONS' => isset($this->config['enabled_sections']) ? $this->config['enabled_sections'] : array(),
        );

        wp_localize_script('bt-buffer', 'behaviourTrackerWebhookUrl', isset($this->config['webhook_url']) ? $this->config['webhook_url'] : '');
        wp_localize_script('bt-buffer', 'bt_customer_id', $current_user->ID > 0 ? $current_user->ID : 'guest');
        wp_localize_script('bt-buffer', 'bt_customer_email', $current_user->ID > 0 ? $current_user->user_email : null);
        wp_localize_script('bt-buffer', 'bt_page_type', $page_type);
        wp_localize_script('bt-buffer', 'bt_config', $config);
    }

    /**
     * Get page type
     */
    private function get_page_type()
    {
        if (is_front_page()) {
            return 'home';
        } elseif (function_exists('is_product') && is_product()) {
            return 'product';
        } elseif (function_exists('is_cart') && is_cart()) {
            return 'cart';
        } elseif (function_exists('is_checkout') && is_checkout()) {
            return 'checkout';
        } elseif (function_exists('is_account_page') && is_account_page()) {
            return 'account';
        } elseif (function_exists('is_shop') && is_shop()) {
            return 'shop';
        } elseif (function_exists('is_product_category') && is_product_category()) {
            return 'category';
        } elseif (is_search()) {
            return 'search';
        } elseif (is_page()) {
            return 'page';
        } elseif (is_single()) {
            return 'post';
        } elseif (is_category() || is_tag() || is_archive()) {
            return 'archive';
        }
        return 'unknown';
    }

    /**
     * Inject tracking initialization
     */
    public function inject_tracking_init()
    {
        // This is called in footer to ensure all scripts are loaded
        // No additional output needed as scripts auto-initialize
    }

    /**
     * Load includes
     */
    public function load_includes()
    {
        require_once BT_PLUGIN_DIR . 'includes/helpers.php';
        require_once BT_PLUGIN_DIR . 'includes/server-events.php';
    }
}

// Initialize the plugin
function bt_init()
{
    return BehaviourTrackerWordPress::get_instance();
}

// Start the plugin
add_action('plugins_loaded', 'bt_init');
