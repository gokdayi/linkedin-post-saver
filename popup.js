/**
 * LinkedIn Post Saver - Popup JavaScript
 * Handles the extension popup interface and user interactions
 */

class PopupController {
    constructor() {
        this.currentTab = 'saved-posts';
        this.currentPage = 1;
        this.postsPerPage = 10;
        this.totalPosts = 0;
        this.currentPosts = [];
        this.settings = {};
        this.userConsent = false;

        this.init();
    }

    async init() {
        console.log('LinkedIn Post Saver Popup: Initializing...');

        // Check user consent first
        await this.checkUserConsent();

        // If no consent, show consent dialog instead
        if (!this.userConsent) {
            this.showConsentRequired();
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Load initial data
        await this.loadInitialData();

        // Setup tab navigation
        this.setupTabNavigation();

        console.log('LinkedIn Post Saver Popup: Initialized successfully');
    }

    async checkUserConsent() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getUserConsent' });
            if (response && response.success) {
                this.userConsent = response.data.hasConsent;
                console.log('User consent status:', this.userConsent);
            }
        } catch (error) {
            console.error('Error checking user consent:', error);
            this.userConsent = false;
        }
    }

    showConsentRequired() {
        // Replace popup content with consent notice
        const consentHTML = `
        <div style="width: 350px; padding: 20px; text-align: center; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #0077b5, #005885); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">🔒 Privacy Consent Required</h1>
          </div>
          
          <div style="margin: 20px 0;">
            <p style="margin-bottom: 16px; color: #666; line-height: 1.4;">
              Before using LinkedIn Post Saver, please review and accept our privacy terms.
            </p>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 6px; margin: 16px 0; text-align: left;">
              <h3 style="margin: 0 0 8px 0; color: #333; font-size: 14px;">Quick Summary:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
                <li>Saves posts locally on your device only</li>
                <li>No data sent to external servers</li>
                <li>Respects LinkedIn's Terms of Service</li>
                <li>You control all your data</li>
              </ul>
            </div>
          </div>
          
          <button id="showConsentDialog" style="
            background: #0077b5; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 14px;
            font-weight: 500;
            width: 100%;
            margin-bottom: 10px;
          ">
            📋 Review Terms & Give Consent
          </button>
          
          <button id="closePopup" style="
            background: #f1f3f4; 
            color: #666; 
            border: 1px solid #e0e0e0; 
            padding: 10px 20px; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 13px;
            width: 100%;
          ">
            ❌ Close Without Consent
          </button>
          
          <p style="margin-top: 16px; font-size: 11px; color: #999; line-height: 1.3;">
            This extension requires your explicit consent to save LinkedIn posts locally on your device.
          </p>
        </div>
      `;

        // Clear existing content and set new HTML
        document.body.innerHTML = consentHTML;

        // Add event listeners AFTER setting innerHTML to avoid CSP issues
        const showConsentBtn = document.getElementById('showConsentDialog');
        const closeBtn = document.getElementById('closePopup');

        if (showConsentBtn) {
            showConsentBtn.addEventListener('click', () => {
                this.openConsentDialog();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.close();
            });
        }
    }

    openConsentDialog() {
        // Open consent dialog in a new tab or popup
        chrome.tabs.create({
            url: chrome.runtime.getURL('consent-dialog.html'),
            active: true
        });

        // Close current popup
        window.close();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Saved Posts tab
        document.getElementById('refreshPosts')?.addEventListener('click', () => this.refreshPosts());
        document.getElementById('exportPosts')?.addEventListener('click', () => this.exportPosts());
        document.getElementById('authorFilter')?.addEventListener('change', () => this.filterPosts());
        document.getElementById('dateFilter')?.addEventListener('change', () => this.filterPosts());
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());

        // Search tab
        document.getElementById('searchButton')?.addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('searchInput')?.addEventListener('input', this.debounce(() => this.performSearch(), 300));

        // Stats tab
        document.getElementById('refreshStats')?.addEventListener('click', () => this.loadStats());
        document.getElementById('cleanupOldPosts')?.addEventListener('click', () => this.cleanupOldPosts());
        document.getElementById('exportAllPosts')?.addEventListener('click', () => this.exportAllPosts());

        // Settings tab
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('importPosts')?.addEventListener('click', () => this.importPosts());
        document.getElementById('importFile')?.addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('clearAllData')?.addEventListener('click', () => this.clearAllData());
        document.getElementById('reviewConsent')?.addEventListener('click', () => this.reviewConsent());
        document.getElementById('revokeConsent')?.addEventListener('click', () => this.revokeConsent());

        // Footer
        document.getElementById('openLinkedIn')?.addEventListener('click', () => this.openLinkedIn());

        // Notification close
        document.getElementById('closeNotification')?.addEventListener('click', () => this.hideNotification());
    }

    async loadInitialData() {
        try {
            this.showLoading('Loading data...');

            // Load settings
            await this.loadSettings();

            // Load posts for the current tab
            await this.loadPosts();

            // Update header stats
            await this.updateHeaderStats();

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

            if (response.success) {
                this.settings = response.data;
                this.populateSettingsForm();
            }

            // Also load and display consent status
            await this.loadConsentStatus();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async loadConsentStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getUserConsent' });

            if (response && response.success) {
                const consentData = response.data;
                const statusElement = document.getElementById('consentStatusText');

                if (statusElement) {
                    if (consentData.hasConsent) {
                        statusElement.textContent = `✅ Granted on ${new Date(consentData.consentDate).toLocaleDateString()}`;
                        statusElement.style.color = '#4caf50';
                    } else {
                        statusElement.textContent = '❌ Not granted';
                        statusElement.style.color = '#f44336';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading consent status:', error);
        }
    }

    populateSettingsForm() {
        // Storage settings
        const maxPosts = document.getElementById('maxPosts');
        if (maxPosts) maxPosts.value = this.settings.maxPosts || 1000;

        const autoCleanup = document.getElementById('autoCleanup');
        if (autoCleanup) autoCleanup.checked = this.settings.autoCleanup !== false;

        const cleanupDays = document.getElementById('cleanupDays');
        if (cleanupDays) cleanupDays.value = this.settings.cleanupDays || 30;

        // Content settings
        const saveImages = document.getElementById('saveImages');
        if (saveImages) saveImages.checked = this.settings.saveImages !== false;

        const saveVideos = document.getElementById('saveVideos');
        if (saveVideos) saveVideos.checked = this.settings.saveVideos === true;

        // Notification settings
        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) enableNotifications.checked = this.settings.enableNotifications !== false;
    }

    async loadPosts(filters = {}) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getPosts',
                filters: {
                    ...filters,
                    page: this.currentPage,
                    limit: this.postsPerPage
                }
            });

            if (response.success) {
                this.currentPosts = response.data.posts;
                this.totalPosts = response.data.totalCount;
                this.displayPosts(this.currentPosts);
                this.updatePagination(response.data);
                this.populateAuthorFilter();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showNotification('Error loading posts', 'error');
        }
    }

    displayPosts(posts) {
        const container = document.getElementById('postsContainer');
        const loading = document.getElementById('postsLoading');

        if (loading) loading.style.display = 'none';

        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No Posts Found</div>
            <div class="empty-state-description">
              Visit LinkedIn and scroll through your feed to start saving posts automatically.
            </div>
          </div>
        `;
            return;
        }

        container.innerHTML = posts.map(post => this.createPostHTML(post)).join('');

        // Add click handlers for post items
        container.querySelectorAll('.post-item').forEach((item, index) => {
            item.addEventListener('click', () => this.openPost(posts[index]));
        });
    }

    createPostHTML(post) {
        const formattedDate = this.formatDate(post.savedAt || post.timestamp);
        const authorAvatar = post.author?.avatar || '/api/placeholder/40/40';
        const authorName = post.author?.name || 'Unknown Author';
        const authorTitle = post.author?.title || '';
        const postTitle = post.title || 'LinkedIn Post';
        const postText = post.text || '';
        const mediaCount = post.media ? post.media.length : 0;

        return `
        <div class="post-item" data-post-id="${post.id}">
          <div class="post-header">
            <img src="${authorAvatar}" alt="${authorName}" class="post-avatar" 
                 onerror="this.src='/api/placeholder/40/40'">
            <div class="post-author">
              <div class="post-author-name">${this.escapeHtml(authorName)}</div>
              ${authorTitle ? `<div class="post-author-title">${this.escapeHtml(authorTitle)}</div>` : ''}
            </div>
            <div class="post-date">${formattedDate}</div>
          </div>
          
          <div class="post-content">
            <div class="post-title">${this.escapeHtml(postTitle)}</div>
            ${postText ? `<div class="post-text">${this.escapeHtml(postText)}</div>` : ''}
          </div>
          
          ${this.createMediaHTML(post.media)}
          
          <div class="post-actions">
            <div class="post-engagement">
              ${post.engagement?.likes ? `👍 ${post.engagement.likes}` : ''}
              ${post.engagement?.comments ? `💬 ${post.engagement.comments}` : ''}
              ${post.engagement?.shares ? `🔄 ${post.engagement.shares}` : ''}
              ${mediaCount > 0 ? `📎 ${mediaCount} media` : ''}
            </div>
            ${post.postUrl ?
                `<a href="${post.postUrl}" target="_blank" class="post-link" onclick="event.stopPropagation()">
                View Original
              </a>` : ''
            }
          </div>
        </div>
      `;
    }

    createMediaHTML(media) {
        if (!media || media.length === 0) return '';

        const mediaItems = media.slice(0, 3).map(item => {
            if (item.type === 'image') {
                return `<img src="${item.url}" alt="${item.alt || ''}" class="post-media-item" 
                       onerror="this.style.display='none'">`;
            }
            return '';
        }).join('');

        const moreCount = media.length > 3 ? media.length - 3 : 0;

        return `
        <div class="post-media">
          ${mediaItems}
          ${moreCount > 0 ? `<div class="post-media-more">+${moreCount} more</div>` : ''}
        </div>
      `;
    }

    populateAuthorFilter() {
        const authorFilter = document.getElementById('authorFilter');
        if (!authorFilter) return;

        const authors = new Set();
        this.currentPosts.forEach(post => {
            if (post.author?.name) {
                authors.add(post.author.name);
            }
        });

        const currentValue = authorFilter.value;
        authorFilter.innerHTML = '<option value="">All authors</option>';

        Array.from(authors).sort().forEach(author => {
            const option = document.createElement('option');
            option.value = author;
            option.textContent = author;
            authorFilter.appendChild(option);
        });

        authorFilter.value = currentValue;
    }

    async updateHeaderStats() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStats' });

            if (response.success) {
                const stats = response.data;
                const totalPostsElement = document.getElementById('totalPosts');
                if (totalPostsElement) {
                    totalPostsElement.textContent = `${stats.totalPosts} posts`;
                }
            }
        } catch (error) {
            console.error('Error updating header stats:', error);
        }
    }

    updatePagination(data) {
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        if (prevButton) {
            prevButton.disabled = data.page <= 1;
        }

        if (nextButton) {
            nextButton.disabled = !data.hasMore;
        }

        if (pageInfo) {
            const totalPages = Math.ceil(data.totalCount / data.limit);
            pageInfo.textContent = `Page ${data.page} of ${totalPages}`;
        }
    }

    setupTabNavigation() {
        // Set initial active tab
        this.switchTab(this.currentTab);
    }

    switchTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.getElementById(tabName)?.classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        try {
            switch (tabName) {
                case 'saved-posts':
                    await this.loadPosts();
                    break;
                case 'search':
                    // Search tab doesn't need initial loading
                    break;
                case 'stats':
                    await this.loadStats();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
        }
    }

    async loadStats() {
        try {
            this.showLoading('Loading statistics...');

            const response = await chrome.runtime.sendMessage({ action: 'getStats' });

            if (response.success) {
                this.displayStats(response.data);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showNotification('Error loading statistics', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayStats(stats) {
        // Update stat cards
        const statElements = {
            'statTotalPosts': stats.totalPosts,
            'statPostsToday': stats.postsToday,
            'statPostsWeek': stats.postsThisWeek,
            'statPostsMonth': stats.postsThisMonth,
            'statWithMedia': stats.postsWithMedia,
            'statAuthors': stats.uniqueAuthors
        };

        Object.entries(statElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value || 0;
        });

        // Update storage info
        const storageUsed = document.getElementById('storageUsed');
        if (storageUsed && stats.storageSize) {
            storageUsed.textContent = stats.storageSize.formatted;
        }

        const oldestPost = document.getElementById('oldestPost');
        if (oldestPost) {
            oldestPost.textContent = stats.oldestPost ?
                this.formatDate(stats.oldestPost) : '-';
        }

        const newestPost = document.getElementById('newestPost');
        if (newestPost) {
            newestPost.textContent = stats.newestPost ?
                this.formatDate(stats.newestPost) : '-';
        }
    }

    async performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        if (!searchInput || !searchResults) return;

        const query = searchInput.value.trim();

        if (query.length === 0) {
            searchResults.innerHTML = `
          <div class="search-placeholder">
            <p>🔍 Enter a search term to find your saved posts</p>
          </div>
        `;
            return;
        }

        try {
            this.showLoading('Searching posts...');

            const filters = {
                hasMedia: document.getElementById('searchWithMedia')?.checked
            };

            const response = await chrome.runtime.sendMessage({
                action: 'searchPosts',
                query: query,
                filters: filters
            });

            if (response.success) {
                this.displaySearchResults(response.data.posts, query);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error searching posts:', error);
            this.showNotification('Error searching posts', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displaySearchResults(posts, query) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No Results Found</div>
            <div class="empty-state-description">
              No posts found matching "${this.escapeHtml(query)}". Try different keywords.
            </div>
          </div>
        `;
            return;
        }

        container.innerHTML = `
        <div class="search-summary">
          <p>Found ${posts.length} posts matching "${this.escapeHtml(query)}"</p>
        </div>
        ${posts.map(post => this.createPostHTML(post)).join('')}
      `;

        // Add click handlers
        container.querySelectorAll('.post-item').forEach((item, index) => {
            item.addEventListener('click', () => this.openPost(posts[index]));
        });
    }

    async filterPosts() {
        const authorFilter = document.getElementById('authorFilter');
        const dateFilter = document.getElementById('dateFilter');

        const filters = {};

        if (authorFilter?.value) {
            filters.author = authorFilter.value;
        }

        if (dateFilter?.value) {
            const now = new Date();
            switch (dateFilter.value) {
                case 'today':
                    filters.dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case 'week':
                    filters.dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString();
                    break;
                case 'month':
                    filters.dateFrom = new Date(now.setDate(now.getDate() - 30)).toISOString();
                    break;
            }
        }

        this.currentPage = 1;
        await this.loadPosts(filters);
    }

    async refreshPosts() {
        this.currentPage = 1;
        await this.loadPosts();
        await this.updateHeaderStats();
        this.showNotification('Posts refreshed successfully');
    }

    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.loadPosts();
        }
    }

    async nextPage() {
        this.currentPage++;
        await this.loadPosts();
    }

    async saveSettings() {
        try {
            const newSettings = {
                maxPosts: parseInt(document.getElementById('maxPosts')?.value) || 1000,
                autoCleanup: document.getElementById('autoCleanup')?.checked,
                cleanupDays: parseInt(document.getElementById('cleanupDays')?.value) || 30,
                saveImages: document.getElementById('saveImages')?.checked,
                saveVideos: document.getElementById('saveVideos')?.checked,
                enableNotifications: document.getElementById('enableNotifications')?.checked
            };

            const response = await chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: newSettings
            });

            if (response.success) {
                this.settings = newSettings;
                this.showNotification('Settings saved successfully');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Error saving settings', 'error');
        }
    }

    async exportPosts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'exportPosts' });

            if (response.success) {
                this.downloadJSON(response.data, `linkedin-posts-${new Date().toISOString().split('T')[0]}.json`);
                this.showNotification('Posts exported successfully');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error exporting posts:', error);
            this.showNotification('Error exporting posts', 'error');
        }
    }

    async exportAllPosts() {
        await this.exportPosts();
    }

    importPosts() {
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);

            const response = await chrome.runtime.sendMessage({
                action: 'importPosts',
                data: data
            });

            if (response.success) {
                this.showNotification('Posts imported successfully');
                await this.refreshPosts();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error importing posts:', error);
            this.showNotification('Error importing posts. Please check the file format.', 'error');
        }
    }

    async cleanupOldPosts() {
        if (!confirm('This will remove old posts according to your cleanup settings. Continue?')) {
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'cleanup' });

            if (response.success) {
                this.showNotification('Old posts cleaned up successfully');
                await this.refreshPosts();
                await this.loadStats();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error cleaning up posts:', error);
            this.showNotification('Error cleaning up posts', 'error');
        }
    }

    async clearAllData() {
        if (!confirm('⚠️ This will permanently delete ALL saved posts and settings. This action cannot be undone. Are you sure?')) {
            return;
        }

        if (!confirm('Last warning: This will delete EVERYTHING. Continue?')) {
            return;
        }

        try {
            // Note: We'd need to add this action to background script
            const response = await chrome.runtime.sendMessage({ action: 'clearAllData' });

            if (response.success) {
                this.showNotification('All data cleared successfully');
                await this.loadInitialData();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            this.showNotification('Error clearing data', 'error');
        }
    }

    async openPost(post) {
        if (post.postUrl) {
            chrome.tabs.create({ url: post.postUrl });
        } else if (post.url) {
            chrome.tabs.create({ url: post.url });
        } else {
            this.showNotification('No URL available for this post', 'warning');
        }
    }

    async openLinkedIn() {
        chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
    }

    // Utility Methods

    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');

        if (overlay) {
            overlay.classList.remove('hidden');
            if (loadingText) loadingText.textContent = text;
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'success') {
        const toast = document.getElementById('notificationToast');
        const text = document.getElementById('notificationText');

        if (!toast || !text) return;

        // Remove existing type classes
        toast.classList.remove('error', 'warning', 'success');

        // Add new type class
        if (type !== 'success') {
            toast.classList.add(type);
        }

        text.textContent = message;
        toast.classList.remove('hidden');

        // Auto hide after 3 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 3000);
    }

    hideNotification() {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.classList.add('hidden');
        }
    }

    // Consent management methods
    reviewConsent() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('consent-dialog.html'),
            active: true
        });
    }

    async revokeConsent() {
        if (!confirm('⚠️ Are you sure you want to revoke consent?\n\nThis will:\n• Stop saving new posts\n• Keep existing data (unless you delete it)\n• Require consent again to resume\n\nContinue?')) {
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'setUserConsent',
                consent: false
            });

            if (response && response.success) {
                this.showNotification('Consent revoked successfully');
                await this.loadConsentStatus();

                // Update user consent status
                this.userConsent = false;

                // Show consent required message
                setTimeout(() => {
                    this.showConsentRequired();
                }, 1500);
            } else {
                throw new Error('Failed to revoke consent');
            }
        } catch (error) {
            console.error('Error revoking consent:', error);
            this.showNotification('Error revoking consent', 'error');
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});