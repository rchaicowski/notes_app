export class LanguageController {
  constructor() {
    this.currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
    this.translations = {};
    this.supportedLanguages = {
      'en': { name: 'English', flag: '🇺🇸' },
      'pt': { name: 'Português', flag: '🇧🇷' },
      'es': { name: 'Español', flag: '🇪🇸' },
      'fr': { name: 'Français', flag: '🇫🇷' }
    };
    
    this.init();
  }

  async init() {
    await this.loadLanguage(this.currentLanguage);
    this.setupLanguageSelector();
  }

  async loadLanguage(langCode) {
    try {
      this.translations = this.getTranslations(langCode);
      this.currentLanguage = langCode;
      localStorage.setItem('selectedLanguage', langCode);
      this.updateContent();
      
      document.documentElement.lang = langCode;
      
      window.dispatchEvent(new CustomEvent('language-changed', { 
        detail: { language: langCode } 
      }));
      
    } catch (error) {
      console.error('Failed to load language:', error);
      if (langCode !== 'en') {
        await this.loadLanguage('en');
      }
    }
  }

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
        'auth.logout': 'Logout'
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
        'auth.logout': 'Sair'
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
        'auth.logout': 'Cerrar Sesión'
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
        'auth.logout': 'Déconnexion'
      }
    };
    
    return translations[langCode] || translations['en'];
  }

  setupLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      languageSelect.innerHTML = '';
      Object.entries(this.supportedLanguages).forEach(([code, info]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${info.flag} ${info.name}`;
        option.selected = code === this.currentLanguage;
        languageSelect.appendChild(option);
      });
      
      languageSelect.addEventListener('change', (e) => {
        this.loadLanguage(e.target.value);
      });
    }
  }

  updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.getTranslation(key);
      
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'email') {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'password') {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    });
    
    document.querySelectorAll('[data-i18n-attr]').forEach(element => {
      const data = element.getAttribute('data-i18n-attr').split(':');
      const attr = data[0];
      const key = data[1];
      element.setAttribute(attr, this.getTranslation(key));
    });
  }

  getTranslation(key) {
    return this.translations[key] || key;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}
