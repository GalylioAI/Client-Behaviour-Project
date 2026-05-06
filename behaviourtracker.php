<?php
/**
 * 2007-2026 PrestaShop
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Academic Free License (AFL 3.0)
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/afl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@prestashop.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade PrestaShop to newer
 * versions in the future. If you wish to customize PrestaShop for your
 * needs please refer to http://www.prestashop.com for more information.
 *
 *  @author    PrestaShop SA <contact@prestashop.com>
 *  @copyright 2007-2026 PrestaShop SA
 *  @license   http://opensource.org/licenses/afl-3.0.php  Academic Free License (AFL 3.0)
 *  International Registered Trademark & Property of PrestaShop SA
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class BehaviourTracker extends Module
{
    public function __construct()
    {
        $this->name = 'behaviourtracker';
        $this->tab = 'analytics_stats';
        $this->version = '1.0.4';
        $this->author = 'Galylio';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7',
            'max' => '9.0.2',
        ];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Customer Behaviour Tracker');
        $this->description = $this->l('Tracks customer behaviour and sends data to a webhook for analysis.');

        $this->confirmUninstall = $this->l('Are you sure you want to uninstall?');
    }

    public function install()
    {
        return parent::install() &&
            $this->registerHook('header') &&
            $this->registerHook('displayHeader') &&
            $this->registerHook('actionValidateOrder') &&
            $this->registerHook('actionOrderStatusUpdate') &&
            $this->registerHook('actionOrderStatusPostUpdate') &&
            $this->installFixtures();
    }

    public function installFixtures()
    {
        // Default settings
        Configuration::updateValue('BT_SEC_SESSION_NAV', true);
        Configuration::updateValue('BT_EVENT_PAGE_VIEW', true);
        Configuration::updateValue('BT_EL_PV_URL', true);
        Configuration::updateValue('BT_EL_PV_TITLE', true);
        Configuration::updateValue('BT_EL_PV_REF', true);
        Configuration::updateValue('BT_EL_PV_UA', true);
        Configuration::updateValue('BT_EVENT_SESSION_START', true);
        Configuration::updateValue('BT_EVENT_SESSION_END', true);
        Configuration::updateValue('BT_EVENT_SCROLL_DEPTH', true);
        Configuration::updateValue('BT_EVENT_CLICK', true);
        Configuration::updateValue('BT_DEBUG_MODE', false);

        // Product Events
        Configuration::updateValue('BT_EVENT_PRODUCT_VIEW', true);
        Configuration::updateValue('BT_EVENT_PRODUCT_IMPRESSION', true);
        Configuration::updateValue('BT_EVENT_PRODUCT_QUICK_VIEW', true);

        // Cart Events
        Configuration::updateValue('BT_EVENT_CART_UPDATE', true);
        Configuration::updateValue('BT_EVENT_CART_VIEW', true);
        Configuration::updateValue('BT_EVENT_CART_QUANTITY_CHANGE', true);
        Configuration::updateValue('BT_EVENT_COUPON_APPLY', true);

        // Checkout Events
        Configuration::updateValue('BT_EVENT_CHECKOUT_START', true);
        Configuration::updateValue('BT_EVENT_CHECKOUT_STEP', true);
        Configuration::updateValue('BT_EVENT_SHIPPING_METHOD', true);
        Configuration::updateValue('BT_EVENT_PAYMENT_METHOD', true);
        Configuration::updateValue('BT_EVENT_PURCHASE_COMPLETED', true);
        Configuration::updateValue('BT_EVENT_ORDER_STATUS_CHANGED', true);
        Configuration::updateValue('BT_EVENT_PAYMENT_FAILED', true);

        // Account Events
        Configuration::updateValue('BT_EVENT_REGISTRATION', true);
        Configuration::updateValue('BT_EVENT_LOGIN', true);
        Configuration::updateValue('BT_EVENT_LOGOUT', true);
        Configuration::updateValue('BT_EVENT_PASSWORD_RESET', true);
        Configuration::updateValue('BT_EVENT_PROFILE_UPDATE', true);
        Configuration::updateValue('BT_EVENT_WISHLIST', true);
        Configuration::updateValue('BT_EVENT_ADDRESS_BOOK', true);

        // Search Events
        Configuration::updateValue('BT_EVENT_SEARCH_QUERY', true);
        Configuration::updateValue('BT_EVENT_SEARCH_AUTOCOMPLETE', true);
        Configuration::updateValue('BT_EVENT_FILTER_APPLIED', true);
        Configuration::updateValue('BT_EVENT_SORT_CHANGED', true);
        Configuration::updateValue('BT_EVENT_ZERO_RESULTS', true);

        // Marketing Events
        Configuration::updateValue('BT_EVENT_NEWSLETTER_SIGNUP', true);
        Configuration::updateValue('BT_EVENT_POPUP_INTERACTION', true);
        Configuration::updateValue('BT_EVENT_BANNER_CLICK', true);
        Configuration::updateValue('BT_EVENT_SOCIAL_SHARE', true);
        Configuration::updateValue('BT_WEBHOOK_URL', 'https://tracker.yatootunisie.tn/webhook');
        Configuration::updateValue('BT_WEBSITE_ID', '');
        Configuration::updateValue('BT_WRITE_KEY', '');
        Configuration::updateValue('BT_SERVER_SECRET_KEY', '');

        return true;
    }

    public function uninstall()
    {
        Configuration::deleteByName('BT_SEC_SESSION_NAV');
        Configuration::deleteByName('BT_EVENT_PAGE_VIEW');
        Configuration::deleteByName('BT_EL_PV_URL');
        Configuration::deleteByName('BT_EL_PV_TITLE');
        Configuration::deleteByName('BT_EL_PV_REF');
        Configuration::deleteByName('BT_EL_PV_UA');
        Configuration::deleteByName('BT_EVENT_SESSION_START');
        Configuration::deleteByName('BT_EVENT_SESSION_END');
        Configuration::deleteByName('BT_EVENT_SCROLL_DEPTH');
        Configuration::deleteByName('BT_EVENT_SCROLL_DEPTH');
        Configuration::deleteByName('BT_EVENT_CLICK');
        Configuration::deleteByName('BT_DEBUG_MODE');
        Configuration::deleteByName('BT_EVENT_PRODUCT_VIEW');
        Configuration::deleteByName('BT_EVENT_PRODUCT_IMPRESSION');
        Configuration::deleteByName('BT_EVENT_PRODUCT_QUICK_VIEW');
        Configuration::deleteByName('BT_EVENT_CART_UPDATE');
        Configuration::deleteByName('BT_EVENT_CART_VIEW');
        Configuration::deleteByName('BT_EVENT_CART_QUANTITY_CHANGE');
        Configuration::deleteByName('BT_EVENT_COUPON_APPLY');
        Configuration::deleteByName('BT_EVENT_CHECKOUT_START');
        Configuration::deleteByName('BT_EVENT_CHECKOUT_STEP');
        Configuration::deleteByName('BT_EVENT_SHIPPING_METHOD');
        Configuration::deleteByName('BT_EVENT_PAYMENT_METHOD');
        Configuration::deleteByName('BT_EVENT_PURCHASE_COMPLETED');
        Configuration::deleteByName('BT_EVENT_ORDER_STATUS_CHANGED');
        Configuration::deleteByName('BT_EVENT_PAYMENT_FAILED');
        Configuration::deleteByName('BT_EVENT_REGISTRATION');
        Configuration::deleteByName('BT_EVENT_LOGIN');
        Configuration::deleteByName('BT_EVENT_LOGOUT');
        Configuration::deleteByName('BT_EVENT_PASSWORD_RESET');
        Configuration::deleteByName('BT_EVENT_PROFILE_UPDATE');
        Configuration::deleteByName('BT_EVENT_WISHLIST');
        Configuration::deleteByName('BT_EVENT_ADDRESS_BOOK');
        Configuration::deleteByName('BT_EVENT_SEARCH_QUERY');
        Configuration::deleteByName('BT_EVENT_SEARCH_AUTOCOMPLETE');
        Configuration::deleteByName('BT_EVENT_FILTER_APPLIED');
        Configuration::deleteByName('BT_EVENT_SORT_CHANGED');
        Configuration::deleteByName('BT_EVENT_ZERO_RESULTS');
        Configuration::deleteByName('BT_EVENT_NEWSLETTER_SIGNUP');
        Configuration::deleteByName('BT_EVENT_POPUP_INTERACTION');
        Configuration::deleteByName('BT_EVENT_BANNER_CLICK');
        Configuration::deleteByName('BT_EVENT_SOCIAL_SHARE');
        Configuration::deleteByName('BT_WEBHOOK_URL');
        Configuration::deleteByName('BT_WEBSITE_ID');
        Configuration::deleteByName('BT_WRITE_KEY');
        Configuration::deleteByName('BT_SERVER_SECRET_KEY');

        return parent::uninstall();
    }

    /**
     * Load the configuration form
     */
    public function getContent()
    {
        if (((bool) Tools::isSubmit('submitBehaviourTrackerModule')) == true) {
            $this->postProcess();
        }

        return $this->renderForm();
    }

    /**
     * Create the form that will be displayed in the configuration of your module.
     */
    protected function renderForm()
    {
        $helper = new HelperForm();

        $helper->show_toolbar = false;
        $helper->table = $this->table;
        $helper->module = $this;
        $helper->default_form_language = $this->context->language->id;
        $helper->allow_employee_form_lang = Configuration::get('PS_BO_ALLOW_EMPLOYEE_FORM_LANG', 0);

        $helper->identifier = $this->identifier;
        $helper->submit_action = 'submitBehaviourTrackerModule';
        $helper->currentIndex = $this->context->link->getAdminLink('AdminModules', false)
            . '&configure=' . $this->name . '&tab_module=' . $this->tab . '&module_name=' . $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');

        $helper->tpl_vars = array(
            'fields_value' => $this->getConfigFormValues(),
            'languages' => $this->context->controller->getLanguages(),
            'id_language' => $this->context->language->id,
        );

        return $helper->generateForm($this->getConfigForm());
    }

    /**
     * Create the structure of your form.
     */
    protected function getConfigForm()
    {
        return array(
            array(
                'form' => array(
                    'legend' => array(
                        'title' => $this->l('Section 1: User Session & Navigation'),
                        'icon' => 'icon-user',
                    ),
                    'input' => array(
                        // Master Switch
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Section'),
                            'name' => 'BT_SEC_SESSION_NAV',
                            'is_bool' => true,
                            'desc' => $this->l('Master switch for all session and navigation tracking.'),
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Debug Mode'),
                            'name' => 'BT_DEBUG_MODE',
                            'is_bool' => true,
                            'desc' => $this->l('Log events to browser console.'),
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'text',
                            'label' => $this->l('Website Identifier'),
                            'name' => 'BT_WEBSITE_ID',
                            'desc' => $this->l('This ID is sent with every event as site_id so you can distinguish data sources. If empty, config.php site_id is used.'),
                        ),
                        array(
                            'type' => 'text',
                            'label' => $this->l('Public Write Key'),
                            'name' => 'BT_WRITE_KEY',
                            'desc' => $this->l('Generated by the SaaS for this website. Browser events use this key together with site_id and allowed domain validation.'),
                        ),
                        array(
                            'type' => 'text',
                            'label' => $this->l('Webhook URL'),
                            'name' => 'BT_WEBHOOK_URL',
                            'desc' => $this->l('All browser and server events are sent to this endpoint.'),
                        ),
                        array(
                            'type' => 'password',
                            'label' => $this->l('Server Secret Key'),
                            'name' => 'BT_SERVER_SECRET_KEY',
                            'desc' => $this->l('Required for server-side order purchase events. Keep this private.'),
                        ),

                        // Header: PAGE_VIEW
                        array(
                            'type' => 'html',
                            'name' => 'html_data_pv',
                            'html_content' => '<h4 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">' . $this->l('PAGE_VIEW') . '</h4>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Event'),
                            'name' => 'BT_EVENT_PAGE_VIEW',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        // Data Elements for Page View
                        array(
                            'type' => 'switch',
                            'label' => $this->l(' - Data: URL'),
                            'name' => 'BT_EL_PV_URL',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l(' - Data: Page Title'),
                            'name' => 'BT_EL_PV_TITLE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l(' - Data: Referrer'),
                            'name' => 'BT_EL_PV_REF',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l(' - Data: User Agent'),
                            'name' => 'BT_EL_PV_UA',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Header: SESSION_START
                        array(
                            'type' => 'html',
                            'name' => 'html_data_ss',
                            'html_content' => '<h4 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">' . $this->l('SESSION_START') . '</h4>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Event'),
                            'name' => 'BT_EVENT_SESSION_START',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Header: SESSION_END
                        array(
                            'type' => 'html',
                            'name' => 'html_data_se',
                            'html_content' => '<h4 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">' . $this->l('SESSION_END') . '</h4>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Event'),
                            'name' => 'BT_EVENT_SESSION_END',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Header: SCROLL_DEPTH
                        array(
                            'type' => 'html',
                            'name' => 'html_data_sd',
                            'html_content' => '<h4 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">' . $this->l('SCROLL_DEPTH') . '</h4>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Event'),
                            'name' => 'BT_EVENT_SCROLL_DEPTH',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Header: CLICK_EVENT
                        array(
                            'type' => 'html',
                            'name' => 'html_data_cl',
                            'html_content' => '<h4 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">' . $this->l('CLICK_EVENT') . '</h4>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Enable Event'),
                            'name' => 'BT_EVENT_CLICK',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: Product Discovery
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_prod',
                            'html_content' => '<hr><h3>' . $this->l('Section 2: Product Discovery') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Product View'),
                            'name' => 'BT_EVENT_PRODUCT_VIEW',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Product Impression (Lists)'),
                            'name' => 'BT_EVENT_PRODUCT_IMPRESSION',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Quick View'),
                            'name' => 'BT_EVENT_PRODUCT_QUICK_VIEW',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: Cart
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_cart',
                            'html_content' => '<hr><h3>' . $this->l('Section 3: Shopping Cart') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Cart Updates (Add/Remove)'),
                            'name' => 'BT_EVENT_CART_UPDATE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Cart View'),
                            'name' => 'BT_EVENT_CART_VIEW',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Quantity Change'),
                            'name' => 'BT_EVENT_CART_QUANTITY_CHANGE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Coupon Apply/Remove'),
                            'name' => 'BT_EVENT_COUPON_APPLY',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: Checkout & Purchase
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_checkout',
                            'html_content' => '<hr><h3>' . $this->l('Section 4: Checkout & Purchase') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Checkout Start'),
                            'name' => 'BT_EVENT_CHECKOUT_START',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Checkout Step Completed'),
                            'name' => 'BT_EVENT_CHECKOUT_STEP',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Shipping Method Selected'),
                            'name' => 'BT_EVENT_SHIPPING_METHOD',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Payment Method Selected'),
                            'name' => 'BT_EVENT_PAYMENT_METHOD',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Purchase Completed'),
                            'name' => 'BT_EVENT_PURCHASE_COMPLETED',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Order Status Changed / Cancelled'),
                            'name' => 'BT_EVENT_ORDER_STATUS_CHANGED',
                            'is_bool' => true,
                            'desc' => $this->l('Tracks admin/backend order changes such as cancelled, refunded, failed, or restored orders.'),
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Payment Failed'),
                            'name' => 'BT_EVENT_PAYMENT_FAILED',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: User Account
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_account',
                            'html_content' => '<hr><h3>' . $this->l('Section 5: User Account') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Registration'),
                            'name' => 'BT_EVENT_REGISTRATION',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Login'),
                            'name' => 'BT_EVENT_LOGIN',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Logout'),
                            'name' => 'BT_EVENT_LOGOUT',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Password Reset'),
                            'name' => 'BT_EVENT_PASSWORD_RESET',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Profile Update'),
                            'name' => 'BT_EVENT_PROFILE_UPDATE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Wishlist Add/Remove'),
                            'name' => 'BT_EVENT_WISHLIST',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Address Book Operations'),
                            'name' => 'BT_EVENT_ADDRESS_BOOK',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: Search & Filter
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_search',
                            'html_content' => '<hr><h3>' . $this->l('Section 6: Search & Filters') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Search Query'),
                            'name' => 'BT_EVENT_SEARCH_QUERY',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Search Autocomplete'),
                            'name' => 'BT_EVENT_SEARCH_AUTOCOMPLETE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Filter Applied'),
                            'name' => 'BT_EVENT_FILTER_APPLIED',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Sort Changed'),
                            'name' => 'BT_EVENT_SORT_CHANGED',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Zero Results'),
                            'name' => 'BT_EVENT_ZERO_RESULTS',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),

                        // Section: Marketing
                        array(
                            'type' => 'html',
                            'name' => 'html_sec_marketing',
                            'html_content' => '<hr><h3>' . $this->l('Section 7: Marketing & Promotions') . '</h3>',
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Newsletter Signup'),
                            'name' => 'BT_EVENT_NEWSLETTER_SIGNUP',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Popup Interaction'),
                            'name' => 'BT_EVENT_POPUP_INTERACTION',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Banner Click'),
                            'name' => 'BT_EVENT_BANNER_CLICK',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                        array(
                            'type' => 'switch',
                            'label' => $this->l('Social Share'),
                            'name' => 'BT_EVENT_SOCIAL_SHARE',
                            'is_bool' => true,
                            'values' => array(
                                array('id' => 'active_on', 'value' => true, 'label' => $this->l('Enabled')),
                                array('id' => 'active_off', 'value' => false, 'label' => $this->l('Disabled'))
                            ),
                        ),
                    ),
                    'submit' => array(
                        'title' => $this->l('Save Settings'),
                    ),
                ),
            ),
        );
    }

    /**
     * Set values for the inputs.
     */
    protected function getConfigFormValues()
    {
        return array(
            'BT_WEBSITE_ID' => Configuration::get('BT_WEBSITE_ID', ''),
            'BT_WRITE_KEY' => Configuration::get('BT_WRITE_KEY', ''),
            'BT_WEBHOOK_URL' => Configuration::get('BT_WEBHOOK_URL', 'https://tracker.yatootunisie.tn/webhook'),
            'BT_SERVER_SECRET_KEY' => Configuration::get('BT_SERVER_SECRET_KEY', ''),
            'BT_SEC_SESSION_NAV' => Configuration::get('BT_SEC_SESSION_NAV', true),
            'BT_EVENT_PAGE_VIEW' => Configuration::get('BT_EVENT_PAGE_VIEW', true),
            'BT_EL_PV_URL' => Configuration::get('BT_EL_PV_URL', true),
            'BT_EL_PV_TITLE' => Configuration::get('BT_EL_PV_TITLE', true),
            'BT_EL_PV_REF' => Configuration::get('BT_EL_PV_REF', true),
            'BT_EL_PV_UA' => Configuration::get('BT_EL_PV_UA', true),
            'BT_EVENT_SESSION_START' => Configuration::get('BT_EVENT_SESSION_START', true),
            'BT_EVENT_SESSION_END' => Configuration::get('BT_EVENT_SESSION_END', true),
            'BT_EVENT_SCROLL_DEPTH' => Configuration::get('BT_EVENT_SCROLL_DEPTH', true),
            'BT_EVENT_SCROLL_DEPTH' => Configuration::get('BT_EVENT_SCROLL_DEPTH', true),
            'BT_EVENT_CLICK' => Configuration::get('BT_EVENT_CLICK', true),
            'BT_DEBUG_MODE' => Configuration::get('BT_DEBUG_MODE', false),
            'BT_EVENT_PRODUCT_VIEW' => Configuration::get('BT_EVENT_PRODUCT_VIEW', true),
            'BT_EVENT_PRODUCT_IMPRESSION' => Configuration::get('BT_EVENT_PRODUCT_IMPRESSION', true),
            'BT_EVENT_PRODUCT_QUICK_VIEW' => Configuration::get('BT_EVENT_PRODUCT_QUICK_VIEW', true),
            'BT_EVENT_CART_UPDATE' => Configuration::get('BT_EVENT_CART_UPDATE', true),
            'BT_EVENT_CART_VIEW' => Configuration::get('BT_EVENT_CART_VIEW', true),
            'BT_EVENT_CART_QUANTITY_CHANGE' => Configuration::get('BT_EVENT_CART_QUANTITY_CHANGE', true),
            'BT_EVENT_COUPON_APPLY' => Configuration::get('BT_EVENT_COUPON_APPLY', true),
            'BT_EVENT_CHECKOUT_START' => Configuration::get('BT_EVENT_CHECKOUT_START', true),
            'BT_EVENT_CHECKOUT_STEP' => Configuration::get('BT_EVENT_CHECKOUT_STEP', true),
            'BT_EVENT_SHIPPING_METHOD' => Configuration::get('BT_EVENT_SHIPPING_METHOD', true),
            'BT_EVENT_PAYMENT_METHOD' => Configuration::get('BT_EVENT_PAYMENT_METHOD', true),
            'BT_EVENT_PURCHASE_COMPLETED' => Configuration::get('BT_EVENT_PURCHASE_COMPLETED', true),
            'BT_EVENT_ORDER_STATUS_CHANGED' => Configuration::get('BT_EVENT_ORDER_STATUS_CHANGED', true),
            'BT_EVENT_PAYMENT_FAILED' => Configuration::get('BT_EVENT_PAYMENT_FAILED', true),
            'BT_EVENT_REGISTRATION' => Configuration::get('BT_EVENT_REGISTRATION', true),
            'BT_EVENT_LOGIN' => Configuration::get('BT_EVENT_LOGIN', true),
            'BT_EVENT_LOGOUT' => Configuration::get('BT_EVENT_LOGOUT', true),
            'BT_EVENT_PASSWORD_RESET' => Configuration::get('BT_EVENT_PASSWORD_RESET', true),
            'BT_EVENT_PROFILE_UPDATE' => Configuration::get('BT_EVENT_PROFILE_UPDATE', true),
            'BT_EVENT_WISHLIST' => Configuration::get('BT_EVENT_WISHLIST', true),
            'BT_EVENT_ADDRESS_BOOK' => Configuration::get('BT_EVENT_ADDRESS_BOOK', true),
            'BT_EVENT_SEARCH_QUERY' => Configuration::get('BT_EVENT_SEARCH_QUERY', true),
            'BT_EVENT_SEARCH_AUTOCOMPLETE' => Configuration::get('BT_EVENT_SEARCH_AUTOCOMPLETE', true),
            'BT_EVENT_FILTER_APPLIED' => Configuration::get('BT_EVENT_FILTER_APPLIED', true),
            'BT_EVENT_SORT_CHANGED' => Configuration::get('BT_EVENT_SORT_CHANGED', true),
            'BT_EVENT_ZERO_RESULTS' => Configuration::get('BT_EVENT_ZERO_RESULTS', true),
            'BT_EVENT_NEWSLETTER_SIGNUP' => Configuration::get('BT_EVENT_NEWSLETTER_SIGNUP', true),
            'BT_EVENT_POPUP_INTERACTION' => Configuration::get('BT_EVENT_POPUP_INTERACTION', true),
            'BT_EVENT_BANNER_CLICK' => Configuration::get('BT_EVENT_BANNER_CLICK', true),
            'BT_EVENT_SOCIAL_SHARE' => Configuration::get('BT_EVENT_SOCIAL_SHARE', true),
        );
    }

    /**
     * Save form data.
     */
    protected function postProcess()
    {
        $form_values = $this->getConfigFormValues();

        foreach (array_keys($form_values) as $key) {
            $value = Tools::getValue($key);
            if ($key === 'BT_SERVER_SECRET_KEY' && $value === '') {
                continue;
            }
            Configuration::updateValue($key, $value);
        }
    }

    /**
     * Add the CSS & JavaScript files you want to be added on the FO.
     */
    public function hookHeader()
    {
        $context = $this->context;
        $customer = $context->customer;

        $config = $this->getConfigFormValues();

        // Load external config for webhook URL
        $externalConfigPath = dirname(__FILE__) . '/config.php';
        $configuredWebhookUrl = Configuration::get('BT_WEBHOOK_URL');
        $webhookUrl = $configuredWebhookUrl ?: 'https://tracker.yatootunisie.tn/webhook';
        $websiteId = Configuration::get('BT_WEBSITE_ID');
        $writeKey = Configuration::get('BT_WRITE_KEY');

        if (file_exists($externalConfigPath)) {
            $externalConfig = include($externalConfigPath);
            if (empty($configuredWebhookUrl) && is_array($externalConfig) && isset($externalConfig['webhook_url'])) {
                $webhookUrl = $externalConfig['webhook_url'];
            }
            // Get buffer interval from config (default to 10 if not set)
            if (isset($externalConfig['buffer_interval'])) {
                $config['BT_BUFFER_INTERVAL'] = (int) $externalConfig['buffer_interval'];
            } else {
                $config['BT_BUFFER_INTERVAL'] = 10; // default
            }

            // Get enabled sections from config (default to all enabled)
            if (isset($externalConfig['enabled_sections']) && is_array($externalConfig['enabled_sections'])) {
                $config['BT_ENABLED_SECTIONS'] = $externalConfig['enabled_sections'];
            } else {
                // Default: all sections enabled
                $config['BT_ENABLED_SECTIONS'] = [
                    'session_navigation' => true,
                    'product' => true,
                    'cart' => true,
                    'checkout' => true,
                    'account' => true,
                    'search' => true,
                    'marketing' => true,
                ];
            }

            if (empty($websiteId) && is_array($externalConfig) && isset($externalConfig['site_id'])) {
                $websiteId = (string) $externalConfig['site_id'];
            } elseif (empty($websiteId) && is_array($externalConfig) && isset($externalConfig['website_id'])) {
                $websiteId = (string) $externalConfig['website_id'];
            }
            if (empty($writeKey) && is_array($externalConfig) && isset($externalConfig['write_key'])) {
                $writeKey = (string) $externalConfig['write_key'];
            } elseif (empty($writeKey) && is_array($externalConfig) && isset($externalConfig['public_write_key'])) {
                $writeKey = (string) $externalConfig['public_write_key'];
            }
        } else {
            $config['BT_BUFFER_INTERVAL'] = 10; // default if config.php doesn't exist
            // Default: all sections enabled
            $config['BT_ENABLED_SECTIONS'] = [
                'session_navigation' => true,
                'product' => true,
                'cart' => true,
                'checkout' => true,
                'account' => true,
                'search' => true,
                'marketing' => true,
            ];
        }

        $config['BT_SCHEMA_VERSION'] = '1.0';
        $config['BT_SITE_ID'] = (string) $websiteId;
        $config['BT_WEBSITE_ID'] = (string) $websiteId; // Backward compatibility for older scripts.
        $config['BT_WRITE_KEY'] = (string) $writeKey;
        $config['BT_PUBLIC_WRITE_KEY'] = (string) $writeKey;
        $config['BT_PLATFORM'] = 'prestashop';
        $config['BT_SOURCE'] = 'client_js';

        // Define variables in JS
        Media::addJsDef([
            'behaviourTrackerWebhookUrl' => $webhookUrl,
            'bt_customer_id' => ($customer && $customer->isLogged()) ? (int) $customer->id : 'guest',
            'bt_customer_email' => ($customer && $customer->isLogged()) ? $customer->email : null,
            'bt_page_type' => $context->controller->php_self,
            'bt_config' => $config,
        ]);

        $this->context->controller->addJS($this->_path . '/views/js/utils/logger.js');
        $this->context->controller->addJS($this->_path . '/views/js/utils/buffer.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/session.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/navigation.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/product.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/cart.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/checkout.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/account.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/search.js');
        $this->context->controller->addJS($this->_path . '/views/js/trackers/marketing.js');
    }

    /**
     * Track confirmed PrestaShop orders on the server side.
     */
    public function hookActionValidateOrder($params)
    {
        if (!Configuration::get('BT_EVENT_PURCHASE_COMPLETED')) {
            return;
        }

        $order = isset($params['order']) ? $params['order'] : null;
        if (!$order || !Validate::isLoadedObject($order)) {
            return;
        }

        $customer = isset($params['customer']) ? $params['customer'] : null;
        $currency = isset($params['currency']) ? $params['currency'] : null;
        $orderStatus = isset($params['orderStatus']) ? $params['orderStatus'] : null;
        $products = method_exists($order, 'getProducts') ? $order->getProducts() : array();
        $items = array();

        foreach ($products as $product) {
            $items[] = array(
                'product_id' => isset($product['product_id']) ? (string) $product['product_id'] : '',
                'product_name' => isset($product['product_name']) ? (string) $product['product_name'] : '',
                'product_sku' => isset($product['product_reference']) ? (string) $product['product_reference'] : '',
                'quantity' => isset($product['product_quantity']) ? (int) $product['product_quantity'] : 0,
                'price' => isset($product['total_price_tax_incl']) ? (float) $product['total_price_tax_incl'] : 0,
            );
        }

        $customerId = isset($order->id_customer) ? (string) $order->id_customer : 'guest';
        $customerEmail = ($customer && isset($customer->email)) ? (string) $customer->email : '';
        $currencyIso = ($currency && isset($currency->iso_code)) ? (string) $currency->iso_code : '';

        $eventData = array(
            'event_id' => 'prestashop_order_' . (int) $order->id,
            'event' => 'purchase_completed',
            'event_type' => 'CHECKOUT & PURCHASE EVENTS',
            'timestamp' => date('c'),
            'customer_id' => $customerId,
            'customer_email' => $customerEmail,
            'order_id' => (string) $order->id,
            'order_reference' => isset($order->reference) ? (string) $order->reference : '',
            'order_status' => $this->getOrderStatusName($orderStatus),
            'order_total' => isset($order->total_paid_tax_incl) ? (float) $order->total_paid_tax_incl : 0,
            'order_subtotal' => isset($order->total_products_wt) ? (float) $order->total_products_wt : 0,
            'tax_amount' => isset($order->total_paid_tax_incl, $order->total_paid_tax_excl)
                ? (float) $order->total_paid_tax_incl - (float) $order->total_paid_tax_excl
                : 0,
            'shipping_cost' => isset($order->total_shipping_tax_incl) ? (float) $order->total_shipping_tax_incl : 0,
            'discount_amount' => isset($order->total_discounts_tax_incl) ? (float) $order->total_discounts_tax_incl : 0,
            'payment_method' => isset($order->payment) ? (string) $order->payment : '',
            'shipping_method' => isset($order->carrier) ? (string) $order->carrier : '',
            'currency' => $currencyIso,
            'items_purchased' => $items,
            'cart_id' => isset($order->id_cart) ? (string) $order->id_cart : '',
        );

        $this->sendServerEvent($eventData);
    }

    protected function getOrderStatusName($orderStatus)
    {
        if (!$orderStatus || !isset($orderStatus->name)) {
            return '';
        }

        if (is_array($orderStatus->name)) {
            $idLang = isset($this->context->language->id) ? (int) $this->context->language->id : 0;
            if ($idLang && isset($orderStatus->name[$idLang])) {
                return (string) $orderStatus->name[$idLang];
            }
            $first = reset($orderStatus->name);
            return $first ? (string) $first : '';
        }

        return (string) $orderStatus->name;
    }

    public function hookActionOrderStatusUpdate($params)
    {
        $idOrder = isset($params['id_order']) ? (int) $params['id_order'] : 0;
        if (!$idOrder) {
            return;
        }

        $order = new Order($idOrder);
        if (!Validate::isLoadedObject($order)) {
            return;
        }

        $GLOBALS['BT_PREVIOUS_ORDER_STATUS_' . $idOrder] = array(
            'id' => (int) $order->current_state,
            'name' => $this->getOrderStatusNameById((int) $order->current_state),
        );
    }

    public function hookActionOrderStatusPostUpdate($params)
    {
        if (!Configuration::get('BT_EVENT_ORDER_STATUS_CHANGED')) {
            return;
        }

        $idOrder = isset($params['id_order']) ? (int) $params['id_order'] : 0;
        if (!$idOrder) {
            return;
        }

        $order = new Order($idOrder);
        if (!Validate::isLoadedObject($order)) {
            return;
        }

        $newOrderStatus = isset($params['newOrderStatus']) ? $params['newOrderStatus'] : null;
        $newStatusId = ($newOrderStatus && isset($newOrderStatus->id)) ? (int) $newOrderStatus->id : (int) $order->current_state;
        $newStatusName = $this->getOrderStatusName($newOrderStatus);
        if (!$newStatusName) {
            $newStatusName = $this->getOrderStatusNameById($newStatusId);
        }

        $previous = isset($GLOBALS['BT_PREVIOUS_ORDER_STATUS_' . $idOrder])
            ? $GLOBALS['BT_PREVIOUS_ORDER_STATUS_' . $idOrder]
            : array('id' => 0, 'name' => '');
        unset($GLOBALS['BT_PREVIOUS_ORDER_STATUS_' . $idOrder]);

        $customer = isset($order->id_customer) ? new Customer((int) $order->id_customer) : null;
        $currency = isset($order->id_currency) ? new Currency((int) $order->id_currency) : null;
        $employeeId = isset($this->context->employee->id) ? (int) $this->context->employee->id : 0;
        $employeeEmail = isset($this->context->employee->email) ? (string) $this->context->employee->email : '';
        $eventName = $this->eventNameForOrderState($newStatusId, $newStatusName);

        $eventData = array(
            'event_id' => 'prestashop_order_' . $idOrder . '_status_' . (int) $previous['id'] . '_to_' . $newStatusId . '_' . date('YmdHis'),
            'event' => $eventName,
            'event_type' => 'ORDER LIFECYCLE EVENTS',
            'timestamp' => date('c'),
            'customer_id' => isset($order->id_customer) ? (string) $order->id_customer : 'guest',
            'customer_email' => ($customer && Validate::isLoadedObject($customer)) ? (string) $customer->email : '',
            'order_id' => (string) $order->id,
            'order_reference' => isset($order->reference) ? (string) $order->reference : '',
            'order_status_previous' => isset($previous['name']) ? (string) $previous['name'] : '',
            'order_status_previous_id' => isset($previous['id']) ? (int) $previous['id'] : 0,
            'order_status' => $newStatusName,
            'order_status_id' => $newStatusId,
            'order_status_change_type' => $eventName,
            'order_total' => isset($order->total_paid_tax_incl) ? (float) $order->total_paid_tax_incl : 0,
            'order_subtotal' => isset($order->total_products_wt) ? (float) $order->total_products_wt : 0,
            'tax_amount' => isset($order->total_paid_tax_incl, $order->total_paid_tax_excl)
                ? (float) $order->total_paid_tax_incl - (float) $order->total_paid_tax_excl
                : 0,
            'shipping_cost' => isset($order->total_shipping_tax_incl) ? (float) $order->total_shipping_tax_incl : 0,
            'discount_amount' => isset($order->total_discounts_tax_incl) ? (float) $order->total_discounts_tax_incl : 0,
            'payment_method' => isset($order->payment) ? (string) $order->payment : '',
            'shipping_method' => isset($order->carrier) ? (string) $order->carrier : '',
            'currency' => ($currency && Validate::isLoadedObject($currency)) ? (string) $currency->iso_code : '',
            'changed_by_employee_id' => $employeeId,
            'changed_by_employee_email' => $employeeEmail,
            'changed_in_admin' => $employeeId > 0,
        );

        $this->sendServerEvent($eventData);
    }

    protected function getOrderStatusNameById($statusId)
    {
        if (!$statusId) {
            return '';
        }

        $orderState = new OrderState((int) $statusId);
        if (!Validate::isLoadedObject($orderState)) {
            return '';
        }

        return $this->getOrderStatusName($orderState);
    }

    protected function eventNameForOrderState($statusId, $statusName)
    {
        $cancelledId = (int) Configuration::get('PS_OS_CANCELED');
        $refundedId = (int) Configuration::get('PS_OS_REFUND');
        $failedId = (int) Configuration::get('PS_OS_ERROR');
        $name = Tools::strtolower((string) $statusName);

        if (($cancelledId && (int) $statusId === $cancelledId) || strpos($name, 'cancel') !== false || strpos($name, 'annul') !== false) {
            return 'order_cancelled';
        }
        if (($refundedId && (int) $statusId === $refundedId) || strpos($name, 'refund') !== false || strpos($name, 'rembours') !== false) {
            return 'order_refunded';
        }
        if (($failedId && (int) $statusId === $failedId) || strpos($name, 'error') !== false || strpos($name, 'failed') !== false || strpos($name, 'erreur') !== false) {
            return 'order_failed';
        }

        return 'order_status_changed';
    }

    protected function sendServerEvent($eventData)
    {
        $externalConfig = $this->getExternalConfig();
        $webhookUrl = $this->getConfiguredValue('BT_WEBHOOK_URL', array('webhook_url'), 'https://tracker.yatootunisie.tn/webhook', $externalConfig);
        $siteId = $this->getConfiguredValue('BT_WEBSITE_ID', array('site_id', 'website_id'), '', $externalConfig);
        $serverSecret = $this->getConfiguredValue('BT_SERVER_SECRET_KEY', array('server_secret_key', 'secret_key'), '', $externalConfig);

        if (!$webhookUrl || !$siteId || !$serverSecret) {
            $this->logDebug('Server event skipped: missing webhook URL, site ID, or server secret key.');
            return false;
        }

        $standardEvent = $this->standardizeServerEvent($eventData);
        $payload = array(
            'schema_version' => '1.0',
            'site_id' => $siteId,
            'platform' => 'prestashop',
            'write_key' => $serverSecret,
            'source' => 'server_php',
            'sent_at' => date('c'),
            'batch_timestamp' => date('c'),
            'server_side' => true,
            'events' => array($standardEvent),
        );

        $sent = $this->postJson($webhookUrl, $payload);
        if (!$sent) {
            $this->logDebug('Failed to send server purchase event for order ' . (isset($eventData['order_id']) ? $eventData['order_id'] : 'unknown'));
        }

        return $sent;
    }

    protected function getExternalConfig()
    {
        $path = dirname(__FILE__) . '/config.php';
        if (!file_exists($path)) {
            return array();
        }

        $config = include($path);
        return is_array($config) ? $config : array();
    }

    protected function getConfiguredValue($configurationKey, $configKeys, $default, $externalConfig)
    {
        $value = Configuration::get($configurationKey);
        if ($value !== false && $value !== null && $value !== '') {
            return (string) $value;
        }

        foreach ($configKeys as $configKey) {
            if (isset($externalConfig[$configKey]) && $externalConfig[$configKey] !== '') {
                return (string) $externalConfig[$configKey];
            }
        }

        return $default;
    }

    protected function standardizeServerEvent($eventData)
    {
        $reserved = array(
            'schema_version', 'event_id', 'event', 'event_name', 'name', 'event_type', 'event_category', 'category',
            'timestamp', 'session_id', 'visitor_id', 'user_id', 'customer_id', 'customer_email',
            'page', 'page_url', 'url', 'page_type', 'page_title', 'referrer_url', 'referrer',
            'site_id', 'siteId', 'website_id', 'context', 'properties', 'data'
        );
        $properties = array();

        foreach ($eventData as $key => $value) {
            if (!in_array($key, $reserved, true)) {
                $properties[$key] = $value;
            }
        }

        $eventName = isset($eventData['event_name'])
            ? $eventData['event_name']
            : (isset($eventData['event']) ? $eventData['event'] : 'unknown');
        $eventCategory = isset($eventData['event_category'])
            ? $eventData['event_category']
            : (isset($eventData['event_type']) ? $eventData['event_type'] : '');

        return array(
            'event_id' => isset($eventData['event_id']) ? $eventData['event_id'] : uniqid('prestashop_', true),
            'event_name' => $eventName,
            'event_category' => $this->normalizeEventCategory($eventCategory, $eventName),
            'timestamp' => isset($eventData['timestamp']) ? $eventData['timestamp'] : date('c'),
            'session_id' => isset($_COOKIE['bt_session_id']) ? $_COOKIE['bt_session_id'] : '',
            'visitor_id' => isset($_COOKIE['bt_visitor_id']) ? $_COOKIE['bt_visitor_id'] : '',
            'customer_id' => isset($eventData['customer_id']) ? (string) $eventData['customer_id'] : 'guest',
            'customer_email' => isset($eventData['customer_email']) ? (string) $eventData['customer_email'] : null,
            'page' => array(),
            'properties' => $properties,
            'context' => array(),
        );
    }

    protected function normalizeEventCategory($category, $eventName)
    {
        $value = strtolower((string) $category);
        $name = strtolower((string) $eventName);

        if (strpos($value, 'session') !== false || strpos($value, 'navigation') !== false) {
            return 'session_navigation';
        }
        if (strpos($value, 'product') !== false) {
            return 'product';
        }
        if (strpos($value, 'cart') !== false) {
            return 'cart';
        }
        if (strpos($value, 'checkout') !== false || strpos($value, 'purchase') !== false || strpos($value, 'payment') !== false || strpos($value, 'order') !== false) {
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

        if (strpos($name, 'purchase') !== false || strpos($name, 'checkout') !== false || strpos($name, 'payment') !== false || strpos($name, 'order_') !== false || strpos($name, 'cancel') !== false || strpos($name, 'refund') !== false) {
            return 'checkout';
        }

        return 'custom';
    }

    protected function postJson($url, $payload)
    {
        $json = json_encode($payload);
        if (!$json) {
            return false;
        }

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            $error = curl_error($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($error) {
                $this->logDebug('Server event HTTP error: ' . $error);
                return false;
            }

            return $status >= 200 && $status < 300;
        }

        $context = stream_context_create(array(
            'http' => array(
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $json,
                'timeout' => 5,
                'ignore_errors' => true,
            ),
        ));
        @file_get_contents($url, false, $context);

        if (!isset($http_response_header) || !is_array($http_response_header)) {
            return false;
        }

        foreach ($http_response_header as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) {
                $status = (int) $matches[1];
                return $status >= 200 && $status < 300;
            }
        }

        return false;
    }

    protected function logDebug($message)
    {
        if (!Configuration::get('BT_DEBUG_MODE')) {
            return;
        }

        if (class_exists('PrestaShopLogger')) {
            PrestaShopLogger::addLog('[BehaviourTracker] ' . $message, 1);
        }
    }

    public function hookDisplayHeader()
    {
        return $this->hookHeader();
    }
}
