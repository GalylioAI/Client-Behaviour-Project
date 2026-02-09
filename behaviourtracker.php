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
        $this->author = 'Antigravity';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7',
            'max' => '9.0.2',
        ];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('Customer Behaviour Tracker');
        $this->description = $this->l('Tracks page views and sends data to a webhook for analysis.');

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
        Configuration::updateValue('BT_BUFFER_INTERVAL', 5); // Default 5 seconds
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
        Configuration::deleteByName('BT_BUFFER_INTERVAL');

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

                        // Buffer Configuration
                        array(
                            'type' => 'text',
                            'label' => $this->l('Buffer Interval (seconds)'),
                            'name' => 'BT_BUFFER_INTERVAL',
                            'desc' => $this->l('Time in seconds to buffer events before sending to server.'),
                            'class' => 'fixed-width-sm',
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
            'BT_BUFFER_INTERVAL' => Configuration::get('BT_BUFFER_INTERVAL', 5),
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

        if (file_exists($externalConfigPath)) {
            $externalConfig = include($externalConfigPath);
            if (is_array($externalConfig) && isset($externalConfig['webhook_url'])) {
                $webhookUrl = $externalConfig['webhook_url'];
            }
        }

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
    }

    public function hookDisplayHeader()
    {
        return $this->hookHeader();
    }
}
