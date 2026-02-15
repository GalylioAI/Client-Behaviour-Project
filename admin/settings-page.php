<?php
/**
 * Admin Settings Page
 */

if (!defined('ABSPATH')) {
    exit;
}

// Save settings if form submitted
if (isset($_POST['bt_save_settings']) && check_admin_referer('bt_settings_save', 'bt_settings_nonce')) {
    $settings = BehaviourTrackerWordPress::get_instance();
    $all_settings = $settings->get_all_setting_keys();

    foreach ($all_settings as $setting) {
        $value = isset($_POST[$setting]) ? '1' : '0';
        update_option($setting, $value);
    }

    echo '<div class="notice notice-success"><p>' . __('Settings saved successfully!', 'behaviour-tracker') . '</p></div>';
}

// Get current values
$get_option = function ($key) {
    return get_option($key, '1') === '1';
};
?>

<div class="wrap">
    <h1>
        <?php echo esc_html(get_admin_page_title()); ?>
    </h1>

    <div class="notice notice-info">
        <p><strong>
                <?php _e('Webhook Configuration:', 'behaviour-tracker'); ?>
            </strong>
            <?php _e('Edit the webhook URL in', 'behaviour-tracker'); ?> <code>config.php</code>
        </p>
    </div>

    <form method="post" action="">
        <?php wp_nonce_field('bt_settings_save', 'bt_settings_nonce'); ?>

        <style>
            .bt-section {
                background: #fff;
                padding: 20px;
                margin: 20px 0;
                border: 1px solid #ccd0d4;
                box-shadow: 0 1px 1px rgba(0, 0, 0, .04);
            }

            .bt-section h2 {
                margin-top: 0;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
            }

            .bt-event-block {
                margin: 20px 0;
                padding: 15px;
                background: #f9f9f9;
                border-left: 4px solid #2271b1;
            }

            .bt-event-block h4 {
                margin: 0 0 10px 0;
                color: #2271b1;
            }

            .bt-data-element {
                margin-left: 30px;
                font-size: 0.95em;
            }

            .bt-master-toggle {
                background: #e7f5fe;
                padding: 10px;
                margin-bottom: 15px;
                border-radius: 3px;
            }
        </style>

        <!-- Section 1: Session & Navigation -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 1: User Session & Navigation', 'behaviour-tracker'); ?>
            </h2>

            <div class="bt-master-toggle">
                <label>
                    <input type="checkbox" name="bt_sec_session_nav" value="1" <?php checked($get_option('bt_sec_session_nav')); ?>>
                    <strong>
                        <?php _e('Enable Section (Master Toggle)', 'behaviour-tracker'); ?>
                    </strong>
                </label>
            </div>

            <label>
                <input type="checkbox" name="bt_debug_mode" value="1" <?php checked($get_option('bt_debug_mode')); ?>>
                <?php _e('Debug Mode (Console Logging)', 'behaviour-tracker'); ?>
            </label>

            <!-- PAGE_VIEW -->
            <div class="bt-event-block">
                <h4>
                    <?php _e('PAGE_VIEW', 'behaviour-tracker'); ?>
                </h4>
                <label>
                    <input type="checkbox" name="bt_event_page_view" value="1" <?php checked($get_option('bt_event_page_view')); ?>>
                    <?php _e('Enable Event', 'behaviour-tracker'); ?>
                </label>
                <div class="bt-data-element">
                    <label><input type="checkbox" name="bt_el_pv_url" value="1" <?php checked($get_option('bt_el_pv_url')); ?>>
                        <?php _e('Data: URL', 'behaviour-tracker'); ?>
                    </label><br>
                    <label><input type="checkbox" name="bt_el_pv_title" value="1" <?php checked($get_option('bt_el_pv_title')); ?>>
                        <?php _e('Data: Page Title', 'behaviour-tracker'); ?>
                    </label><br>
                    <label><input type="checkbox" name="bt_el_pv_ref" value="1" <?php checked($get_option('bt_el_pv_ref')); ?>>
                        <?php _e('Data: Referrer', 'behaviour-tracker'); ?>
                    </label><br>
                    <label><input type="checkbox" name="bt_el_pv_ua" value="1" <?php checked($get_option('bt_el_pv_ua')); ?>>
                        <?php _e('Data: User Agent', 'behaviour-tracker'); ?>
                    </label>
                </div>
            </div>

            <!-- SESSION_START -->
            <div class="bt-event-block">
                <h4>
                    <?php _e('SESSION_START', 'behaviour-tracker'); ?>
                </h4>
                <label>
                    <input type="checkbox" name="bt_event_session_start" value="1" <?php checked($get_option('bt_event_session_start')); ?>>
                    <?php _e('Enable Event', 'behaviour-tracker'); ?>
                </label>
            </div>

            <!-- SESSION_END -->
            <div class="bt-event-block">
                <h4>
                    <?php _e('SESSION_END', 'behaviour-tracker'); ?>
                </h4>
                <label>
                    <input type="checkbox" name="bt_event_session_end" value="1" <?php checked($get_option('bt_event_session_end')); ?>>
                    <?php _e('Enable Event', 'behaviour-tracker'); ?>
                </label>
            </div>

            <!-- SCROLL_DEPTH -->
            <div class="bt-event-block">
                <h4>
                    <?php _e('SCROLL_DEPTH', 'behaviour-tracker'); ?>
                </h4>
                <label>
                    <input type="checkbox" name="bt_event_scroll_depth" value="1" <?php checked($get_option('bt_event_scroll_depth')); ?>>
                    <?php _e('Enable Event', 'behaviour-tracker'); ?>
                </label>
            </div>

            <!-- CLICK_EVENT -->
            <div class="bt-event-block">
                <h4>
                    <?php _e('CLICK_EVENT', 'behaviour-tracker'); ?>
                </h4>
                <label>
                    <input type="checkbox" name="bt_event_click" value="1" <?php checked($get_option('bt_event_click')); ?>>
                    <?php _e('Enable Event', 'behaviour-tracker'); ?>
                </label>
            </div>
        </div>

        <!-- Section 2: Product Discovery -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 2: Product Discovery', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_product_view" value="1" <?php checked($get_option('bt_event_product_view')); ?>>
                <?php _e('Product View', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_product_impression" value="1" <?php checked($get_option('bt_event_product_impression')); ?>>
                <?php _e('Product Impression (Lists)', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_product_quick_view" value="1" <?php checked($get_option('bt_event_product_quick_view')); ?>>
                <?php _e('Quick View', 'behaviour-tracker'); ?>
            </label>
        </div>

        <!-- Section 3: Shopping Cart -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 3: Shopping Cart', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_cart_update" value="1" <?php checked($get_option('bt_event_cart_update')); ?>>
                <?php _e('Cart Updates (Add/Remove)', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_cart_view" value="1" <?php checked($get_option('bt_event_cart_view')); ?>>
                <?php _e('Cart View', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_cart_quantity_change" value="1" <?php checked($get_option('bt_event_cart_quantity_change')); ?>>
                <?php _e('Quantity Change', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_coupon_apply" value="1" <?php checked($get_option('bt_event_coupon_apply')); ?>>
                <?php _e('Coupon Apply/Remove', 'behaviour-tracker'); ?>
            </label>
        </div>

        <!-- Section 4: Checkout & Purchase -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 4: Checkout & Purchase', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_checkout_start" value="1" <?php checked($get_option('bt_event_checkout_start')); ?>>
                <?php _e('Checkout Start', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_checkout_step" value="1" <?php checked($get_option('bt_event_checkout_step')); ?>>
                <?php _e('Checkout Step Completed', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_shipping_method" value="1" <?php checked($get_option('bt_event_shipping_method')); ?>>
                <?php _e('Shipping Method Selected', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_payment_method" value="1" <?php checked($get_option('bt_event_payment_method')); ?>>
                <?php _e('Payment Method Selected', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_purchase_completed" value="1" <?php checked($get_option('bt_event_purchase_completed')); ?>>
                <?php _e('Purchase Completed', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_payment_failed" value="1" <?php checked($get_option('bt_event_payment_failed')); ?>>
                <?php _e('Payment Failed', 'behaviour-tracker'); ?>
            </label>
        </div>

        <!-- Section 5: User Account -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 5: User Account', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_registration" value="1" <?php checked($get_option('bt_event_registration')); ?>>
                <?php _e('Registration', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_login" value="1" <?php checked($get_option('bt_event_login')); ?>>
                <?php _e('Login', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_logout" value="1" <?php checked($get_option('bt_event_logout')); ?>>
                <?php _e('Logout', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_password_reset" value="1" <?php checked($get_option('bt_event_password_reset')); ?>>
                <?php _e('Password Reset', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_profile_update" value="1" <?php checked($get_option('bt_event_profile_update')); ?>>
                <?php _e('Profile Update', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_wishlist" value="1" <?php checked($get_option('bt_event_wishlist')); ?>>
                <?php _e('Wishlist Add/Remove', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_address_book" value="1" <?php checked($get_option('bt_event_address_book')); ?>>
                <?php _e('Address Book Operations', 'behaviour-tracker'); ?>
            </label>
        </div>

        <!-- Section 6: Search & Filters -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 6: Search & Filters', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_search_query" value="1" <?php checked($get_option('bt_event_search_query')); ?>>
                <?php _e('Search Query', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_search_autocomplete" value="1" <?php checked($get_option('bt_event_search_autocomplete')); ?>>
                <?php _e('Search Autocomplete', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_filter_applied" value="1" <?php checked($get_option('bt_event_filter_applied')); ?>>
                <?php _e('Filter Applied', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_sort_changed" value="1" <?php checked($get_option('bt_event_sort_changed')); ?>>
                <?php _e('Sort Changed', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_zero_results" value="1" <?php checked($get_option('bt_event_zero_results')); ?>>
                <?php _e('Zero Results', 'behaviour-tracker'); ?>
            </label>
        </div>

        <!-- Section 7: Marketing & Promotions -->
        <div class="bt-section">
            <h2>
                <?php _e('Section 7: Marketing & Promotions', 'behaviour-tracker'); ?>
            </h2>

            <label><input type="checkbox" name="bt_event_newsletter_signup" value="1" <?php checked($get_option('bt_event_newsletter_signup')); ?>>
                <?php _e('Newsletter Signup', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_popup_interaction" value="1" <?php checked($get_option('bt_event_popup_interaction')); ?>>
                <?php _e('Popup Interaction', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_banner_click" value="1" <?php checked($get_option('bt_event_banner_click')); ?>>
                <?php _e('Banner Click', 'behaviour-tracker'); ?>
            </label><br>
            <label><input type="checkbox" name="bt_event_social_share" value="1" <?php checked($get_option('bt_event_social_share')); ?>>
                <?php _e('Social Share', 'behaviour-tracker'); ?>
            </label>
        </div>

        <p class="submit">
            <input type="submit" name="bt_save_settings" class="button button-primary"
                value="<?php _e('Save Settings', 'behaviour-tracker'); ?>">
        </p>
    </form>
</div>