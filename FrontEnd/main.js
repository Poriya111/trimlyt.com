document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const token = localStorage.getItem('trimlyt_token');

    // --- Apply Theme ---
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // --- Route Protection ---
    // Pages that don't require auth
    const publicPages = ['index.html', 'dashboard.html', 'appointments.html', 'settings.html'];
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
    }
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
                alert('Account created successfully! Please log in.');
                // Switch back to login mode
                signupBtn.click();
            } else {
                // Login Success
                localStorage.setItem('trimlyt_token', data.token);
                
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
            alert(err.message);
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

    // Load saved settings
    const savedGoal = localStorage.getItem('trimlyt_goal');
    const savedCurrency = localStorage.getItem('trimlyt_currency');
    const savedAutoComplete = localStorage.getItem('trimlyt_auto_complete');
    const savedTheme = localStorage.getItem('trimlyt_theme') || 'light';

    if (savedGoal) goalInput.value = savedGoal;
    if (savedCurrency) currencyInput.value = savedCurrency;
    if (savedAutoComplete) autoCompleteInput.value = savedAutoComplete;
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('trimlyt_theme', newTheme);
        });
    }

    // Save settings
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            localStorage.setItem('trimlyt_goal', goalInput.value);
            localStorage.setItem('trimlyt_currency', currencyInput.value);
            localStorage.setItem('trimlyt_auto_complete', autoCompleteInput.value);
            alert('Settings saved!');
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
    const addForm = document.getElementById('addAppointmentForm');
    const list = document.getElementById('appointmentList');
    const dateInput = document.getElementById('dateInput');

    const btnNoShow = document.getElementById('btnNoShow');
    const btnFinish = document.getElementById('btnFinish');

    // Function to handle button visibility based on time
    const updateActionModalState = (appointmentDateStr) => {
        if (!appointmentDateStr) return;

        const appointmentTime = new Date(appointmentDateStr).getTime();
        const now = Date.now();

        // If appointment is in the future (before the appointment time)
        if (now < appointmentTime) {
            // Disable/Hide options that don't make sense yet
            if (btnNoShow) btnNoShow.style.display = 'none';
            if (btnFinish) btnFinish.style.display = 'none';
        } else {
            // Show all options
            if (btnNoShow) btnNoShow.style.display = 'block';
            if (btnFinish) btnFinish.style.display = 'block';
        }
    };

    // Open Modal (Event Delegation)
    if (list) {
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-more')) {
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

    // Close when clicking outside content (optional UX improvement)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // --- Add Appointment Logic ---
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            addModal.classList.remove('hidden');
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
            window.location.href = 'index.html';
        });
    }
}

function initDashboardPage() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const addModal = document.getElementById('addModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addAppointmentForm');
    const dateInput = document.getElementById('dateInput');

    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            addModal.classList.remove('hidden');
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

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const res = await fetch('http://localhost:5000/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ service, price, date, extras })
        });

        if (!res.ok) throw new Error('Failed to save appointment');

        alert('Appointment saved!');
        if (modal) modal.classList.add('hidden');
        form.reset();
        window.location.reload(); // Reload to eventually show the new data
    } catch (err) {
        alert('Error saving appointment: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function loadAppointments() {
    const listContainer = document.getElementById('appointmentList');
    if (!listContainer) return;

    const token = localStorage.getItem('trimlyt_token');
    const currency = localStorage.getItem('trimlyt_currency') || '$';

    try {
        const res = await fetch('http://localhost:5000/api/appointments', {
            headers: { 'x-auth-token': token }
        });
        const appointments = await res.json();

        if (appointments.length === 0) {
            // Keep the empty state from HTML if no appointments
            return;
        }

        listContainer.innerHTML = appointments.map(app => `
            <div class="appointment-item">
                <div class="appointment-info">
                    <h4>${app.service}</h4>
                    <p>${new Date(app.date).toLocaleString()}</p>
                </div>
                <div class="appointment-right">
                    <span class="appointment-price">${currency}${app.price}</span>
                    <button class="btn-more">⋮</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}