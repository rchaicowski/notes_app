/**
 * @fileoverview Internationalization (i18n) controller for multi-language support
 * Manages language selection, translation loading, and dynamic content updates
 * Supports English, Portuguese, Spanish, and French with automatic DOM updates
 * @module languageController
 */

/**
 * Manages application internationalization (i18n)
 * Handles language switching, translation storage, and automatic UI updates
 * Uses data-i18n attributes in HTML for declarative translation bindings
 */
export class LanguageController {
  /**
   * Creates a new LanguageController instance
   * Initializes with saved language preference or defaults to English
   * Loads translations and sets up language selector
   */
  constructor() {
    /**
     * Currently active language code
     * @type {string}
     */
    this.currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
    
    /**
     * Current language translations object
     * Maps translation keys to localized strings
     * @type {Object<string, string>}
     */
    this.translations = {};
    
    /**
     * Supported languages configuration
     * Maps language codes to display names and flag emojis
     * @type {Object<string, {name: string, flag: string}>}
     */
    this.supportedLanguages = {
      'en': { name: 'English', flag: '🇺🇸' },
      'pt': { name: 'Português', flag: '🇧🇷' },
      'es': { name: 'Español', flag: '🇪🇸' },
      'fr': { name: 'Français', flag: '🇫🇷' }
    };
    
    this.init();
  }

  /**
   * Initializes the language controller
   * Loads saved or default language and sets up the language selector
   * 
   * @async
   */
  async init() {
    await this.loadLanguage(this.currentLanguage);
    this.setupLanguageSelector();
  }

  /**
   * Loads and activates a language
   * Updates translations, persists selection, and updates all UI text
   * Dispatches 'language-changed' event for other components to react
   * Falls back to English if requested language fails to load
   * 
   * @async
   * @param {string} langCode - Language code to load ('en', 'pt', 'es', 'fr')
   * 
   * @fires CustomEvent#language-changed - Emitted when language changes
   */
  async loadLanguage(langCode) {
    try {
      // Load translation data
      this.translations = this.getTranslations(langCode);
      this.currentLanguage = langCode;
      
      // Persist language preference
      localStorage.setItem('selectedLanguage', langCode);
      
      // Update all translatable content in DOM
      this.updateContent();
      
      // Set HTML lang attribute for accessibility and SEO
      document.documentElement.lang = langCode;
      
      // Notify other components of language change
      window.dispatchEvent(new CustomEvent('language-changed', { 
        detail: { language: langCode } 
      }));
      
    } catch (error) {
      console.error('Failed to load language:', error);
      // Fallback to English if non-English language fails
      if (langCode !== 'en') {
        await this.loadLanguage('en');
      }
    }
  }

  /**
   * Retrieves translation object for a specific language
   * Returns English translations as fallback if language not found
   * 
   * @param {string} langCode - Language code to get translations for
   * @returns {Object<string, string>} Translation key-value pairs
   * 
   * Translation key format:
   * - 'category.item' - Hierarchical structure for organization
   * - '{placeholder}' - Dynamic values replaced at runtime
   * 
   * Example keys:
   * - 'app.title' → 'My Notes'
   * - 'page.info' → 'Page {current} of {total}'
   */
  getTranslations(langCode) {
    const translations = {
      'en': {
        'app.title': 'My Notes',
        'lamp.darkMode': 'DARK MODE',
        'pencil.edit': 'EDIT',
        'eraser.delete': 'DELETE',
        'note.placeholder': 'Note',
        'note.add': '+',
        'page.previous': '‹',
        'page.next': '›',
        'page.info': 'Page {current} of {total}',
        'page.noPages': 'No pages',
        
        'settings.title': 'Settings',
        'settings.trigger': 'SETTINGS',
        'settings.storage': '📁 Storage',
        'settings.storageMode': 'Storage Mode:',
        'settings.currentMode': 'Current Mode:',
        'settings.online': 'Online',
        'settings.offline': 'Offline',
        'settings.switchOnline': '☁️ Switch to Online Mode (Login)',
        'settings.audio': '🔊 Audio',
        'settings.volume': 'Volume:',
        'settings.enableSounds': 'Enable Sounds:',
        'settings.interface': '🎨 Interface',
        'settings.language': 'Language:',
        'settings.account': '👤 Account',
        'settings.deleteAccount': 'Delete Account',
        'settings.deleteWarning': 'This action cannot be undone. All your notes will be permanently deleted.',
        
        'auth.login': 'Login',
        'auth.register': 'Register',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.name': 'Name',
        'auth.emailPlaceholder': 'Enter your email',
        'auth.passwordPlaceholder': 'Enter your password',
        'auth.namePlaceholder': 'Enter your full name',
        'auth.createPassword': 'Create a password',
        'auth.noAccount': "Don't have an account?",
        'auth.hasAccount': 'Already have an account?',
        'auth.or': 'or',
        'auth.offlineMode': 'Continue in Offline Mode',
        'auth.welcome': 'Welcome',
        'auth.logout': 'Logout',
        'auth.invalidEmail': 'Please enter a valid email address.',
        'auth.invalidPassword': 'Password must be at least 6 characters.',
        'auth.forgotPassword': 'Forgot password?',
        'auth.forgotPasswordTitle': 'Forgot Password',
        'auth.forgotPasswordDesc': "Enter your email address and we'll send you a link to reset your password.",
        'auth.sendResetLink': 'Send Reset Link',
        'auth.backToLogin': '← Back to Login',
        'auth.resetPasswordTitle': 'Reset Password',
        'auth.resetPasswordDesc': 'Enter your new password below.',
        'auth.newPassword': 'New Password',
        'auth.confirmPassword': 'Confirm Password',
        'auth.confirmPasswordPlaceholder': 'Confirm your password',
        'auth.resetPassword': 'Reset Password',
        'auth.invalidPasswordLength': 'Password must be at least 8 characters.',
        'auth.passwordMismatch': 'Passwords do not match.'
      },
      
      'pt': {
        'app.title': 'Minhas Notas',
        'lamp.darkMode': 'MODO ESCURO',
        'pencil.edit': 'EDITAR',
        'eraser.delete': 'EXCLUIR',
        'note.placeholder': 'Nota',
        'note.add': '+',
        'page.previous': '‹',
        'page.next': '›',
        'page.info': 'Página {current} de {total}',
        'page.noPages': 'Sem páginas',
        
        'settings.title': 'Configurações',
        'settings.trigger': 'CONFIGURAÇÕES',
        'settings.storage': '📁 Armazenamento',
        'settings.storageMode': 'Modo de Armazenamento:',
        'settings.currentMode': 'Modo Atual:',
        'settings.online': 'Online',
        'settings.offline': 'Offline',
        'settings.switchOnline': '☁️ Alternar para Modo Online (Login)',
        'settings.audio': '🔊 Áudio',
        'settings.volume': 'Volume:',
        'settings.enableSounds': 'Ativar Sons:',
        'settings.interface': '🎨 Interface',
        'settings.language': 'Idioma:',
        'settings.account': '👤 Conta',
        'settings.deleteAccount': 'Excluir Conta',
        'settings.deleteWarning': 'Esta ação não pode ser desfeita. Todas as suas notas serão excluídas permanentemente.',
        
        'auth.login': 'Entrar',
        'auth.register': 'Registrar',
        'auth.email': 'Email',
        'auth.password': 'Senha',
        'auth.name': 'Nome',
        'auth.emailPlaceholder': 'Digite seu email',
        'auth.passwordPlaceholder': 'Digite sua senha',
        'auth.namePlaceholder': 'Digite seu nome completo',
        'auth.createPassword': 'Crie uma senha',
        'auth.noAccount': 'Não tem uma conta?',
        'auth.hasAccount': 'Já tem uma conta?',
        'auth.or': 'ou',
        'auth.offlineMode': 'Continuar no Modo Offline',
        'auth.welcome': 'Bem-vindo',
        'auth.logout': 'Sair',
        'auth.invalidEmail': 'Por favor, insira um endereço de email válido.',
        'auth.invalidPassword': 'A senha deve ter pelo menos 6 caracteres.',
        'auth.forgotPassword': 'Esqueceu a senha?',
        'auth.forgotPasswordTitle': 'Esqueceu a Senha',
        'auth.forgotPasswordDesc': 'Digite seu endereço de email e enviaremos um link para redefinir sua senha.',
        'auth.sendResetLink': 'Enviar Link de Redefinição',
        'auth.backToLogin': '← Voltar ao Login',
        'auth.resetPasswordTitle': 'Redefinir Senha',
        'auth.resetPasswordDesc': 'Digite sua nova senha abaixo.',
        'auth.newPassword': 'Nova Senha',
        'auth.confirmPassword': 'Confirmar Senha',
        'auth.confirmPasswordPlaceholder': 'Confirme sua senha',
        'auth.resetPassword': 'Redefinir Senha',
        'auth.invalidPasswordLength': 'A senha deve ter pelo menos 8 caracteres.',
        'auth.passwordMismatch': 'As senhas não correspondem.'
      },
      
      'es': {
        'app.title': 'Mis Notas',
        'lamp.darkMode': 'MODO OSCURO',
        'pencil.edit': 'EDITAR',
        'eraser.delete': 'ELIMINAR',
        'note.placeholder': 'Nota',
        'note.add': '+',
        'page.previous': '‹',
        'page.next': '›',
        'page.info': 'Página {current} de {total}',
        'page.noPages': 'Sin páginas',
        
        'settings.title': 'Configuración',
        'settings.trigger': 'CONFIGURACIÓN',
        'settings.storage': '📁 Almacenamiento',
        'settings.storageMode': 'Modo de Almacenamiento:',
        'settings.currentMode': 'Modo Actual:',
        'settings.online': 'En línea',
        'settings.offline': 'Sin conexión',
        'settings.switchOnline': '☁️ Cambiar a Modo En línea (Iniciar sesión)',
        'settings.audio': '🔊 Audio',
        'settings.volume': 'Volumen:',
        'settings.enableSounds': 'Activar Sonidos:',
        'settings.interface': '🎨 Interfaz',
        'settings.language': 'Idioma:',
        'settings.account': '👤 Cuenta',
        'settings.deleteAccount': 'Eliminar Cuenta',
        'settings.deleteWarning': 'Esta acción no se puede deshacer. Todas tus notas serán eliminadas permanentemente.',
        
        'auth.login': 'Iniciar Sesión',
        'auth.register': 'Registrarse',
        'auth.email': 'Correo',
        'auth.password': 'Contraseña',
        'auth.name': 'Nombre',
        'auth.emailPlaceholder': 'Ingresa tu correo',
        'auth.passwordPlaceholder': 'Ingresa tu contraseña',
        'auth.namePlaceholder': 'Ingresa tu nombre completo',
        'auth.createPassword': 'Crea una contraseña',
        'auth.noAccount': '¿No tienes cuenta?',
        'auth.hasAccount': '¿Ya tienes cuenta?',
        'auth.or': 'o',
        'auth.offlineMode': 'Continuar en Modo Sin Conexión',
        'auth.welcome': 'Bienvenido',
        'auth.logout': 'Cerrar Sesión',
        'auth.invalidEmail': 'Por favor, ingresa un correo electrónico válido.',
        'auth.invalidPassword': 'La contraseña debe tener al menos 6 caracteres.',
        'auth.forgotPassword': '¿Olvidaste tu contraseña?',
        'auth.forgotPasswordTitle': 'Olvidé mi Contraseña',
        'auth.forgotPasswordDesc': 'Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.',
        'auth.sendResetLink': 'Enviar Enlace de Restablecimiento',
        'auth.backToLogin': '← Volver al Inicio de Sesión',
        'auth.resetPasswordTitle': 'Restablecer Contraseña',
        'auth.resetPasswordDesc': 'Ingresa tu nueva contraseña a continuación.',
        'auth.newPassword': 'Nueva Contraseña',
        'auth.confirmPassword': 'Confirmar Contraseña',
        'auth.confirmPasswordPlaceholder': 'Confirma tu contraseña',
        'auth.resetPassword': 'Restablecer Contraseña',
        'auth.invalidPasswordLength': 'La contraseña debe tener al menos 8 caracteres.',
        'auth.passwordMismatch': 'Las contraseñas no coinciden.'
      },
      
      'fr': {
        'app.title': 'Mes Notes',
        'lamp.darkMode': 'MODE SOMBRE',
        'pencil.edit': 'ÉDITER',
        'eraser.delete': 'SUPPRIMER',
        'note.placeholder': 'Note',
        'note.add': '+',
        'page.previous': '‹',
        'page.next': '›',
        'page.info': 'Page {current} sur {total}',
        'page.noPages': 'Aucune page',
        
        'settings.title': 'Paramètres',
        'settings.trigger': 'PARAMÈTRES',
        'settings.storage': '📁 Stockage',
        'settings.storageMode': 'Mode de Stockage:',
        'settings.currentMode': 'Mode Actuel:',
        'settings.online': 'En ligne',
        'settings.offline': 'Hors ligne',
        'settings.switchOnline': '☁️ Passer en Mode En ligne (Connexion)',
        'settings.audio': '🔊 Audio',
        'settings.volume': 'Volume:',
        'settings.enableSounds': 'Activer les Sons:',
        'settings.interface': '🎨 Interface',
        'settings.language': 'Langue:',
        'settings.account': '👤 Compte',
        'settings.deleteAccount': 'Supprimer le Compte',
        'settings.deleteWarning': 'Cette action ne peut pas être annulée. Toutes vos notes seront supprimées définitivement.',
        
        'auth.login': 'Se Connecter',
        'auth.register': "S'inscrire",
        'auth.email': 'Email',
        'auth.password': 'Mot de passe',
        'auth.name': 'Nom',
        'auth.emailPlaceholder': 'Entrez votre email',
        'auth.passwordPlaceholder': 'Entrez votre mot de passe',
        'auth.namePlaceholder': 'Entrez votre nom complet',
        'auth.createPassword': 'Créez un mot de passe',
        'auth.noAccount': "Vous n'avez pas de compte?",
        'auth.hasAccount': 'Vous avez déjà un compte?',
        'auth.or': 'ou',
        'auth.offlineMode': 'Continuer en Mode Hors ligne',
        'auth.welcome': 'Bienvenue',
        'auth.logout': 'Déconnexion',
        'auth.invalidEmail': "Veuillez entrer une adresse e-mail valide.",
        'auth.invalidPassword': 'Le mot de passe doit contenir au moins 6 caractères.',
        'auth.forgotPassword': 'Mot de passe oublié?',
        'auth.forgotPasswordTitle': 'Mot de Passe Oublié',
        'auth.forgotPasswordDesc': 'Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.',
        'auth.sendResetLink': 'Envoyer le Lien de Réinitialisation',
        'auth.backToLogin': '← Retour à la Connexion',
        'auth.resetPasswordTitle': 'Réinitialiser le Mot de Passe',
        'auth.resetPasswordDesc': 'Entrez votre nouveau mot de passe ci-dessous.',
        'auth.newPassword': 'Nouveau Mot de Passe',
        'auth.confirmPassword': 'Confirmer le Mot de Passe',
        'auth.confirmPasswordPlaceholder': 'Confirmez votre mot de passe',
        'auth.resetPassword': 'Réinitialiser le Mot de Passe',
        'auth.invalidPasswordLength': 'Le mot de passe doit contenir au moins 8 caractères.',
        'auth.passwordMismatch': 'Les mots de passe ne correspondent pas.'
      }
    };
    
    return translations[langCode] || translations['en'];
  }

  /**
   * Sets up the language selector dropdown
   * Populates options with supported languages and current selection
   * Attaches change event listener for language switching
   */
  setupLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      // Clear existing options
      languageSelect.innerHTML = '';
      
      // Add option for each supported language
      Object.entries(this.supportedLanguages).forEach(([code, info]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${info.flag} ${info.name}`;
        option.selected = code === this.currentLanguage;
        languageSelect.appendChild(option);
      });
      
      // Handle language selection changes
      languageSelect.addEventListener('change', (e) => {
        this.loadLanguage(e.target.value);
      });
    }
  }

  /**
   * Updates all translatable content in the DOM
   * Searches for elements with data-i18n and data-i18n-attr attributes
   * 
   * Translation strategies:
   * - data-i18n: Updates element content (text or placeholder)
   * - data-i18n-attr: Updates specified attributes (e.g., title, aria-label)
   * 
   * Supported element types:
   * - Text inputs: Updates placeholder
   * - Email inputs: Updates placeholder
   * - Password inputs: Updates placeholder
   * - Other elements: Updates textContent
   * 
   * @example HTML usage:
   * <button data-i18n="auth.login">Login</button>
   * <input data-i18n="auth.emailPlaceholder" placeholder="Enter email">
   * <button data-i18n-attr="title:auth.login" title="Login">...</button>
   */
  updateContent() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.getTranslation(key);
      
      // Update placeholder for input fields
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'email') {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'password') {
        element.placeholder = translation;
      } else {
        // Update text content for other elements
        element.textContent = translation;
      }
    });
    
    // Update elements with data-i18n-attr attribute
    // Format: "attribute:translationKey"
    document.querySelectorAll('[data-i18n-attr]').forEach(element => {
      const data = element.getAttribute('data-i18n-attr').split(':');
      const attr = data[0];
      const key = data[1];
      element.setAttribute(attr, this.getTranslation(key));
    });
  }

  /**
   * Retrieves a translation for a given key
   * Returns the key itself if translation not found (graceful fallback)
   * 
   * @param {string} key - Translation key (e.g., 'app.title')
   * @returns {string} Translated string or original key if not found
   */
  getTranslation(key) {
    return this.translations[key] || key;
  }

  /**
   * Gets the current active language code
   * 
   * @returns {string} Current language code ('en', 'pt', 'es', or 'fr')
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Gets the list of supported languages
   * 
   * @returns {Object<string, {name: string, flag: string}>} Supported languages with metadata
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}
