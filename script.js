/* ============================================
   ÇIĞLIKLAR - Korku Hikayeleri Forumu
   JavaScript Ana Dosyası - Appwrite Entegrasyonu
   ============================================ */

// Appwrite Yapılandırması
const appwriteConfig = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',  // Appwrite Cloud Endpoint
    projectId: '698ecbb3001caa15230d',               // Appwrite Project ID'nizi yazın
    databaseId: '698ecc40000c1666bb9e',             // Database ID'nizi yazın
    // Koleksiyon kimlikleri
    usersCollectionId: 'users',
    storiesCollectionId: 'stories',
    chatsCollectionId: 'chats'
};

// Appwrite İstemci Başlatma - SDK yüklendikten sonra
let client, account, databases;
let currentUser = null;
let isInitialized = false;

// Ana Uygulama Nesnesi
const app = {
    // ===== Başlatma =====
    init: async function() {
        try {
            // SDK'nın yüklenmesini bekle
            if (typeof Appwrite === 'undefined') {
                setTimeout(() => this.init(), 100);
                return;
            }

            // Appwrite İstemcisini Başlat
            const { Client, Account, Databases } = Appwrite;
            client = new Client();
            account = new Account(client);
            databases = new Databases(client);

            client
                .setEndpoint(appwriteConfig.endpoint)
                .setProject(appwriteConfig.projectId);

            isInitialized = true;

            // Mevcut oturumu kontrol et
            await this.checkSession();
            
            // Event Listeners ekle
            this.setupEventListeners();
            
            // Sayfa ticarı yükle
            await this.loadHomeStats();

            console.log('✓ Appwrite başarıyla başlatıldı');
        } catch (error) {
            console.error('✗ Appwrite başlatma hatası:', error);
            this.showNotification('Bağlantı hatası: Appwrite ayarlarını kontrol edin', 'error');
        }
    },

    // ===== Session Yönetimi =====
    checkSession: async function() {
        try {
            const session = await account.get();
            currentUser = session;
            await this.loadUserProfile();
            this.updateUI();
            return true;
        } catch (error) {
            currentUser = null;
            this.updateUI();
            return false;
        }
    },

    updateUI: function() {
        const userStatus = document.getElementById('userStatus');
        const logoutBtn = document.getElementById('logoutBtn');
        const chatLink = document.getElementById('chatLink');
        const profileLink = document.getElementById('profileLink');
        const adminLink = document.getElementById('adminLink');
        const storyLink = document.querySelector('[data-page="stories"]');

        if (currentUser) {
            userStatus.textContent = `◆ ${currentUser.name || currentUser.email}`;
            logoutBtn.style.display = 'inline-block';
            chatLink.style.pointerEvents = 'auto';
            profileLink.style.pointerEvents = 'auto';
            storyLink.style.pointerEvents = 'auto';
            
            // Admin panelini kontrol et
            this.checkAdminStatus();
        } else {
            userStatus.textContent = 'Giriş yapmamış';
            logoutBtn.style.display = 'none';
            chatLink.style.pointerEvents = 'none';
            profileLink.style.pointerEvents = 'none';
            storyLink.style.pointerEvents = 'none';
            adminLink.style.display = 'none';
        }
    },

    // ===== Doğrulama İşlemleri =====
    login: async function() {
        // Appwrite hazır mı kontrol et
        if (!isInitialized || !account) {
            this.showNotification('Sistem henüz hazırlanmıyor, lütfen bekleyin...', 'error');
            return;
        }

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showNotification('Lütfen e-posta ve şifre girin', 'error');
            return;
        }

        try {
            const session = await account.createEmailPasswordSession(email, password);
            currentUser = session;
            await this.loadUserProfile();
            this.updateUI();
            this.showNotification('✓ Giriş başarılı!', 'success');
            
            // Formu temizle
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            
            // Ana sayfaya yönlendir
            this.showPage('home');
        } catch (error) {
            console.error('Giriş hatası:', error);
            this.showNotification('Hatalı e-posta veya şifre', 'error');
        }
    },

    register: async function() {
        // Appwrite hazır mı kontrol et
        if (!isInitialized || !account) {
            this.showNotification('Sistem henüz hazırlanmıyor, lütfen bekleyin...', 'error');
            return;
        }

        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

        if (!username || !email || !password || !passwordConfirm) {
            this.showNotification('Tüm alanları doldurun', 'error');
            return;
        }

        if (password !== passwordConfirm) {
            this.showNotification('Şifreler eşleşmiyor', 'error');
            return;
        }

        if (password.length < 8) {
            this.showNotification('Şifre en az 8 karakter olmalı', 'error');
            return;
        }

        try {
            // Appwrite'da kullanıcı oluştur
            const user = await account.create(
                'unique()',
                email,
                password,
                username
            );

            // Otomatik olarak giriş yap
            const session = await account.createEmailPasswordSession(email, password);
            currentUser = session;

            // Veritabanında kullanıcı profili oluştur
            await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                user.$id,
                {
                    userId: user.$id,
                    username: username,
                    email: email,
                    storyCount: 0,
                    likeCount: 0,
                    joinDate: new Date().toISOString(),
                    avatar: '👥'
                }
            );

            await this.loadUserProfile();
            this.updateUI();
            this.showNotification('✓ Kaydı tamamlandı!', 'success');

            // Formu temizle
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerPasswordConfirm').value = '';

            // Ana sayfaya yönlendir
            this.showPage('home');
        } catch (error) {
            console.error('Kayıt hatası:', error);
            if (error.message.includes('already exists')) {
                this.showNotification('Bu e-posta zaten kullanılıyor', 'error');
            } else {
                this.showNotification('Kayıt hatası: ' + error.message, 'error');
            }
        }
    },

    logout: async function() {
        try {
            await account.deleteSession('current');
            currentUser = null;
            this.updateUI();
            this.showNotification('✓ Çıkış yapıldı', 'success');
            this.showPage('home');
        } catch (error) {
            console.error('Çıkış hatası:', error);
            this.showNotification('Çıkış hatası', 'error');
        }
    },

    // ===== Hikaye İşlemleri =====
    saveStory: async function() {
        if (!currentUser) {
            this.showNotification('Hikaye paylaşmak için giriş yapın', 'error');
            return;
        }

        const title = document.getElementById('storyTitle').value.trim();
        const content = document.getElementById('storyContent').value.trim();

        if (!title || !content) {
            this.showNotification('Başlık ve içerik zorunludur', 'error');
            return;
        }

        try {
            const story = await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                'unique()',
                {
                    authorId: currentUser.$id,
                    authorName: currentUser.name || currentUser.email,
                    title: title,
                    content: content,
                    createdAt: new Date().toISOString(),
                    likes: [],
                    bookmarks: []
                }
            );

            // Kullanıcı hikaye sayısını artır
            await this.incrementUserStoryCount();

            this.showNotification('✓ Hikaye paylaşıldı!', 'success');
            
            // Formu temizle
            document.getElementById('storyTitle').value = '';
            document.getElementById('storyContent').value = '';
            this.toggleStoryForm();

            // Hikaye listesini yenile
            this.loadStories();
        } catch (error) {
            console.error('Hikaye kayıt hatası:', error);
            this.showNotification('Hikaye paylaşılamadı', 'error');
        }
    },

    loadStories: async function(searchTerm = '') {
        try {
            let response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            let stories = response.documents;

            // Ara filtresi uygula
            if (searchTerm) {
                stories = stories.filter(story =>
                    story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    story.authorName.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }

            // En yeni hikayeleri ilk göster
            stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const storiesContainer = document.getElementById('storiesList');
            if (!storiesContainer) return;

            storiesContainer.innerHTML = '';

            if (stories.length === 0) {
                storiesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">Henüz hikaye yok...</p>';
                return;
            }

            stories.forEach(story => {
                const storyCard = this.createStoryCard(story);
                storiesContainer.appendChild(storyCard);
            });

            // Ön izlemede de göster
            this.loadStoriesToHome();
        } catch (error) {
            console.error('Hikaye yükleme hatası:', error);
        }
    },

    createStoryCard: function(story) {
        const card = document.createElement('div');
        card.className = 'story-card';
        card.dataset.storyId = story.$id;

        const isLiked = story.likes && story.likes.includes(currentUser?.$id);
        const isBookmarked = story.bookmarks && story.bookmarks.includes(currentUser?.$id);

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="story-title">${this.escapeHtml(story.title)}</div>
            <div class="story-author">✍️ ${this.escapeHtml(story.authorName)}</div>
            <div class="story-date">📅 ${new Date(story.createdAt).toLocaleDateString('tr-TR')}</div>
            <div class="story-content">${this.escapeHtml(story.content)}</div>
            <div class="story-actions">
                <button class="story-btn ${isLiked ? 'liked' : ''}" onclick="app.toggleLike('${story.$id}', event)">
                    ❤️ Beğen ${story.likes ? `(${story.likes.length})` : '(0)'}
                </button>
                <button class="story-btn ${isBookmarked ? 'bookmarked' : ''}" onclick="app.toggleBookmark('${story.$id}', event)">
                    🔖 Kaydet
                </button>
                ${currentUser && (currentUser.$id === story.authorId || currentUser.labels?.includes('admin')) ? `
                    <button class="story-btn" onclick="app.editStory('${story.$id}', event)">✏️ Düzenle</button>
                    <button class="story-btn" onclick="app.deleteStory('${story.$id}', event)">🗑️ Sil</button>
                ` : ''}
                <button class="story-btn" onclick="app.showStoryDetail('${story.$id}', event)">👁️ Oku</button>
            </div>
        `;

        card.appendChild(content);
        return card;
    },

    showStoryDetail: async function(storyId, event) {
        event.preventDefault();
        event.stopPropagation();

        try {
            const story = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId
            );

            const modal = document.createElement('div');
            modal.className = 'story-detail active';
            modal.id = `modal-${storyId}`;

            const isLiked = story.likes && story.likes.includes(currentUser?.$id);
            const isBookmarked = story.bookmarks && story.bookmarks.includes(currentUser?.$id);

            const detailContent = `
                <div class="story-detail-content">
                    <button class="story-close" onclick="document.getElementById('modal-${storyId}').remove()">✕</button>
                    <h2 class="story-detail-title">${this.escapeHtml(story.title)}</h2>
                    <div class="story-detail-meta">
                        <strong>Yazar:</strong> ${this.escapeHtml(story.authorName)} | 
                        <strong>Tarih:</strong> ${new Date(story.createdAt).toLocaleString('tr-TR')}
                    </div>
                    <div class="story-detail-content-text">${this.escapeHtml(story.content)}</div>
                    <div class="story-detail-actions">
                        <button class="btn btn-primary ${isLiked ? 'liked' : ''}" onclick="app.toggleLike('${story.$id}')">
                            ❤️ Beğen (${story.likes ? story.likes.length : 0})
                        </button>
                        <button class="btn btn-primary ${isBookmarked ? 'bookmarked' : ''}" onclick="app.toggleBookmark('${story.$id}')">
                            🔖 Kaydet
                        </button>
                        ${currentUser && (currentUser.$id === story.authorId || currentUser.labels?.includes('admin')) ? `
                            <button class="btn btn-secondary" onclick="app.editStory('${story.$id}')">✏️ Düzenle</button>
                            <button class="btn btn-danger" onclick="app.deleteStory('${story.$id}')">🗑️ Sil</button>
                        ` : ''}
                    </div>
                </div>
            `;

            modal.innerHTML = detailContent;
            document.body.appendChild(modal);

            // Dışarıya tıklanırsa kapat
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        } catch (error) {
            console.error('Hikaye detay hatası:', error);
            this.showNotification('Hikaye yüklenemedi', 'error');
        }
    },

    toggleLike: async function(storyId, event) {
        if (event) event.preventDefault();
        if (!currentUser) {
            this.showNotification('Beğenmek için giriş yapın', 'error');
            return;
        }

        try {
            const story = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId
            );

            let likes = story.likes || [];
            const index = likes.indexOf(currentUser.$id);

            if (index > -1) {
                likes.splice(index, 1);
            } else {
                likes.push(currentUser.$id);
            }

            await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId,
                { likes }
            );

            // Hikaye listesini yenile
            this.loadStories();
            this.loadStoriesToHome();
        } catch (error) {
            console.error('Beğeni hatası:', error);
            this.showNotification('Beğeni işlemi başarısız', 'error');
        }
    },

    toggleBookmark: async function(storyId, event) {
        if (event) event.preventDefault();
        if (!currentUser) {
            this.showNotification('Kaydetmek için giriş yapın', 'error');
            return;
        }

        try {
            const story = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId
            );

            let bookmarks = story.bookmarks || [];
            const index = bookmarks.indexOf(currentUser.$id);

            if (index > -1) {
                bookmarks.splice(index, 1);
            } else {
                bookmarks.push(currentUser.$id);
            }

            await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId,
                { bookmarks }
            );

            this.loadStories();
            if (document.getElementById('profilePage').style.display !== 'none') {
                this.loadBookmarkedStories();
            }
        } catch (error) {
            console.error('Bookmark hatası:', error);
            this.showNotification('Kaydetme başarısız', 'error');
        }
    },

    editStory: async function(storyId, event) {
        if (event) event.preventDefault();
        
        try {
            const story = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId
            );

            // Yetkilendirme kontrolü: Sadece yazar veya admin düzenleyebilir
            if (!currentUser) {
                this.showNotification('Düzenlemek için giriş yapın', 'error');
                return;
            }

            if (currentUser.$id !== story.authorId && !currentUser.labels?.includes('admin')) {
                this.showNotification('Sadece kendi hikayeni düzenleyebilirsin', 'error');
                return;
            }

            const newTitle = prompt('Yeni başlık:', story.title);
            if (newTitle === null) return;

            const newContent = prompt('Yeni içerik:', story.content);
            if (newContent === null) return;

            await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId,
                storyId,
                {
                    title: newTitle,
                    content: newContent
                }
            );

            this.showNotification('✓ Hikaye güncellendi', 'success');
            this.loadStories();
            this.loadStoriesToHome();
        } catch (error) {
            console.error('Hikaye düzenleme hatası:', error);
            this.showNotification('Düzenleme başarısız', 'error');
        }
    },

    deleteStory: function(storyId, event) {
        if (event) event.preventDefault();
        
        // Yetkilendirme kontrolü: Sadece yazar veya admin silebilir
        if (!currentUser) {
            this.showNotification('Silmek için giriş yapın', 'error');
            return;
        }

        // Hikaye bulup kontrol et
        databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.storiesCollectionId,
            storyId
        ).then(story => {
            if (currentUser.$id !== story.authorId && !currentUser.labels?.includes('admin')) {
                this.showNotification('Sadece kendi hikayeni silebilirsin', 'error');
                return;
            }

            this.pendingDelete = { type: 'story', id: storyId };
            document.getElementById('deleteConfirmMessage').textContent = 'Bu hikayeyi silmek istediğine emin misin? Bu işlem geri alınamaz.';
            document.getElementById('deleteConfirmModal').classList.add('active');
        }).catch(error => {
            console.error('Hikaye kontrol hatası:', error);
            this.showNotification('Hikaye bulunamadı', 'error');
        });
    },

    confirmDelete: async function() {
        if (!this.pendingDelete) return;

        try {
            if (this.pendingDelete.type === 'story') {
                await databases.deleteDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.storiesCollectionId,
                    this.pendingDelete.id
                );
                this.showNotification('✓ Hikaye silindi', 'success');
                this.loadStories();
                this.loadStoriesToHome();
            } else if (this.pendingDelete.type === 'message') {
                await databases.deleteDocument(
                    appwriteConfig.databaseId,
                    appwriteConfig.chatsCollectionId,
                    this.pendingDelete.id
                );
                this.showNotification('✓ Mesaj silindi', 'success');
                this.loadMessages();
            }
        } catch (error) {
            console.error('Silme hatası:', error);
            this.showNotification('Silme başarısız', 'error');
        }

        this.cancelDelete();
    },

    cancelDelete: function() {
        this.pendingDelete = null;
        document.getElementById('deleteConfirmModal').classList.remove('active');
    },

    incrementUserStoryCount: async function() {
        try {
            const userDoc = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                currentUser.$id
            );

            await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                currentUser.$id,
                {
                    storyCount: (userDoc.storyCount || 0) + 1
                }
            );
        } catch (error) {
            console.error('Hikaye sayısı güncelleme hatası:', error);
        }
    },

    // ===== Chat İşlemleri =====
    sendMessage: async function() {
        if (!currentUser) {
            this.showNotification('Chat için giriş yapın', 'error');
            return;
        }

        const messageInput = document.getElementById('chatInput');
        const messageText = messageInput.value.trim();

        if (!messageText) return;

        try {
            await databases.createDocument(
                appwriteConfig.databaseId,
                appwriteConfig.chatsCollectionId,
                'unique()',
                {
                    authorId: currentUser.$id,
                    authorName: currentUser.name || currentUser.email,
                    content: messageText,
                    createdAt: new Date().toISOString()
                }
            );

            messageInput.value = '';
            this.loadMessages();
        } catch (error) {
            console.error('Mesaj gönderme hatası:', error);
            this.showNotification('Mesaj gönderilemedi', 'error');
        }
    },

    loadMessages: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.chatsCollectionId
            );

            const messages = response.documents.sort((a, b) =>
                new Date(a.createdAt) - new Date(b.createdAt)
            );

            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';

            messages.forEach(msg => {
                const messageEl = document.createElement('div');
                messageEl.className = 'chat-message';

                const date = new Date(msg.createdAt);
                const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                messageEl.innerHTML = `
                    <div class="chat-author">${this.escapeHtml(msg.authorName)}</div>
                    <div class="chat-time">${timeStr}</div>
                    <div class="chat-text">${this.escapeHtml(msg.content)}</div>
                    ${currentUser && (currentUser.$id === msg.authorId || currentUser.labels?.includes('admin')) ? `
                        <button class="story-btn" onclick="app.deleteMessage('${msg.$id}', event)" style="margin-top: 8px; font-size: 0.75em;">🗑️ Sil</button>
                    ` : ''}
                `;

                chatMessages.appendChild(messageEl);
            });

            // Son mesaja kaydır
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('Mesaj yükleme hatası:', error);
        }
    },

    deleteMessage: function(messageId, event) {
        if (event) event.preventDefault();
        
        // Yetkilendirme kontrolü: Sadece yazar veya admin silebilir
        if (!currentUser) {
            this.showNotification('Silmek için giriş yapın', 'error');
            return;
        }

        // Mesajı bulup kontrol et
        databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.chatsCollectionId,
            messageId
        ).then(message => {
            if (currentUser.$id !== message.authorId && !currentUser.labels?.includes('admin')) {
                this.showNotification('Sadece kendi mesajını silebilirsin', 'error');
                return;
            }

            this.pendingDelete = { type: 'message', id: messageId };
            document.getElementById('deleteConfirmMessage').textContent = 'Bu mesajı silmek istediğine emin misin?';
            document.getElementById('deleteConfirmModal').classList.add('active');
        }).catch(error => {
            console.error('Mesaj kontrol hatası:', error);
            this.showNotification('Mesaj bulunamadı', 'error');
        });
    },

    // ===== Profil İşlemleri =====
    loadUserProfile: async function() {
        if (!currentUser) return;

        try {
            const userDoc = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                currentUser.$id
            );

            // Profil sayfasına yükle
            document.getElementById('profileUsername').textContent = userDoc.username || currentUser.email;
            document.getElementById('profileEmail').textContent = userDoc.email || currentUser.email;
            document.getElementById('profileStoryCount').textContent = userDoc.storyCount || 0;
            document.getElementById('profileLikeCount').textContent = userDoc.likeCount || 0;

            const joinDate = new Date(userDoc.joinDate).toLocaleDateString('tr-TR');
            document.getElementById('profileJoinDate').textContent = joinDate;

            // Düzenleme formu doldur
            document.getElementById('profileEditUsername').value = userDoc.username || '';
            document.getElementById('profileEditEmail').value = userDoc.email || '';

            // Profil düzenleme butonu
            const profileEditBtn = document.getElementById('profileEditBtn');
            profileEditBtn.innerHTML = '<button class="btn btn-secondary" onclick="app.toggleProfileEdit()">✏️ Profili Düzenle</button>';

            // Kullanıcı hikayelerini yükle
            await this.loadUserStories();
        } catch (error) {
            console.error('Profil yükleme hatası:', error);
        }
    },

    loadUserStories: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            const userStories = response.documents.filter(s => s.authorId === currentUser.$id);
            const userStoriesContainer = document.getElementById('userStories');

            userStoriesContainer.innerHTML = '';

            if (userStories.length === 0) {
                userStoriesContainer.innerHTML = '<p style="color: #999;">Henüz hikaye paylaşmadın...</p>';
                return;
            }

            userStories.forEach(story => {
                const storyCard = this.createStoryCard(story);
                userStoriesContainer.appendChild(storyCard);
            });
        } catch (error) {
            console.error('Kullanıcı hikayesi yükleme hatası:', error);
        }
    },

    loadBookmarkedStories: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            const bookmarked = response.documents.filter(s =>
                s.bookmarks && s.bookmarks.includes(currentUser.$id)
            );

            const bookmarkedContainer = document.getElementById('bookmarkedStories');
            bookmarkedContainer.innerHTML = '';

            if (bookmarked.length === 0) {
                document.getElementById('profileBookmarksSection').style.display = 'none';
                return;
            }

            document.getElementById('profileBookmarksSection').style.display = 'block';

            bookmarked.forEach(story => {
                const storyCard = this.createStoryCard(story);
                bookmarkedContainer.appendChild(storyCard);
            });
        } catch (error) {
            console.error('Bookmark yükleme hatası:', error);
        }
    },

    toggleProfileEdit: function() {
        const editForm = document.getElementById('profileEditForm');
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
    },

    updateProfile: async function() {
        if (!currentUser) return;

        const username = document.getElementById('profileEditUsername').value.trim();
        const email = document.getElementById('profileEditEmail').value.trim();

        if (!username || !email) {
            this.showNotification('Tüm alanları doldurun', 'error');
            return;
        }

        try {
            await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                currentUser.$id,
                {
                    username: username,
                    email: email
                }
            );

            // Appwrite kullanıcı adını güncelle
            if (username !== currentUser.name) {
                await account.updateName(username);
            }

            this.showNotification('✓ Profil güncellendi', 'success');
            await this.loadUserProfile();
            this.toggleProfileEdit();
        } catch (error) {
            console.error('Profil güncelleme hatası:', error);
            this.showNotification('Profil güncellemesi başarısız', 'error');
        }
    },

    loadOtherUserProfile: async function(userId) {
        // Bu fonksiyon profil sayfasında başka kullanıcı profili göstermek için kullanılabilir
        try {
            const userDoc = await databases.getDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                userId
            );

            // Profil bilgilerini göster
            document.getElementById('profileUsername').textContent = userDoc.username || userDoc.email;
            document.getElementById('profileEmail').textContent = userDoc.email;
            document.getElementById('profileStoryCount').textContent = userDoc.storyCount || 0;
            document.getElementById('profileLikeCount').textContent = userDoc.likeCount || 0;

            // Düzenleme butonunu gizle
            document.getElementById('profileEditBtn').innerHTML = '';

            // Kullanıcı hikayelerini yükle
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            const userStories = response.documents.filter(s => s.authorId === userId);
            const userStoriesContainer = document.getElementById('userStories');

            userStoriesContainer.innerHTML = '';
            userStories.forEach(story => {
                const storyCard = this.createStoryCard(story);
                userStoriesContainer.appendChild(storyCard);
            });
        } catch (error) {
            console.error('Diğer kullanıcı profili hatası:', error);
        }
    },

    // ===== Admin Paneli =====
    checkAdminStatus: async function() {
        if (!currentUser) return;

        try {
            const adminLink = document.getElementById('adminLink');
            // Not: Appwrite'da role sistemi kontrol et
            // Şimdilik manuel olarak admin kontrolü yapılacak
            // Gerçek uygulamada Appwrite teams kullanılabilir
            
            const adminEmails = ['ermirhansalman4@gmail.com']; // Admin e-postalarını burada belirt
            if (adminEmails.includes(currentUser.email)) {
                adminLink.style.display = 'block';
            }
        } catch (error) {
            console.error('Admin kontrol hatası:', error);
        }
    },

    showAdminTab: function(tabName) {
        // Tüm sekmeler gizle
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Seçili sekmeyi göster
        document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
        document.querySelector(`[onclick*="'${tabName}'"]`).classList.add('active');

        // İçeriği yükle
        if (tabName === 'users') {
            this.loadAdminUsers();
        } else if (tabName === 'stories') {
            this.loadAdminStories();
        } else if (tabName === 'messages') {
            this.loadAdminMessages();
        }
    },

    loadAdminUsers: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId
            );

            const usersList = document.getElementById('adminUsersList');
            usersList.innerHTML = '';

            if (response.documents.length === 0) {
                usersList.innerHTML = '<p style="color: #999;">Kullanıcı yok</p>';
                return;
            }

            response.documents.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'admin-item';
                userItem.innerHTML = `
                    <div class="admin-item-info">
                        <div class="admin-item-title">${this.escapeHtml(user.username || user.email)}</div>
                        <div class="admin-item-meta">${user.email} | ${user.storyCount || 0} hikaye</div>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-btn" onclick="app.viewUserProfile('${user.userId}')">👁️ Profil</button>
                        <button class="admin-btn admin-btn-danger" onclick="app.adminDeleteUser('${user.userId}')">🗑️ Sil</button>
                    </div>
                `;
                usersList.appendChild(userItem);
            });

            document.getElementById('adminUserCount').textContent = response.documents.length;
        } catch (error) {
            console.error('Admin kullanıcı yükleme hatası:', error);
        }
    },

    loadAdminStories: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            const storiesList = document.getElementById('adminStoriesList');
            storiesList.innerHTML = '';

            if (response.documents.length === 0) {
                storiesList.innerHTML = '<p style="color: #999;">Hikaye yok</p>';
                return;
            }

            response.documents.forEach(story => {
                const storyItem = document.createElement('div');
                storyItem.className = 'admin-item';
                storyItem.innerHTML = `
                    <div class="admin-item-info">
                        <div class="admin-item-title">${this.escapeHtml(story.title)}</div>
                        <div class="admin-item-meta">Yazar: ${this.escapeHtml(story.authorName)} | ${new Date(story.createdAt).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-btn" onclick="app.showStoryDetail('${story.$id}')">👁️ Oku</button>
                        <button class="admin-btn" onclick="app.editStory('${story.$id}')">✏️ Düzenle</button>
                        <button class="admin-btn admin-btn-danger" onclick="app.deleteStory('${story.$id}')">🗑️ Sil</button>
                    </div>
                `;
                storiesList.appendChild(storyItem);
            });

            document.getElementById('adminStoryCount').textContent = response.documents.length;
        } catch (error) {
            console.error('Admin hikaye yükleme hatası:', error);
        }
    },

    loadAdminMessages: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.chatsCollectionId
            );

            const messagesList = document.getElementById('adminMessagesList');
            messagesList.innerHTML = '';

            if (response.documents.length === 0) {
                messagesList.innerHTML = '<p style="color: #999;">Mesaj yok</p>';
                return;
            }

            response.documents.forEach(msg => {
                const msgItem = document.createElement('div');
                msgItem.className = 'admin-item';
                msgItem.innerHTML = `
                    <div class="admin-item-info">
                        <div class="admin-item-title">${this.escapeHtml(msg.authorName)}</div>
                        <div class="admin-item-meta">${this.escapeHtml(msg.content.substring(0, 50))}... | ${new Date(msg.createdAt).toLocaleString('tr-TR')}</div>
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-btn admin-btn-danger" onclick="app.deleteMessage('${msg.$id}')">🗑️ Sil</button>
                    </div>
                `;
                messagesList.appendChild(msgItem);
            });

            document.getElementById('adminMessageCount').textContent = response.documents.length;
        } catch (error) {
            console.error('Admin mesaj yükleme hatası:', error);
        }
    },

    adminDeleteUser: async function(userId) {
        if (!confirm('Bu kullanıcıyı silmek istediğine emin misin?')) return;

        try {
            await databases.deleteDocument(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId,
                userId
            );
            this.showNotification('✓ Kullanıcı silindi', 'success');
            this.loadAdminUsers();
        } catch (error) {
            console.error('Kullanıcı silme hatası:', error);
            this.showNotification('Silme başarısız', 'error');
        }
    },

    viewUserProfile: function(userId) {
        this.loadOtherUserProfile(userId);
        this.showPage('profile');
    },

    // ===== Sayfa Navigasyonu =====
    showPage: function(pageName) {
        // Tüm sayfaları gizle
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Seçilmiş sayfayı göster
        const pagePath = `${pageName}-page`;
        const page = document.getElementById(pagePath);
        if (page) page.classList.add('active');

        // Nav linklerini güncelle
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageName) {
                link.classList.add('active');
            }
        });

        // Sayfa özel yükleme işlemleri
        if (pageName === 'stories') {
            this.loadStories();
        } else if (pageName === 'chat') {
            if (!currentUser) {
                this.showNotification('Chat için giriş yapın', 'error');
                this.showPage('auth');
                return;
            }
            this.loadMessages();

            // Her 2 saniyede bir mesajları yenile (realtime simulasyonu)
            if (!this.messageRefreshInterval) {
                this.messageRefreshInterval = setInterval(() => {
                    if (document.getElementById('chat-page').classList.contains('active')) {
                        this.loadMessages();
                    }
                }, 2000);
            }
        } else if (pageName === 'profile') {
            if (!currentUser) {
                this.showNotification('Profil görüntülemek için giriş yapın', 'error');
                this.showPage('auth');
                return;
            }
            this.loadUserProfile();
            this.loadBookmarkedStories();
        } else if (pageName === 'admin') {
            if (!currentUser || document.getElementById('adminLink').style.display === 'none') {
                this.showNotification('Yetkilendirme hatası', 'error');
                this.showPage('home');
                return;
            }
            this.loadAdminUsers();
        }

        // Sidebar'ı kapat (mobil)
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    },

    toggleAuthForm: function(event) {
        event.preventDefault();
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        loginForm.classList.toggle('active-form');
        registerForm.classList.toggle('active-form');
    },

    toggleStoryForm: function() {
        const formContainer = document.getElementById('storyFormContainer');
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
    },

    // ===== Yardımcı Fonksiyonlar =====
    loadStoriesToHome: async function() {
        try {
            const response = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            let stories = response.documents;
            stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // Son 6 hikayeyi göster
            const featured = stories.slice(0, 6);
            const featuredContainer = document.getElementById('featuredStories');

            if (!featuredContainer) return;
            featuredContainer.innerHTML = '';

            featured.forEach(story => {
                const storyCard = this.createStoryCard(story);
                featuredContainer.appendChild(storyCard);
            });
        } catch (error) {
            console.error('Home hikaye yükleme hatası:', error);
        }
    },

    loadHomeStats: async function() {
        try {
            const usersResponse = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.usersCollectionId
            );

            const storiesResponse = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.storiesCollectionId
            );

            const chatsResponse = await databases.listDocuments(
                appwriteConfig.databaseId,
                appwriteConfig.chatsCollectionId
            );

            document.getElementById('totalUsers').textContent = usersResponse.total || 0;
            document.getElementById('totalStories').textContent = storiesResponse.total || 0;
            document.getElementById('totalMessages').textContent = chatsResponse.total || 0;

            this.loadStoriesToHome();
        } catch (error) {
            console.error('Stats yükleme hatası:', error);
        }
    },

    setupEventListeners: function() {
        // Logout butonunu
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Navbar linklerini
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageName = link.dataset.page;
                
                if (pageName === 'auth' && !currentUser) {
                    this.showPage('auth');
                } else if (pageName !== 'auth') {
                    this.showPage(pageName);
                }
            });
        });

        // Mobil sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('open');
            });
        }

        // Hikaye arama
        const searchStories = document.getElementById('searchStories');
        if (searchStories) {
            let searchTimeout;
            searchStories.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.loadStories(e.target.value);
                }, 300);
            });
        }

        // Enter tuşu ile mesaj gönder
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Hero login butonu
        const heroLoginBtn = document.getElementById('heroLoginBtn');
        if (heroLoginBtn && currentUser) {
            heroLoginBtn.style.display = 'none';
        }
    },

    showNotification: function(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    },

    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};

// ===== Uygulama Başlatma =====
document.addEventListener('DOMContentLoaded', async () => {
    await app.init();
});

// Bonus: Hata ele alma
window.addEventListener('error', (e) => {
    console.error('Genel hata:', e.error);
});
