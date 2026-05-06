<?php
/**
 * Upgrade script for Behaviour Tracker 1.0.3.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_0_3($module)
{
    $ok = true;

    if (method_exists($module, 'registerHook')) {
        $ok = $module->registerHook('actionValidateOrder') && $ok;
    }

    if (Configuration::get('BT_WEBHOOK_URL') === false) {
        $ok = Configuration::updateValue('BT_WEBHOOK_URL', 'https://tracker.yatootunisie.tn/webhook') && $ok;
    }

    if (Configuration::get('BT_SERVER_SECRET_KEY') === false) {
        $ok = Configuration::updateValue('BT_SERVER_SECRET_KEY', '') && $ok;
    }

    return $ok;
}
