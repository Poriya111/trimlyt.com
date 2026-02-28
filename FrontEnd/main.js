let currentAppointments = [];
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const token = localStorage.getItem('trimlyt_token');

    // --- Apply Theme ---
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // --- Initialize Cookie Consent Banner ---
    initCookieConsent();

    // --- Route Protection ---
    // Pages that don't require auth
    const publicPages = ['index.html', 'privacyPolicy.html', 'termsOfService.html', 'subscription.html'];
    const isPublicPage = publicPages.includes(page);

    // If not logged in and trying to access a protected page, redirect to login
    if (!token && !isPublicPage) {
        window.location.href = 'index.html';
        return;
    }

    // If logged in and trying to access login page, redirect to dashboard
    // Only redirect if we are strictly on the login page
    if (token && (page === 'index.html' || page === '')) {
        window.location.href = 'dashboard.html';
        return;
    }

    // --- Page Specific Logic ---
    if (page === 'index.html' || page === '') {
        initAuthPage();
    } else if (page === 'settings.html') {
        initSettingsPage();
    } else if (page === 'dashboard.html') {
        initDashboardPage();
    } else if (page === 'appointments.html') {
        initAppointmentsPage();
    } else if (page === 'profile.html') {
        initProfilePage();
    }

    // Global Back Button Logic
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }

    // Global Info Modal Logic
    const infoBtn = document.getElementById('infoBtn');
    const infoModal = document.getElementById('infoModal');
    const closeInfoBtn = document.getElementById('closeInfoModal');

    if (infoBtn && infoModal) {
        infoBtn.addEventListener('click', () => {
            infoModal.classList.remove('hidden');
        });
    }

    if (closeInfoBtn && infoModal) {
        closeInfoBtn.addEventListener('click', () => {
            infoModal.classList.add('hidden');
        });
        
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.classList.add('hidden');
            }
        });
    }

    // Scroll-to-bottom button inside modals
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.scroll-to-bottom');
        if (!btn) return;

        const modalContent = btn.closest('.modal-content');
        if (!modalContent) return;

        // Smooth scroll to bottom of modal content
        modalContent.scrollTo({ top: modalContent.scrollHeight, behavior: 'smooth' });
    });

    updateProfileDisplay();
    
    // Initialize Onboarding Modal for Dashboard, Appointments, Settings
    const onboardingPages = ['dashboard.html', 'appointments.html', 'settings.html'];
    if (onboardingPages.includes(page) && token) {
        initOnboarding(token);
    }
    
    applyTranslations();
});

function initAuthPage() {
    const form = document.getElementById('authForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = form.querySelector('button[type="submit"]');
    const signupBtn = document.getElementById('signupBtn');
    const headerTitle = document.querySelector('.auth-header h1');
    const headerDesc = document.querySelector('.auth-header p');

    // Add show/hide password button
    if (passwordInput) {
        const inputGroup = passwordInput.parentElement;
        if (inputGroup) {
            // Create a wrapper for the input and the button
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            
            // Move the input inside the new wrapper
            inputGroup.replaceChild(wrapper, passwordInput);
            wrapper.appendChild(passwordInput);

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.innerHTML = 'Show';
            toggleBtn.setAttribute('aria-label', 'Show password');
            toggleBtn.style.position = 'absolute';
            toggleBtn.style.right = '12px';
            toggleBtn.style.top = '50%';
            toggleBtn.style.transform = 'translateY(-50%)';
            toggleBtn.style.background = 'transparent';
            toggleBtn.style.border = 'none';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.fontSize = '1.2rem';
            toggleBtn.style.color = 'var(--text-muted)';
            toggleBtn.style.padding = '0';

            wrapper.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                toggleBtn.innerHTML = isPassword ? 'Hide' : 'Show';
                toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            });
        }
    }

    let isSignup = false;

    // Toggle Login / Signup Mode
    signupBtn.addEventListener('click', () => {
        isSignup = !isSignup;
        if (isSignup) {
            headerTitle.textContent = t('signup_title');
            headerDesc.textContent = t('signup_desc');
            submitBtn.textContent = t('create_account');
            signupBtn.textContent = t('back_login');
        } else {
            headerTitle.textContent = t('login_title');
            headerDesc.textContent = t('login_desc');
            submitBtn.textContent = t('login');
            signupBtn.textContent = t('signup');
        }
    });

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = passwordInput.value;
        const endpoint = isSignup 
            ? '/api/auth/register' 
            : '/api/auth/login';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.msg || data.error || 'Something went wrong');
            }

            if (isSignup) {
                showNotification(t('account_created'), 'success');
                // Switch back to login mode
                signupBtn.click();
            } else {
                // Login Success
                localStorage.setItem('trimlyt_token', data.token);
                if (data.user && data.user.email) {
                    localStorage.setItem('trimlyt_email', data.user.email);
                }
                if (data.user && data.user.avatar) {
                    localStorage.setItem('trimlyt_avatar', data.user.avatar);
                } else {
                    localStorage.removeItem('trimlyt_avatar');
                }
                
                // Save user settings locally
                if (data.user && data.user.settings) {
                    localStorage.setItem('trimlyt_currency', data.user.settings.currency);
                    localStorage.setItem('trimlyt_goal', data.user.settings.monthlyGoal);
                    localStorage.setItem('trimlyt_auto_complete', data.user.settings.autoCompleteStatus);
                    localStorage.setItem('trimlyt_theme', data.user.settings.theme);
                    localStorage.setItem('trimlyt_gap', data.user.settings.appointmentGap !== undefined ? data.user.settings.appointmentGap : 60);
                    localStorage.setItem('trimlyt_language', data.user.settings.language || 'en');
                }

                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isSignup ? t('create_account') : t('login');
        }
    });
}

function initSettingsPage() {
    const settingsForm = document.getElementById('settingsForm');
    const goalInput = document.getElementById('monthlyGoal');
    const currencyInput = document.getElementById('currency');
    const autoCompleteInput = document.getElementById('autoCompleteStatus');
    const appointmentGapInput = document.getElementById('appointmentGap');
    const themeToggle = document.getElementById('themeToggle');
    const saveGoalBtn = document.getElementById('saveGoalBtn');
    const saveCurrencyBtn = document.getElementById('saveCurrencyBtn');
    const saveGapBtn = document.getElementById('saveGapBtn');
    const languageInput = document.getElementById('language');
    const saveLanguageBtn = document.getElementById('saveLanguageBtn');
    const manageServicesBtn = document.getElementById('manageServicesBtn');
    const connectGoogleBtn = document.getElementById('connectGoogleBtn');
    const googleKeywordInput = document.getElementById('googleImportKeyword');
    const saveGoogleKeywordBtn = document.getElementById('saveGoogleKeywordBtn');

    // Load saved settings
    const savedGoal = localStorage.getItem('trimlyt_goal');
    const savedCurrency = localStorage.getItem('trimlyt_currency');
    const savedAutoComplete = localStorage.getItem('trimlyt_auto_complete');
    const savedGap = localStorage.getItem('trimlyt_gap');
    const savedLanguage = localStorage.getItem('trimlyt_language') || 'en';
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';
    const savedKeyword = localStorage.getItem('trimlyt_google_keyword');

    if (savedGoal) goalInput.value = savedGoal;
    if (savedCurrency) currencyInput.value = savedCurrency;
    if (savedAutoComplete) autoCompleteInput.value = savedAutoComplete;
    if (savedGap !== null) appointmentGapInput.value = savedGap;
    if (savedLanguage) languageInput.value = savedLanguage;
    if (savedKeyword) googleKeywordInput.value = savedKeyword;

    // Helper to save settings to backend
    const saveSettings = async (payload) => {
        const token = localStorage.getItem('trimlyt_token');
        try {
            const res = await fetch('/api/auth/settings', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-token': token 
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save settings');

            // Update Local Storage
            if (payload.monthlyGoal) localStorage.setItem('trimlyt_goal', payload.monthlyGoal);
            if (payload.currency) localStorage.setItem('trimlyt_currency', payload.currency);
            if (payload.autoCompleteStatus) localStorage.setItem('trimlyt_auto_complete', payload.autoCompleteStatus);
            if (payload.theme) localStorage.setItem('trimlyt_theme', payload.theme);
            if (payload.appointmentGap !== undefined) localStorage.setItem('trimlyt_gap', payload.appointmentGap);
            if (payload.language) localStorage.setItem('trimlyt_language', payload.language);
            
            applyTranslations();
            return true;
        } catch (err) {
            console.error(err);
            showNotification('Error saving settings: ' + err.message, 'error');
            return false;
        }
    };

    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            saveSettings({ theme: newTheme });
        });
    }

    // Auto-save Auto Complete
    if (autoCompleteInput) {
        autoCompleteInput.addEventListener('change', () => {
            saveSettings({ autoCompleteStatus: autoCompleteInput.value });
        });
    }

    // Manual Save Appointment Gap
    if (saveGapBtn) {
        saveGapBtn.addEventListener('click', async () => {
            if (await saveSettings({ appointmentGap: appointmentGapInput.value })) {
                showNotification('Appointment gap saved!', 'success');
            }
        });
    }

    // Manual Save Buttons
    if (saveGoalBtn) {
        saveGoalBtn.addEventListener('click', async () => {
            if (await saveSettings({ monthlyGoal: goalInput.value })) {
                showNotification('Goal saved!', 'success');
            }
        });
    }

    if (saveCurrencyBtn) {
        saveCurrencyBtn.addEventListener('click', async () => {
            if (await saveSettings({ currency: currencyInput.value })) {
                showNotification('Currency saved!', 'success');
            }
        });
    }

    if (saveLanguageBtn) {
        saveLanguageBtn.addEventListener('click', async () => {
            if (await saveSettings({ language: languageInput.value })) {
                showNotification('Language saved!', 'success');
            }
        });
    }

    if (manageServicesBtn) {
        manageServicesBtn.addEventListener('click', () => {
            initServicesModal();
        });
    }

    if (saveGoogleKeywordBtn && googleKeywordInput) {
        saveGoogleKeywordBtn.addEventListener('click', () => {
            const keyword = googleKeywordInput.value.trim() || 'TL';
            localStorage.setItem('trimlyt_google_keyword', keyword);
            showNotification(t('save'), 'success');
        });
    }

    // --- Google Integration Logic ---
    if (connectGoogleBtn) {
        const token = localStorage.getItem('trimlyt_token');
        const statusEl = document.getElementById('googleStatus');

        // Check Status
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/auth/google/status', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                
                if (data.connected) {
                    statusEl.textContent = data.email;
                    statusEl.style.color = 'var(--success-color)';
                    connectGoogleBtn.innerHTML = `<span data-i18n="disconnect">Disconnect</span>`;
                    connectGoogleBtn.classList.add('btn-connected');
                    connectGoogleBtn.onclick = disconnectGoogle;
                } else {
                    statusEl.textContent = t('not_connected');
                    statusEl.style.color = 'var(--text-muted)';
                    connectGoogleBtn.innerHTML = `<span style="font-size: 1.2em;">G</span> <span data-i18n="connect_google">Connect Google Account</span>`;
                    connectGoogleBtn.classList.remove('btn-connected');
                    connectGoogleBtn.onclick = connectGoogle;
                }
            } catch (err) {
                console.error(err);
            }
        };

        const connectGoogle = async () => {
            try {
                const res = await fetch('/api/auth/google/url', { headers: { 'x-auth-token': token } });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
            } catch (err) {
                showNotification('Error initiating connection', 'error');
            }
        };

        const disconnectGoogle = async () => {
            if (await showConfirm(t('confirm_disconnect'), t('disconnect'), true)) {
                await fetch('/api/auth/google', { method: 'DELETE', headers: { 'x-auth-token': token } });
                checkStatus();
                showNotification(t('disconnected'), 'success');
            }
        };

        // Handle Callback Params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('google_auth') === 'success') {
            showNotification(t('google_connected'), 'success');
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        checkStatus();
    }

    setupCustomSelects();

    initProfileLogic();
}

function initServicesModal() {
    const modal = document.getElementById('servicesModal');
    const closeBtn = document.getElementById('closeServicesModal');
    const form = document.getElementById('addServiceForm');
    const list = document.getElementById('servicesList');
    const token = localStorage.getItem('trimlyt_token');
    const currency = localStorage.getItem('trimlyt_currency') || '$';

    if (modal) modal.classList.remove('hidden');

    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    const loadServices = async () => {
        try {
            const res = await fetch('/api/services', { headers: { 'x-auth-token': token } });
            const services = await res.json();
            
            if (services.length === 0) {
                list.innerHTML = `<div class="empty-state" style="padding: 20px;"><p>${t('no_services_yet')}</p></div>`;
            } else {
                list.innerHTML = services.map(s => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.5); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
                        <div><strong>${s.name}</strong> <span style="opacity: 0.7;">${currency}${s.price}</span></div>
                        <button class="btn-icon" style="color: var(--danger-color); font-size: 1rem;" onclick="deleteService('${s._id}')">✕</button>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    window.deleteService = async (id) => {
        const confirmed = await showConfirm(t('confirm_delete'), t('delete'), true);
        if (confirmed) {
            try {
                const res = await fetch(`/api/services/${id}`, { method: 'DELETE', headers: { 'x-auth-token': token } });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.msg || 'Failed to delete service');
                }
                loadServices();
                showNotification(t('service_deleted'), 'success');
            } catch (err) {
                showNotification(err.message, 'error');
            }
        }
    };

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('newServiceName').value;
            const price = document.getElementById('newServicePrice').value;
            try {
                const res = await fetch('/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body: JSON.stringify({ name, price })
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.msg || 'Failed to add service');
                }
                form.reset();
                loadServices();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        };
    }

    loadServices();
}

function initAppointmentsPage() {
    const modal = document.getElementById('actionModal');
    const addModal = document.getElementById('addModal');
    const closeBtn = document.getElementById('closeModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addBtn = document.getElementById('addAppointmentBtn');
    const walkInBtn = document.getElementById('walkInBtn');
    
    // New Modals & Buttons
    const addChoiceModal = document.getElementById('addChoiceModal');
    const calendarModal = document.getElementById('calendarModal');
    const btnManualAdd = document.getElementById('btnManualAdd');
    const btnCalendarIntegrate = document.getElementById('btnCalendarIntegrate');
    
    const addForm = document.getElementById('addAppointmentForm');
    const list = document.getElementById('appointmentList');
    const dateInput = document.getElementById('dateInput');
    const searchInput = document.getElementById('searchInput');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    const btnNoShow = document.getElementById('btnNoShow');
    const btnFinish = document.getElementById('btnFinish');
    const btnDelete = document.getElementById('btnDelete');
    const btnEdit = document.getElementById('btnEdit');
    const btnCancel = document.getElementById('btnCancel');
    const btnReset = document.getElementById('btnReset');

    // Complete Modal Elements
    const completeModal = document.getElementById('completeModal');
    const closeCompleteBtn = document.getElementById('closeCompleteModal');
    const completeForm = document.getElementById('completeAppointmentForm');
    
    let pastPage = 1;
    let selectedAppointmentId = null;

    // Function to handle button visibility based on time
    const updateActionModalState = (appointment) => {
        if (!appointment) return;

        const appointmentTime = new Date(appointment.date).getTime();
        const now = Date.now();
        const isFuture = appointmentTime > now;
        const status = appointment.status || 'Scheduled';

        // Reset all displays
        if (btnFinish) btnFinish.style.display = 'block';
        if (btnNoShow) btnNoShow.style.display = 'block';
        if (btnCancel) btnCancel.style.display = 'block';
        if (btnDelete) btnDelete.style.display = 'block';
        if (btnEdit) btnEdit.style.display = 'block';
        if (btnReset) btnReset.style.display = 'none';

        if (status === 'Finished') {
            // Prevent deleting finished appointments (Revenue history)
            if (btnDelete) btnDelete.style.display = 'none';
            
            // Zombie status fix: Can't Cancel/NoShow a finished appointment directly
            if (btnFinish) btnFinish.style.display = 'none';
            if (btnNoShow) btnNoShow.style.display = 'none';
            if (btnCancel) btnCancel.style.display = 'none';
            
            // Allow Undo
            if (btnReset) {
                btnReset.style.display = 'block';
                btnReset.textContent = t('undo_finish');
            }
        } else if (status === 'Canceled' || status === 'No Show') {
            if (btnFinish) btnFinish.style.display = 'none';
            if (btnNoShow) btnNoShow.style.display = 'none';
            if (btnCancel) btnCancel.style.display = 'none';
            
            // Allow Reset
            if (btnReset) {
                btnReset.style.display = 'block';
                btnReset.textContent = t('set_scheduled');
            }
        } else {
            // Scheduled
            if (isFuture) {
                // Time Travel fix
                if (btnFinish) btnFinish.style.display = 'none';
                if (btnNoShow) btnNoShow.style.display = 'none';
            }
        }
    };

    // Complete Data Action (Event Delegation)
    if (list) {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-complete-data')) {
                e.stopPropagation();
                selectedAppointmentId = e.target.dataset.id;
                const appointment = currentAppointments.find(a => a._id === selectedAppointmentId);
                
                if (appointment && completeModal) {
                    // Populate Complete Form
                    const serviceInput = document.getElementById('completeServiceInput');
                    const priceInput = document.getElementById('completePriceInput');
                    
                    // Populate services in the complete modal
                    // We reuse the logic from setupServiceSelect but target this specific select
                    const mainServiceInput = document.getElementById('serviceInput');
                    if (mainServiceInput && serviceInput) {
                        serviceInput.innerHTML = mainServiceInput.innerHTML;
                        setupCustomSelects(); // Re-init custom selects
                    }

                    // Try to guess service from title if possible, or just reset
                    serviceInput.value = "";
                    priceInput.value = "";

                    // Reset custom select UI
                    const wrapper = serviceInput.closest('.custom-select-wrapper');
                    if (wrapper) {
                        const trigger = wrapper.querySelector('.custom-select-trigger');
                        if (trigger) trigger.textContent = t('select_service');
                        wrapper.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                    }

                    completeModal.classList.remove('hidden');
                }
            }
        });
    }

    if (closeCompleteBtn) {
        closeCompleteBtn.addEventListener('click', () => {
            completeModal.classList.add('hidden');
        });
    }

    if (completeForm) {
        completeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const service = document.getElementById('completeServiceInput').value;
            const price = document.getElementById('completePriceInput').value;
            const token = localStorage.getItem('trimlyt_token');
            
            if (!selectedAppointmentId) return;

            try {
                const res = await fetch(`/api/appointments/${selectedAppointmentId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-auth-token': token 
                    },
                    body: JSON.stringify({ service, price, needsCompletion: false })
                });

                if (!res.ok) throw new Error('Failed to update appointment');

                showNotification(t('appointment_updated'), 'success');
                completeModal.classList.add('hidden');
                loadAppointments(true);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    // Open Modal (Event Delegation)
    if (list) {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-more')) {
                selectedAppointmentId = e.target.dataset.id;
                const appointment = currentAppointments.find(a => a._id === selectedAppointmentId);
                updateActionModalState(appointment);
                modal.classList.remove('hidden');
            }
        });
    }

    // Close Modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // Delete Action
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!selectedAppointmentId) return;
            
            const confirmed = await showConfirm(t('confirm_delete'), t('delete'), true);
            
            if (confirmed) {
                const token = localStorage.getItem('trimlyt_token');
                try {
                    await fetch(`/api/appointments/${selectedAppointmentId}`, {
                        method: 'DELETE',
                        headers: { 'x-auth-token': token }
                    });
                    modal.classList.add('hidden');
                    loadAppointments(); // Reload the list
                } catch (err) {
                    showNotification('Error deleting appointment', 'error');
                }
            }
        });
    }

    // Search Filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = currentAppointments.filter(app => 
                app.service.toLowerCase().includes(term) || 
                (app.extras && app.extras.toLowerCase().includes(term))
            );
            renderAppointments(filtered);
        });
    }

    // Load More Action
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            loadMoreBtn.textContent = 'Loading...';
            loadMoreBtn.disabled = true;
            
            pastPage++;
            const token = localStorage.getItem('trimlyt_token');
            try {
                const res = await fetch(`/api/appointments?type=past&page=${pastPage}&limit=20`, {
                    headers: { 'x-auth-token': token }
                });
                const newPast = await res.json();
                
                if (newPast.length < 20) loadMoreBtn.style.display = 'none';
                
                currentAppointments = [...currentAppointments, ...newPast];
                renderAppointments(currentAppointments);
            } catch (err) {
                console.error(err);
            } finally {
                loadMoreBtn.textContent = t('load_more');
                loadMoreBtn.disabled = false;
            }
        });
    }

    // Status Actions
    const updateStatus = async (status) => {
        if (!selectedAppointmentId) return;
        const token = localStorage.getItem('trimlyt_token');
        try {
            const res = await fetch(`/api/appointments/${selectedAppointmentId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-auth-token': token 
                },
                body: JSON.stringify({ status })
            });
            
            if (!res.ok) throw new Error('Failed to update status');
            
            modal.classList.add('hidden');
            loadAppointments();
        } catch (err) {
            showNotification('Error updating status: ' + err.message, 'error');
        }
    };

    if (btnNoShow) btnNoShow.addEventListener('click', () => updateStatus('No Show'));
    if (btnFinish) btnFinish.addEventListener('click', () => updateStatus('Finished'));
    if (btnCancel) btnCancel.addEventListener('click', () => updateStatus('Canceled'));
    if (btnReset) btnReset.addEventListener('click', () => updateStatus('Scheduled'));

    // Edit Action
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            const appointment = currentAppointments.find(a => a._id === selectedAppointmentId);
            if (appointment) {
                const serviceInput = document.getElementById('serviceInput');
                // Check if option exists, if not (e.g. deleted service or walk-in), add it temporarily
                let optionExists = Array.from(serviceInput.options).some(o => o.value === appointment.service);
                if (!optionExists) {
                    const opt = document.createElement('option');
                    opt.value = appointment.service;
                    opt.textContent = `${appointment.service} (${localStorage.getItem('trimlyt_currency') || '$'}${appointment.price})`;
                    serviceInput.appendChild(opt);
                }
                serviceInput.value = appointment.service;
                
                // Update custom select UI for Edit
                const wrapper = serviceInput.closest('.custom-select-wrapper');
                if (wrapper) {
                    const trigger = wrapper.querySelector('.custom-select-trigger');
                    if (trigger) trigger.textContent = appointment.service;
                    wrapper.querySelectorAll('.custom-option').forEach(opt => {
                        if (opt.dataset.value === appointment.service) opt.classList.add('selected');
                        else opt.classList.remove('selected');
                    });
                }

                document.getElementById('priceInput').value = appointment.price;
                
                const d = new Date(appointment.date);
                
                // Check if appointment is in the past to determine min date restriction
                const now = new Date();
                if (d < now) {
                    document.getElementById('dateInput').removeAttribute('min');
                } else {
                    const localNow = new Date(now);
                    localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
                    document.getElementById('dateInput').min = localNow.toISOString().slice(0, 16);
                }

                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                document.getElementById('dateInput').value = d.toISOString().slice(0, 16);
                
                document.getElementById('extrasInput').value = appointment.extras || '';
                
                addForm.dataset.mode = 'edit';
                delete addForm.dataset.type;
                addForm.dataset.editId = selectedAppointmentId;
                addModal.querySelector('h3').textContent = t('edit_appointment');
                addForm.querySelector('button[type="submit"]').textContent = t('update');
                
                modal.classList.add('hidden');
                addModal.classList.remove('hidden');
            }
        });
    }

    // Close when clicking outside content (optional UX improvement)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // --- Add Appointment Logic ---
    if (addBtn) {
        // Open Choice Modal instead of direct Add Modal
        addBtn.addEventListener('click', () => {
            if (addChoiceModal) addChoiceModal.classList.remove('hidden');
        });
    }

    // Choice Modal Logic
    if (addChoiceModal) {
        const closeChoiceBtn = document.getElementById('closeChoiceModal');
        if (closeChoiceBtn) {
            closeChoiceBtn.addEventListener('click', () => addChoiceModal.classList.add('hidden'));
        }

        if (btnCalendarIntegrate) {
            btnCalendarIntegrate.addEventListener('click', () => {
                addChoiceModal.classList.add('hidden');
                if (calendarModal) calendarModal.classList.remove('hidden');
            });
        }
    }

    // Calendar Modal Logic
    if (calendarModal) {
        const backToChoiceBtn = document.getElementById('backToChoiceBtn');
        if (backToChoiceBtn) {
            backToChoiceBtn.addEventListener('click', () => {
                calendarModal.classList.add('hidden');
                if (addChoiceModal) addChoiceModal.classList.remove('hidden');
            });
        }

        const calendarBtns = calendarModal.querySelectorAll('.calendar-btn');
        calendarBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const text = btn.textContent || "";
                if (text.toLowerCase().includes('google')) {
                    calendarModal.classList.add('hidden');
                    await syncGoogleCalendar();
                } else {
                    showNotification(t('coming_soon'), 'info');
                }
            });
        });
    }

    // Manual Add Logic (Moved from addBtn)
    if (btnManualAdd) {
        btnManualAdd.addEventListener('click', () => {
            if (addChoiceModal) addChoiceModal.classList.add('hidden');
            addForm.reset();
            addForm.dataset.mode = 'add';
            delete addForm.dataset.editId;
            delete addForm.dataset.type; // Clear walk-in type
            addModal.querySelector('h3').textContent = t('new_appointment');
            addForm.querySelector('button[type="submit"]').textContent = t('save');
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateInput').min = now.toISOString().slice(0, 16);
            
            // Reset custom select UI
            const serviceWrapper = document.getElementById('serviceInput').closest('.custom-select-wrapper');
            if (serviceWrapper) {
                const trigger = serviceWrapper.querySelector('.custom-select-trigger');
                if (trigger) trigger.textContent = t('select_service');
                serviceWrapper.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            }

            // Show Date Input
            if (dateInput && dateInput.parentElement) {
                dateInput.parentElement.style.display = 'block';
                dateInput.required = true;
            }

            addModal.classList.remove('hidden');
        });
    }

    if (walkInBtn) {
        walkInBtn.addEventListener('click', () => {
            setupWalkInModal(addForm, addModal, dateInput);
        });
    }

    if (closeAddBtn) {
        closeAddBtn.addEventListener('click', () => {
            addModal.classList.add('hidden');
        });
    }

    if (addForm) {
        addForm.addEventListener('submit', (e) => handleAppointmentSubmit(e, addModal));
    }

    if (dateInput) {
        dateInput.addEventListener('click', () => {
            if ('showPicker' in HTMLInputElement.prototype) {
                dateInput.showPicker();
            }
        });
    }

    const token = localStorage.getItem('trimlyt_token');
    if (token) setupServiceSelect(token);

    initProfileLogic();
    initExportLogic();
    loadAppointments(true); // Pass true to reset pagination
}

function setupWalkInModal(form, modal, dateInput) {
    if (!form || !modal) return;
    
    form.reset();
    form.dataset.mode = 'add';
    form.dataset.type = 'walk-in';
    delete form.dataset.editId;
    
    modal.querySelector('h3').textContent = t('walk_in_finished');
    form.querySelector('button[type="submit"]').textContent = t('complete');
    
    // Hide Date Input
    if (dateInput && dateInput.parentElement) {
        dateInput.parentElement.style.display = 'none';
        dateInput.required = false;
    }

    modal.classList.remove('hidden');
}

function initExportLogic() {
    const exportBtn = document.getElementById('exportBtn');
    const exportModal = document.getElementById('exportModal');
    const closeExportBtn = document.getElementById('closeExportModal');
    const btnExportPDF = document.getElementById('btnExportPDF');
    const btnExportExcel = document.getElementById('btnExportExcel');

    if (exportBtn && exportModal) {
        exportBtn.addEventListener('click', () => {
            exportModal.classList.remove('hidden');
        });
    }

    if (closeExportBtn && exportModal) {
        closeExportBtn.addEventListener('click', () => {
            exportModal.classList.add('hidden');
        });
    }

    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => {
            exportToPDF();
            exportModal.classList.add('hidden');
        });
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            exportToExcel();
            exportModal.classList.add('hidden');
        });
    }
}

function exportToPDF() {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const currency = localStorage.getItem('trimlyt_currency') || '$';

    const tableColumn = ["Date", "Service", "Price", "Status", "Extras"];
    const tableRows = [];

    currentAppointments.forEach(app => {
        const appDate = new Date(app.date).toLocaleString();
        const appData = [
            appDate,
            app.service,
            `${currency}${app.price}`,
            app.status || 'Scheduled',
            app.extras || ''
        ];
        tableRows.push(appData);
    });

    doc.text("Trimlyt Appointments", 14, 15);
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    doc.save(`Trimlyt_Appointments_${new Date().toISOString().slice(0,10)}.pdf`);
}

function exportToExcel() {
    if (!window.XLSX) return;
    const currency = localStorage.getItem('trimlyt_currency') || '$';
    
    const data = currentAppointments.map(app => ({
        Date: new Date(app.date).toLocaleString(),
        Service: app.service,
        Price: `${currency}${app.price}`,
        Status: app.status || 'Scheduled',
        Extras: app.extras || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Appointments");
    XLSX.writeFile(wb, `Trimlyt_Appointments_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function initDashboardPage() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const walkInBtn = document.getElementById('walkInBtn');
    const addModal = document.getElementById('addModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addAppointmentForm');
    const dateInput = document.getElementById('dateInput');
    
    // New Modals & Buttons
    const addChoiceModal = document.getElementById('addChoiceModal');
    const calendarModal = document.getElementById('calendarModal');
    const btnManualAdd = document.getElementById('btnManualAdd');
    const btnCalendarIntegrate = document.getElementById('btnCalendarIntegrate');

    if (quickAddBtn) {
        // Open Choice Modal instead of direct Add Modal
        quickAddBtn.addEventListener('click', () => {
            if (addChoiceModal) addChoiceModal.classList.remove('hidden');
        });
    }

    // Choice Modal Logic
    if (addChoiceModal) {
        const closeChoiceBtn = document.getElementById('closeChoiceModal');
        if (closeChoiceBtn) {
            closeChoiceBtn.addEventListener('click', () => addChoiceModal.classList.add('hidden'));
        }

        if (btnCalendarIntegrate) {
            btnCalendarIntegrate.addEventListener('click', () => {
                addChoiceModal.classList.add('hidden');
                if (calendarModal) calendarModal.classList.remove('hidden');
            });
        }
    }

    // Calendar Modal Logic
    if (calendarModal) {
        const backToChoiceBtn = document.getElementById('backToChoiceBtn');
        if (backToChoiceBtn) {
            backToChoiceBtn.addEventListener('click', () => {
                calendarModal.classList.add('hidden');
                if (addChoiceModal) addChoiceModal.classList.remove('hidden');
            });
        }

        const calendarBtns = calendarModal.querySelectorAll('.calendar-btn');
        calendarBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const text = btn.textContent || "";
                if (text.toLowerCase().includes('google')) {
                    calendarModal.classList.add('hidden');
                    await syncGoogleCalendar();
                } else {
                    showNotification(t('coming_soon'), 'info');
                }
            });
        });
    }

    // Manual Add Logic (Moved from quickAddBtn)
    if (btnManualAdd) {
        btnManualAdd.addEventListener('click', () => {
            if (addChoiceModal) addChoiceModal.classList.add('hidden');
            const form = document.getElementById('addAppointmentForm');
            form.reset();
            form.dataset.mode = 'add';
            delete form.dataset.editId;
            delete form.dataset.type; // Clear walk-in type
            addModal.querySelector('h3').textContent = t('new_appointment'); // Ensure translation
            form.querySelector('button[type="submit"]').textContent = t('save');
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateInput').min = now.toISOString().slice(0, 16);
            
            // Reset custom select UI
            const serviceWrapper = document.getElementById('serviceInput').closest('.custom-select-wrapper');
            if (serviceWrapper) {
                const trigger = serviceWrapper.querySelector('.custom-select-trigger');
                if (trigger) trigger.textContent = t('select_service');
                serviceWrapper.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            }

            // Show Date Input
            if (dateInput && dateInput.parentElement) {
                dateInput.parentElement.style.display = 'block';
                dateInput.required = true;
            }

            addModal.classList.remove('hidden');
        });
    }

    if (walkInBtn) {
        walkInBtn.addEventListener('click', () => {
            setupWalkInModal(addForm, addModal, dateInput);
        });
    }

    if (closeAddBtn) {
        closeAddBtn.addEventListener('click', () => {
            addModal.classList.add('hidden');
        });
    }

    if (addForm) {
        addForm.addEventListener('submit', (e) => handleAppointmentSubmit(e, addModal));
    }

    if (dateInput) {
        dateInput.addEventListener('click', () => {
            if ('showPicker' in HTMLInputElement.prototype) {
                dateInput.showPicker();
            }
        });
    }

    const token = localStorage.getItem('trimlyt_token');
    if (token) setupServiceSelect(token);

    initProfileLogic();
    updateDashboardMetrics();
}

function initProfileLogic() {
    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileModal');
    const logoutBtn = document.getElementById('logoutBtn');

    // Update Email in Modal
    if (profileModal) {
        const emailEl = profileModal.querySelector('.modal-content p');
        if (emailEl) {
            const savedEmail = localStorage.getItem('trimlyt_email');
            if (savedEmail) {
                emailEl.textContent = savedEmail;
            } else {
                const token = localStorage.getItem('trimlyt_token');
                if (token) {
                    fetch('/api/auth/user', { headers: { 'x-auth-token': token } })
                        .then(res => res.ok ? res.json() : null)
                        .then(user => {
                            if (user && user.email) {
                                emailEl.textContent = user.email;
                                localStorage.setItem('trimlyt_email', user.email);
                            }
                            if (user && user.avatar) {
                                localStorage.setItem('trimlyt_avatar', user.avatar);
                                updateProfileDisplay();
                            }
                        })
                        .catch(err => console.error('Error fetching user info:', err));
                }
            }
        }
    }

    if (profileBtn && profileModal) {
        profileBtn.addEventListener('click', () => {
            profileModal.classList.remove('hidden');
        });
    }

    if (closeProfileBtn && profileModal) {
        closeProfileBtn.addEventListener('click', () => {
            profileModal.classList.add('hidden');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('trimlyt_token');
            localStorage.removeItem('trimlyt_email');
            localStorage.removeItem('trimlyt_avatar');
            localStorage.removeItem('trimlyt_currency');
            localStorage.removeItem('trimlyt_goal');
            localStorage.removeItem('trimlyt_auto_complete');
            localStorage.removeItem('trimlyt_theme');
            localStorage.removeItem('trimlyt_gap');
            localStorage.removeItem('trimlyt_language');
            sessionStorage.clear(); // Clear session-specific flags like onboarding skips
            window.location.href = 'index.html';
        });
    }
}

async function handleAppointmentSubmit(e, modal) {
    e.preventDefault();
    
    const form = e.target;
    const service = document.getElementById('serviceInput').value;
    const price = document.getElementById('priceInput').value;
    const date = document.getElementById('dateInput').value;
    const extras = document.getElementById('extrasInput').value;
    const token = localStorage.getItem('trimlyt_token');
    const submitBtn = form.querySelector('button[type="submit"]');

    const mode = form.dataset.mode === 'edit' ? 'edit' : 'add';
    const isWalkIn = form.dataset.type === 'walk-in';
    const editId = form.dataset.editId;

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = t('saving');

    try {
        const url = mode === 'edit' ? `/api/appointments/${editId}` : '/api/appointments';
        const method = mode === 'edit' ? 'PUT' : 'POST';

        let payload = { service, price, date, extras };

        // Ensure datetime-local value is converted to an ISO UTC timestamp
        // so server and Google Calendar receive the correct moment matching user's local selection.
        if (payload.date) {
            try {
                const localDate = new Date(payload.date);
                // If the date input was a 'YYYY-MM-DDTHH:mm' string, this creates a local Date.
                payload.date = localDate.toISOString();
            } catch (e) {
                // leave as-is on parse failure
            }
        }

        if (isWalkIn) {
            payload.status = 'Finished';
            payload.date = new Date().toISOString();
            payload.service = `${service} (${t('walk_in')})`;
        }

        // Future Edit Loophole: If moving to future, reset status to Scheduled
        if (!isWalkIn && new Date(date) > new Date()) {
            payload.status = 'Scheduled';
        }

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            let errorMessage = errorData.msg || errorData.error || 'Failed to save appointment';

            if (errorMessage.includes('Time conflict')) {
                errorMessage += ' You can change the gap in Settings.';
            }

            throw new Error(errorMessage);
        }

        const successMsg = mode === 'edit' ? t('appointment_updated') : t('appointment_created');
        showNotification(successMsg, 'success');

        // Show Google Calendar sync info if user has connected Google
        const userRes = await fetch('/api/auth/user', { headers: { 'x-auth-token': token } });
        if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.googleEmail) {
                setTimeout(() => {
                    showNotification(`📅 Synced to Google Calendar (${userData.googleEmail})`, 'info');
                }, 500);
            }
        }

        if (modal) modal.classList.add('hidden');
        form.reset();
        
        const path = window.location.pathname;
        if (path.includes('dashboard')) {
            updateDashboardMetrics();
        } else if (path.includes('appointments')) {
            loadAppointments(true);
        }
    } catch (err) {
        showNotification('Error saving appointment: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function loadAppointments(reset = false) {
    const token = localStorage.getItem('trimlyt_token');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (reset) {
        // If resetting, we assume we are in initAppointmentsPage scope or similar, 
        // but we need to reset the page counter if it was global. 
        // Since pastPage is scoped to initAppointmentsPage, we can't easily reset it from here 
        // without refactoring. For now, we will just fetch page 1 of past.
    }

    try {
        const userRes = await fetch('/api/auth/user', { headers: { 'x-auth-token': token } });

        if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.email) localStorage.setItem('trimlyt_email', userData.email);
            if (userData.avatar) localStorage.setItem('trimlyt_avatar', userData.avatar);
            if (userData.settings) {
                localStorage.setItem('trimlyt_currency', userData.settings.currency);
                localStorage.setItem('trimlyt_goal', userData.settings.monthlyGoal);
                localStorage.setItem('trimlyt_auto_complete', userData.settings.autoCompleteStatus);
                localStorage.setItem('trimlyt_theme', userData.settings.theme);
                localStorage.setItem('trimlyt_gap', userData.settings.appointmentGap !== undefined ? userData.settings.appointmentGap : 60);
                localStorage.setItem('trimlyt_language', userData.settings.language || 'en');
                applyTranslations();
            }
        }

        // Fetch Upcoming (All) and Past (Page 1)
        const [upcomingRes, pastRes] = await Promise.all([
            fetch('/api/appointments?type=upcoming', { headers: { 'x-auth-token': token } }),
            fetch('/api/appointments?type=past&page=1&limit=20', { headers: { 'x-auth-token': token } })
        ]);

        const upcoming = await upcomingRes.json();
        const past = await pastRes.json();

        currentAppointments = [...upcoming, ...past];

        if (loadMoreBtn) {
            loadMoreBtn.style.display = past.length === 20 ? 'block' : 'none';
        }

        renderAppointments(currentAppointments);

    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}

function renderAppointments(appointments) {
    const listContainer = document.getElementById('appointmentList');
    if (!listContainer) return;

    const currency = localStorage.getItem('trimlyt_currency') || '$';

    if (!Array.isArray(appointments) || appointments.length === 0) {
        // Check if it's a search result empty state or global empty state
        if (currentAppointments.length > 0) {
             listContainer.innerHTML = `
                <div class="empty-state">
                    <p>${t('no_matching_appointments')}</p>
                </div>`;
        } else {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>${t('no_appointments')}</p>
                    <p style="font-size: 0.9rem; opacity: 0.8;">${t('track_first')}</p>
                </div>`;
        }
        return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrowStart = new Date(tomorrowStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

    const upcoming = appointments.filter(a => new Date(a.date) >= todayStart);
    const past = appointments.filter(a => new Date(a.date) < todayStart);

    // Sort Upcoming: Ascending (Earliest first)
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Sort Past: Descending (Latest first)
    past.sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    let lastGroup = null;

    const generateItemHTML = (app) => {
        let statusStyle = '';
        let statusText = '';
        let actionButton = '';
        let itemClass = 'appointment-item';

        if (app.needsCompletion) {
            itemClass += ' needs-completion';
            actionButton = `<button class="btn-complete-data btn btn-warning btn-sm" style="margin: 0 8px; padding: 4px 12px; font-size: 0.8rem;" data-id="${app._id}">${t('complete_data')}</button>`;
        }
        
        if (app.status === 'Canceled') {
            statusStyle = 'opacity: 0.6;';
            statusText = `<span style="font-size: 0.8em; color: var(--danger-color); margin-left: 8px;">(${t('status_canceled')})</span>`;
        } else if (app.status === 'No Show') {
            statusStyle = 'opacity: 0.8; border-left: 3px solid var(--danger-color);';
            statusText = `<span style="font-size: 0.8em; color: var(--danger-color); margin-left: 8px;">(${t('status_noshow')})</span>`;
        } else if (app.status === 'Finished') {
            statusStyle = 'border-left: 3px solid var(--success-color);';
            statusText = '<span style="font-size: 0.8em; color: var(--success-color); margin-left: 8px;">✓</span>';
        }

        let extrasHtml = '';
        if (app.extras) {
            extrasHtml = `<p style="font-size: 0.85rem; opacity: 0.8; margin-top: 2px; font-style: italic;">+ ${app.extras}</p>`;
        }

        return `
        <div class="${itemClass}" style="${statusStyle}">
            <div class="appointment-info">
                <h4>${app.service}${statusText}</h4>
                <p>${new Date(app.date).toLocaleString()}</p>
                ${extrasHtml}
            </div>
            ${actionButton}
            <div class="appointment-right">
                <span class="appointment-price">${currency}${app.price}</span>
                <button class="btn-more" data-id="${app._id}">⋮</button>
            </div>
        </div>
        `;
    };

    // Render Upcoming
    upcoming.forEach(app => {
        const appDate = new Date(app.date);
        let groupLabel = '';

        if (appDate < tomorrowStart) {
            groupLabel = t('today');
        } else if (appDate < dayAfterTomorrowStart) {
            groupLabel = t('tomorrow');
        } else {
            groupLabel = appDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        }

        if (groupLabel !== lastGroup) {
            html += `<div class="date-separator">${groupLabel}</div>`;
            lastGroup = groupLabel;
        }
        html += generateItemHTML(app);
    });

    // Render Past
    if (past.length > 0) {
        html += `<div class="date-separator">${t('past')}</div>`;
        past.forEach(app => {
            html += generateItemHTML(app);
        });
    }

    listContainer.innerHTML = html;
}
async function updateDashboardMetrics() {
    const token = localStorage.getItem('trimlyt_token');

    try {
        // Fetch User Settings & Appointments in parallel
        const [userRes, appointmentsRes] = await Promise.all([
            fetch('/api/auth/user', { headers: { 'x-auth-token': token } }),
            fetch('/api/appointments', { headers: { 'x-auth-token': token } })
        ]);

        if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.email) localStorage.setItem('trimlyt_email', userData.email);
            if (userData.avatar) {
                localStorage.setItem('trimlyt_avatar', userData.avatar);
                updateProfileDisplay();
            }
            if (userData.settings) {
                localStorage.setItem('trimlyt_currency', userData.settings.currency);
                localStorage.setItem('trimlyt_goal', userData.settings.monthlyGoal);
                localStorage.setItem('trimlyt_auto_complete', userData.settings.autoCompleteStatus);
                localStorage.setItem('trimlyt_theme', userData.settings.theme);
                localStorage.setItem('trimlyt_gap', userData.settings.appointmentGap !== undefined ? userData.settings.appointmentGap : 60);
                localStorage.setItem('trimlyt_language', userData.settings.language || 'en');
                applyTranslations();
            }
        }

        const appointments = await appointmentsRes.json();
        const currency = localStorage.getItem('trimlyt_currency') || '$';
        const goal = parseInt(localStorage.getItem('trimlyt_goal')) || 5000;

        if (!Array.isArray(appointments)) return;

        const now = new Date();
        const today = now.toDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate start of week (Sunday)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        let realToday = 0, expectedToday = 0;
        let realWeek = 0, expectedWeek = 0;
        let realMonth = 0, expectedMonth = 0;
        let noShowCount = 0, noShowLost = 0;

        appointments.forEach(app => {
            const appDate = new Date(app.date);
            const price = parseFloat(app.price) || 0;
            const isReal = app.status === 'Finished';
            const isExpected = app.status === 'Finished' || app.status === 'Scheduled' || !app.status;

            if (appDate.toDateString() === today) {
                if (isReal) realToday += price;
                if (isExpected) expectedToday += price;
            }
            if (appDate >= startOfWeek) {
                if (isReal) realWeek += price;
                if (isExpected) expectedWeek += price;
            }
            if (appDate.getMonth() === currentMonth && appDate.getFullYear() === currentYear) {
                if (isReal) realMonth += price;
                if (isExpected) expectedMonth += price;

                if (app.status === 'No Show') {
                    noShowCount++;
                    noShowLost += price;
                }
            }
        });

        // Update UI Cards
        const cards = document.querySelectorAll('.metric-card');
        if (cards.length >= 3) {
            const updateCard = (card, real, expected) => {
                card.querySelector('.value').textContent = `${currency}${real}`;
                const expEl = card.querySelector('.expected-value');
                if (expEl) expEl.textContent = `${t('expected')} ${currency}${expected}`;
            };

            updateCard(cards[0], realToday, expectedToday);
            updateCard(cards[1], realWeek, expectedWeek);
            updateCard(cards[2], realMonth, expectedMonth);
        }

        // Update Goal Progress
        const goalPercent = Math.min(100, Math.round((realMonth / goal) * 100));
        const progressBar = document.querySelector('.progress-fill');
        const goalText = document.querySelector('.goal-details');
        const goalPercentText = document.querySelector('.goal-percent');

        if (progressBar) progressBar.style.width = `${goalPercent}%`;
        if (goalText) goalText.textContent = `${currency}${realMonth} / ${currency}${goal}`;
        if (goalPercentText) goalPercentText.textContent = `${goalPercent}%`;

        // Update No Show Metrics
        const noShowValueEl = document.getElementById('noShowValue');
        const noShowLostEl = document.getElementById('noShowLost');
        if (noShowValueEl) noShowValueEl.textContent = noShowCount;
        if (noShowLostEl) noShowLostEl.textContent = `${t('lost')} ${currency}${noShowLost}`;

        // --- Analytics Logic ---
        const hours = new Array(24).fill(0);
        const serviceRevenue = {};

        appointments.forEach(app => {
            const status = app.status || 'Scheduled';
            
            // Busy Hours (Scheduled + Finished)
            if (status === 'Scheduled' || status === 'Finished') {
                const d = new Date(app.date);
                const hour = d.getHours(); // Uses browser's local time automatically
                if (hour >= 0 && hour < 24) hours[hour]++;
            }

            // Service Revenue (Finished only)
            if (status === 'Finished') {
                const price = parseFloat(app.price) || 0;
                const name = app.service;
                if (!serviceRevenue[name]) serviceRevenue[name] = 0;
                serviceRevenue[name] += price;
            }
        });

        // Render Busy Hours Chart
        const chartContainer = document.getElementById('busyHoursChart');
        const yAxisContainer = document.getElementById('busyHoursYAxis');
        
        if (yAxisContainer) {
            yAxisContainer.style.display = 'none';
        }

        if (chartContainer) {
            const maxVal = Math.max(...hours, 1);

            chartContainer.innerHTML = hours.map((count, i) => {
                const h = (count / maxVal) * 100;
                // Show label for every 4 hours: 0, 4, 8, 12, 16, 20
                const label = (i % 4 === 0) ? `<span class="chart-bar-label">${i}</span>` : '';
                return `<div class="chart-bar" style="height: ${h}%;"><div class="chart-bar-value">${count}</div>${label}</div>`;
            }).join('');
        }

        // Render Service Stats
        let top = { name: '-', val: 0 };
        let low = { name: '-', val: Infinity };
        const entries = Object.entries(serviceRevenue);
        
        if (entries.length > 0) {
            entries.forEach(([name, val]) => {
                if (val > top.val) top = { name, val };
                if (val < low.val) low = { name, val };
            });
        } else {
            low.val = 0;
        }

        const topNameEl = document.getElementById('topServiceValue');
        const topRevEl = document.getElementById('topServiceRevenue');
        const lowNameEl = document.getElementById('lowServiceValue');
        const lowRevEl = document.getElementById('lowServiceRevenue');

        if (topNameEl) topNameEl.textContent = top.name;
        if (topRevEl) topRevEl.textContent = `${currency}${top.val}`;
        if (lowNameEl) lowNameEl.textContent = low.name;
        if (lowRevEl) lowRevEl.textContent = entries.length > 0 ? `${currency}${low.val}` : '-';

    } catch (err) {
        console.error('Error updating dashboard:', err);
    }
}

function updateProfileDisplay() {
    const email = localStorage.getItem('trimlyt_email');
    const avatar = localStorage.getItem('trimlyt_avatar');
    const profileBtn = document.getElementById('profileBtn');
    
    if (profileBtn && email) {
        if (avatar) {
            profileBtn.style.backgroundImage = `url('${avatar}')`;
            profileBtn.textContent = '';
            profileBtn.style.backgroundColor = 'transparent';
            return;
        }

        const letter = email.charAt(0).toUpperCase();
        
        // Generate a consistent color based on the email string
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        
        profileBtn.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
        profileBtn.textContent = letter;
        profileBtn.style.backgroundImage = 'none';
    }
}

function initProfilePage() {
    const form = document.getElementById('profileForm');
    const emailInput = document.getElementById('profileEmail');
    const passwordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const avatarInput = document.getElementById('avatarInput');
    const profilePicPreview = document.getElementById('profilePicPreview');
    
    // Load current data
    const email = localStorage.getItem('trimlyt_email');
    const currentAvatar = localStorage.getItem('trimlyt_avatar');
    
    if (emailInput && email) emailInput.value = email;
    
    // Setup Avatar Preview
    const updatePreview = (src) => {
        if (src) {
            profilePicPreview.style.backgroundImage = `url('${src}')`;
            profilePicPreview.textContent = '';
            profilePicPreview.innerHTML = '<div class="profile-overlay">📷</div>';
        } else if (email) {
            // Fallback to initials
            const letter = email.charAt(0).toUpperCase();
            let hash = 0;
            for (let i = 0; i < email.length; i++) {
                hash = email.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            profilePicPreview.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
            profilePicPreview.textContent = letter;
            profilePicPreview.style.backgroundImage = 'none';
            profilePicPreview.innerHTML = `${letter}<div class="profile-overlay">📷</div>`;
        }
    };

    updatePreview(currentAvatar);

    // Handle File Selection
    if (profilePicPreview && avatarInput) {
        profilePicPreview.addEventListener('click', () => avatarInput.click());
        
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    updatePreview(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;
            const confirm = confirmPasswordInput.value;
            const token = localStorage.getItem('trimlyt_token');

            if (password && password !== confirm) {
                showNotification(t('passwords_mismatch'), 'error');
                return;
            }

            const payload = {};
            if (password) payload.password = password;
            
            // Check if avatar changed
            if (avatarInput.files.length > 0) {
                const file = avatarInput.files[0];

                // Compress and resize image
                payload.avatar = await compressImage(file);
            }

            try {
                const res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.msg || errorData.error || res.statusText || 'Failed to update profile');
                }
                
                if (payload.avatar) localStorage.setItem('trimlyt_avatar', payload.avatar);
                updateProfileDisplay();
                showNotification(t('profile_updated'), 'success');
                form.reset();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }

    initProfileLogic();
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Max dimensions for avatar
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to WebP (0.8 quality is very efficient and high quality)
                let dataUrl = canvas.toDataURL('image/webp', 0.8);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                }
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function showNotification(message, type = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger reflow
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 600); // Match CSS transition time
    }, 3000); // Visible for 3 seconds
}

function showConfirm(message, confirmText = 'Confirm', isDestructive = false) {
    return new Promise((resolve) => {
        let modal = document.getElementById('customConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmModal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Confirmation</h3>
                    <p id="confirmMessage" style="text-align: center; margin-bottom: 24px; color: var(--text-muted);"></p>
                    <button id="confirmYesBtn" class="btn-option"></button>
                    <button id="confirmNoBtn" class="btn btn-text">Cancel</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const msgEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');

        msgEl.textContent = message;
        yesBtn.textContent = confirmText;
        
        yesBtn.className = 'btn-option';
        if (isDestructive) {
            yesBtn.classList.add('btn-danger');
        }

        // Force reflow
        void modal.offsetWidth;
        modal.classList.remove('hidden');

        const close = (result) => {
            modal.classList.add('hidden');
            resolve(result);
            yesBtn.onclick = null;
            noBtn.onclick = null;
            modal.onclick = null;
        };

        yesBtn.onclick = () => close(true);
        noBtn.onclick = () => close(false);
        modal.onclick = (e) => {
            if (e.target === modal) close(false);
        };
    });
}

function setupCustomSelects() {
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        // Check if already wrapped to prevent duplicate initialization
        if (select.parentElement.classList.contains('custom-select-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.classList.add('custom-select-wrapper');
        
        // Insert wrapper before select
        select.parentNode.insertBefore(wrapper, select);
        // Move select into wrapper
        wrapper.appendChild(select);

        // Create custom UI structure
        const customSelect = document.createElement('div');
        customSelect.classList.add('custom-select');
        
        const trigger = document.createElement('div');
        trigger.classList.add('custom-select-trigger');
        
        // Set initial text based on current selection
        const selectedOption = select.options[select.selectedIndex];
        trigger.textContent = selectedOption ? selectedOption.textContent : 'Select';
        
        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('custom-options');

        Array.from(select.options).forEach(option => {
            const customOption = document.createElement('div');
            customOption.classList.add('custom-option');
            customOption.textContent = option.textContent;
            customOption.dataset.value = option.value;
            
            if (option.selected) {
                customOption.classList.add('selected');
            }

            customOption.addEventListener('click', () => {
                // Update original select value
                select.value = option.value;
                
                // Update trigger text
                trigger.textContent = option.textContent;
                
                // Update selected visual state
                optionsDiv.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                customOption.classList.add('selected');
                
                // Close dropdown
                customSelect.classList.remove('open');
                
                // Trigger change event so existing listeners in main.js work
                select.dispatchEvent(new Event('change'));
            });

            optionsDiv.appendChild(customOption);
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other open selects
            document.querySelectorAll('.custom-select').forEach(s => {
                if (s !== customSelect) s.classList.remove('open');
            });
            customSelect.classList.toggle('open');
        });

        customSelect.appendChild(trigger);
        customSelect.appendChild(optionsDiv);
        wrapper.appendChild(customSelect);
    });

    // Close dropdowns when clicking outside (ensure only added once)
    if (!window._customSelectListenerAdded) {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.custom-select').forEach(s => {
                if (!s.contains(e.target)) {
                    s.classList.remove('open');
                }
            });
        });
        window._customSelectListenerAdded = true;
    }
}

async function setupServiceSelect(token) {
    const serviceInput = document.getElementById('serviceInput');
    const priceInput = document.getElementById('priceInput');
    
    if (!serviceInput || !priceInput) return;

    try {
        const res = await fetch('/api/services', { headers: { 'x-auth-token': token } });
        if (res.ok) {
            const services = await res.json();
            const currency = localStorage.getItem('trimlyt_currency') || '$';
            
            // Rebuild options, keeping placeholder
            const placeholderText = t('select_service');
            let html = `<option value="" disabled selected>${placeholderText}</option>`;
            
            services.forEach(s => {
                html += `<option value="${s.name}" data-price="${s.price}">${s.name} (${currency}${s.price})</option>`;
            });
            
            serviceInput.innerHTML = html;

            serviceInput.addEventListener('change', () => {
                const selectedOption = serviceInput.options[serviceInput.selectedIndex];
                const price = selectedOption.dataset.price;
                if (price) {
                    priceInput.value = price;
                }
            });

            setupCustomSelects();
        }
    } catch (err) {
        console.error('Failed to load services', err);
    }
}

async function syncGoogleCalendar() {
    const token = localStorage.getItem('trimlyt_token');
    const keyword = localStorage.getItem('trimlyt_google_keyword') || 'TL';
    showNotification(`Syncing with Google Calendar...\n\nLooking for events starting with: "${keyword}"`, 'info');
    
    try {
        const res = await fetch('/api/appointments/sync-google', {
            method: 'POST',
            headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ importKeyword: keyword })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            showNotification(data.msg + '\n\nOnly events matching "TL Service Price" pattern are imported.', 'success');
            // Refresh data based on current page
            const path = window.location.pathname;
            if (path.includes('dashboard')) {
                updateDashboardMetrics();
            } else if (path.includes('appointments')) {
                loadAppointments(true);
            }
        } else {
            if (data.msg === 'Google account not connected') {
                showNotification(t('not_connected'), 'error');
            } else {
                throw new Error(data.msg || 'Sync failed');
            }
        }
    } catch (err) {
        console.error(err);
        const message = (err && err.message) || (err && err.msg) || 'Error syncing calendar';
        // If backend provided a helpful message (e.g. "Google token invalid"), show it directly.
        if (message && message !== 'Server Error during sync') {
            showNotification(message, 'error');
        } else {
            showNotification('Error syncing calendar: ' + message, 'error');
        }
    }
}

// --- Onboarding System ---
async function initOnboarding(token) {
    const modal = document.getElementById('onboardingModal');
    const content = document.getElementById('onboardingContent');
    const closeBtn = document.getElementById('closeOnboardingBtn');
    
    if (!modal || !content) return;

    // Helper to check status
    const checkGoogleStatus = async () => {
        try {
            const res = await fetch('/api/auth/google/status', { headers: { 'x-auth-token': token } });
            const data = await res.json();
            return data.connected;
        } catch (err) {
            console.error('Error checking Google status:', err);
            return false;
        }
    };

    // Helper to render and show task
    const showTask = (task) => {
        if (task === 'info_button_intro') {
            content.innerHTML = `
                <h3 style="margin-bottom: 16px; color: var(--text-primary);">${t('onboarding_info_title')}</h3>
                <div style="color: var(--text-muted); margin-bottom: 24px; line-height: 1.6;">${t('onboarding_info_text_html')}</div>
                <button id="gotItInfoBtn" class="btn btn-primary" style="width: 100%;">${t('got_it')}</button>
            `;

            document.getElementById('gotItInfoBtn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });

        } else if (task === 'google_task1') {
            content.innerHTML = `
                <h3 style="margin-bottom: 16px; color: var(--text-primary);">${t('onboarding_google_task1_title')}</h3>
                <div style="color: var(--text-muted); line-height: 1.6;">${t('onboarding_google_task1_text_html')}</div>
                <div style="display: flex; gap: 8px;">
                    <button id="connectGoogleTaskBtn" class="btn btn-primary" style="flex: 1;">${t('connect_google_account')}</button>
                    <button id="skipGoogleTask1Btn" class="btn btn-text" style="flex: 1;">${t('maybe_later')}</button>
                </div>
            `;

            document.getElementById('connectGoogleTaskBtn').addEventListener('click', async () => {
                const token = localStorage.getItem('trimlyt_token');
                try {
                    const res = await fetch('/api/auth/google/url', { headers: { 'x-auth-token': token } });
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    }
                } catch (err) {
                    showNotification('Error initiating connection', 'error');
                }
            });

            document.getElementById('skipGoogleTask1Btn').addEventListener('click', () => {
                sessionStorage.setItem('trimlyt_google_task1_skipped_session', 'true');
                modal.classList.add('hidden');
                // Stop the timers for the current session
                if (window._trimlytGoogleTaskTimeout) {
                    clearTimeout(window._trimlytGoogleTaskTimeout);
                }
                if (window._trimlytGoogleTaskInterval) {
                    clearInterval(window._trimlytGoogleTaskInterval);
                }
            });

        } else if (task === 'google_task2') {
            content.innerHTML = `
                <h3 style="margin-bottom: 16px; color: var(--text-primary);">${t('onboarding_google_task2_title')}</h3>
                <div style="color: var(--text-muted); line-height: 1.6;">${t('onboarding_google_task2_text_html')}</div>
                <div style="display: flex; gap: 8px;">
                    <button id="understandTask2Btn" class="btn btn-primary" style="flex: 1;">${t('got_it')}</button>
                    <button id="skipGoogleTask2Btn" class="btn btn-text" style="flex: 1;">${t('maybe_later')}</button>
                </div>
            `;

            document.getElementById('understandTask2Btn').addEventListener('click', () => {
                localStorage.setItem('trimlyt_onboarding_google_task2_dismissed', 'true');
                modal.classList.add('hidden');
            });

            document.getElementById('skipGoogleTask2Btn').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        
        modal.classList.remove('hidden');
    };

    // Close button logic
    if (closeBtn) {
        // Clone to remove existing listeners if any, though initOnboarding is usually called once
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // --- Onboarding Logic ---

    // 1. One-time modal for the info button. This runs before other onboarding tasks.
    const infoButtonModalShown = localStorage.getItem('trimlyt_info_button_modal_shown');
    if (!infoButtonModalShown) {
        showTask('info_button_intro');
        localStorage.setItem('trimlyt_info_button_modal_shown', 'true');
        return; // Show this and exit onboarding for this page load
    }

    // 2. Google-related tasks
    // Initial Check
    const isGoogleConnected = await checkGoogleStatus();
    const googleTask2Dismissed = localStorage.getItem('trimlyt_onboarding_google_task2_dismissed');

    if (isGoogleConnected) {
        // Task 2: Show immediately if connected and not dismissed
        if (!googleTask2Dismissed) {
            showTask('google_task2');
        }
    } else {
        // Task 1: Not connected.
        if (sessionStorage.getItem('trimlyt_google_task1_skipped_session')) {
            return; // User has skipped this for the current session.
        }
        
        // Trigger 1: Show after 3 seconds
        window._trimlytGoogleTaskTimeout = setTimeout(async () => {
            const currentStatus = await checkGoogleStatus();
            if (!currentStatus && modal.classList.contains('hidden')) {
                showTask('google_task1');
            }
        }, 3000);

        // Clear any existing interval to prevent duplicates
        if (window._trimlytGoogleTaskInterval) clearInterval(window._trimlytGoogleTaskInterval);

        window._trimlytGoogleTaskInterval = setInterval(async () => {
            const currentStatus = await checkGoogleStatus();
            if (!currentStatus) {
                // Only show if not already visible
                if (modal.classList.contains('hidden')) {
                    showTask('google_task1');
                }
            }
        }, 120000); // 2 minutes
    }
}

// --- Translation System ---
const translations = {
    en: {
        app_name: "Trimlyt",
        tagline: "Performance tracking for barbers.",
        email: "Email",
        password: "Password",
        login: "Log In",
        signup: "Sign Up",
        create_account: "Create Account",
        back_login: "Back to Login",
        dashboard: "Dashboard",
        track_cut: "Track every cut.",
        add_appointment: "+ Add Appointments",
        walk_in_now: "Walk-in (Now)",
        revenue_today: "Today's Revenue",
        revenue_week: "This Week",
        revenue_month: "This Month",
        expected: "Exp:",
        monthly_goal: "Monthly Goal",
        busy_hours: "Busy Hours",
        top_service: "Top Service",
        lowest_service: "Least Profitable",
        history: "History",
        walk_in: "Walk-in",
        add: "+ Add",
        search_placeholder: "Search appointments...",
        services: "Services",
        manage_services: "Manage Services",
        services_modal_title: "My Services",
        service_name: "Service Name",
        service_deleted: "Service deleted.",
        no_services_yet: "No services added yet.",
        no_appointments: "No appointments logged yet.",
        no_matching_services: "No matching services",
        track_first: "Tap \"+ Add\" to track your first cut.",
        load_more: "Load More",
        settings: "Settings",
        currency: "Currency",
        language: "Language",
        gap: "Minimum Appointment Gap",
        auto_complete: "Auto-Complete Appointments",
        auto_complete_desc: "If an appointment time passes without a manual update, automatically set the status to:",
        dark_mode: "Dark Mode",
        edit_profile: "Edit Profile",
        subscription: "Subscription",
        logout: "Log Out",
        close: "Close",
        save: "Save",
        cancel: "Cancel",
        update: "Update",
        service: "Service",
        price: "Price",
        date_time: "Date & Time",
        extras: "Extras (Optional)",
        extras_placeholder: "Client Name, Notes, etc.",
        new_appointment: "New Appointment",
        edit_appointment: "Edit Appointment",
        options: "Options",
        finish_app: "Appointment Finished",
        user_no_show: "User didn't show up",
        canceled: "Canceled",
        delete_app: "Delete Appointment",
        undo_finish: "Undo Finish",
        set_scheduled: "Set to Scheduled",
        confirm_delete: "Are you sure you want to delete this appointment?",
        delete: "Delete",
        confirm: "Confirm",
        account: "Account",
        profile_guide: "Profile Guide",
        got_it: "Got it",
        login_title: "Trimlyt",
        login_desc: "Performance tracking for barbers.",
        signup_title: "Sign Up",
        signup_desc: "Create your account.",
        account_created: "Account created successfully! Please log in.",
        walk_in_finished: "Walk-in (Finished)",
        complete: "Complete",
        saving: "Saving...",
        appointment_updated: "Appointment updated!",
        appointment_created: "Appointment created!",
        no_matching_appointments: "No matching appointments found.",
        status_canceled: "Canceled",
        status_noshow: "No Show",
        today: "Today",
        tomorrow: "Tomorrow",
        past: "Past",
        passwords_mismatch: "Passwords do not match",
        profile_updated: "Profile updated successfully!",
        dashboard_guide: "Dashboard Guide",
        dashboard_guide_text: "This is your main command center.\n\n• Revenue (Big Number): Cash secured. Only counts 'Finished' appointments.\n• Exp (Expected): Your potential total. Counts both 'Finished' and 'Scheduled' appointments.\n• Goal: Tracks your progress toward your monthly target based on actual revenue.\n• Walk-in: Quickly logs a cut as 'Finished' for right now, skipping the schedule.",
        appointments_guide: "Appointments Guide",
        appointments_guide_text: "Manage your schedule and history.\n\n• Time Gap: To prevent overbooking, the system enforces a minimum gap between appointments (Default: 1 hour). Change this in Settings.\n• Search: Filter by client name, service, or extras.\n• Actions: Tap any appointment to Edit, Cancel, or mark as Finished.\n• History: Scroll down to load past appointments.",
        settings_guide: "Settings Guide",
        settings_guide_text: "Customize the app to fit your workflow.\n\n• Monthly Goal: The revenue target used for the progress bar on the Dashboard.\n• Appointment Gap: The mandatory buffer time between bookings to prevent conflicts.\n• Auto-Complete: If you forget to update an appointment, the app will automatically set it to this status (e.g., 'Finished') after 1 hour.",
        profile_guide_text: "Update your account information.\n\n• Avatar: Tap the camera icon to upload a custom profile picture.\n• Security: Update your password here. You will stay logged in after changing it.",
        subscription_guide: "Subscription Guide",
        subscription_guide_text: "Manage your Trimlyt plan.\n\nView your current status and upgrade to unlock premium features.",
        sub_coming_soon: "Subscription management coming soon.",
        new_password: "New Password",
        confirm_password: "Confirm Password",
        update_profile: "Update Profile",
        finished_default: "Finished (Default)",
        didnt_show_up: "Didn't Show Up",
        no_gap: "No Gap",
        hour_default: "1 Hour (Default)",
        add_manually: "Add Manually",
        integrate_calendar: "Integrate from Calendar",
        choose_calendar: "Choose Calendar",
        back: "Back",
        coming_soon: "Coming Soon",
        google_calendar: "Google Calendar",
        apple_calendar: "Apple Calendar",
        no_shows_month: "No Shows (Month)",
        lost: "Lost:",
        integrations: "Integrations",
        connect_google: "Connect Google Account",
        google_integration_desc: "Connect to sync with Google Calendar. Trimlyt only accesses calendar events and basic identity.",
        not_connected: "Not Connected",
        disconnect: "Disconnect",
        google_connected: "Google Account Connected!",
        confirm_disconnect: "Disconnect Google Account?",
        disconnected: "Disconnected.",
        manage_services_hint: "You can manage services in the settings",
        select_service: "Select Service",
        export_options: "Export Options",
        download_pdf: "Download PDF",
        download_excel: "Download Excel",
        google_import_keyword: "Google Import Keyword",
        google_import_keyword_desc: "Events with this title will be imported. Default is 'TL'.",
        complete_appointment_title: "Complete Appointment",
        complete_appointment_desc: "This appointment was imported from Google Calendar but is missing details (Service/Price). Please update it.",
        complete_data: "Complete Data",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Your business control center. Track revenue, monitor performance, and manage quick actions.</p><h4 style='margin-top:12px;'>Quick Actions</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Add Appointments:</strong> Open the menu to add a new appointment manually or import from your connected calendar.</li><li><strong>Walk-in (Now):</strong> Instantly log a completed service for right now. Skips the schedule and adds directly to revenue.</li></ul><h4 style='margin-top:12px;'>Metrics & Goals</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Revenue:</strong> Cash secured from 'Finished' appointments.</li><li><strong>Expected (Exp):</strong> Total potential revenue (Finished + Scheduled).</li><li><strong>Goal:</strong> Tracks progress toward your monthly target (set in Settings).</li></ul><h4 style='margin-top:12px;'>Analytics</h4><p style='color: var(--text-muted);'><strong>Busy Hours</strong> shows your peak times. <strong>Top Service</strong> highlights your best earners.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & terms: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacy Policy</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Terms of Service</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Manage your schedule and history.</p><h4 style='margin-top:12px;'>Adding Appointments</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Add:</strong> Choose <em>Add Manually</em> for specific details or <em>Integrate from Calendar</em> to pull events from Google/Apple Calendar.</li><li><strong>Walk-in:</strong> Quickly log a finished job for the current time.</li></ul><h4 style='margin-top:12px;'>Google Calendar Sync</h4><p style='color: var(--text-muted);'>To import events, title them <strong>TL [Service] [Price]</strong> (e.g., \"TL Haircut 25\") in your Google Calendar. Trimlyt only imports events with this format.</p><h4 style='margin-top:12px;'>Managing the List</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Search:</strong> Filter by client name, service, or notes.</li><li><strong>Actions:</strong> Tap any appointment to Edit, Finish, Cancel, or Delete.</li><li><strong>History:</strong> Scroll down to view past appointments.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & terms: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacy Policy</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Terms of Service</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Customize Trimlyt for your business.</p><h4 style='margin-top:12px;'>Integrations & Services</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Google Account:</strong> Connect to sync appointments. We only access calendar events and basic profile info.</li><li><strong>Manage Services:</strong> Add or remove services (e.g., Haircut, Beard Trim) to speed up appointment entry.</li></ul><h4 style='margin-top:12px;'>Preferences</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Monthly Goal:</strong> Set your revenue target for the Dashboard.</li><li><strong>Appointment Gap:</strong> Enforce buffer time between bookings to prevent overlap.</li><li><strong>Auto-Complete:</strong> Automatically mark past scheduled appointments as Finished, Canceled, or No Show.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & terms: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacy Policy</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Terms of Service</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Manage your personal account details.<br><br>• <strong>Avatar:</strong> Tap the camera icon to upload a brand logo or profile picture.<br>• <strong>Security:</strong> Update your password to keep your account safe.<br>• <strong>Email:</strong> Your login email is fixed. Contact support if it needs changing.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>View and manage your Trimlyt plan.<br><br>• <strong>Current Status:</strong> Check your active plan.<br>• <strong>Upgrade:</strong> Unlock premium features like advanced analytics and unlimited history (Coming Soon).</p>",
        onboarding_info_title: "💡 Quick Tip!",
        onboarding_info_text_html: "<p>See that ⓘ icon in the top-left corner?</p><p>Tap it anytime for a helpful guide on the current page's features.</p>",
        onboarding_google_task1_title: "📱 Connect Your Google Account",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Connect your Google Account to unlock these features:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Sync Google Calendar</strong> — Trimlyt appointments will also appear in your Google Calendar and you can import existing appointments to Trimlyt</li><li><strong>Zero Email Access</strong> — Trimlyt does <u>not</u> access your email or send on your behalf</li><li><strong>Minimal Permissions</strong> — Only calendar and basic identity</li><li><strong>Your Data is Safe</strong> — End-to-end encrypted, no data sharing</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Privacy & Terms:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Privacy Policy</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Terms of Service</a></p></div>",
        onboarding_google_task2_title: "📅 How Google Calendar Integration Works",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt uses a simple format to identify which events to import from your Google Calendar.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Event Title Format:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Service] [Price]</code><p style='margin: 0; font-size: 0.9rem;'>Example: <strong>\"TL Haircut 25\"</strong> or <strong>\"TL Beard Trim 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>Why this approach?</strong> Only events you specifically mark with the \"TL\" keyword are imported. This ensures:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>You have full control over what gets imported</li><li>Personal events stay private</li><li>No accidental pollution of your appointment history</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Best Practice:</strong> We recommend creating appointments directly in <strong>Trimlyt</strong> for better control and mobile experience. Use Google Calendar import for <strong>bulk-importing existing events only</strong>.</p></div>",
        connect_google_account: "Connect Google Account",
        maybe_later: "Maybe later"
    },
    de: {
        app_name: "Trimlyt",
        tagline: "Leistungserfassung für Barbiere.",
        email: "E-Mail",
        password: "Passwort",
        login: "Anmelden",
        signup: "Registrieren",
        create_account: "Konto erstellen",
        back_login: "Zurück zur Anmeldung",
        dashboard: "Dashboard",
        track_cut: "Jeden Schnitt erfassen.",
        add_appointment: "+ Termin hinzufügen",
        walk_in_now: "Laufkundschaft (Jetzt)",
        revenue_today: "Einnahmen Heute",
        revenue_week: "Diese Woche",
        revenue_month: "Diesen Monat",
        expected: "Erw:",
        monthly_goal: "Monatsziel",
        busy_hours: "Stoßzeiten",
        top_service: "Top Service",
        lowest_service: "Wenigsten Profitabel",
        history: "Verlauf",
        walk_in: "Laufkundschaft",
        add: "+ Neu",
        search_placeholder: "Termine suchen...",
        no_appointments: "Noch keine Termine.",
        no_matching_services: "Keine passenden Dienste",
        service_deleted: "Dienstleistung gelöscht.",
        track_first: "Tippe auf \"+ Neu\" für den ersten Schnitt.",
        load_more: "Mehr laden",
        settings: "Einstellungen",
        currency: "Währung",
        language: "Sprache",
        gap: "Min. Terminabstand",
        auto_complete: "Termine autom. abschließen",
        auto_complete_desc: "Wenn ein Termin ohne Update verstreicht, Status setzen auf:",
        dark_mode: "Dunkelmodus",
        edit_profile: "Profil bearbeiten",
        subscription: "Abo",
        logout: "Abmelden",
        close: "Schließen",
        save: "Speichern",
        cancel: "Abbrechen",
        update: "Aktualisieren",
        service: "Dienstleistung",
        price: "Preis",
        date_time: "Datum & Zeit",
        extras: "Extras (Optional)",
        extras_placeholder: "Kundenname, Notizen, etc.",
        new_appointment: "Neuer Termin",
        edit_appointment: "Termin bearbeiten",
        options: "Optionen",
        finish_app: "Termin beendet",
        user_no_show: "Kunde nicht erschienen",
        canceled: "Abgesagt",
        delete_app: "Termin löschen",
        undo_finish: "Beenden rückgängig",
        set_scheduled: "Auf Geplant setzen",
        confirm_delete: "Möchtest du diesen Termin wirklich löschen?",
        delete: "Löschen",
        confirm: "Bestätigen",
        account: "Konto",
        profile_guide: "Profil Hilfe",
        got_it: "Verstanden",
        login_title: "Trimlyt",
        login_desc: "Leistungserfassung für Barbiere.",
        signup_title: "Registrieren",
        signup_desc: "Erstelle dein Konto.",
        account_created: "Konto erfolgreich erstellt! Bitte anmelden.",
        walk_in_finished: "Laufkundschaft (Fertig)",
        complete: "Abschließen",
        saving: "Speichern...",
        appointment_updated: "Termin aktualisiert!",
        appointment_created: "Termin erstellt!",
        no_matching_appointments: "Keine passenden Termine gefunden.",
        status_canceled: "Abgesagt",
        status_noshow: "Nicht erschienen",
        today: "Heute",
        tomorrow: "Morgen",
        past: "Vergangenheit",
        passwords_mismatch: "Passwörter stimmen nicht überein",
        profile_updated: "Profil erfolgreich aktualisiert!",
        dashboard_guide: "Dashboard Anleitung",
        dashboard_guide_text: "Dies ist deine Kommandozentrale.\n\n• Einnahmen (Große Zahl): Gesichertes Geld. Zählt nur 'Beendete' Termine.\n• Erw (Erwartet): Dein potenzielles Gesamt. Zählt 'Beendete' und 'Geplante' Termine.\n• Ziel: Verfolgt deinen Fortschritt zum Monatsziel basierend auf tatsächlichen Einnahmen.\n• Laufkundschaft: Protokolliert schnell einen Schnitt als 'Beendet' für jetzt, ohne Zeitplan.",
        appointments_guide: "Termin Anleitung",
        appointments_guide_text: "Verwalte deinen Zeitplan und Verlauf.\n\n• Zeitabstand: Um Überbuchungen zu vermeiden, erzwingt das System einen Mindestabstand zwischen Terminen (Standard: 1 Stunde). Ändere dies in den Einstellungen.\n• Suche: Filtere nach Kundenname, Dienstleistung oder Extras.\n• Aktionen: Tippe auf einen Termin zum Bearbeiten, Absagen oder als Beendet markieren.\n• Verlauf: Scrolle nach unten, um vergangene Termine zu laden.",
        settings_guide: "Einstellungen Anleitung",
        settings_guide_text: "Passe die App an deinen Arbeitsablauf an.\n\n• Monatsziel: Das Umsatzziel für den Fortschrittsbalken im Dashboard.\n• Terminabstand: Die obligatorische Pufferzeit zwischen Buchungen, um Konflikte zu vermeiden.\n• Auto-Complete: Wenn du vergisst, einen Termin zu aktualisieren, setzt die App ihn nach 1 Stunde automatisch auf diesen Status (z.B. 'Beendet').",
        profile_guide_text: "Aktualisiere deine Kontoinformationen.\n\n• Avatar: Tippe auf das Kamerasymbol, um ein eigenes Profilbild hochzuladen.\n• Sicherheit: Aktualisiere hier dein Passwort. Du bleibst nach der Änderung angemeldet.",
        subscription_guide: "Abo Anleitung",
        subscription_guide_text: "Verwalte deinen Trimlyt-Plan.\n\nSieh dir deinen aktuellen Status an und upgrade, um Premium-Funktionen freizuschalten.",
        sub_coming_soon: "Abo-Verwaltung kommt bald.",
        new_password: "Neues Passwort",
        confirm_password: "Passwort bestätigen",
        update_profile: "Profil aktualisieren",
        finished_default: "Beendet (Standard)",
        didnt_show_up: "Nicht erschienen",
        no_gap: "Kein Abstand",
        hour_default: "1 Stunde (Standard)",
        add_manually: "Manuell hinzufügen",
        integrate_calendar: "Kalender integrieren",
        choose_calendar: "Kalender wählen",
        back: "Zurück",
        coming_soon: "Demnächst",
        google_calendar: "Google Kalender",
        apple_calendar: "Apple Kalender",
        no_shows_month: "Nicht erschienen (Monat)",
        lost: "Verlust:",
        integrations: "Integrationen",
        connect_google: "Google-Konto verbinden",
        google_integration_desc: "Verbinden, um automatische E-Mail-Erinnerungen zu senden.",
        not_connected: "Nicht verbunden",
        disconnect: "Trennen",
        google_connected: "Google-Konto verbunden!",
        confirm_disconnect: "Google-Konto trennen?",
        disconnected: "Getrennt.",
        export_options: "Exportoptionen",
        download_pdf: "PDF herunterladen",
        download_excel: "Excel herunterladen",
        google_import_keyword: "Google Import-Schlüsselwort",
        google_import_keyword_desc: "Ereignisse mit diesem Titel werden importiert. Standard ist 'TL'.",
        complete_appointment_title: "Termin vervollständigen",
        complete_appointment_desc: "Dieser Termin wurde aus Google Kalender importiert, aber es fehlen Details (Dienstleistung/Preis). Bitte aktualisieren.",
        complete_data: "Daten vervollständigen",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Ihre Geschäftszentrale. Verfolgen Sie Einnahmen, überwachen Sie die Leistung und verwalten Sie Schnellaktionen.</p><h4 style='margin-top:12px;'>Schnellaktionen</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Termine hinzufügen:</strong> Öffnen Sie das Menü, um einen neuen Termin manuell hinzuzufügen oder aus Ihrem verbundenen Kalender zu importieren.</li><li><strong>Laufkundschaft (Jetzt):</strong> Protokollieren Sie sofort einen abgeschlossenen Service für jetzt. Überspringt den Zeitplan und fügt direkt zu den Einnahmen hinzu.</li></ul><h4 style='margin-top:12px;'>Metriken & Ziele</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Einnahmen:</strong> Gesichertes Bargeld aus 'Beendeten' Terminen.</li><li><strong>Erwartet (Erw):</strong> Gesamtes potenzielles Einkommen (Beendet + Geplant).</li><li><strong>Ziel:</strong> Verfolgt den Fortschritt in Richtung Ihres monatlichen Ziels (in den Einstellungen festgelegt).</li></ul><h4 style='margin-top:12px;'>Analytik</h4><p style='color: var(--text-muted);'><strong>Stoßzeiten</strong> zeigt Ihre Spitzenzeiten. <strong>Top Service</strong> hebt Ihre besten Einnahmequellen hervor.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Datenschutz & Bedingungen: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Datenschutz</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Nutzungsbedingungen</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Verwalten Sie Ihren Zeitplan und Verlauf.</p><h4 style='margin-top:12px;'>Termine hinzufügen</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Hinzufügen:</strong> Wählen Sie <em>Manuell hinzufügen</em> für spezifische Details oder <em>Aus Kalender integrieren</em>, um Ereignisse aus Google/Apple Kalender abzurufen.</li><li><strong>Laufkundschaft:</strong> Protokollieren Sie schnell einen abgeschlossenen Job für die aktuelle Zeit.</li></ul><h4 style='margin-top:12px;'>Google Kalender Sync</h4><p style='color: var(--text-muted);'>Um Ereignisse zu importieren, benennen Sie sie <strong>TL [Service] [Preis]</strong> (z.B. \"TL Haarschnitt 25\") in Ihrem Google Kalender. Trimlyt importiert nur Ereignisse mit diesem Format.</p><h4 style='margin-top:12px;'>Liste verwalten</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Suche:</strong> Filtern Sie nach Kundenname, Service oder Notizen.</li><li><strong>Aktionen:</strong> Tippen Sie auf einen Termin zum Bearbeiten, Beenden, Abbrechen oder Löschen.</li><li><strong>Verlauf:</strong> Scrollen Sie nach unten, um vergangene Termine anzuzeigen.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Datenschutz & Bedingungen: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Datenschutz</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Nutzungsbedingungen</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Passen Sie Trimlyt an Ihr Geschäft an.</p><h4 style='margin-top:12px;'>Integrationen & Dienste</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Google-Konto:</strong> Verbinden Sie sich, um Termine zu synchronisieren. Wir greifen nur auf Kalenderereignisse und grundlegende Profilinformationen zu.</li><li><strong>Dienste verwalten:</strong> Fügen Sie Dienste hinzu oder entfernen Sie sie (z.B. Haarschnitt, Bartpflege), um die Termineingabe zu beschleunigen.</li></ul><h4 style='margin-top:12px;'>Einstellungen</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Monatsziel:</strong> Legen Sie Ihr Umsatzziel für das Dashboard fest.</li><li><strong>Terminabstand:</strong> Erzwingen Sie eine Pufferzeit zwischen Buchungen, um Überschneidungen zu vermeiden.</li><li><strong>Auto-Complete:</strong> Markieren Sie vergangene geplante Termine automatisch als Beendet, Abgesagt oder Nicht erschienen.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Datenschutz & Bedingungen: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Datenschutz</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Nutzungsbedingungen</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Verwalten Sie Ihre persönlichen Kontodaten.<br><br>• <strong>Avatar:</strong> Tippen Sie auf das Kamerasymbol, um ein Markenlogo oder Profilbild hochzuladen.<br>• <strong>Sicherheit:</strong> Aktualisieren Sie Ihr Passwort, um Ihr Konto sicher zu halten.<br>• <strong>E-Mail:</strong> Ihre Anmelde-E-Mail ist festgelegt. Kontaktieren Sie den Support, wenn sie geändert werden muss.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Verwalten Sie Ihren Trimlyt-Plan.<br><br>• <strong>Aktueller Status:</strong> Überprüfen Sie Ihren aktiven Plan.<br>• <strong>Upgrade:</strong> Schalten Sie Premium-Funktionen wie erweiterte Analysen und unbegrenzten Verlauf frei (Demnächst).</p>",
        onboarding_info_title: "💡 Schneller Tipp!",
        onboarding_info_text_html: "<p>Sehen Sie das ⓘ Symbol oben links?</p><p>Tippen Sie jederzeit darauf für eine hilfreiche Anleitung zu den Funktionen der aktuellen Seite.</p>",
        onboarding_google_task1_title: "📱 Google-Konto verbinden",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Verbinden Sie Ihr Google-Konto, um diese Funktionen freizuschalten:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Google Kalender Sync</strong> — Trimlyt-Termine erscheinen auch in Ihrem Google Kalender und Sie können bestehende Termine importieren</li><li><strong>Kein E-Mail-Zugriff</strong> — Trimlyt greift <u>nicht</u> auf Ihre E-Mails zu oder sendet in Ihrem Namen</li><li><strong>Minimale Berechtigungen</strong> — Nur Kalender und grundlegende Identität</li><li><strong>Ihre Daten sind sicher</strong> — Ende-zu-Ende verschlüsselt, keine Datenweitergabe</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Datenschutz & Bedingungen:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Datenschutz</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Nutzungsbedingungen</a></p></div>",
        onboarding_google_task2_title: "📅 Wie die Google Kalender Integration funktioniert",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt verwendet ein einfaches Format, um zu identifizieren, welche Ereignisse aus Ihrem Google Kalender importiert werden sollen.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Ereignistitel-Format:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Service] [Preis]</code><p style='margin: 0; font-size: 0.9rem;'>Beispiel: <strong>\"TL Haarschnitt 25\"</strong> oder <strong>\"TL Bartpflege 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>Warum dieser Ansatz?</strong> Nur Ereignisse, die Sie speziell mit dem Schlüsselwort \"TL\" markieren, werden importiert. Dies stellt sicher:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>Sie haben die volle Kontrolle darüber, was importiert wird</li><li>Persönliche Ereignisse bleiben privat</li><li>Keine versehentliche Verschmutzung Ihres Terminverlaufs</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Best Practice:</strong> Wir empfehlen, Termine direkt in <strong>Trimlyt</strong> zu erstellen, um eine bessere Kontrolle und mobile Erfahrung zu gewährleisten. Verwenden Sie den Google Kalender Import nur für <strong>Massenimport bestehender Ereignisse</strong>.</p></div>",
        connect_google_account: "Google-Konto verbinden",
        maybe_later: "Vielleicht später"
    },
    nl: {
        app_name: "Trimlyt",
        tagline: "Prestatie-tracking voor kappers.",
        email: "E-mail",
        password: "Wachtwoord",
        login: "Inloggen",
        signup: "Aanmelden",
        create_account: "Account aanmaken",
        back_login: "Terug naar inloggen",
        dashboard: "Dashboard",
        track_cut: "Houd elke knipbeurt bij.",
        add_appointment: "+ Afspraak toevoegen",
        walk_in_now: "Binnenloop (Nu)",
        revenue_today: "Omzet Vandaag",
        revenue_week: "Deze Week",
        revenue_month: "Deze Maand",
        expected: "Verw:",
        monthly_goal: "Maanddoel",
        busy_hours: "Drukke Uren",
        top_service: "Top Dienst",
        lowest_service: "Minst Winstgevend",
        history: "Geschiedenis",
        walk_in: "Binnenloop",
        add: "+ Nieuw",
        search_placeholder: "Afspraken zoeken...",
        no_appointments: "Nog geen afspraken.",
        no_matching_services: "Geen overeenkomende diensten",
        service_deleted: "Dienst verwijderd.",
        track_first: "Tik op \"+ Nieuw\" voor je eerste knipbeurt.",
        load_more: "Meer laden",
        settings: "Instellingen",
        currency: "Valuta",
        language: "Taal",
        gap: "Min. Afspraak Tussenruimte",
        auto_complete: "Afspraken autom. voltooien",
        auto_complete_desc: "Als een afspraak verloopt zonder update, status instellen op:",
        dark_mode: "Donkere Modus",
        edit_profile: "Profiel bewerken",
        subscription: "Abonnement",
        logout: "Uitloggen",
        close: "Sluiten",
        save: "Opslaan",
        cancel: "Annuleren",
        update: "Bijwerken",
        service: "Dienst",
        price: "Prijs",
        date_time: "Datum & Tijd",
        extras: "Extra's (Optioneel)",
        extras_placeholder: "Klantnaam, notities, etc.",
        new_appointment: "Nieuwe Afspraak",
        edit_appointment: "Afspraak bewerken",
        options: "Opties",
        finish_app: "Afspraak Voltooid",
        user_no_show: "Klant niet komen opdagen",
        canceled: "Geannuleerd",
        delete_app: "Afspraak verwijderen",
        undo_finish: "Voltooien ongedaan maken",
        set_scheduled: "Instellen op Gepland",
        confirm_delete: "Weet je zeker dat je deze afspraak wilt verwijderen?",
        delete: "Verwijderen",
        confirm: "Bevestigen",
        account: "Account",
        profile_guide: "Profiel Gids",
        got_it: "Begrepen",
        login_title: "Trimlyt",
        login_desc: "Prestatie-tracking voor kappers.",
        signup_title: "Aanmelden",
        signup_desc: "Maak je account aan.",
        account_created: "Account succesvol aangemaakt! Log in.",
        walk_in_finished: "Binnenloop (Voltooid)",
        complete: "Voltooien",
        saving: "Opslaan...",
        appointment_updated: "Afspraak bijgewerkt!",
        appointment_created: "Afspraak aangemaakt!",
        no_matching_appointments: "Geen overeenkomende afspraken gevonden.",
        status_canceled: "Geannuleerd",
        status_noshow: "Niet komen opdagen",
        today: "Vandaag",
        tomorrow: "Morgen",
        past: "Verleden",
        passwords_mismatch: "Wachtwoorden komen niet overeen",
        profile_updated: "Profiel succesvol bijgewerkt!",
        dashboard_guide: "Dashboard Gids",
        dashboard_guide_text: "Dit is je commandocentrum.\n\n• Omzet (Groot getal): Beveiligd geld. Telt alleen 'Voltooide' afspraken.\n• Verw (Verwacht): Je potentiële totaal. Telt zowel 'Voltooide' als 'Geplande' afspraken.\n• Doel: Volgt je voortgang naar je maanddoel op basis van werkelijke omzet.\n• Binnenloop: Logt snel een knipbeurt als 'Voltooid' voor nu, zonder planning.",
        appointments_guide: "Afspraken Gids",
        appointments_guide_text: "Beheer je schema en geschiedenis.\n\n• Tussenruimte: Om overboekingen te voorkomen, dwingt het systeem een minimale ruimte tussen afspraken af (Standaard: 1 uur). Wijzig dit in Instellingen.\n• Zoeken: Filter op klantnaam, dienst of extra's.\n• Acties: Tik op een afspraak om te Bewerken, Annuleren of als Voltooid te markeren.\n• Geschiedenis: Scroll naar beneden om eerdere afspraken te laden.",
        settings_guide: "Instellingen Gids",
        settings_guide_text: "Pas de app aan je workflow aan.\n\n• Maanddoel: Het omzetdoel voor de voortgangsbalk op het Dashboard.\n• Afspraak Tussenruimte: De verplichte buffertijd tussen boekingen om conflicten te voorkomen.\n• Auto-Complete: Als je vergeet een afspraak bij te werken, stelt de app deze na 1 uur automatisch in op deze status (bijv. 'Voltooid').",
        profile_guide_text: "Werk je accountgegevens bij.\n\n• Avatar: Tik op het camerapictogram om een eigen profielfoto te uploaden.\n• Beveiliging: Werk hier je wachtwoord bij. Je blijft ingelogd na het wijzigen.",
        subscription_guide: "Abonnement Gids",
        subscription_guide_text: "Beheer je Trimlyt-plan.\n\nBekijk je huidige status en upgrade om premium functies te ontgrendelen.",
        sub_coming_soon: "Abonnementsbeheer komt binnenkort.",
        new_password: "Nieuw Wachtwoord",
        confirm_password: "Bevestig Wachtwoord",
        update_profile: "Profiel Bijwerken",
        finished_default: "Voltooid (Standaard)",
        didnt_show_up: "Niet komen opdagen",
        no_gap: "Geen Tussenruimte",
        hour_default: "1 Uur (Standaard)",
        add_manually: "Handmatig toevoegen",
        integrate_calendar: "Kalender integreren",
        choose_calendar: "Kies Kalender",
        back: "Terug",
        coming_soon: "Binnenkort",
        google_calendar: "Google Agenda",
        apple_calendar: "Apple Agenda",
        no_shows_month: "No Shows (Maand)",
        lost: "Verloren:",
        integrations: "Integraties",
        connect_google: "Google Account Verbinden",
        google_integration_desc: "Verbind om automatische e-mailherinneringen te sturen.",
        not_connected: "Niet Verbonden",
        disconnect: "Ontkoppelen",
        google_connected: "Google Account Verbonden!",
        confirm_disconnect: "Google Account ontkoppelen?",
        disconnected: "Ontkoppeld.",
        export_options: "Exportopties",
        download_pdf: "PDF downloaden",
        download_excel: "Excel downloaden",
        google_import_keyword: "Google Import Trefwoord",
        google_import_keyword_desc: "Evenementen met deze titel worden geïmporteerd. Standaard is 'TL'.",
        complete_appointment_title: "Afspraak Voltooien",
        complete_appointment_desc: "Deze afspraak is geïmporteerd uit Google Agenda maar mist details (Dienst/Prijs). Werk deze bij.",
        complete_data: "Gegevens Voltooien",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Uw zakelijke controlecentrum. Volg omzet, monitor prestaties en beheer snelle acties.</p><h4 style='margin-top:12px;'>Snelle Acties</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Afspraken toevoegen:</strong> Open het menu om handmatig een nieuwe afspraak toe te voegen of te importeren uit uw verbonden agenda.</li><li><strong>Binnenloop (Nu):</strong> Log direct een voltooide dienst voor nu. Slaat de planning over en voegt direct toe aan de omzet.</li></ul><h4 style='margin-top:12px;'>Metriken & Doelen</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Omzet:</strong> Beveiligd geld van 'Voltooide' afspraken.</li><li><strong>Verwacht (Verw):</strong> Totale potentiële omzet (Voltooid + Gepland).</li><li><strong>Doel:</strong> Volgt de voortgang naar uw maandelijkse doel (ingesteld in Instellingen).</li></ul><h4 style='margin-top:12px;'>Analytics</h4><p style='color: var(--text-muted);'><strong>Drukke Uren</strong> toont uw piektijden. <strong>Top Dienst</strong> markeert uw beste verdieners.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & voorwaarden: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacybeleid</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Servicevoorwaarden</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Beheer uw schema en geschiedenis.</p><h4 style='margin-top:12px;'>Afspraken toevoegen</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Toevoegen:</strong> Kies <em>Handmatig toevoegen</em> voor specifieke details of <em>Integreren vanuit Agenda</em> om evenementen uit Google/Apple Agenda op te halen.</li><li><strong>Binnenloop:</strong> Log snel een voltooide klus voor de huidige tijd.</li></ul><h4 style='margin-top:12px;'>Google Agenda Sync</h4><p style='color: var(--text-muted);'>Om evenementen te importeren, geef ze de titel <strong>TL [Dienst] [Prijs]</strong> (bijv. \"TL Knippen 25\") in uw Google Agenda. Trimlyt importeert alleen evenementen met dit formaat.</p><h4 style='margin-top:12px;'>De lijst beheren</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Zoeken:</strong> Filter op klantnaam, dienst of notities.</li><li><strong>Acties:</strong> Tik op een afspraak om te Bewerken, Voltooien, Annuleren of Verwijderen.</li><li><strong>Geschiedenis:</strong> Scroll naar beneden om eerdere afspraken te bekijken.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & voorwaarden: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacybeleid</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Servicevoorwaarden</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Pas Trimlyt aan voor uw bedrijf.</p><h4 style='margin-top:12px;'>Integraties & Diensten</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Google Account:</strong> Verbind om afspraken te synchroniseren. We hebben alleen toegang tot agenda-evenementen en basisprofielinformatie.</li><li><strong>Diensten beheren:</strong> Voeg diensten toe of verwijder ze (bijv. Knippen, Baard trimmen) om het invoeren van afspraken te versnellen.</li></ul><h4 style='margin-top:12px;'>Voorkeuren</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Maanddoel:</strong> Stel uw omzetdoel in voor het Dashboard.</li><li><strong>Afspraak Tussenruimte:</strong> Dwing buffertijd af tussen boekingen om overlapping te voorkomen.</li><li><strong>Auto-Complete:</strong> Markeer eerdere geplande afspraken automatisch als Voltooid, Geannuleerd of Niet komen opdagen.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacy & voorwaarden: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Privacybeleid</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Servicevoorwaarden</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Beheer uw persoonlijke accountgegevens.<br><br>• <strong>Avatar:</strong> Tik op het camerapictogram om een merklogo of profielfoto te uploaden.<br>• <strong>Beveiliging:</strong> Werk uw wachtwoord bij om uw account veilig te houden.<br>• <strong>E-mail:</strong> Uw inlog-e-mail staat vast. Neem contact op met ondersteuning als deze moet worden gewijzigd.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Beheer uw Trimlyt-abonnement.<br><br>• <strong>Huidige status:</strong> Controleer uw actieve plan.<br>• <strong>Upgrade:</strong> Ontgrendel premiumfuncties zoals geavanceerde analyses en onbeperkte geschiedenis (Binnenkort).</p>",
        onboarding_info_title: "💡 Snelle Tip!",
        onboarding_info_text_html: "<p>Zie je dat ⓘ pictogram linksboven?</p><p>Tik er op elk moment op voor een handige gids over de functies van de huidige pagina.</p>",
        onboarding_google_task1_title: "📱 Verbind uw Google Account",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Verbind uw Google Account om deze functies te ontgrendelen:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Synchroniseer Google Agenda</strong> — Trimlyt-afspraken verschijnen ook in uw Google Agenda en u kunt bestaande afspraken importeren naar Trimlyt</li><li><strong>Geen E-mail Toegang</strong> — Trimlyt heeft <u>geen</u> toegang tot uw e-mail en verzendt niet namens u</li><li><strong>Minimale Rechten</strong> — Alleen agenda en basisidentiteit</li><li><strong>Uw Gegevens zijn Veilig</strong> — End-to-end versleuteld, geen gegevensdeling</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Privacy & Voorwaarden:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Privacybeleid</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Servicevoorwaarden</a></p></div>",
        onboarding_google_task2_title: "📅 Hoe Google Agenda Integratie Werkt",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt gebruikt een eenvoudig formaat om te identificeren welke evenementen uit uw Google Agenda moeten worden geïmporteerd.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Evenement Titel Formaat:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Dienst] [Prijs]</code><p style='margin: 0; font-size: 0.9rem;'>Voorbeeld: <strong>\"TL Knippen 25\"</strong> of <strong>\"TL Baard Trimmen 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>Waarom deze aanpak?</strong> Alleen evenementen die u specifiek markeert met het trefwoord \"TL\" worden geïmporteerd. Dit zorgt ervoor dat:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>U volledige controle heeft over wat wordt geïmporteerd</li><li>Persoonlijke evenementen privé blijven</li><li>Geen onbedoelde vervuiling van uw afspraakgeschiedenis</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Beste Praktijk:</strong> We raden aan om afspraken direct in <strong>Trimlyt</strong> te maken voor betere controle en mobiele ervaring. Gebruik Google Agenda import alleen voor <strong>massa-import van bestaande evenementen</strong>.</p></div>",
        connect_google_account: "Verbind Google Account",
        maybe_later: "Misschien later"
    },
    es: {
        app_name: "Trimlyt",
        tagline: "Seguimiento de rendimiento para barberos.",
        email: "Correo electrónico",
        password: "Contraseña",
        login: "Iniciar Sesión",
        signup: "Registrarse",
        create_account: "Crear Cuenta",
        back_login: "Volver a Iniciar Sesión",
        dashboard: "Tablero",
        track_cut: "Rastrea cada corte.",
        add_appointment: "+ Añadir Cita",
        walk_in_now: "Sin Cita (Ahora)",
        revenue_today: "Ingresos Hoy",
        revenue_week: "Esta Semana",
        revenue_month: "Este Mes",
        expected: "Esp:",
        monthly_goal: "Meta Mensual",
        busy_hours: "Horas Punta",
        top_service: "Servicio Top",
        lowest_service: "Menos Rentable",
        history: "Historial",
        walk_in: "Sin Cita",
        add: "+ Añadir",
        search_placeholder: "Buscar citas...",
        no_appointments: "No hay citas registradas.",
        no_matching_services: "No hay servicios coincidentes",
        service_deleted: "Servicio eliminado.",
        track_first: "Toca \"+ Añadir\" para registrar tu primer corte.",
        load_more: "Cargar Más",
        settings: "Ajustes",
        currency: "Moneda",
        language: "Idioma",
        gap: "Espacio Mínimo entre Citas",
        auto_complete: "Auto-Completar Citas",
        auto_complete_desc: "Si pasa la hora de una cita sin actualización, establecer estado a:",
        dark_mode: "Modo Oscuro",
        edit_profile: "Editar Perfil",
        subscription: "Suscripción",
        logout: "Cerrar Sesión",
        close: "Cerrar",
        save: "Guardar",
        cancel: "Cancelar",
        update: "Actualizar",
        service: "Servicio",
        price: "Precio",
        date_time: "Fecha y Hora",
        extras: "Extras (Opcional)",
        extras_placeholder: "Nombre del Cliente, Notas, etc.",
        new_appointment: "Nueva Cita",
        edit_appointment: "Editar Cita",
        options: "Opciones",
        finish_app: "Cita Finalizada",
        user_no_show: "Usuario no se presentó",
        canceled: "Cancelado",
        delete_app: "Eliminar Cita",
        undo_finish: "Deshacer Finalizar",
        set_scheduled: "Establecer como Programado",
        confirm_delete: "¿Estás seguro de que quieres eliminar esta cita?",
        delete: "Eliminar",
        confirm: "Confirmar",
        account: "Cuenta",
        profile_guide: "Guía de Perfil",
        got_it: "Entendido",
        login_title: "Trimlyt",
        login_desc: "Seguimiento de rendimiento para barberos.",
        signup_title: "Registrarse",
        signup_desc: "Crea tu cuenta.",
        account_created: "¡Cuenta creada con éxito! Por favor inicia sesión.",
        walk_in_finished: "Sin Cita (Finalizado)",
        complete: "Completar",
        saving: "Guardando...",
        appointment_updated: "¡Cita actualizada!",
        appointment_created: "¡Cita creada!",
        no_matching_appointments: "No se encontraron citas coincidentes.",
        status_canceled: "Cancelado",
        status_noshow: "No se presentó",
        today: "Hoy",
        tomorrow: "Mañana",
        past: "Pasado",
        passwords_mismatch: "Las contraseñas no coinciden",
        profile_updated: "¡Perfil actualizado con éxito!",
        dashboard_guide: "Guía del Tablero",
        dashboard_guide_text: "Este es tu centro de mando principal.\n\n• Ingresos (Número Grande): Dinero asegurado. Solo cuenta citas 'Finalizadas'.\n• Esp (Esperado): Tu total potencial. Cuenta citas 'Finalizadas' y 'Programadas'.\n• Meta: Rastrea tu progreso hacia tu meta mensual basada en ingresos reales.\n• Sin Cita: Registra rápidamente un corte como 'Finalizado' para ahora, saltando la agenda.",
        appointments_guide: "Guía de Citas",
        appointments_guide_text: "Gestiona tu horario e historial.\n\n• Espacio de Tiempo: Para evitar sobreventas, el sistema impone un espacio mínimo entre citas (Por defecto: 1 hora). Cambia esto en Ajustes.\n• Buscar: Filtra por nombre del cliente, servicio o extras.\n• Acciones: Toca cualquier cita para Editar, Cancelar o marcar como Finalizada.\n• Historial: Desplázate hacia abajo para cargar citas pasadas.",
        settings_guide: "Guía de Ajustes",
        settings_guide_text: "Personaliza la aplicación para que se ajuste a tu flujo de trabajo.\n\n• Meta Mensual: El objetivo de ingresos para la barra de progreso en el Tablero.\n• Espacio entre Citas: El tiempo de búfer obligatorio entre reservas para evitar conflictos.\n• Auto-Completar: Si olvidas actualizar una cita, la aplicación la establecerá automáticamente en este estado (ej. 'Finalizado') después de 1 hora.",
        profile_guide_text: "Actualiza la información de tu cuenta.\n\n• Avatar: Toca el icono de la cámara para subir una foto de perfil personalizada.\n• Seguridad: Actualiza tu contraseña aquí. Permanecerás conectado después de cambiarla.",
        subscription_guide: "Guía de Suscripción",
        subscription_guide_text: "Gestiona tu plan Trimlyt.\n\nVer tu estado actual y actualiza para desbloquear funciones premium.",
        sub_coming_soon: "Gestión de suscripciones próximamente.",
        new_password: "Nueva Contraseña",
        confirm_password: "Confirmar Contraseña",
        update_profile: "Actualizar Perfil",
        finished_default: "Finalizado (Por defecto)",
        didnt_show_up: "No se presentó",
        no_gap: "Sin Espacio",
        hour_default: "1 Hora (Por defecto)",
        add_manually: "Añadir Manualmente",
        integrate_calendar: "Integrar Calendario",
        choose_calendar: "Elegir Calendario",
        back: "Volver",
        coming_soon: "Próximamente",
        google_calendar: "Google Calendar",
        apple_calendar: "Apple Calendar",
        no_shows_month: "No presentados (Mes)",
        lost: "Perdido:",
        integrations: "Integraciones",
        connect_google: "Conectar cuenta de Google",
        google_integration_desc: "Conecta para enviar recordatorios automáticos por correo.",
        not_connected: "No conectado",
        disconnect: "Desconectar",
        google_connected: "¡Cuenta de Google conectada!",
        confirm_disconnect: "¿Desconectar cuenta de Google?",
        disconnected: "Desconectado.",
        export_options: "Opciones de Exportación",
        download_pdf: "Descargar PDF",
        download_excel: "Descargar Excel",
        google_import_keyword: "Palabra Clave de Importación Google",
        google_import_keyword_desc: "Se importarán los eventos con este título. El valor predeterminado es 'TL'.",
        complete_appointment_title: "Completar Cita",
        complete_appointment_desc: "Esta cita fue importada de Google Calendar pero le faltan detalles (Servicio/Precio). Por favor actualícela.",
        complete_data: "Completar Datos",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Tu centro de control empresarial. Rastrea ingresos, monitorea el rendimiento y gestiona acciones rápidas.</p><h4 style='margin-top:12px;'>Acciones Rápidas</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Añadir Citas:</strong> Abre el menú para añadir una nueva cita manualmente o importar desde tu calendario conectado.</li><li><strong>Sin Cita (Ahora):</strong> Registra instantáneamente un servicio completado para ahora. Omite el horario y añade directamente a los ingresos.</li></ul><h4 style='margin-top:12px;'>Métricas y Metas</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Ingresos:</strong> Efectivo asegurado de citas 'Finalizadas'.</li><li><strong>Esperado (Esp):</strong> Ingreso potencial total (Finalizado + Programado).</li><li><strong>Meta:</strong> Rastrea el progreso hacia tu meta mensual (establecida en Ajustes).</li></ul><h4 style='margin-top:12px;'>Analítica</h4><p style='color: var(--text-muted);'><strong>Horas Punta</strong> muestra tus horas pico. <strong>Servicio Top</strong> destaca tus mejores ingresos.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidad y términos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidad</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Términos de Servicio</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Gestiona tu horario e historial.</p><h4 style='margin-top:12px;'>Añadir Citas</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Añadir:</strong> Elige <em>Añadir Manualmente</em> para detalles específicos o <em>Integrar desde Calendario</em> para extraer eventos de Google/Apple Calendar.</li><li><strong>Sin Cita:</strong> Registra rápidamente un trabajo terminado para la hora actual.</li></ul><h4 style='margin-top:12px;'>Sincronización de Google Calendar</h4><p style='color: var(--text-muted);'>Para importar eventos, titúlalos <strong>TL [Servicio] [Precio]</strong> (ej., \"TL Corte 25\") en tu Google Calendar. Trimlyt solo importa eventos con este formato.</p><h4 style='margin-top:12px;'>Gestionar la Lista</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Buscar:</strong> Filtra por nombre del cliente, servicio o notas.</li><li><strong>Acciones:</strong> Toca cualquier cita para Editar, Finalizar, Cancelar o Eliminar.</li><li><strong>Historial:</strong> Desplázate hacia abajo para ver citas pasadas.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidad y términos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidad</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Términos de Servicio</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Personaliza Trimlyt para tu negocio.</p><h4 style='margin-top:12px;'>Integraciones y Servicios</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Cuenta de Google:</strong> Conecta para sincronizar citas. Solo accedemos a eventos del calendario e información básica del perfil.</li><li><strong>Gestionar Servicios:</strong> Añade o elimina servicios (ej., Corte, Arreglo de Barba) para acelerar la entrada de citas.</li></ul><h4 style='margin-top:12px;'>Preferencias</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Meta Mensual:</strong> Establece tu objetivo de ingresos para el Tablero.</li><li><strong>Espacio entre Citas:</strong> Impón tiempo de búfer entre reservas para evitar superposiciones.</li><li><strong>Auto-Completar:</strong> Marca automáticamente citas pasadas programadas como Finalizadas, Canceladas o No presentadas.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidad y términos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidad</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Términos de Servicio</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gestiona los detalles de tu cuenta personal.<br><br>• <strong>Avatar:</strong> Toca el icono de la cámara para subir un logo de marca o foto de perfil.<br>• <strong>Seguridad:</strong> Actualiza tu contraseña para mantener tu cuenta segura.<br>• <strong>Email:</strong> Tu correo de inicio de sesión es fijo. Contacta a soporte si necesitas cambiarlo.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gestiona tu plan Trimlyt.<br><br>• <strong>Estado Actual:</strong> Verifica tu plan activo.<br>• <strong>Mejorar:</strong> Desbloquea funciones premium como análisis avanzados e historial ilimitado (Próximamente).</p>",
        onboarding_info_title: "💡 ¡Consejo Rápido!",
        onboarding_info_text_html: "<p>¿Ves ese icono ⓘ en la esquina superior izquierda?</p><p>Tócalo en cualquier momento para una guía útil sobre las funciones de la página actual.</p>",
        onboarding_google_task1_title: "📱 Conecta tu Cuenta de Google",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Conecta tu Cuenta de Google para desbloquear estas funciones:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Sincronizar Google Calendar</strong> — Las citas de Trimlyt también aparecerán en tu Google Calendar y puedes importar citas existentes a Trimlyt</li><li><strong>Cero Acceso al Email</strong> — Trimlyt <u>no</u> accede a tu correo ni envía en tu nombre</li><li><strong>Permisos Mínimos</strong> — Solo calendario e identidad básica</li><li><strong>Tus Datos están Seguros</strong> — Encriptado de extremo a extremo, sin compartir datos</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Privacidad y Términos:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Política de Privacidad</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Términos de Servicio</a></p></div>",
        onboarding_google_task2_title: "📅 Cómo Funciona la Integración de Google Calendar",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt usa un formato simple para identificar qué eventos importar de tu Google Calendar.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Formato del Título del Evento:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Servicio] [Precio]</code><p style='margin: 0; font-size: 0.9rem;'>Ejemplo: <strong>\"TL Corte 25\"</strong> o <strong>\"TL Arreglo Barba 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>¿Por qué este enfoque?</strong> Solo se importan los eventos que marcas específicamente con la palabra clave \"TL\". Esto asegura:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>Tienes control total sobre lo que se importa</li><li>Los eventos personales permanecen privados</li><li>Sin contaminación accidental de tu historial de citas</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Mejor Práctica:</strong> Recomendamos crear citas directamente en <strong>Trimlyt</strong> para un mejor control y experiencia móvil. Usa la importación de Google Calendar solo para <strong>importación masiva de eventos existentes</strong>.</p></div>",
        connect_google_account: "Conectar Cuenta de Google",
        maybe_later: "Quizás más tarde"
    },
    fr: {
        app_name: "Trimlyt",
        tagline: "Suivi des performances pour barbiers.",
        email: "E-mail",
        password: "Mot de passe",
        login: "Connexion",
        signup: "S'inscrire",
        create_account: "Créer un compte",
        back_login: "Retour à la connexion",
        dashboard: "Tableau de bord",
        track_cut: "Suivez chaque coupe.",
        add_appointment: "+ Ajouter Rendez-vous",
        walk_in_now: "Sans rendez-vous (Maintenant)",
        revenue_today: "Revenu Aujourd'hui",
        revenue_week: "Cette Semaine",
        revenue_month: "Ce Mois",
        expected: "Prév:",
        monthly_goal: "Objectif Mensuel",
        busy_hours: "Heures de Pointe",
        top_service: "Meilleur Service",
        lowest_service: "Moins Rentable",
        history: "Historique",
        walk_in: "Sans RDV",
        add: "+ Ajouter",
        search_placeholder: "Rechercher rendez-vous...",
        no_appointments: "Aucun rendez-vous enregistré.",
        no_matching_services: "Aucun service correspondant",
        service_deleted: "Service supprimé.",
        track_first: "Appuyez sur \"+ Ajouter\" pour suivre votre première coupe.",
        load_more: "Charger Plus",
        settings: "Paramètres",
        currency: "Devise",
        language: "Langue",
        gap: "Écart Min. entre RDV",
        auto_complete: "Auto-compléter Rendez-vous",
        auto_complete_desc: "Si l'heure d'un RDV passe sans mise à jour, définir le statut sur :",
        dark_mode: "Mode Sombre",
        edit_profile: "Modifier Profil",
        subscription: "Abonnement",
        logout: "Déconnexion",
        close: "Fermer",
        save: "Enregistrer",
        cancel: "Annuler",
        update: "Mettre à jour",
        service: "Service",
        price: "Prix",
        date_time: "Date & Heure",
        extras: "Extras (Optionnel)",
        extras_placeholder: "Nom du client, notes, etc.",
        new_appointment: "Nouveau Rendez-vous",
        edit_appointment: "Modifier Rendez-vous",
        options: "Options",
        finish_app: "Rendez-vous Terminé",
        user_no_show: "Client non présenté",
        canceled: "Annulé",
        delete_app: "Supprimer Rendez-vous",
        undo_finish: "Annuler Terminé",
        set_scheduled: "Définir comme Prévu",
        confirm_delete: "Êtes-vous sûr de vouloir supprimer ce rendez-vous ?",
        delete: "Supprimer",
        confirm: "Confirmer",
        account: "Compte",
        profile_guide: "Guide Profil",
        got_it: "Compris",
        login_title: "Trimlyt",
        login_desc: "Suivi des performances pour barbiers.",
        signup_title: "S'inscrire",
        signup_desc: "Créez votre compte.",
        account_created: "Compte créé avec succès ! Veuillez vous connecter.",
        walk_in_finished: "Sans RDV (Terminé)",
        complete: "Terminer",
        saving: "Enregistrement...",
        appointment_updated: "Rendez-vous mis à jour !",
        appointment_created: "Rendez-vous créé !",
        no_matching_appointments: "Aucun rendez-vous correspondant trouvé.",
        status_canceled: "Annulé",
        status_noshow: "Non présenté",
        today: "Aujourd'hui",
        tomorrow: "Demain",
        past: "Passé",
        passwords_mismatch: "Les mots de passe ne correspondent pas",
        profile_updated: "Profil mis à jour avec succès !",
        dashboard_guide: "Guide Tableau de bord",
        dashboard_guide_text: "Ceci est votre centre de commande principal.\n\n• Revenu (Grand Nombre) : Argent sécurisé. Compte uniquement les RDV 'Terminés'.\n• Prév (Prévu) : Votre total potentiel. Compte les RDV 'Terminés' et 'Prévus'.\n• Objectif : Suit votre progression vers votre objectif mensuel basé sur le revenu réel.\n• Sans RDV : Enregistre rapidement une coupe comme 'Terminée' pour maintenant, sans planning.",
        appointments_guide: "Guide Rendez-vous",
        appointments_guide_text: "Gérez votre emploi du temps et votre historique.\n\n• Écart de Temps : Pour éviter les surréservations, le système impose un écart minimum entre les RDV (Défaut : 1 heure). Modifiez cela dans les Paramètres.\n• Recherche : Filtrez par nom de client, service ou extras.\n• Actions : Appuyez sur un RDV pour Modifier, Annuler ou marquer comme Terminé.\n• Historique : Faites défiler vers le bas pour charger les RDV passés.",
        settings_guide: "Guide Paramètres",
        settings_guide_text: "Personnalisez l'application selon votre flux de travail.\n\n• Objectif Mensuel : L'objectif de revenu pour la barre de progression sur le Tableau de bord.\n• Écart RDV : Le temps tampon obligatoire entre les réservations pour éviter les conflits.\n• Auto-complétion : Si vous oubliez de mettre à jour un RDV, l'application le définira automatiquement sur ce statut (ex. 'Terminé') après 1 heure.",
        profile_guide_text: "Mettez à jour vos informations de compte.\n\n• Avatar : Appuyez sur l'icône de caméra pour télécharger une photo de profil personnalisée.\n• Sécurité : Mettez à jour votre mot de passe ici. Vous resterez connecté après le changement.",
        subscription_guide: "Guide Abonnement",
        subscription_guide_text: "Gérez votre plan Trimlyt.\n\nConsultez votre statut actuel et mettez à niveau pour débloquer des fonctionnalités premium.",
        sub_coming_soon: "Gestion de l'abonnement bientôt disponible.",
        new_password: "Nouveau mot de passe",
        confirm_password: "Confirmer mot de passe",
        update_profile: "Mettre à jour Profil",
        finished_default: "Terminé (Défaut)",
        didnt_show_up: "Non présenté",
        no_gap: "Pas d'écart",
        hour_default: "1 Heure (Défaut)",
        add_manually: "Ajouter Manuellement",
        integrate_calendar: "Intégrer Calendrier",
        choose_calendar: "Choisir Calendrier",
        back: "Retour",
        coming_soon: "Bientôt",
        google_calendar: "Google Agenda",
        apple_calendar: "Apple Calendrier",
        no_shows_month: "Non présentés (Mois)",
        lost: "Perte :",
        integrations: "Intégrations",
        connect_google: "Connecter compte Google",
        google_integration_desc: "Connectez-vous pour envoyer des rappels automatiques.",
        not_connected: "Non connecté",
        disconnect: "Déconnecter",
        google_connected: "Compte Google connecté !",
        confirm_disconnect: "Déconnecter le compte Google ?",
        disconnected: "Déconnecté.",
        export_options: "Options d'exportation",
        download_pdf: "Télécharger PDF",
        download_excel: "Télécharger Excel",
        google_import_keyword: "Mot-clé d'importation Google",
        google_import_keyword_desc: "Les événements avec ce titre seront importés. La valeur par défaut est 'TL'.",
        complete_appointment_title: "Compléter le rendez-vous",
        complete_appointment_desc: "Ce rendez-vous a été importé de Google Agenda mais manque de détails (Service/Prix). Veuillez le mettre à jour.",
        complete_data: "Compléter les données",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Votre centre de contrôle d'entreprise. Suivez les revenus, surveillez les performances et gérez les actions rapides.</p><h4 style='margin-top:12px;'>Actions Rapides</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Ajouter Rendez-vous :</strong> Ouvrez le menu pour ajouter un nouveau rendez-vous manuellement ou importer depuis votre calendrier connecté.</li><li><strong>Sans rendez-vous (Maintenant) :</strong> Enregistrez instantanément un service terminé pour maintenant. Ignore le planning et ajoute directement aux revenus.</li></ul><h4 style='margin-top:12px;'>Métriques & Objectifs</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Revenu :</strong> Argent sécurisé des rendez-vous 'Terminés'.</li><li><strong>Prévu (Prév) :</strong> Revenu potentiel total (Terminé + Prévu).</li><li><strong>Objectif :</strong> Suit votre progression vers votre objectif mensuel (défini dans les Paramètres).</li></ul><h4 style='margin-top:12px;'>Analytique</h4><p style='color: var(--text-muted);'><strong>Heures de Pointe</strong> montre vos périodes d'affluence. <strong>Meilleur Service</strong> met en évidence vos meilleures sources de revenus.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Confidentialité & conditions : <a href='privacyPolicy.html' style='color: var(--primary-color);'>Politique de Confidentialité</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Conditions d'Utilisation</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Gérez votre emploi du temps et votre historique.</p><h4 style='margin-top:12px;'>Ajouter des Rendez-vous</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Ajouter :</strong> Choisissez <em>Ajouter Manuellement</em> pour des détails spécifiques ou <em>Intégrer depuis Calendrier</em> pour récupérer des événements de Google/Apple Calendar.</li><li><strong>Sans rendez-vous :</strong> Enregistrez rapidement un travail terminé pour l'heure actuelle.</li></ul><h4 style='margin-top:12px;'>Synchro Google Agenda</h4><p style='color: var(--text-muted);'>Pour importer des événements, intitulez-les <strong>TL [Service] [Prix]</strong> (ex., \"TL Coupe 25\") dans votre Google Agenda. Trimlyt importe uniquement les événements avec ce format.</p><h4 style='margin-top:12px;'>Gérer la Liste</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Recherche :</strong> Filtrez par nom de client, service ou notes.</li><li><strong>Actions :</strong> Appuyez sur n'importe quel rendez-vous pour Modifier, Terminer, Annuler ou Supprimer.</li><li><strong>Historique :</strong> Faites défiler vers le bas pour voir les rendez-vous passés.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Confidentialité & conditions : <a href='privacyPolicy.html' style='color: var(--primary-color);'>Politique de Confidentialité</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Conditions d'Utilisation</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Personnalisez Trimlyt pour votre entreprise.</p><h4 style='margin-top:12px;'>Intégrations & Services</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Compte Google :</strong> Connectez-vous pour synchroniser les rendez-vous. Nous accédons uniquement aux événements du calendrier et aux informations de profil de base.</li><li><strong>Gérer les Services :</strong> Ajoutez ou supprimez des services (ex., Coupe, Taille de Barbe) pour accélérer la saisie des rendez-vous.</li></ul><h4 style='margin-top:12px;'>Préférences</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Objectif Mensuel :</strong> Définissez votre objectif de revenu pour le Tableau de bord.</li><li><strong>Écart RDV :</strong> Imposez un temps tampon entre les réservations pour éviter les chevauchements.</li><li><strong>Auto-complétion :</strong> Marquez automatiquement les rendez-vous prévus passés comme Terminés, Annulés ou Non présentés.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Confidentialité & conditions : <a href='privacyPolicy.html' style='color: var(--primary-color);'>Politique de Confidentialité</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Conditions d'Utilisation</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gérez vos informations de compte personnelles.<br><br>• <strong>Avatar :</strong> Appuyez sur l'icône de caméra pour télécharger un logo de marque ou une photo de profil.<br>• <strong>Sécurité :</strong> Mettez à jour votre mot de passe pour sécuriser votre compte.<br>• <strong>E-mail :</strong> Votre e-mail de connexion est fixe. Contactez le support s'il doit être modifié.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gérez votre plan Trimlyt.<br><br>• <strong>Statut Actuel :</strong> Vérifiez votre plan actif.<br>• <strong>Mise à niveau :</strong> Débloquez des fonctionnalités premium comme des analyses avancées et un historique illimité (Bientôt).</p>",
        onboarding_info_title: "💡 Astuce Rapide !",
        onboarding_info_text_html: "<p>Voyez-vous cette icône ⓘ en haut à gauche ?</p><p>Appuyez dessus à tout moment pour un guide utile sur les fonctionnalités de la page actuelle.</p>",
        onboarding_google_task1_title: "📱 Connectez Votre Compte Google",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Connectez votre compte Google pour débloquer ces fonctionnalités :</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Synchroniser Google Agenda</strong> — Les rendez-vous Trimlyt apparaîtront également dans votre Google Agenda et vous pourrez importer des rendez-vous existants vers Trimlyt</li><li><strong>Zéro Accès E-mail</strong> — Trimlyt n'accède <u>pas</u> à vos e-mails et n'envoie pas en votre nom</li><li><strong>Permissions Minimales</strong> — Uniquement calendrier et identité de base</li><li><strong>Vos Données sont Sécurisées</strong> — Chiffrées de bout en bout, pas de partage de données</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Confidentialité & Conditions :</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Politique de Confidentialité</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Conditions d'Utilisation</a></p></div>",
        onboarding_google_task2_title: "📅 Comment Fonctionne l'Intégration Google Agenda",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt utilise un format simple pour identifier quels événements importer depuis votre Google Agenda.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Format du Titre de l'Événement :</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Service] [Prix]</code><p style='margin: 0; font-size: 0.9rem;'>Exemple : <strong>\"TL Coupe 25\"</strong> ou <strong>\"TL Taille Barbe 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>Pourquoi cette approche ?</strong> Seuls les événements que vous marquez spécifiquement avec le mot-clé \"TL\" sont importés. Cela garantit :</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>Vous avez un contrôle total sur ce qui est importé</li><li>Les événements personnels restent privés</li><li>Pas de pollution accidentelle de votre historique de rendez-vous</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Meilleure Pratique :</strong> Nous recommandons de créer des rendez-vous directement dans <strong>Trimlyt</strong> pour un meilleur contrôle et une meilleure expérience mobile. Utilisez l'importation Google Agenda uniquement pour <strong>l'importation en masse d'événements existants</strong>.</p></div>",
        connect_google_account: "Connecter Compte Google",
        maybe_later: "Peut-être plus tard"
    },
    fa: {
        app_name: "تریم‌لیت",
        tagline: "پیگیری عملکرد برای آرایشگران.",
        email: "ایمیل",
        password: "رمز عبور",
        login: "ورود",
        signup: "ثبت نام",
        create_account: "ایجاد حساب",
        back_login: "بازگشت به ورود",
        dashboard: "داشبورد",
        track_cut: "پیگیری هر اصلاح.",
        add_appointment: "+ افزودن نوبت",
        walk_in_now: "حضوری (الان)",
        revenue_today: "درآمد امروز",
        revenue_week: "این هفته",
        revenue_month: "این ماه",
        expected: "مورد انتظار:",
        monthly_goal: "هدف ماهانه",
        busy_hours: "ساعات شلوغی",
        top_service: "بهترین سرویس",
        lowest_service: "کم‌سودترین",
        history: "تاریخچه",
        walk_in: "حضوری",
        add: "+ جدید",
        search_placeholder: "جستجوی نوبت‌ها...",
        no_appointments: "هنوز نوبتی ثبت نشده است.",
        no_matching_services: "سرویس منطبقی یافت نشد",
        service_deleted: "سرویس حذف شد.",
        track_first: "برای ثبت اولین اصلاح روی \"+ جدید\" بزنید.",
        load_more: "بارگذاری بیشتر",
        settings: "تنظیمات",
        currency: "واحد پول",
        language: "زبان",
        gap: "حداقل فاصله نوبت‌ها",
        auto_complete: "تکمیل خودکار نوبت‌ها",
        auto_complete_desc: "اگر زمان نوبت بگذرد و به‌روزرسانی نشود، وضعیت به این تغییر کند:",
        dark_mode: "حالت تاریک",
        edit_profile: "ویرایش پروفایل",
        subscription: "اشتراک",
        logout: "خروج",
        close: "بستن",
        save: "ذخیره",
        cancel: "لغو",
        update: "به‌روزرسانی",
        service: "خدمات",
        price: "قیمت",
        date_time: "تاریخ و زمان",
        extras: "توضیحات (اختیاری)",
        extras_placeholder: "نام مشتری، یادداشت‌ها و غیره",
        new_appointment: "نوبت جدید",
        edit_appointment: "ویرایش نوبت",
        options: "گزینه‌ها",
        finish_app: "نوبت انجام شد",
        user_no_show: "مشتری نیامد",
        canceled: "لغو شد",
        delete_app: "حذف نوبت",
        undo_finish: "لغو اتمام",
        set_scheduled: "تنظیم به برنامه‌ریزی شده",
        confirm_delete: "آیا مطمئن هستید که می‌خواهید این نوبت را حذف کنید؟",
        delete: "حذف",
        confirm: "تایید",
        account: "حساب کاربری",
        profile_guide: "راهنمای پروفایل",
        got_it: "متوجه شدم",
        login_title: "تریم‌لیت",
        login_desc: "پیگیری عملکرد برای آرایشگران.",
        signup_title: "ثبت نام",
        signup_desc: "حساب خود را بسازید.",
        account_created: "حساب با موفقیت ساخته شد! لطفا وارد شوید.",
        walk_in_finished: "حضوری (انجام شد)",
        complete: "تکمیل",
        saving: "در حال ذخیره...",
        appointment_updated: "نوبت به‌روز شد!",
        appointment_created: "نوبت ایجاد شد!",
        no_matching_appointments: "نوبتی پیدا نشد.",
        status_canceled: "لغو شده",
        status_noshow: "نیامد",
        today: "امروز",
        tomorrow: "فردا",
        past: "گذشته",
        passwords_mismatch: "رمزهای عبور مطابقت ندارند",
        profile_updated: "پروفایل با موفقیت به‌روز شد!",
        dashboard_guide: "راهنمای داشبورد",
        dashboard_guide_text: "این مرکز فرماندهی اصلی شماست.\n\n• درآمد (عدد بزرگ): پول قطعی. فقط نوبت‌های 'انجام شده' را می‌شمارد.\n• مورد انتظار: کل پتانسیل شما. هم نوبت‌های 'انجام شده' و هم 'برنامه‌ریزی شده' را می‌شمارد.\n• هدف: پیشرفت شما به سمت هدف ماهانه را بر اساس درآمد واقعی نشان می‌دهد.\n• حضوری: به سرعت یک اصلاح را به عنوان 'انجام شده' برای همین لحظه ثبت می‌کند، بدون برنامه‌ریزی.",
        appointments_guide: "راهنمای نوبت‌ها",
        appointments_guide_text: "برنامه و تاریخچه خود را مدیریت کنید.\n\n• فاصله زمانی: برای جلوگیری از تداخل، سیستم یک فاصله حداقل بین نوبت‌ها اعمال می‌کند (پیش‌فرض: ۱ ساعت). این را در تنظیمات تغییر دهید.\n• جستجو: فیلتر بر اساس نام مشتری، خدمات یا توضیحات.\n• اقدامات: روی هر نوبت بزنید تا ویرایش، لغو یا به عنوان انجام شده علامت‌گذاری کنید.\n• تاریخچه: برای بارگذاری نوبت‌های گذشته به پایین اسکرول کنید.",
        settings_guide: "راهنمای تنظیمات",
        settings_guide_text: "برنامه را متناسب با جریان کاری خود شخصی‌سازی کنید.\n\n• هدف ماهانه: هدف درآمد برای نوار پیشرفت در داشبورد.\n• فاصله نوبت: زمان بافر اجباری بین رزروها برای جلوگیری از تداخل.\n• تکمیل خودکار: اگر فراموش کنید نوبتی را به‌روز کنید، برنامه پس از ۱ ساعت آن را به طور خودکار به این وضعیت (مثلاً 'انجام شده') تغییر می‌دهد.",
        profile_guide_text: "اطلاعات حساب خود را به‌روز کنید.\n\n• آواتار: روی آیکون دوربین بزنید تا عکس پروفایل دلخواه آپلود کنید.\n• امنیت: رمز عبور خود را اینجا به‌روز کنید. پس از تغییر همچنان وارد خواهید ماند.",
        subscription_guide: "راهنمای اشتراک",
        subscription_guide_text: "طرح تریم‌لیت خود را مدیریت کنید.\n\nوضعیت فعلی خود را ببینید و برای باز کردن ویژگی‌های پریمیوم ارتقا دهید.",
        sub_coming_soon: "مدیریت اشتراک به زودی.",
        new_password: "رمز عبور جدید",
        confirm_password: "تایید رمز عبور",
        update_profile: "به‌روزرسانی پروفایل",
        finished_default: "انجام شده (پیش‌فرض)",
        didnt_show_up: "نیامد",
        no_gap: "بدون فاصله",
        hour_default: "۱ ساعت (پیش‌فرض)",
        add_manually: "افزودن دستی",
        integrate_calendar: "ادغام تقویم",
        choose_calendar: "انتخاب تقویم",
        back: "بازگشت",
        coming_soon: "به زودی",
        google_calendar: "تقویم گوگل",
        apple_calendar: "تقویم اپل",
        no_shows_month: "عدم حضور (ماه)",
        lost: "ضرر:",
        integrations: "اتصالات",
        connect_google: "اتصال حساب گوگل",
        google_integration_desc: "برای ارسال یادآوری‌های خودکار ایمیلی متصل شوید.",
        not_connected: "متصل نیست",
        disconnect: "قطع ارتباط",
        google_connected: "حساب گوگل متصل شد!",
        confirm_disconnect: "قطع ارتباط حساب گوگل؟",
        disconnected: "قطع شد.",
        export_options: "گزینه‌های خروجی",
        download_pdf: "دانلود PDF",
        download_excel: "دانلود اکسل",
        google_import_keyword: "کلمه کلیدی وارد کردن گوگل",
        google_import_keyword_desc: "رویدادهایی با این عنوان وارد خواهند شد. پیش‌فرض 'TL' است.",
        complete_appointment_title: "تکمیل نوبت",
        complete_appointment_desc: "این نوبت از تقویم گوگل وارد شده اما جزئیات (سرویس/قیمت) ندارد. لطفا آن را به‌روز کنید.",
        complete_data: "تکمیل داده‌ها",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>مرکز کنترل کسب و کار شما. پیگیری درآمد، نظارت بر عملکرد و مدیریت اقدامات سریع.</p><h4 style='margin-top:12px;'>اقدامات سریع</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ افزودن نوبت:</strong> منو را باز کنید تا نوبت جدیدی را به صورت دستی اضافه کنید یا از تقویم متصل خود وارد کنید.</li><li><strong>حضوری (الان):</strong> فوراً یک سرویس تکمیل شده را برای همین لحظه ثبت کنید. برنامه را نادیده می‌گیرد و مستقیماً به درآمد اضافه می‌کند.</li></ul><h4 style='margin-top:12px;'>معیارها و اهداف</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>درآمد:</strong> پول نقد تضمین شده از نوبت‌های 'انجام شده'.</li><li><strong>مورد انتظار (Exp):</strong> کل درآمد بالقوه (انجام شده + برنامه‌ریزی شده).</li><li><strong>هدف:</strong> پیشرفت شما را به سمت هدف ماهانه (تنظیم شده در تنظیمات) پیگیری می‌کند.</li></ul><h4 style='margin-top:12px;'>تحلیل‌ها</h4><p style='color: var(--text-muted);'><strong>ساعات شلوغی</strong> زمان‌های اوج شما را نشان می‌دهد. <strong>بهترین سرویس</strong> پردرآمدترین خدمات شما را برجسته می‌کند.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>حریم خصوصی و شرایط: <a href='privacyPolicy.html' style='color: var(--primary-color);'>سیاست حفظ حریم خصوصی</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>شرایط خدمات</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>برنامه و تاریخچه خود را مدیریت کنید.</p><h4 style='margin-top:12px;'>افزودن نوبت</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ افزودن:</strong> <em>افزودن دستی</em> را برای جزئیات خاص یا <em>ادغام از تقویم</em> را برای دریافت رویدادها از تقویم گوگل/اپل انتخاب کنید.</li><li><strong>حضوری:</strong> به سرعت یک کار تمام شده را برای زمان فعلی ثبت کنید.</li></ul><h4 style='margin-top:12px;'>همگام‌سازی تقویم گوگل</h4><p style='color: var(--text-muted);'>برای وارد کردن رویدادها، آنها را با عنوان <strong>TL [سرویس] [قیمت]</strong> (مثلاً \"TL Haircut 25\") در تقویم گوگل خود نامگذاری کنید. تریم‌لیت فقط رویدادهایی با این فرمت را وارد می‌کند.</p><h4 style='margin-top:12px;'>مدیریت لیست</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>جستجو:</strong> فیلتر بر اساس نام مشتری، سرویس یا یادداشت‌ها.</li><li><strong>اقدامات:</strong> روی هر نوبت بزنید تا ویرایش، اتمام، لغو یا حذف کنید.</li><li><strong>تاریخچه:</strong> برای مشاهده نوبت‌های گذشته به پایین اسکرول کنید.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>حریم خصوصی و شرایط: <a href='privacyPolicy.html' style='color: var(--primary-color);'>سیاست حفظ حریم خصوصی</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>شرایط خدمات</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>تریم‌لیت را برای کسب و کار خود شخصی‌سازی کنید.</p><h4 style='margin-top:12px;'>ادغام‌ها و خدمات</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>حساب گوگل:</strong> برای همگام‌سازی نوبت‌ها متصل شوید. ما فقط به رویدادهای تقویم و اطلاعات اولیه پروفایل دسترسی داریم.</li><li><strong>مدیریت خدمات:</strong> خدمات را اضافه یا حذف کنید (مثلاً اصلاح مو، اصلاح ریش) تا ورود نوبت را سرعت بخشید.</li></ul><h4 style='margin-top:12px;'>ترجیحات</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>هدف ماهانه:</strong> هدف درآمد خود را برای داشبورد تنظیم کنید.</li><li><strong>فاصله نوبت:</strong> زمان بافر اجباری بین رزروها را برای جلوگیری از تداخل اعمال کنید.</li><li><strong>تکمیل خودکار:</strong> نوبت‌های برنامه‌ریزی شده گذشته را به طور خودکار به عنوان انجام شده، لغو شده یا عدم حضور علامت‌گذاری کنید.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>حریم خصوصی و شرایط: <a href='privacyPolicy.html' style='color: var(--primary-color);'>سیاست حفظ حریم خصوصی</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>شرایط خدمات</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>جزئیات حساب شخصی خود را مدیریت کنید.<br><br>• <strong>آواتار:</strong> روی آیکون دوربین بزنید تا لوگوی برند یا عکس پروفایل آپلود کنید.<br>• <strong>امنیت:</strong> رمز عبور خود را برای حفظ امنیت حساب خود به‌روز کنید.<br>• <strong>ایمیل:</strong> ایمیل ورود شما ثابت است. اگر نیاز به تغییر دارد با پشتیبانی تماس بگیرید.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>طرح تریم‌لیت خود را مدیریت کنید.<br><br>• <strong>وضعیت فعلی:</strong> طرح فعال خود را بررسی کنید.<br>• <strong>ارتقا:</strong> ویژگی‌های پریمیوم مانند تحلیل‌های پیشرفته و تاریخچه نامحدود را باز کنید (به زودی).</p>",
        onboarding_info_title: "💡 نکته سریع!",
        onboarding_info_text_html: "<p>آن آیکون ⓘ را در گوشه بالا سمت چپ می‌بینید؟</p><p>هر زمان برای راهنمایی مفید در مورد ویژگی‌های صفحه فعلی روی آن بزنید.</p>",
        onboarding_google_task1_title: "📱 اتصال حساب گوگل",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>حساب گوگل خود را متصل کنید تا این ویژگی‌ها باز شوند:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>همگام‌سازی تقویم گوگل</strong> — نوبت‌های تریم‌لیت در تقویم گوگل شما نیز ظاهر می‌شوند و می‌توانید نوبت‌های موجود را به تریم‌لیت وارد کنید</li><li><strong>بدون دسترسی به ایمیل</strong> — تریم‌لیت به ایمیل شما دسترسی <u>ندارد</u> و از طرف شما ارسال نمی‌کند</li><li><strong>مجوزهای حداقل</strong> — فقط تقویم و هویت اولیه</li><li><strong>داده‌های شما امن است</strong> — رمزگذاری سرتاسر، بدون اشتراک‌گذاری داده</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>حریم خصوصی و شرایط:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>سیاست حفظ حریم خصوصی</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>شرایط خدمات</a></p></div>",
        onboarding_google_task2_title: "📅 نحوه کار ادغام تقویم گوگل",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>تریم‌لیت از یک فرمت ساده برای شناسایی رویدادهایی که باید از تقویم گوگل شما وارد شوند استفاده می‌کند.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>فرمت عنوان رویداد:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [سرویس] [قیمت]</code><p style='margin: 0; font-size: 0.9rem;'>مثال: <strong>\"TL Haircut 25\"</strong> یا <strong>\"TL Beard Trim 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>چرا این روش؟</strong> فقط رویدادهایی که شما به طور خاص با کلمه کلیدی \"TL\" علامت‌گذاری می‌کنید وارد می‌شوند. این اطمینان می‌دهد:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>شما کنترل کامل بر آنچه وارد می‌شود دارید</li><li>رویدادهای شخصی خصوصی می‌مانند</li><li>بدون آلودگی تصادفی تاریخچه نوبت‌های شما</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 بهترین روش:</strong> توصیه می‌کنیم نوبت‌ها را مستقیماً در <strong>تریم‌لیت</strong> ایجاد کنید تا کنترل و تجربه موبایل بهتری داشته باشید. از وارد کردن تقویم گوگل فقط برای <strong>وارد کردن انبوه رویدادهای موجود</strong> استفاده کنید.</p></div>",
        connect_google_account: "اتصال حساب گوگل",
        maybe_later: "شاید بعداً"
    },
    pt: {
        app_name: "Trimlyt",
        tagline: "Rastreamento de desempenho para barbeiros.",
        email: "E-mail",
        password: "Senha",
        login: "Entrar",
        signup: "Inscrever-se",
        create_account: "Criar Conta",
        back_login: "Voltar ao Login",
        dashboard: "Painel",
        track_cut: "Rastreie cada corte.",
        add_appointment: "+ Adicionar Agendamento",
        walk_in_now: "Sem Agendamento (Agora)",
        revenue_today: "Receita Hoje",
        revenue_week: "Esta Semana",
        revenue_month: "Este Mês",
        expected: "Exp:",
        monthly_goal: "Meta Mensal",
        busy_hours: "Horários de Pico",
        top_service: "Melhor Serviço",
        lowest_service: "Menos Lucrativo",
        history: "Histórico",
        walk_in: "Sem Agendamento",
        add: "+ Novo",
        search_placeholder: "Buscar agendamentos...",
        no_appointments: "Nenhum agendamento registrado.",
        no_matching_services: "Nenhum serviço correspondente",
        service_deleted: "Serviço excluído.",
        track_first: "Toque em \"+ Novo\" para registrar seu primeiro corte.",
        load_more: "Carregar Mais",
        settings: "Configurações",
        currency: "Moeda",
        language: "Idioma",
        gap: "Intervalo Mín. de Agendamento",
        auto_complete: "Auto-Completar Agendamentos",
        auto_complete_desc: "Se o horário passar sem atualização, definir status para:",
        dark_mode: "Modo Escuro",
        edit_profile: "Editar Perfil",
        subscription: "Assinatura",
        logout: "Sair",
        close: "Fechar",
        save: "Salvar",
        cancel: "Cancelar",
        update: "Atualizar",
        service: "Serviço",
        price: "Preço",
        date_time: "Data e Hora",
        extras: "Extras (Opcional)",
        extras_placeholder: "Nome do Cliente, Notas, etc.",
        new_appointment: "Novo Agendamento",
        edit_appointment: "Editar Agendamento",
        options: "Opções",
        finish_app: "Agendamento Concluído",
        user_no_show: "Cliente não apareceu",
        canceled: "Cancelado",
        delete_app: "Excluir Agendamento",
        undo_finish: "Desfazer Conclusão",
        set_scheduled: "Definir como Agendado",
        confirm_delete: "Tem certeza que deseja excluir este agendamento?",
        delete: "Excluir",
        confirm: "Confirmar",
        account: "Conta",
        profile_guide: "Guia de Perfil",
        got_it: "Entendi",
        login_title: "Trimlyt",
        login_desc: "Rastreamento de desempenho para barbeiros.",
        signup_title: "Inscrever-se",
        signup_desc: "Crie sua conta.",
        account_created: "Conta criada com sucesso! Por favor, entre.",
        walk_in_finished: "Sem Agendamento (Concluído)",
        complete: "Concluir",
        saving: "Salvando...",
        appointment_updated: "Agendamento atualizado!",
        appointment_created: "Agendamento criado!",
        no_matching_appointments: "Nenhum agendamento correspondente encontrado.",
        status_canceled: "Cancelado",
        status_noshow: "Não apareceu",
        today: "Hoje",
        tomorrow: "Amanhã",
        past: "Passado",
        passwords_mismatch: "As senhas não coincidem",
        profile_updated: "Perfil atualizado com sucesso!",
        dashboard_guide: "Guia do Painel",
        dashboard_guide_text: "Este é seu centro de comando principal.\n\n• Receita (Número Grande): Dinheiro garantido. Conta apenas agendamentos 'Concluídos'.\n• Exp (Esperado): Seu total potencial. Conta agendamentos 'Concluídos' e 'Agendados'.\n• Meta: Rastreia seu progresso em direção à meta mensal com base na receita real.\n• Sem Agendamento: Registra rapidamente um corte como 'Concluído' para agora, pulando a agenda.",
        appointments_guide: "Guia de Agendamentos",
        appointments_guide_text: "Gerencie sua agenda e histórico.\n\n• Intervalo de Tempo: Para evitar conflitos, o sistema impõe um intervalo mínimo entre agendamentos (Padrão: 1 hora). Altere isso nas Configurações.\n• Busca: Filtre por nome do cliente, serviço ou extras.\n• Ações: Toque em qualquer agendamento para Editar, Cancelar ou marcar como Concluído.\n• Histórico: Role para baixo para carregar agendamentos passados.",
        settings_guide: "Guia de Configurações",
        settings_guide_text: "Personalize o aplicativo para seu fluxo de trabalho.\n\n• Meta Mensal: A meta de receita para a barra de progresso no Painel.\n• Intervalo de Agendamento: O tempo de buffer obrigatório entre reservas para evitar conflitos.\n• Auto-Completar: Se você esquecer de atualizar um agendamento, o aplicativo o definirá automaticamente para este status (ex. 'Concluído') após 1 hora.",
        profile_guide_text: "Atualize as informações da sua conta.\n\n• Avatar: Toque no ícone da câmera para enviar uma foto de perfil personalizada.\n• Segurança: Atualize sua senha aqui. Você permanecerá logado após a alteração.",
        subscription_guide: "Guia de Assinatura",
        subscription_guide_text: "Gerencie seu plano Trimlyt.\n\nVeja seu status atual e faça upgrade para desbloquear recursos premium.",
        sub_coming_soon: "Gerenciamento de assinatura em breve.",
        new_password: "Nova Senha",
        confirm_password: "Confirmar Senha",
        update_profile: "Atualizar Perfil",
        finished_default: "Concluído (Padrão)",
        didnt_show_up: "Não apareceu",
        no_gap: "Sem Intervalo",
        hour_default: "1 Hora (Padrão)",
        add_manually: "Adicionar Manualmente",
        integrate_calendar: "Integrar Calendário",
        choose_calendar: "Escolher Calendário",
        back: "Voltar",
        coming_soon: "Em Breve",
        google_calendar: "Google Calendar",
        apple_calendar: "Apple Calendar",
        no_shows_month: "Não Compareceu (Mês)",
        lost: "Perdido:",
        integrations: "Integrações",
        connect_google: "Conectar Conta Google",
        google_integration_desc: "Conecte para enviar lembretes automáticos por e-mail.",
        not_connected: "Não Conectado",
        disconnect: "Desconectar",
        google_connected: "Conta Google Conectada!",
        confirm_disconnect: "Desconectar Conta Google?",
        disconnected: "Desconectado.",
        export_options: "Opções de Exportação",
        download_pdf: "Baixar PDF",
        download_excel: "Baixar Excel",
        google_import_keyword: "Palavra-chave de Importação Google",
        google_import_keyword_desc: "Eventos com este título serão importados. O padrão é 'TL'.",
        complete_appointment_title: "Completar Agendamento",
        complete_appointment_desc: "Este agendamento foi importado do Google Calendar mas faltam detalhes (Serviço/Preço). Por favor, atualize.",
        complete_data: "Completar Dados",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Seu centro de controle de negócios. Acompanhe a receita, monitore o desempenho e gerencie ações rápidas.</p><h4 style='margin-top:12px;'>Ações Rápidas</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Adicionar Agendamentos:</strong> Abra o menu para adicionar um novo agendamento manualmente ou importar do seu calendário conectado.</li><li><strong>Sem Agendamento (Agora):</strong> Registre instantaneamente um serviço concluído para agora. Pula a agenda e adiciona diretamente à receita.</li></ul><h4 style='margin-top:12px;'>Métricas e Metas</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Receita:</strong> Dinheiro garantido de agendamentos 'Concluídos'.</li><li><strong>Esperado (Exp):</strong> Receita potencial total (Concluído + Agendado).</li><li><strong>Meta:</strong> Acompanha seu progresso em direção à sua meta mensal (definida nas Configurações).</li></ul><h4 style='margin-top:12px;'>Análise</h4><p style='color: var(--text-muted);'><strong>Horários de Pico</strong> mostra seus horários mais movimentados. <strong>Melhor Serviço</strong> destaca seus melhores ganhos.</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidade e termos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidade</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Termos de Serviço</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Gerencie sua agenda e histórico.</p><h4 style='margin-top:12px;'>Adicionando Agendamentos</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ Adicionar:</strong> Escolha <em>Adicionar Manualmente</em> para detalhes específicos ou <em>Integrar do Calendário</em> para puxar eventos do Google/Apple Calendar.</li><li><strong>Sem Agendamento:</strong> Registre rapidamente um trabalho concluído para o horário atual.</li></ul><h4 style='margin-top:12px;'>Sincronização do Google Calendar</h4><p style='color: var(--text-muted);'>Para importar eventos, intitule-os <strong>TL [Serviço] [Preço]</strong> (ex: \"TL Corte 25\") no seu Google Calendar. O Trimlyt importa apenas eventos com este formato.</p><h4 style='margin-top:12px;'>Gerenciando a Lista</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Busca:</strong> Filtre por nome do cliente, serviço ou notas.</li><li><strong>Ações:</strong> Toque em qualquer agendamento para Editar, Concluir, Cancelar ou Excluir.</li><li><strong>Histórico:</strong> Role para baixo para ver agendamentos passados.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidade e termos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidade</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Termos de Serviço</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>Personalize o Trimlyt para o seu negócio.</p><h4 style='margin-top:12px;'>Integrações e Serviços</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Conta Google:</strong> Conecte para sincronizar agendamentos. Acessamos apenas eventos do calendário e informações básicas do perfil.</li><li><strong>Gerenciar Serviços:</strong> Adicione ou remova serviços (ex: Corte, Barba) para agilizar a entrada de agendamentos.</li></ul><h4 style='margin-top:12px;'>Preferências</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Meta Mensal:</strong> Defina sua meta de receita para o Painel.</li><li><strong>Intervalo de Agendamento:</strong> Imponha um tempo de buffer entre reservas para evitar sobreposições.</li><li><strong>Auto-Completar:</strong> Marque automaticamente agendamentos passados como Concluídos, Cancelados ou Não Compareceu.</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>Privacidade e termos: <a href='privacyPolicy.html' style='color: var(--primary-color);'>Política de Privacidade</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>Termos de Serviço</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gerencie os detalhes da sua conta pessoal.<br><br>• <strong>Avatar:</strong> Toque no ícone da câmera para enviar um logotipo da marca ou foto de perfil.<br>• <strong>Segurança:</strong> Atualize sua senha para manter sua conta segura.<br>• <strong>E-mail:</strong> Seu e-mail de login é fixo. Entre em contato com o suporte se precisar alterá-lo.</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>Gerencie seu plano Trimlyt.<br><br>• <strong>Status Atual:</strong> Verifique seu plano ativo.<br>• <strong>Upgrade:</strong> Desbloqueie recursos premium como análises avançadas e histórico ilimitado (Em Breve).</p>",
        onboarding_info_title: "💡 Dica Rápida!",
        onboarding_info_text_html: "<p>Vê aquele ícone ⓘ no canto superior esquerdo?</p><p>Toque nele a qualquer momento para um guia útil sobre os recursos da página atual.</p>",
        onboarding_google_task1_title: "📱 Conecte Sua Conta Google",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>Conecte sua Conta Google para desbloquear estes recursos:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Sincronizar Google Calendar</strong> — Agendamentos do Trimlyt também aparecerão no seu Google Calendar e você pode importar agendamentos existentes para o Trimlyt</li><li><strong>Zero Acesso ao E-mail</strong> — O Trimlyt <u>não</u> acessa seu e-mail ou envia em seu nome</li><li><strong>Permissões Mínimas</strong> — Apenas calendário e identidade básica</li><li><strong>Seus Dados estão Seguros</strong> — Criptografado de ponta a ponta, sem compartilhamento de dados</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>Privacidade e Termos:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>Política de Privacidade</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>Termos de Serviço</a></p></div>",
        onboarding_google_task2_title: "📅 Como Funciona a Integração do Google Calendar",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>O Trimlyt usa um formato simples para identificar quais eventos importar do seu Google Calendar.</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>Formato do Título do Evento:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [Serviço] [Preço]</code><p style='margin: 0; font-size: 0.9rem;'>Exemplo: <strong>\"TL Corte 25\"</strong> ou <strong>\"TL Barba 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>Por que essa abordagem?</strong> Apenas eventos que você marcar especificamente com a palavra-chave \"TL\" são importados. Isso garante:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>Você tem controle total sobre o que é importado</li><li>Eventos pessoais permanecem privados</li><li>Sem poluição acidental do seu histórico de agendamentos</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 Melhor Prática:</strong> Recomendamos criar agendamentos diretamente no <strong>Trimlyt</strong> para melhor controle e experiência móvel. Use a importação do Google Calendar apenas para <strong>importação em massa de eventos existentes</strong>.</p></div>",
        connect_google_account: "Conectar Conta Google",
        maybe_later: "Talvez mais tarde"
    },
    hi: {
        app_name: "Trimlyt",
        tagline: "नाइयों के लिए प्रदर्शन ट्रैकिंग।",
        email: "ईमेल",
        password: "पासवर्ड",
        login: "लॉग इन",
        signup: "साइन अप",
        create_account: "खाता बनाएं",
        back_login: "लॉगिन पर वापस जाएं",
        dashboard: "डैशबोर्ड",
        track_cut: "हर कट को ट्रैक करें।",
        add_appointment: "+ अपॉइंटमेंट जोड़ें",
        walk_in_now: "वॉक-इन (अभी)",
        revenue_today: "आज की कमाई",
        revenue_week: "इस सप्ताह",
        revenue_month: "इस महीने",
        expected: "अपेक्षित:",
        monthly_goal: "मासिक लक्ष्य",
        busy_hours: "व्यस्त घंटे",
        top_service: "शीर्ष सेवा",
        lowest_service: "सबसे कम लाभदायक",
        history: "इतिहास",
        walk_in: "वॉक-इन",
        add: "+ नया",
        search_placeholder: "अपॉइंटमेंट खोजें...",
        no_appointments: "अभी तक कोई अपॉइंटमेंट नहीं।",
        no_matching_services: "कोई मेल खाने वाली सेवा नहीं",
        service_deleted: "सेवा हटा दी गई।",
        track_first: "अपना पहला कट ट्रैक करने के लिए \"+ नया\" पर टैप करें।",
        load_more: "और लोड करें",
        settings: "सेटिंग्स",
        currency: "मुद्रा",
        language: "भाषा",
        gap: "न्यूनतम अपॉइंटमेंट गैप",
        auto_complete: "अपॉइंटमेंट ऑटो-कम्प्लीट",
        auto_complete_desc: "यदि कोई अपॉइंटमेंट समय बिना अपडेट के बीत जाता है, तो स्थिति सेट करें:",
        dark_mode: "डार्क मोड",
        edit_profile: "प्रोफ़ाइल संपादित करें",
        subscription: "सदस्यता",
        logout: "लॉग आउट",
        close: "बंद करें",
        save: "सहेजें",
        cancel: "रद्द करें",
        update: "अपडेट करें",
        service: "सेवा",
        price: "कीमत",
        date_time: "दिनांक और समय",
        extras: "अतिरिक्त (वैकल्पिक)",
        extras_placeholder: "ग्राहक का नाम, नोट्स, आदि।",
        new_appointment: "नया अपॉइंटमेंट",
        edit_appointment: "अपॉइंटमेंट संपादित करें",
        options: "विकल्प",
        finish_app: "अपॉइंटमेंट समाप्त",
        user_no_show: "उपयोगकर्ता नहीं आया",
        canceled: "रद्द किया गया",
        delete_app: "अपॉइंटमेंट हटाएं",
        undo_finish: "समाप्त पूर्ववत करें",
        set_scheduled: "अनुसूचित पर सेट करें",
        confirm_delete: "क्या आप वाकई इस अपॉइंटमेंट को हटाना चाहते हैं?",
        delete: "हटाएं",
        confirm: "पुष्टि करें",
        account: "खाता",
        profile_guide: "प्रोफ़ाइल गाइड",
        got_it: "समझ गया",
        login_title: "Trimlyt",
        login_desc: "नाइयों के लिए प्रदर्शन ट्रैकिंग।",
        signup_title: "साइन अप",
        signup_desc: "अपना खाता बनाएं।",
        account_created: "खाता सफलतापूर्वक बनाया गया! कृपया लॉग इन करें।",
        walk_in_finished: "वॉक-इन (समाप्त)",
        complete: "पूरा करें",
        saving: "सहेजा जा रहा है...",
        appointment_updated: "अपॉइंटमेंट अपडेट किया गया!",
        appointment_created: "अपॉइंटमेंट बनाया गया!",
        no_matching_appointments: "कोई मेल खाने वाला अपॉइंटमेंट नहीं मिला।",
        status_canceled: "रद्द किया गया",
        status_noshow: "नहीं आया",
        today: "आज",
        tomorrow: "कल",
        past: "अतीत",
        passwords_mismatch: "पासवर्ड मेल नहीं खाते",
        profile_updated: "प्रोफ़ाइल सफलतापूर्वक अपडेट की गई!",
        dashboard_guide: "डैशबोर्ड गाइड",
        dashboard_guide_text: "यह आपका मुख्य कमांड सेंटर है।\n\n• राजस्व (बड़ी संख्या): सुरक्षित पैसा। केवल 'समाप्त' अपॉइंटमेंट गिनता है।\n• अपेक्षित: आपका संभावित कुल। 'समाप्त' और 'अनुसूचित' दोनों अपॉइंटमेंट गिनता है।\n• लक्ष्य: वास्तविक राजस्व के आधार पर आपके मासिक लक्ष्य की ओर आपकी प्रगति को ट्रैक करता है।\n• वॉक-इन: शेड्यूल को छोड़कर, अभी के लिए एक कट को 'समाप्त' के रूप में जल्दी से लॉग करता है।",
        appointments_guide: "अपॉइंटमेंट गाइड",
        appointments_guide_text: "अपना शेड्यूल और इतिहास प्रबंधित करें।\n\n• समय अंतराल: ओवरबुकिंग को रोकने के लिए, सिस्टम अपॉइंटमेंट के बीच न्यूनतम अंतराल लागू करता है (डिफ़ॉल्ट: 1 घंटा)। इसे सेटिंग्स में बदलें।\n• खोजें: ग्राहक नाम, सेवा या अतिरिक्त द्वारा फ़िल्टर करें।\n• क्रियाएं: संपादित करने, रद्द करने या समाप्त के रूप में चिह्नित करने के लिए किसी भी अपॉइंटमेंट पर टैप करें।\n• इतिहास: पिछले अपॉइंटमेंट लोड करने के लिए नीचे स्क्रॉल करें।",
        settings_guide: "सेटिंग्स गाइड",
        settings_guide_text: "अपने वर्कफ़्लो के अनुसार ऐप को कस्टमाइज़ करें।\n\n• मासिक लक्ष्य: डैशबोर्ड पर प्रगति बार के लिए राजस्व लक्ष्य।\n• अपॉइंटमेंट गैप: संघर्षों को रोकने के लिए बुकिंग के बीच अनिवार्य बफर समय।\n• ऑटो-कम्प्लीट: यदि आप किसी अपॉइंटमेंट को अपडेट करना भूल जाते हैं, तो ऐप 1 घंटे के बाद स्वचालित रूप से इसे इस स्थिति (जैसे 'समाप्त') पर सेट कर देगा।",
        profile_guide_text: "अपनी खाता जानकारी अपडेट करें।\n\n• अवतार: कस्टम प्रोफ़ाइल चित्र अपलोड करने के लिए कैमरा आइकन पर टैप करें।\n• सुरक्षा: अपना पासवर्ड यहां अपडेट करें। इसे बदलने के बाद आप लॉग इन रहेंगे।",
        subscription_guide: "सदस्यता गाइड",
        subscription_guide_text: "अपनी Trimlyt योजना प्रबंधित करें।\n\nअपनी वर्तमान स्थिति देखें और प्रीमियम सुविधाओं को अनलॉक करने के लिए अपग्रेड करें।",
        sub_coming_soon: "सदस्यता प्रबंधन जल्द आ रहा है।",
        new_password: "नया पासवर्ड",
        confirm_password: "पासवर्ड की पुष्टि करें",
        update_profile: "प्रोफ़ाइल अपडेट करें",
        finished_default: "समाप्त (डिफ़ॉल्ट)",
        didnt_show_up: "नहीं आया",
        no_gap: "कोई अंतराल नहीं",
        hour_default: "1 घंटा (डिफ़ॉल्ट)",
        add_manually: "मैन्युअल रूप से जोड़ें",
        integrate_calendar: "कैलेंडर से जोड़ें",
        choose_calendar: "कैलेंडर चुनें",
        back: "वापस",
        coming_soon: "जल्द आ रहा है",
        google_calendar: "गूगल कैलेंडर",
        apple_calendar: "एप्पल कैलेंडर",
        no_shows_month: "नो-शो (महीना)",
        lost: "नुकसान:",
        integrations: "एकीकरण",
        connect_google: "Google खाता कनेक्ट करें",
        google_integration_desc: "स्वचालित ईमेल अनुस्मारक भेजने के लिए कनेक्ट करें।",
        not_connected: "कनेक्ट नहीं है",
        disconnect: "डिस्कनेक्ट करें",
        google_connected: "Google खाता कनेक्ट हो गया!",
        confirm_disconnect: "Google खाता डिस्कनेक्ट करें?",
        disconnected: "डिस्कनेक्ट किया गया।",
        export_options: "निर्यात विकल्प",
        download_pdf: "पीडीएफ डाउनलोड करें",
        download_excel: "एक्सेल डाउनलोड करें",
        google_import_keyword: "Google आयात कीवर्ड",
        google_import_keyword_desc: "इस शीर्षक वाले ईवेंट आयात किए जाएंगे। डिफ़ॉल्ट 'TL' है।",
        complete_appointment_title: "अपॉइंटमेंट पूरा करें",
        complete_appointment_desc: "यह अपॉइंटमेंट Google कैलेंडर से आयात किया गया था लेकिन विवरण (सेवा/मूल्य) गायब है। कृपया इसे अपडेट करें।",
        complete_data: "डेटा पूरा करें",
        dashboard_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>आपका व्यवसाय नियंत्रण केंद्र। राजस्व ट्रैक करें, प्रदर्शन की निगरानी करें और त्वरित कार्रवाइयों का प्रबंधन करें।</p><h4 style='margin-top:12px;'>त्वरित कार्रवाइयां</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ अपॉइंटमेंट जोड़ें:</strong> मैन्युअल रूप से एक नया अपॉइंटमेंट जोड़ने या अपने कनेक्टेड कैलेंडर से आयात करने के लिए मेनू खोलें।</li><li><strong>वॉक-इन (अभी):</strong> अभी के लिए एक पूर्ण सेवा को तुरंत लॉग करें। शेड्यूल को छोड़ देता है और सीधे राजस्व में जोड़ता है।</li></ul><h4 style='margin-top:12px;'>मेट्रिक्स और लक्ष्य</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>राजस्व:</strong> 'समाप्त' अपॉइंटमेंट से सुरक्षित नकद।</li><li><strong>अपेक्षित (Exp):</strong> कुल संभावित राजस्व (समाप्त + अनुसूचित)।</li><li><strong>लक्ष्य:</strong> आपके मासिक लक्ष्य (सेटिंग्स में सेट) की ओर आपकी प्रगति को ट्रैक करता है।</li></ul><h4 style='margin-top:12px;'>एनालिटिक्स</h4><p style='color: var(--text-muted);'><strong>व्यस्त घंटे</strong> आपके पीक समय को दिखाता है। <strong>शीर्ष सेवा</strong> आपकी सबसे अच्छी कमाई को उजागर करती है।</p><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>गोपनीयता और शर्तें: <a href='privacyPolicy.html' style='color: var(--primary-color);'>गोपनीयता नीति</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>सेवा की शर्तें</a></p>",
        appointments_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>अपना शेड्यूल और इतिहास प्रबंधित करें।</p><h4 style='margin-top:12px;'>अपॉइंटमेंट जोड़ना</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>+ जोड़ें:</strong> विशिष्ट विवरण के लिए <em>मैन्युअल रूप से जोड़ें</em> चुनें या Google/Apple कैलेंडर से ईवेंट खींचने के लिए <em>कैलेंडर से एकीकृत करें</em> चुनें।</li><li><strong>वॉक-इन:</strong> वर्तमान समय के लिए एक पूर्ण कार्य को जल्दी से लॉग करें।</li></ul><h4 style='margin-top:12px;'>Google कैलेंडर सिंक</h4><p style='color: var(--text-muted);'>ईवेंट आयात करने के लिए, उन्हें अपने Google कैलेंडर में <strong>TL [सेवा] [कीमत]</strong> (जैसे, \"TL Haircut 25\") शीर्षक दें। Trimlyt केवल इस प्रारूप वाले ईवेंट आयात करता है।</p><h4 style='margin-top:12px;'>सूची का प्रबंधन</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>खोजें:</strong> ग्राहक नाम, सेवा या नोट्स द्वारा फ़िल्टर करें।</li><li><strong>क्रियाएं:</strong> संपादित करने, समाप्त करने, रद्द करने या हटाने के लिए किसी भी अपॉइंटमेंट पर टैप करें।</li><li><strong>इतिहास:</strong> पिछले अपॉइंटमेंट देखने के लिए नीचे स्क्रॉल करें।</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>गोपनीयता और शर्तें: <a href='privacyPolicy.html' style='color: var(--primary-color);'>गोपनीयता नीति</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>सेवा की शर्तें</a></p>",
        settings_guide_html: "<p style='color: var(--text-muted); line-height: 1.6;'>अपने व्यवसाय के लिए Trimlyt को अनुकूलित करें।</p><h4 style='margin-top:12px;'>एकीकरण और सेवाएं</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>Google खाता:</strong> अपॉइंटमेंट सिंक करने के लिए कनेक्ट करें। हम केवल कैलेंडर ईवेंट और बुनियादी प्रोफ़ाइल जानकारी तक पहुँचते हैं।</li><li><strong>सेवाएं प्रबंधित करें:</strong> अपॉइंटमेंट प्रविष्टि को तेज़ करने के लिए सेवाएं जोड़ें या हटाएँ (जैसे, हेयरकट, दाढ़ी ट्रिम)।</li></ul><h4 style='margin-top:12px;'>प्राथमिकताएं</h4><ul style='color: var(--text-muted); line-height: 1.6;'><li><strong>मासिक लक्ष्य:</strong> डैशबोर्ड के लिए अपना राजस्व लक्ष्य निर्धारित करें।</li><li><strong>अपॉइंटमेंट गैप:</strong> ओवरलैप को रोकने के लिए बुकिंग के बीच बफर समय लागू करें।</li><li><strong>ऑटो-कम्प्लीट:</strong> पिछले अनुसूचित अपॉइंटमेंट को स्वचालित रूप से समाप्त, रद्द या नो शो के रूप में चिह्नित करें।</li></ul><p style='color: var(--text-muted); font-size: 0.9rem; margin-top: 12px;'>गोपनीयता और शर्तें: <a href='privacyPolicy.html' style='color: var(--primary-color);'>गोपनीयता नीति</a> • <a href='termsOfService.html' style='color: var(--primary-color);'>सेवा की शर्तें</a></p>",
        profile_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>अपने व्यक्तिगत खाते के विवरण प्रबंधित करें।<br><br>• <strong>अवतार:</strong> ब्रांड लोगो या प्रोफ़ाइल चित्र अपलोड करने के लिए कैमरा आइकन पर टैप करें।<br>• <strong>सुरक्षा:</strong> अपने खाते को सुरक्षित रखने के लिए अपना पासवर्ड अपडेट करें।<br>• <strong>ईमेल:</strong> आपका लॉगिन ईमेल तय है। यदि इसे बदलने की आवश्यकता है तो समर्थन से संपर्क करें।</p>",
        subscription_guide_html: "<p style='color: var(--text-muted); line-height: 1.6; margin-bottom: 24px;'>अपनी Trimlyt योजना प्रबंधित करें।<br><br>• <strong>वर्तमान स्थिति:</strong> अपनी सक्रिय योजना की जाँच करें।<br>• <strong>अपग्रेड:</strong> उन्नत एनालिटिक्स और असीमित इतिहास (जल्द आ रहा है) जैसी प्रीमियम सुविधाओं को अनलॉक करें।</p>",
        onboarding_info_title: "💡 त्वरित टिप!",
        onboarding_info_text_html: "<p>ऊपर बाईं ओर वह ⓘ आइकन देखें?</p><p>वर्तमान पृष्ठ की सुविधाओं पर एक सहायक मार्गदर्शिका के लिए इसे कभी भी टैप करें।</p>",
        onboarding_google_task1_title: "📱 अपना Google खाता कनेक्ट करें",
        onboarding_google_task1_text_html: "<p style='margin-bottom: 12px;'>इन सुविधाओं को अनलॉक करने के लिए अपना Google खाता कनेक्ट करें:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li><strong>Google कैलेंडर सिंक करें</strong> — Trimlyt अपॉइंटमेंट आपके Google कैलेंडर में भी दिखाई देंगे और आप मौजूदा अपॉइंटमेंट को Trimlyt में आयात कर सकते हैं</li><li><strong>शून्य ईमेल एक्सेस</strong> — Trimlyt आपके ईमेल तक नहीं पहुँचता है या आपकी ओर से नहीं भेजता है</li><li><strong>न्यूनतम अनुमतियां</strong> — केवल कैलेंडर और बुनियादी पहचान</li><li><strong>आपका डेटा सुरक्षित है</strong> — एंड-टू-एंड एन्क्रिप्टेड, कोई डेटा शेयरिंग नहीं</li></ul><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;'><p style='margin: 0 0 8px 0;'><strong>गोपनीयता और शर्तें:</strong></p><p style='margin: 4px 0;'><a href='privacyPolicy.html' style='color: var(--primary-color); text-decoration: none;'>गोपनीयता नीति</a> • <a href='termsOfService.html' style='color: var(--primary-color); text-decoration: none;'>सेवा की शर्तें</a></p></div>",
        onboarding_google_task2_title: "📅 Google कैलेंडर एकीकरण कैसे काम करता है",
        onboarding_google_task2_text_html: "<p style='margin-bottom: 12px;'>Trimlyt आपके Google कैलेंडर से किन ईवेंट को आयात करना है, इसकी पहचान करने के लिए एक सरल प्रारूप का उपयोग करता है।</p><div style='background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 16px;'><p style='margin: 0 0 8px 0;'><strong>ईवेंट शीर्षक प्रारूप:</strong></p><code style='display: block; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; font-family: monospace; margin-bottom: 8px; color: var(--primary-color);'>TL [सेवा] [कीमत]</code><p style='margin: 0; font-size: 0.9rem;'>उदाहरण: <strong>\"TL Haircut 25\"</strong> या <strong>\"TL Beard Trim 15\"</strong></p></div><p style='margin-bottom: 12px;'><strong>यह दृष्टिकोण क्यों?</strong> केवल वे ईवेंट जिन्हें आप विशेष रूप से \"TL\" कीवर्ड के साथ चिह्नित करते हैं, आयात किए जाते हैं। यह सुनिश्चित करता है:</p><ul style='margin: 12px 0 16px 16px; line-height: 1.8;'><li>आयात की जाने वाली चीज़ों पर आपका पूरा नियंत्रण है</li><li>व्यक्तिगत कार्यक्रम निजी रहते हैं</li><li>आपके अपॉइंटमेंट इतिहास का कोई आकस्मिक प्रदूषण नहीं</li></ul><div style='background: rgba(255, 193, 7, 0.1); border-left: 3px solid rgba(255, 193, 7, 0.8); padding: 12px; margin-bottom: 16px; border-radius: 4px;'><p style='margin: 0; font-size: 0.95rem;'><strong>💡 सर्वोत्तम अभ्यास:</strong> हम बेहतर नियंत्रण और मोबाइल अनुभव के लिए सीधे <strong>Trimlyt</strong> में अपॉइंटमेंट बनाने की सलाह देते हैं। Google कैलेंडर आयात का उपयोग केवल <strong>मौजूदा ईवेंट के थोक-आयात</strong> के लिए करें।</p></div>",
        connect_google_account: "Google खाता कनेक्ट करें",
        maybe_later: "शायद बाद में"
    }
};

function t(key) {
    const lang = localStorage.getItem('trimlyt_language') || 'en';
    if (translations[lang] && translations[lang][key]) {
        return translations[lang][key];
    }
    // Fallback to English
    if (translations['en'][key]) {
        return translations['en'][key];
    }
    return key;
}

function applyTranslations() {
    const lang = localStorage.getItem('trimlyt_language') || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';

    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                el.placeholder = translations[lang][key];
            } else {
                // Preserve HTML structure if needed, but for now textContent is safer
                // If we need HTML (like bold tags in guides), we can use innerHTML
                // The guide texts have \n which we might want to convert to <br>
                if (key.endsWith('_html')) {
                    el.innerHTML = translations[lang][key];
                } else if (key.includes('guide_text')) {
                    el.innerHTML = translations[lang][key].replace(/\n/g, '<br>');
                } else {
                    el.textContent = translations[lang][key];
                }
            }
        }
    });
    
    // Re-render dynamic components if they are currently visible
    const path = window.location.pathname;
    if (path.includes('appointments')) {
        // We need to re-render the list to update status texts etc.
        // But we don't want to fetch data again if we don't have to.
        // renderAppointments uses currentAppointments global variable.
        if (typeof renderAppointments === 'function' && typeof currentAppointments !== 'undefined') {
            renderAppointments(currentAppointments);
        }
    }
    if (path.includes('dashboard')) {
        if (typeof updateDashboardMetrics === 'function') {
            updateDashboardMetrics();
        }
    }
}

// --- Cookie Consent Management ---
function initCookieConsent() {
    const consentKey = 'trimlyt_analytics_consent';
    const userConsent = localStorage.getItem(consentKey);

    // If user has already made a choice, don't show banner
    if (userConsent) {
        return;
    }

    // Create and inject the cookie consent banner
    const bannerHTML = `
        <div class="cookie-consent-banner" id="cookieConsentBanner">
            <div class="cookie-consent-message">
                <strong>We use analytics to improve Trimlyt.</strong>
                <span>Google Analytics helps us understand how you use the app. Visit our <a href="privacyPolicy.html" target="_blank">Privacy Policy</a> to learn more.</span>
            </div>
            <div class="cookie-consent-actions">
                <button class="cookie-consent-dismiss" id="cookieDismiss">Dismiss</button>
                <button class="cookie-consent-accept" id="cookieAccept">Accept</button>
            </div>
        </div>
    `;

    // Inject banner into the DOM (after body loads)
    if (document.body) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bannerHTML;
        document.body.appendChild(tempDiv.firstElementChild);

        // Attach event listeners
        document.getElementById('cookieAccept').addEventListener('click', () => {
            localStorage.setItem(consentKey, 'accepted');
            hideCookieBanner();
        });

        document.getElementById('cookieDismiss').addEventListener('click', () => {
            localStorage.setItem(consentKey, 'dismissed');
            hideCookieBanner();
        });
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('cookieConsentBanner');
    if (banner) {
        banner.classList.add('hidden');
    }
}
