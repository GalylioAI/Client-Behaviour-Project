/**
 * User Account Tracker
 */
const BehaviourTrackerAccount = {
    init: function () {
        this.trackRegistration();
        this.trackLogin();
        this.trackLogout();
        this.trackPasswordReset();
        this.trackProfileUpdate();
        this.trackWishlist();
        this.trackAddressBook();
    },

    /**
     * Track Account Registration
     */
    trackRegistration: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_REGISTRATION == '0') return;

        // Watch for registration form submission
        const regForms = document.querySelectorAll('#customer-form, #create-account_form, [action*="register"]');

        regForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const email = form.querySelector('[name="email"]')?.value;
                const newsletterOptin = form.querySelector('[name="newsletter"]')?.checked || false;

                const data = {
                    event: 'account_registration',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_email: email,
                    newsletter_opted_in: newsletterOptin,
                    registration_source: window.location.pathname
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Track Login
     */
    trackLogin: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_LOGIN == '0') return;

        const loginForms = document.querySelectorAll('#login-form, [action*="login"]');

        loginForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const email = form.querySelector('[name="email"]')?.value;

                const data = {
                    event: 'login',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_email: email,
                    login_method: 'email'
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Track Logout
     */
    trackLogout: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_LOGOUT == '0') return;

        document.body.addEventListener('click', (e) => {
            const logoutLink = e.target.closest('[href*="logout"], .logout, [data-action="logout"]');
            if (logoutLink) {
                const data = {
                    event: 'logout',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : null
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Password Reset
     */
    trackPasswordReset: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PASSWORD_RESET == '0') return;

        const resetForms = document.querySelectorAll('[action*="password"], #password-reset');

        resetForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const email = form.querySelector('[name="email"]')?.value;

                const data = {
                    event: 'password_reset_request',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_email: email
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Track Profile Update
     */
    trackProfileUpdate: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PROFILE_UPDATE == '0') return;

        // Watch for profile/identity form submissions
        const profileForms = document.querySelectorAll('#customer-form, [action*="identity"]');

        profileForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const data = {
                    event: 'profile_update',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : null
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Track Wishlist Operations
     */
    trackWishlist: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_WISHLIST == '0') return;

        document.body.addEventListener('click', (e) => {
            const wishlistBtn = e.target.closest('.wishlist-button, [data-action="add-to-wishlist"], .add-to-wishlist');
            if (wishlistBtn) {
                const productId = wishlistBtn.dataset.idProduct || wishlistBtn.closest('[data-id-product]')?.dataset.idProduct;
                const action = wishlistBtn.classList.contains('active') ? 'wishlist_remove' : 'wishlist_add';

                const data = {
                    event: action,
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : null,
                    product_id: productId
                };
                this.sendData(data);
            }
        });
    },

    /**
     * Track Address Book Operations
     */
    trackAddressBook: function () {
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_ADDRESS_BOOK == '0') return;

        // Track address form submissions
        const addressForms = document.querySelectorAll('[action*="address"]');

        addressForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                const country = form.querySelector('[name*="country"]')?.value;
                const city = form.querySelector('[name*="city"]')?.value;

                const data = {
                    event: 'address_book_add',
                    timestamp: new Date().toISOString(),
                    session_id: BehaviourTrackerSession.getOrCreateSessionId(),
                    customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : null,
                    country: country,
                    city: city
                };
                this.sendData(data);
            });
        });
    },

    /**
     * Send Data (Delegated to Buffer)
     */
    sendData: function (data) {
        if (typeof BehaviourTrackerBuffer !== 'undefined') {
            BehaviourTrackerBuffer.add(data);
        } else {
            BehaviourTrackerLogger.error('BehaviourTrackerBuffer not defined.');
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    BehaviourTrackerAccount.init();
});
