# WooCommerce HPOS Compatibility Fix

## Issue
The plugin was showing a warning: "This plugin is incompatible with the enabled WooCommerce feature 'High-Performance order storage'"

## Solution Implemented

### 1. Declared HPOS Compatibility
Added the required compatibility declaration in the main plugin file using WooCommerce's `FeaturesUtil` class:

```php
public function declare_hpos_compatibility() {
    if (class_exists('\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
    }
}
```

This is hooked into `before_woocommerce_init` action to ensure it runs before WooCommerce checks for compatibility.

### 2. Verified HPOS-Compatible Order Methods
The plugin already uses `wc_get_order()` which is HPOS-compatible and works with both:
- Traditional post-based order storage
- New High-Performance Order Storage (HPOS/COT)

All order methods used are HPOS-compatible:
- `$order->get_items()`
- `$order->get_billing_email()`
- `$order->get_total()`
- `$order->get_subtotal()`
- `$order->get_total_tax()`
- `$order->get_shipping_total()`
- `$order->get_discount_total()`
- `$order->get_payment_method()`
- `$order->get_shipping_method()`
- `$order->get_currency()`
- `$order->get_billing_country()`
- `$order->get_shipping_country()`

## Testing
After this fix:
1. The HPOS compatibility warning should disappear
2. The plugin will work correctly with both traditional and HPOS order storage
3. No changes needed to existing tracking functionality

## Files Modified
- `behaviour-tracker-wordpress.php` - Added HPOS compatibility declaration
- `includes/server-events.php` - Added clarifying comment about HPOS compatibility
