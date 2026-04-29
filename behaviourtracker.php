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
        $this->version = '1.0.0';
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
        Configuration::updateValue('BT_WEBSITE_ID', '');

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
        Configuration::deleteByName('BT_WEBSITE_ID');

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
                            'desc' => $this->l('This ID is sent with every event as website_id so you can distinguish data sources. If empty, config.php website_id is used.'),
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
            Configuration::updateValue($key, Tools::getValue($key));
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
        $webhookUrl = ''; // No default fallback
        $websiteId = Configuration::get('BT_WEBSITE_ID');

        if (file_exists($externalConfigPath)) {
            $externalConfig = include($externalConfigPath);
            if (is_array($externalConfig) && isset($externalConfig['webhook_url'])) {
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

            if (empty($websiteId) && is_array($externalConfig) && isset($externalConfig['website_id'])) {
                $websiteId = (string) $externalConfig['website_id'];
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

        $config['BT_WEBSITE_ID'] = (string) $websiteId;

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

    public function hookDisplayHeader()
    {
        return $this->hookHeader();
    }
}
