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
    const publicPages = ['index.html', 'dashboard.html', 'appointments.html', 'settings.html', 'profile.html', 'subscription.html'];
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

    updateProfileDisplay();
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
            headerTitle.textContent = 'Sign Up';
            headerDesc.textContent = 'Create your account.';
            submitBtn.textContent = 'Create Account';
            signupBtn.textContent = 'Back to Login';
        } else {
            headerTitle.textContent = 'Trimlyt';
            headerDesc.textContent = 'Performance tracking for barbers.';
            submitBtn.textContent = 'Log In';
            signupBtn.textContent = 'Sign Up';
        }
    });

    // Handle Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = passwordInput.value;
        const endpoint = isSignup 
            ? 'http://localhost:5000/api/auth/register' 
            : 'http://localhost:5000/api/auth/login';

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
                showNotification('Account created successfully! Please log in.', 'success');
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
                }
                
                // Save user settings locally
                if (data.user && data.user.settings) {
                    localStorage.setItem('trimlyt_currency', data.user.settings.currency);
                    localStorage.setItem('trimlyt_goal', data.user.settings.monthlyGoal);
                    localStorage.setItem('trimlyt_auto_complete', data.user.settings.autoCompleteStatus);
                    localStorage.setItem('trimlyt_theme', data.user.settings.theme);
                }

                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
        }
    });
}

function initSettingsPage() {
    const settingsForm = document.getElementById('settingsForm');
    const goalInput = document.getElementById('monthlyGoal');
    const currencyInput = document.getElementById('currency');
    const autoCompleteInput = document.getElementById('autoCompleteStatus');
    const themeToggle = document.getElementById('themeToggle');
    const saveGoalBtn = document.getElementById('saveGoalBtn');
    const saveCurrencyBtn = document.getElementById('saveCurrencyBtn');

    // Load saved settings
    const savedGoal = localStorage.getItem('trimlyt_goal');
    const savedCurrency = localStorage.getItem('trimlyt_currency');
    const savedAutoComplete = localStorage.getItem('trimlyt_auto_complete');
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';

    if (savedGoal) goalInput.value = savedGoal;
    if (savedCurrency) currencyInput.value = savedCurrency;
    if (savedAutoComplete) autoCompleteInput.value = savedAutoComplete;

    // Helper to save settings to backend
    const saveSettings = async (payload) => {
        const token = localStorage.getItem('trimlyt_token');
        try {
            const res = await fetch('http://localhost:5000/api/auth/settings', {
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

    initProfileLogic();
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
                btnReset.textContent = 'Undo Finish';
            }
        } else if (status === 'Canceled' || status === 'No Show') {
            if (btnFinish) btnFinish.style.display = 'none';
            if (btnNoShow) btnNoShow.style.display = 'none';
            if (btnCancel) btnCancel.style.display = 'none';
            
            // Allow Reset
            if (btnReset) {
                btnReset.style.display = 'block';
                btnReset.textContent = 'Set to Scheduled';
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
            
            const confirmed = await showConfirm('Are you sure you want to delete this appointment?', 'Delete', true);
            
            if (confirmed) {
                const token = localStorage.getItem('trimlyt_token');
                try {
                    await fetch(`http://localhost:5000/api/appointments/${selectedAppointmentId}`, {
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
                const res = await fetch(`http://localhost:5000/api/appointments?type=past&page=${pastPage}&limit=20`, {
                    headers: { 'x-auth-token': token }
                });
                const newPast = await res.json();
                
                if (newPast.length < 20) loadMoreBtn.style.display = 'none';
                
                currentAppointments = [...currentAppointments, ...newPast];
                renderAppointments(currentAppointments);
            } catch (err) {
                console.error(err);
            } finally {
                loadMoreBtn.textContent = 'Load More';
                loadMoreBtn.disabled = false;
            }
        });
    }

    // Status Actions
    const updateStatus = async (status) => {
        if (!selectedAppointmentId) return;
        const token = localStorage.getItem('trimlyt_token');
        try {
            const res = await fetch(`http://localhost:5000/api/appointments/${selectedAppointmentId}`, {
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
                addModal.querySelector('h3').textContent = 'Edit Appointment';
                addForm.querySelector('button[type="submit"]').textContent = 'Update';
                
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
            addModal.querySelector('h3').textContent = 'New Appointment';
            addForm.querySelector('button[type="submit"]').textContent = 'Save';
            
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
    loadAppointments(true); // Pass true to reset pagination
}

function setupWalkInModal(form, modal, dateInput) {
    if (!form || !modal) return;
    
    form.reset();
    form.dataset.mode = 'add';
    form.dataset.type = 'walk-in';
    delete form.dataset.editId;
    
    modal.querySelector('h3').textContent = 'Walk-in (Finished)';
    form.querySelector('button[type="submit"]').textContent = 'Complete';
    
    // Hide Date Input
    if (dateInput && dateInput.parentElement) {
        dateInput.parentElement.style.display = 'none';
        dateInput.required = false;
    }

    modal.classList.remove('hidden');
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
                    fetch('http://localhost:5000/api/auth/user', { headers: { 'x-auth-token': token } })
                        .then(res => res.ok ? res.json() : null)
                        .then(user => {
                            if (user && user.email) {
                                emailEl.textContent = user.email;
                                localStorage.setItem('trimlyt_email', user.email);
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
                    fetch('http://localhost:5000/api/auth/user', { headers: { 'x-auth-token': token } })
                        .then(res => res.ok ? res.json() : null)
                        .then(user => {
                            if (user && user.email) {
                                emailEl.textContent = user.email;
                                localStorage.setItem('trimlyt_email', user.email);
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
            addModal.querySelector('h3').textContent = 'New Appointment';
            form.querySelector('button[type="submit"]').textContent = 'Save';
            
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
    submitBtn.textContent = 'Saving...';

    try {
        const url = mode === 'edit' ? `http://localhost:5000/api/appointments/${editId}` : 'http://localhost:5000/api/appointments';
        const method = mode === 'edit' ? 'PUT' : 'POST';

        let payload = { service, price, date, extras };

        if (isWalkIn) {
            payload.status = 'Finished';
            payload.date = new Date().toISOString();
            payload.service = `${service} (Walk-in)`;
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

        if (!res.ok) throw new Error('Failed to save appointment');

        const successMsg = mode === 'edit' ? 'Appointment updated!' : 'Appointment created!';
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
        const userRes = await fetch('http://localhost:5000/api/auth/user', { headers: { 'x-auth-token': token } });

        if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.email) localStorage.setItem('trimlyt_email', userData.email);
            if (userData.avatar) localStorage.setItem('trimlyt_avatar', userData.avatar);
            if (userData.settings) {
                localStorage.setItem('trimlyt_currency', userData.settings.currency);
                localStorage.setItem('trimlyt_goal', userData.settings.monthlyGoal);
                localStorage.setItem('trimlyt_auto_complete', userData.settings.autoCompleteStatus);
                localStorage.setItem('trimlyt_theme', userData.settings.theme);
            }
        }

        // Fetch Upcoming (All) and Past (Page 1)
        const [upcomingRes, pastRes] = await Promise.all([
            fetch('http://localhost:5000/api/appointments?type=upcoming', { headers: { 'x-auth-token': token } }),
            fetch('http://localhost:5000/api/appointments?type=past&page=1&limit=20', { headers: { 'x-auth-token': token } })
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
                    <p>No matching appointments found.</p>
                </div>`;
        } else {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>No appointments logged yet.</p>
                    <p style="font-size: 0.9rem; opacity: 0.8;">Tap "+ Add" to track your first cut.</p>
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
            statusText = '<span style="font-size: 0.8em; color: var(--danger-color); margin-left: 8px;">(Canceled)</span>';
        } else if (app.status === 'No Show') {
            statusStyle = 'opacity: 0.8; border-left: 3px solid var(--danger-color);';
            statusText = '<span style="font-size: 0.8em; color: var(--danger-color); margin-left: 8px;">(No Show)</span>';
        } else if (app.status === 'Finished') {
            statusStyle = 'border-left: 3px solid var(--success-color);';
            statusText = '<span style="font-size: 0.8em; color: var(--success-color); margin-left: 8px;">✓</span>';
        }

        return `
        <div class="appointment-item" style="${statusStyle}">
            <div class="appointment-info">
                <h4>${app.service}${statusText}</h4>
                <p>${new Date(app.date).toLocaleString()}</p>
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
            groupLabel = 'Today';
        } else if (appDate < dayAfterTomorrowStart) {
            groupLabel = 'Tomorrow';
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
        html += `<div class="date-separator">Past</div>`;
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
            fetch('http://localhost:5000/api/auth/user', { headers: { 'x-auth-token': token } }),
            fetch('http://localhost:5000/api/appointments', { headers: { 'x-auth-token': token } })
        ]);

        if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.email) localStorage.setItem('trimlyt_email', userData.email);
            if (userData.settings) {
                localStorage.setItem('trimlyt_currency', userData.settings.currency);
                localStorage.setItem('trimlyt_goal', userData.settings.monthlyGoal);
                localStorage.setItem('trimlyt_auto_complete', userData.settings.autoCompleteStatus);
                localStorage.setItem('trimlyt_theme', userData.settings.theme);
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
                if (expEl) expEl.textContent = `Exp: ${currency}${expected}`;
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
                showNotification('Passwords do not match', 'error');
                return;
            }

            const payload = {};
            if (password) payload.password = password;
            
            // Check if avatar changed
            if (avatarInput.files.length > 0) {
                const file = avatarInput.files[0];
                // Convert to Base64
                const toBase64 = file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                payload.avatar = await toBase64(file);
            }

            try {
                const res = await fetch('http://localhost:5000/api/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Failed to update profile');
                
                if (payload.avatar) localStorage.setItem('trimlyt_avatar', payload.avatar);
                updateProfileDisplay();
                showNotification('Profile updated successfully!', 'success');
                form.reset();
            } catch (err) {
                showNotification(err.message, 'error');
            }
        });
    }
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