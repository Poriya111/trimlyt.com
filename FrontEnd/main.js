document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const token = localStorage.getItem('trimlyt_token');

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

        // Simulate Backend Call
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        // Simulate network delay (Mocking Backend)
        setTimeout(() => {
            console.log(`${isSignup ? 'Signup' : 'Login'} successful for ${email}`);
            
            // Store Mock Token
            localStorage.setItem('trimlyt_token', 'mock_token_' + Date.now());
            
            // Redirect to Dashboard
            window.location.href = 'dashboard.html';
        }, 800);
    });
}

function initSettingsPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const settingsForm = document.getElementById('settingsForm');
    const goalInput = document.getElementById('monthlyGoal');
    const currencyInput = document.getElementById('currency');

    // Load saved settings
    const savedGoal = localStorage.getItem('trimlyt_goal');
    const savedCurrency = localStorage.getItem('trimlyt_currency');

    if (savedGoal) goalInput.value = savedGoal;
    if (savedCurrency) currencyInput.value = savedCurrency;

    // Save settings
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            localStorage.setItem('trimlyt_goal', goalInput.value);
            localStorage.setItem('trimlyt_currency', currencyInput.value);
            alert('Settings saved!');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('trimlyt_token');
            window.location.href = 'index.html';
        });
    }
}

function initAppointmentsPage() {
    const modal = document.getElementById('actionModal');
    const addModal = document.getElementById('addModal');
    const closeBtn = document.getElementById('closeModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addBtn = document.getElementById('addAppointmentBtn');
    const addForm = document.getElementById('addAppointmentForm');
    const moreBtns = document.querySelectorAll('.btn-more');

    // Open Modal
    moreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
    });

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
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Logic to save data will go here
            console.log('Adding appointment...');
            addModal.classList.add('hidden');
            addForm.reset();
        });
    }
}

function initDashboardPage() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const addModal = document.getElementById('addModal');
    const closeAddBtn = document.getElementById('closeAddModal');
    const addForm = document.getElementById('addAppointmentForm');

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
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Logic to save data will go here
            console.log('Adding appointment from Dashboard...');
            addModal.classList.add('hidden');
            addForm.reset();
        });
    }
}