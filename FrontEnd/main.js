let currentAppointments = [];

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const token = localStorage.getItem('trimlyt_token');

    // --- Apply Theme ---
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // --- Route Protection ---
    // Pages that don't require auth
    const publicPages = ['index.html'];
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

    updateProfileDisplay();
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

    // Load saved settings
    const savedGoal = localStorage.getItem('trimlyt_goal');
    const savedCurrency = localStorage.getItem('trimlyt_currency');
    const savedAutoComplete = localStorage.getItem('trimlyt_auto_complete');
    const savedGap = localStorage.getItem('trimlyt_gap');
    const savedLanguage = localStorage.getItem('trimlyt_language') || 'en';
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';

    if (savedGoal) goalInput.value = savedGoal;
    if (savedCurrency) currencyInput.value = savedCurrency;
    if (savedAutoComplete) autoCompleteInput.value = savedAutoComplete;
    if (savedGap !== null) appointmentGapInput.value = savedGap;
    if (savedLanguage) languageInput.value = savedLanguage;

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
                document.getElementById('serviceInput').value = appointment.service;
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
        addBtn.addEventListener('click', () => {
            addForm.reset();
            addForm.dataset.mode = 'add';
            delete addForm.dataset.editId;
            delete addForm.dataset.type; // Clear walk-in type
            addModal.querySelector('h3').textContent = t('new_appointment');
            addForm.querySelector('button[type="submit"]').textContent = t('save');
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateInput').min = now.toISOString().slice(0, 16);
            
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
    if (token) setupServiceAutocomplete(token);

    initProfileLogic();
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

function initDashboardPage() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const walkInBtn = document.getElementById('walkInBtn');
    const addModal = document.getElementById('addModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addAppointmentForm');
    const dateInput = document.getElementById('dateInput');

    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            const form = document.getElementById('addAppointmentForm');
            form.reset();
            form.dataset.mode = 'add';
            delete form.dataset.editId;
            delete form.dataset.type; // Clear walk-in type
            addModal.querySelector('h3').textContent = 'New Appointment';
            form.querySelector('button[type="submit"]').textContent = 'Save';
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateInput').min = now.toISOString().slice(0, 16);
            
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

    initProfileLogic();
    loadAppointments();
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
            window.location.href = 'index.html';
        });
    }
}

function initDashboardPage() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const walkInBtn = document.getElementById('walkInBtn');
    const addModal = document.getElementById('addModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addAppointmentForm');
    const dateInput = document.getElementById('dateInput');

    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            const form = document.getElementById('addAppointmentForm');
            form.reset();
            form.dataset.mode = 'add';
            delete form.dataset.editId;
            addModal.querySelector('h3').textContent = t('new_appointment');
            form.querySelector('button[type="submit"]').textContent = t('save');
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dateInput').min = now.toISOString().slice(0, 16);

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
    if (token) setupServiceAutocomplete(token);

    initProfileLogic();
    updateDashboardMetrics();
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
        <div class="appointment-item" style="${statusStyle}">
            <div class="appointment-info">
                <h4>${app.service}${statusText}</h4>
                <p>${new Date(app.date).toLocaleString()}</p>
                ${extrasHtml}
            </div>
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

        appointments.forEach(app => {
            const appDate = new Date(app.date);
            const price = app.price || 0;
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

        // --- Analytics Logic ---
        const hours = new Array(24).fill(0);
        const serviceRevenue = {};

        appointments.forEach(app => {
            const status = app.status || 'Scheduled';
            
            // Busy Hours (Scheduled + Finished)
            if (status === 'Scheduled' || status === 'Finished') {
                const d = new Date(app.date);
                hours[d.getHours()]++;
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
        if (chartContainer && yAxisContainer) {
            const maxVal = Math.max(...hours, 1);

            // Render Y-Axis
            yAxisContainer.innerHTML = `
                <span>${maxVal}</span>
                <span>${Math.ceil(maxVal / 2)}</span>
                <span>0</span>
            `;

            chartContainer.innerHTML = hours.map((count, i) => {
                const h = (count / maxVal) * 100;
                // Show label for every 6 hours: 0, 6, 12, 18
                const label = (i % 6 === 0) ? `<span class="chart-bar-label">${i}:00</span>` : '';
                return `<div class="chart-bar" style="height: ${h}%;" title="${i}:00 - ${count} bookings">${label}</div>`;
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

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.custom-select').forEach(s => {
            if (!s.contains(e.target)) {
                s.classList.remove('open');
            }
        });
    });
}

async function setupServiceAutocomplete(token) {
    const serviceInput = document.getElementById('serviceInput');
    const priceInput = document.getElementById('priceInput');
    const serviceDropdown = document.getElementById('serviceDropdown');
    
    if (!serviceInput || !priceInput || !serviceDropdown) return;

    serviceInput.setAttribute('autocomplete', 'off');

    let services = [];
    try {
        const res = await fetch('/api/services', { headers: { 'x-auth-token': token } });
        if (res.ok) services = await res.json();
    } catch (err) {
        console.error('Failed to load services for autocomplete', err);
        return;
    }

    const renderDropdown = (filteredServices) => {
        const currency = localStorage.getItem('trimlyt_currency') || '$';
        if (filteredServices.length === 0) {
            serviceDropdown.innerHTML = `<div class="custom-option" style="justify-content: center; color: var(--text-muted);">${t('no_matching_services')}</div>`;
        } else {
            serviceDropdown.innerHTML = filteredServices.map(s => `
                <div class="service-option" data-name="${s.name}" data-price="${s.price}">
                    <span>${s.name}</span>
                    <span class="service-price">${currency}${s.price}</span>
                </div>
            `).join('');
        }

        serviceDropdown.querySelectorAll('.service-option').forEach(option => {
            option.addEventListener('click', () => {
                if (option.dataset.name) {
                    serviceInput.value = option.dataset.name;
                    priceInput.value = option.dataset.price;
                    serviceDropdown.classList.remove('open');
                }
            });
        });
    };

    serviceInput.addEventListener('focus', () => {
        renderDropdown(services);
        serviceDropdown.classList.add('open');
    });

    serviceInput.addEventListener('input', () => {
        const searchTerm = serviceInput.value.toLowerCase();
        const filtered = services.filter(s => s.name.toLowerCase().includes(searchTerm));
        renderDropdown(filtered);
        serviceDropdown.classList.add('open');
    });

    document.addEventListener('click', (e) => {
        const container = serviceInput.parentElement;
        if (container && !container.contains(e.target)) {
            serviceDropdown.classList.remove('open');
        }
    });
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
        hour_default: "1 Hour (Default)"
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
        hour_default: "1 Stunde (Standard)"
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
        hour_default: "1 Uur (Standaard)"
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
        hour_default: "1 Hora (Por defecto)"
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
        hour_default: "1 Heure (Défaut)"
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
        hour_default: "۱ ساعت (پیش‌فرض)"
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
        hour_default: "1 Hora (Padrão)"
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
        hour_default: "1 घंटा (डिफ़ॉल्ट)"
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
                if (key.includes('guide_text')) {
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