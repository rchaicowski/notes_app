export class LoginManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        const authContainer = document.getElementById('authContainer');
        const userInfo = document.getElementById('userInfo');
        
        if (this.token) {
            authContainer?.classList.add('hidden');
            userInfo?.classList.remove('hidden');
            this.updateUserInfo();
        } else {
            authContainer?.classList.remove('hidden');
            userInfo?.classList.add('hidden');
        }
    }

    setupEventListeners() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
        document.getElementById('showRegister')?.addEventListener('click', () => this.toggleForms('register'));
        document.getElementById('showLogin')?.addEventListener('click', () => this.toggleForms('login'));
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('http://localhost:5000/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) throw new Error('Login failed');

            const data = await response.json();
            this.setAuthData(data);
            window.location.reload();
        } catch (error) {
            console.error('Login failed:', error);
            this.showError('Login failed. Please check your credentials.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const name = document.getElementById('registerName').value;

        try {
            const response = await fetch('http://localhost:5000/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            if (!response.ok) throw new Error('Registration failed');

            const data = await response.json();
            this.setAuthData(data);
            window.location.reload();
        } catch (error) {
            console.error('Registration failed:', error);
            this.showError('Registration failed. Please try again.');
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    }

    setAuthData(data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
    }

    updateUserInfo() {
        const userName = document.getElementById('userName');
        if (userName && this.user) {
            userName.textContent = this.user.name || this.user.email;
        }
    }

    toggleForms(form) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (form === 'register') {
            loginForm?.classList.add('hidden');
            registerForm?.classList.remove('hidden');
        } else {
            registerForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
        }
    }

    showError(message) {
        alert(message); // For now, using alert. Can be enhanced with a better UI later
    }
}
