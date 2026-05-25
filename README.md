# Behaviour Tracker for PrestaShop

A comprehensive behavior tracking module for PrestaShop that tracks customer interactions and sends event data to a webhook for analysis. Track user behavior across your entire e-commerce funnel.

## Features

- **7 Tracking Categories** with 40+ event types
- **Event Buffering System** with configurable intervals
- **Granular Configuration** - Enable/disable individual events and data elements
- **PrestaShop Integration** - Full e-commerce tracking
- **Client-Side Tracking** via JavaScript
- **Server-Side Revenue Tracking** via PrestaShop order hooks
- **Order Lifecycle Tracking** for cancelled, refunded, and failed orders
- **Standard SaaS Payload** with `site_id`, `platform`, public write key, and server secret key support
- **Debug Mode** for development
- **Webhook Delivery** with retry logic and `navigator.sendBeacon`

## Installation

1. Upload the `behaviourtracker` folder to `/modules/`
2. Go to Modules > Module Manager in PrestaShop admin
3. Find "Customer Behaviour Tracker" and click "Install"
4. Configure the module settings
5. Configure `site_id`, webhook URL, public write key, and server secret key

## Configuration

### Module Settings

Access via Modules > Module Manager > Customer Behaviour Tracker > Configure

Configure each event category and individual events:
- Enable/disable entire sections
- Toggle individual events
- Control data elements for specific events (e.g., PAGE_VIEW URL, title, referrer)
- Enable debug mode for console logging

### External Configuration (`config.php`)

Edit `modules/behaviourtracker/config.php` to set:

```php
'webhook_url' => 'https://tracker.yatootunisie.tn/webhook',
'site_id' => 'your-store-id',
'write_key' => 'pk_live_your_public_write_key',
'server_secret_key' => 'sk_live_your_server_secret_key',
'buffer_interval' => 3, // seconds
'enabled_sections' => [
    'session_navigation' => true,
    'product' => true,
    'cart' => true,
    'checkout' => true,
    'account' => true,
    'search' => true,
    'marketing' => true,
],
'selectors' => [
    // Optional custom CSS selectors for non-standard themes.
    'add_to_cart_buttons' => [],
    'search_forms' => [],
    'newsletter_forms' => [],
]
```

**Master Section Toggles:**
- Completely disable entire tracking categories for isolated testing
- Overrides individual event settings when disabled

## Event Categories

### 1. User Session & Navigation Events
- **PAGE_VIEW** - Track page visits with configurable data elements
- **SESSION_START** - New session detection
- **SESSION_END** - Session termination (page unload)
- **VISITOR_IDENTIFIED** - Links anonymous visitor history to a logged-in customer
- **SCROLL_DEPTH** - Scroll tracking at 25%, 50%, 75%, 100%
- **CLICK_EVENT** - Interactive element clicks

### 2. Product Discovery Events
- **PRODUCT_VIEW** - Product page views
- **PRODUCT_IMPRESSION** - Product visibility in lists
- **PRODUCT_QUICK_VIEW** - Quick view modal interactions
- **PRODUCT_ZOOM** - Image zoom interactions
- **PRODUCT_REVIEW_READ** - Review tab clicks

### 3. Shopping Cart Events
- **ADD_TO_CART** - Items added to cart
- **REMOVE_FROM_CART** - Items removed from cart
- **CART_VIEW** - Cart page views
- **CART_QUANTITY_CHANGE** - Quantity modifications
- **APPLY_COUPON** - Coupon code applications
- **REMOVE_COUPON** - Coupon code removals

### 4. Checkout & Purchase Events
- **CHECKOUT_START** - Checkout initiation
- **CHECKOUT_STEP** - Step progression
- **SHIPPING_METHOD** - Shipping selection
- **PAYMENT_METHOD** - Payment selection
- **ORDER_CONFIRMATION_VIEW** - Browser confirmation page view, non-revenue event
- **PURCHASE_COMPLETED** - Successful orders, sent server-side only to avoid duplicate revenue
- **ORDER_STATUS_CHANGED** - Backend/admin order status transitions
- **ORDER_CANCELLED** - Orders changed to cancelled status
- **ORDER_REFUNDED** - Orders changed to refunded status
- **ORDER_FAILED** - Orders changed to failed/error status
- **PAYMENT_FAILED** - Failed transactions

### 5. User Account Events
- **REGISTRATION** - Successful account creation, server-side
- **LOGIN** - Successful user login, server-side
- **LOGOUT** - User logout, server-side
- **REGISTRATION_SUBMIT / LOGIN_SUBMIT / LOGOUT_CLICK** - Browser-side intent events
- **PASSWORD_RESET** - Password reset requests
- **PROFILE_UPDATE** - Account information changes
- **WISHLIST** - Wishlist operations
- **ADDRESS_BOOK** - Address management

### 6. Search & Filter Events
- **SEARCH_QUERY** - Search submissions
- **SEARCH_AUTOCOMPLETE** - Autocomplete interactions
- **FILTER_APPLIED** - Product filter usage
- **SORT_CHANGED** - Sort order changes
- **ZERO_RESULTS** - Empty search results

### 7. Marketing & Promotional Events
- **NEWSLETTER_SIGNUP** - Newsletter subscriptions
- **POPUP_INTERACTION** - Popup engagements
- **BANNER_CLICK** - Promotional banner clicks
- **SOCIAL_SHARE** - Social sharing actions

## Event Data Structure

All events follow a consistent JSON format:

```json
{
  "schema_version": "1.0",
  "site_id": "your-store-id",
  "platform": "prestashop",
  "write_key": "pk_live_or_sk_live_key",
  "source": "client_js or server_php",
  "events": [
    {
      "event_id": "uuid-or-deterministic-id",
      "event_name": "event_name",
      "event_category": "checkout",
      "timestamp": "2026-02-11T15:30:00+01:00",
      "session_id": "uuid-v4",
      "visitor_id": "persistent-cookie-id",
      "customer_id": 123 or "guest",
      "customer_email": "customer@example.com" or null,
      "page": {},
      "properties": {},
      "context": {}
    }
  ]
}
```

### Event Type Categories

1. **USER SESSION & NAVIGATION EVENTS**
2. **PRODUCT DISCOVERY EVENTS**
3. **SHOPPING CART EVENTS**
4. **CHECKOUT & PURCHASE EVENTS**
5. **USER ACCOUNT EVENTS**
6. **SEARCH & FILTER EVENTS**
7. **PROMOTIONAL & MARKETING EVENTS**

## Technical Architecture

### JavaScript Components

**Utilities:**
- `logger.js` - Console logging with debug mode support
- `buffer.js` - Event batching and webhook delivery

**Trackers:**
- `session.js` - Session management and tracking
- `navigation.js` - Page views, scrolling, clicks
- `product.js` - Product interactions
- `cart.js` - Shopping cart events
- `checkout.js` - Checkout process
- `account.js` - User account operations
- `search.js` - Search and filtering
- `marketing.js` - Marketing interactions

### Event Buffering

- **Batching**: Events collected in memory
- **Interval Flushing**: Configurable timer (default 3 seconds)
- **Batch Size**: Auto-flush at 50 events
- **Unload Handling**: `navigator.sendBeacon` for page unload reliability
- **Retry Logic**: 3 attempts with exponential backoff
- **Memory Management**: Maximum buffer size to prevent memory leaks

### Session Management

- **Session ID**: UUID v4 stored in cookies
- **Duration**: 30-minute expiration with refresh on activity
- **New Session Detection**: Automatic session_start event
- **Device Type**: Automatic detection (desktop, mobile, tablet)

## Requirements

- PrestaShop 1.7.x or higher
- PHP 7.2+
- Modern browser with JavaScript enabled
- Webhook endpoint for data collection

## Testing & Debugging

### Debug Mode

Enable in module configuration:
- Console logs for all tracker activity
- Event additions logged
- Batch sends logged
- Buffer status displayed
- Error messages shown

### Webhook Testing

Use [webhook.site](https://webhook.site) to inspect payloads:

1. Create a new webhook URL
2. Update `config.php` with the URL
3. Perform actions on your store
4. Check webhook.site for received events
5. Verify JSON structure

### Console Monitoring

With debug mode enabled, open browser console to see:
```
[BehaviourTracker] Buffer initialized with interval: 3000ms
[BehaviourTracker] Event added. Buffer size: 1
[BehaviourTracker] Flushing 5 events to server...
[BehaviourTracker] Batch sent successfully
```

## Performance Considerations

- **Minimal Impact**: Events buffered and sent asynchronously
- **No Page Blocking**: All tracking happens in background
- **Configurable Intervals**: Adjust buffer timing for your traffic
- **Selective Tracking**: Disable unused events to reduce overhead
- **Memory Efficient**: Automatic buffer size limits

## Privacy & GDPR

- **Customer Consent**: Ensure compliance with local privacy laws
- **Data Minimization**: Disable unnecessary data elements
- **Anonymization**: Option to track without customer emails
- **Cookie Notice**: Session cookies require user notification
- **Data Retention**: Configure webhook endpoint retention policies

## Troubleshooting

**Events not appearing in webhook:**
- Check `config.php` webhook URL is correct
- Verify section is enabled in `enabled_sections`
- Confirm individual event is enabled in module settings
- Enable debug mode and check browser console
- Check browser network tab for failed requests

**Some events missing:**
- Verify PrestaShop theme uses standard selectors
- Add custom selectors in `config.php` under `selectors`
- Check for JavaScript errors in console
- Test with default PrestaShop theme to isolate theme issues

**High server load:**
- Increase buffer interval in `config.php`
- Disable high-frequency events (scroll, click)
- Reduce batch size in `buffer.js`
- Optimize webhook endpoint response time

## Support & Documentation

For detailed event specifications, see `events.txt` in the module directory.

## License

Proprietary - All rights reserved

## Author

Galylio

## Version

1.0.8
