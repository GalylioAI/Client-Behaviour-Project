/**
 * User Account Tracker
 * WordPress/WooCommerce Integration
 */
const BehaviourTrackerAccount = {
    init: function () {
        this.trackAccountInteractions();
    },

    /**
     * Track account interactions
     */
    trackAccountInteractions: function () {
        // Login form submission
        document.querySelectorAll('form.login, form.woocommerce-form-login').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.trackLogin(form);
            });
        });

        // Registration form submission
        document.querySelectorAll('form.register, form.woocommerce-form-register').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.trackRegistration(form);
            });
        });

        // Profile update
        document.querySelectorAll('form.edit-account, form.woocommerce-EditAccountForm').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.trackProfileUpdate();
            });
        });

        // Password reset
        document.querySelectorAll('form.lost_reset_password, form.woocommerce-ResetPassword').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.trackPasswordReset();
            });
        });
    },

    /**
     * Track Login
     */
    trackLogin: function (form) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_LOGIN == '0') return;

        const data = {
            event: 'login',
            event_type: 'USER ACCOUNT EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            login_method: 'email'
        };

        this.sendData(data);
    },

    /**
     * Track Registration
     */
    trackRegistration: function (form) {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_REGISTRATION == '0') return;

        const emailInput = form.querySelector('[name="email"]');
        const email = emailInput ? emailInput.value : null;

        const data = {
            event: 'account_registration',
            event_type: 'USER ACCOUNT EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_email: email,
            registration_method: 'email',
            registration_source: document.body.classList.contains('woocommerce-checkout') ? 'checkout' : 'account_page'
        };

        this.sendData(data);
    },

    /**
     * Track Profile Update
     */
    trackProfileUpdate: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PROFILE_UPDATE == '0') return;

        const data = {
            event: 'profile_update',
            event_type: 'USER ACCOUNT EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            customer_id: (typeof bt_customer_id !== 'undefined') ? bt_customer_id : 'guest'
        };

        this.sendData(data);
    },

    /**
     * Track Password Reset
     */
    trackPasswordReset: function () {
        // Check Config
        if (typeof bt_config !== 'undefined' && bt_config.BT_EVENT_PASSWORD_RESET == '0') return;

        const data = {
            event: 'password_reset_request',
            event_type: 'USER ACCOUNT EVENTS',
            timestamp: new Date().toISOString(),
            session_id: BehaviourTrackerSession.getOrCreateSessionId(),
            reset_method: 'email'
        };

        this.sendData(data);
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
    // Check if this section is enabled
    if (typeof bt_config !== 'undefined' &&
        bt_config.BT_ENABLED_SECTIONS &&
        bt_config.BT_ENABLED_SECTIONS.account === false) {
        BehaviourTrackerLogger.log('Account tracker section is disabled in config.php');
        return;
    }

    BehaviourTrackerAccount.init();
});
