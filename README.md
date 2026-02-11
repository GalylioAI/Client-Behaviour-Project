# Behaviour Tracker for WordPress

A comprehensive behavior tracking plugin for WordPress/WooCommerce that tracks user interactions and sends event data to a webhook for analysis. This is the WordPress equivalent of the PrestaShop Behaviour Tracker extension.

## Features

- **7 Tracking Categories** with 40+ event types
- **Identical Event Data Structures** to PrestaShop version
- **Event Buffering System** with configurable intervals
- **Granular Configuration** - Enable/disable individual events
- **WooCommerce Integration** - Full e-commerce tracking
- **Server-Side & Client-Side** tracking
- **Debug Mode** for development

## Installation

1. Upload the `wordpress-behaviour-tracker` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Configure webhook URL in `config.php`
4. Go to Settings > Behaviour Tracker to configure events

## Configuration

Edit `config.php` to set:
- **webhook_url**: Your webhook endpoint
- **buffer_interval**: How often to send batched events (seconds)
- **enabled_sections**: Master toggles for each tracking category

## Event Categories

### 1. User Session & Navigation
- PAGE_VIEW, SESSION_START, SESSION_END, SCROLL_DEPTH, CLICK_EVENT

### 2. Product Discovery
- PRODUCT_VIEW, PRODUCT_IMPRESSION, PRODUCT_QUICK_VIEW

### 3. Shopping Cart
- ADD_TO_CART, REMOVE_FROM_CART, CART_VIEW, CART_QUANTITY_CHANGE, APPLY_COUPON

### 4. Checkout & Purchase
- CHECKOUT_START, CHECKOUT_STEP, SHIPPING_METHOD, PAYMENT_METHOD, PURCHASE_COMPLETED, PAYMENT_FAILED

### 5. User Account
- REGISTRATION, LOGIN, LOGOUT, PASSWORD_RESET, PROFILE_UPDATE, WISHLIST, ADDRESS_BOOK

### 6. Search & Filters
- SEARCH_QUERY, SEARCH_AUTOCOMPLETE, FILTER_APPLIED, SORT_CHANGED, ZERO_RESULTS

### 7. Marketing & Promotions
- NEWSLETTER_SIGNUP, POPUP_INTERACTION, BANNER_CLICK, SOCIAL_SHARE

## Requirements

- WordPress 5.0+
- WooCommerce 3.0+ (for e-commerce tracking)
- PHP 7.4+

## Event Data Structure

All events follow this format:
```json
{
  "event": "event_name",
  "event_type": "CATEGORY NAME",
  "timestamp": "ISO 8601 format",
  "session_id": "uuid",
  "customer_id": "ID or 'guest'",
  "customer_email": "email or null",
  ...event-specific data
}
```

## License

GPL v2 or later

## Author

Galylio
