<?php
/**
 * Upgrade script for Behaviour Tracker 1.0.7.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_0_7($module)
{
    $ok = true;

    if (method_exists($module, 'registerHook')) {
        $ok = $module->registerHook('actionValidateOrder') && $ok;
        $ok = $module->registerHook('actionOrderStatusUpdate') && $ok;
        $ok = $module->registerHook('actionOrderStatusPostUpdate') && $ok;
        $ok = $module->registerHook('actionCustomerAccountAdd') && $ok;
        $ok = $module->registerHook('actionAuthentication') && $ok;
        $ok = $module->registerHook('actionCustomerLogoutAfter') && $ok;
    }

    if (Configuration::get('BT_EVENT_ORDER_STATUS_CHANGED') === false) {
        $ok = Configuration::updateValue('BT_EVENT_ORDER_STATUS_CHANGED', true) && $ok;
    }

    return $ok;
}
