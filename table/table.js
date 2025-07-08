let rankingData = [];

// Variable pour suivre l'état du tri
let currentSort = {
    column: null,
    direction: 'desc' // 'asc' ou 'desc'
};

// Récupération des données
document.addEventListener('DOMContentLoaded', () => {
    fetch('https://raw.githubusercontent.com/guezito-dev/ethos/main/gigachads-ranking.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            rankingData = data.ranking;
            // Tri initial par rang
            currentSort = { column: 'rank', direction: 'asc' };
            renderTable(rankingData);
            updateSortArrows();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des données:', error);
        });
});

// Fonction pour calculer les gigachads qui n'ont pas encore été reviewés OU vouchés
function getMissingReviews(currentUser, allUsers) {
    const reviewedAvatars = new Set();
    const vouchedAvatars = new Set();
    
    console.log('=== ANALYSING USER ===');
    console.log('User:', currentUser.user.displayName);
    console.log('🔍 CURRENT USER STRUCTURE:', currentUser);
    console.log('🔍 CURRENT USER.USER:', currentUser.user);
    console.log('Reviews given:', currentUser.stats.reviewsGivenAvatars);
    console.log('Vouches given:', currentUser.stats.vouchesGivenAvatars);
    
    // Récupérer tous les avatars que ce gigachad a déjà reviewé
    if (currentUser.stats.reviewsGivenAvatars && Array.isArray(currentUser.stats.reviewsGivenAvatars)) {
        currentUser.stats.reviewsGivenAvatars.forEach(review => {
            if (review.avatar) {
                reviewedAvatars.add(review.avatar);
            }
        });
    }
    
    // Récupérer tous les avatars que ce gigachad a déjà vouché
    if (currentUser.stats.vouchesGivenAvatars && Array.isArray(currentUser.stats.vouchesGivenAvatars)) {
        currentUser.stats.vouchesGivenAvatars.forEach(vouch => {
            if (vouch.avatar) {
                vouchedAvatars.add(vouch.avatar);
            }
        });
    }
    
    console.log('Reviewed avatars:', Array.from(reviewedAvatars));
    console.log('Vouched avatars:', Array.from(vouchedAvatars));
    console.log('=== ALL GIGACHADS AVATARS ===');
    
    // Debug de la première entrée pour comprendre la structure
    if (allUsers.length > 0) {
        console.log('🔍 FIRST USER STRUCTURE:', allUsers[0]);
        console.log('🔍 FIRST USER.USER:', allUsers[0].user);
        console.log('🔍 ALL KEYS IN FIRST USER:', Object.keys(allUsers[0]));
        console.log('🔍 ALL KEYS IN FIRST USER.USER:', Object.keys(allUsers[0].user));
    }
    
    // Filtrer les gigachads qui n'ont pas encore été reviewés ET pas encore été vouchés
    const missingReviews = allUsers.filter(user => {
        // Utiliser displayName comme fallback si userkey n'existe pas
        const currentUserID = currentUser.user.userkey || currentUser.user.displayName;
        const userID = user.user.userkey || user.user.displayName;
        
        const isNotSelf = userID !== currentUserID;
        const notReviewed = !reviewedAvatars.has(user.user.avatarUrl);
        const notVouched = !vouchedAvatars.has(user.user.avatarUrl);
        
        console.log(`Checking ${user.user.displayName}:`);
        console.log(`  - UserID: ${userID}`);
        console.log(`  - Is not self: ${isNotSelf}`);
        console.log(`  - Avatar URL: ${user.user.avatarUrl}`);
        console.log(`  - Not reviewed: ${notReviewed}`);
        console.log(`  - Not vouched: ${notVouched}`);
        console.log(`  - Should include: ${isNotSelf && notReviewed && notVouched}`);
        
        return isNotSelf && notReviewed && notVouched;
    });
    
    console.log('=== FINAL RESULT ===');
    console.log('Missing reviews/vouches count:', missingReviews.length);
    console.log('Missing reviews/vouches:', missingReviews);
    
    return missingReviews;
}

// Fonction pour afficher la modal avec les personnes manquantes
function showMissingReviewsModal(userIndex) {
    const user = rankingData[userIndex];
    const missingReviews = getMissingReviews(user, rankingData);
    
    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2> ${user.user.displayName} should review these Gigachads</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>Missing reviews: <strong>${missingReviews.length}</strong> Gigachads</p>
                <div class="missing-reviews-list">
                    ${missingReviews.map(missingUser => `
                        <div class="missing-review-item">
                            <img src="${missingUser.user.avatarUrl}" alt="${missingUser.user.displayName}" class="avatar-small" 
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNDAiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+Cg=='" />
                            <div class="user-info">
                                <span class="user-name">${missingUser.user.displayName}</span>
                                <span class="user-rank">Rank #${missingUser.rank}</span>
                            </div>
                            <div class="user-actions">
                                <a href="${missingUser.user.profileUrl}" target="_blank" class="btn-ethos">
                                    📝 Review on Ethos
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${missingReviews.length === 0 ? `
                    <div class="no-missing-reviews">
                        <p>🎉 ${user.user.displayName} has reviewed all Gigachads!</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Ajouter l'événement pour fermer en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Fonction pour fermer la modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Fonction pour échapper les caractères spéciaux dans JSON
function escapeJsonForHtml(obj) {
    return JSON.stringify(obj).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// Fonction pour afficher le tableau
function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    data.forEach((user, index) => {
        const row = document.createElement('tr');
        
        // Calculer les reviews manquantes
        const missingReviews = getMissingReviews(user, data);
        const missingCount = missingReviews.length;

        // Créer les attributs data de manière sécurisée
        const vouchesGivenData = user.stats.vouchesGivenAvatars || [];
        const reviewsGivenData = user.stats.reviewsGivenAvatars || [];
        const vouchesReceivedData = user.stats.vouchesReceivedAvatars || [];
        const reviewsReceivedData = user.stats.reviewsReceivedAvatars || [];

        // 🎯 CORRECTION : Utiliser UNIQUEMENT le rang original (user.rank)
        let rankDisplay;
        
        if (user.rank === 1) {
            rankDisplay = '<span class="rank-gold">#1</span>';
        } else if (user.rank === 2) {
            rankDisplay = '<span class="rank-silver">#2</span>';
        } else if (user.rank === 3) {
            rankDisplay = '<span class="rank-bronze">#3</span>';
        } else {
            // Tous les autres rangs en noir
            rankDisplay = '#' + user.rank;
        }

        row.innerHTML = `
            <td data-label="Rank">${rankDisplay}</td>
            <td data-label="User" class="user-cell">
                <img src="${user.user.avatarUrl}" alt="${user.user.displayName}" class="img-avatar" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNDAiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+Cg=='" />
                <span class="user-name">${user.user.displayName}</span>
            </td>
            <td data-label="Vouches Given" data-vouches-given-avatars='${escapeJsonForHtml(vouchesGivenData)}'>${user.stats.vouchesGiven}</td>
            <td data-label="Reviews Given" data-reviews-given-avatars='${escapeJsonForHtml(reviewsGivenData)}'>${user.stats.reviewsGiven}</td>
            <td data-label="Vouches Received" data-vouches-received-avatars='${escapeJsonForHtml(vouchesReceivedData)}'>${user.stats.vouchesReceived}</td>
            <td data-label="Reviews Received" data-reviews-received-avatars='${escapeJsonForHtml(reviewsReceivedData)}'>${user.stats.reviewsReceived}</td>
            <td data-label="Total Score">${user.stats.totalScore}</td>
            <td data-label="Ethos">
                <div class="action-buttons">
                    <a href="${user.user.profileUrl}" target="_blank" class="ethos-link">ETHOS</a>
                </div>
            </td>
            <td data-label="X Profile">
                <div class="action-buttons">
                    <a href="${user.user.twitterUrl}" target="_blank" class="twitter-link">X PROFILE</a>
                </div>
            </td>
            <td data-label="Review Me Please" class="review-me-please">
                <div class="action-buttons">
                    <button class="btn-review-me" onclick="showMissingReviewsModal(${index})">
                        ${missingCount} MISSING
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


// Fonction de tri bidirectionnelle
function sortTable(key) {
    // Déterminer la direction du tri
    if (currentSort.column === key) {
        // Même colonne : inverser la direction
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        // Nouvelle colonne : commencer par descendant (sauf pour rank)
        currentSort.column = key;
        currentSort.direction = key === 'rank' ? 'asc' : 'desc';
    }

    // Effectuer le tri
    rankingData.sort((a, b) => {
        let valueA, valueB;
        
        if (key === 'rank') {
            valueA = a.rank;
            valueB = b.rank;
        } else {
            valueA = a.stats[key];
            valueB = b.stats[key];
        }
        
        // Appliquer la direction du tri
        if (currentSort.direction === 'desc') {
            return valueB - valueA; // Décroissant
        } else {
            return valueA - valueB; // Croissant
        }
    });
    
    // Mettre à jour l'affichage des flèches
    updateSortArrows();
    
    renderTable(rankingData);
}

// Fonction pour mettre à jour les flèches de tri
function updateSortArrows() {
    // Réinitialiser toutes les flèches
    document.querySelectorAll('.sortable-cell i').forEach(arrow => {
        arrow.className = 'fas fa-sort';
        arrow.style.opacity = '0.6';
    });
    
    // Mettre à jour la flèche de la colonne active
    const activeHeader = document.querySelector(`[onclick="sortTable('${currentSort.column}')"] i`);
    if (activeHeader) {
        activeHeader.style.opacity = '1';
        if (currentSort.direction === 'desc') {
            activeHeader.className = 'fas fa-sort-down';
        } else {
            activeHeader.className = 'fas fa-sort-up';
        }
    }
}

// Fonction pour gérer la fermeture de la modal avec la touche Échap
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Gestion du tooltip mobile
document.addEventListener('DOMContentLoaded', function() {
    const rankingContainer = document.querySelector('.ranking-system-container');
    const rankingText = document.querySelector('.ranking-system-text');
    
    if (rankingContainer && rankingText) {
        // Fonction pour vérifier si on est sur mobile
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        // Toggle du tooltip au clic
        rankingText.addEventListener('click', function(e) {
            if (isMobile()) {
                e.preventDefault();
                e.stopPropagation();
                rankingContainer.classList.toggle('tooltip-active');
            }
        });
        
        // Fermer le tooltip si on clique en dehors
        document.addEventListener('click', function(e) {
            if (isMobile() && !rankingContainer.contains(e.target)) {
                rankingContainer.classList.remove('tooltip-active');
            }
        });
        
        // Fermer le tooltip au redimensionnement vers desktop
        window.addEventListener('resize', function() {
            if (!isMobile()) {
                rankingContainer.classList.remove('tooltip-active');
            }
        });
    }
});



// Exposer les fonctions globalement pour les événements onclick
window.showMissingReviewsModal = showMissingReviewsModal;
window.closeModal = closeModal;
window.sortTable = sortTable;

// 🔍 SYSTÈME DE RECHERCHE
let searchTimeout;

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearch');
    const clearBtn = document.getElementById('clearSearch');
    const searchResults = document.getElementById('searchResults');
    
    // Événement de recherche avec debounce
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length === 0) {
            hideSearchResults();
            clearBtn.style.display = 'none';
            removeHighlight();
            return;
        }
        
        clearBtn.style.display = 'block';
        
        // Debounce pour éviter trop de recherches
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    // Bouton clear
    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        hideSearchResults();
        clearBtn.style.display = 'none';
        removeHighlight();
    });
    
    // Fermer les résultats si on clique ailleurs
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-container')) {
            hideSearchResults();
        }
    });
});

function performSearch(query) {
    const results = rankingData.filter(user => 
        user.user.displayName.toLowerCase().includes(query.toLowerCase())
    );
    
    displaySearchResults(results);
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No users found</div>';
        searchResults.style.display = 'block';
        return;
    }
    
    const html = results.slice(0, 5).map(user => `
        <div class="search-result-item" onclick="selectUser('${user.user.displayName}')">
            <img src="${user.user.avatarUrl}" alt="${user.user.displayName}" class="search-result-avatar"
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNDAiIGZpbGw9IiNEOUQ5RDkiLz4KPC9zdmc+Cg=='" />
            <div class="search-result-info">
                <div class="search-result-name">${user.user.displayName}</div>
                <div class="search-result-rank">Rank #${user.rank} • ${user.stats.totalScore} points</div>
            </div>
        </div>
    `).join('');
    
    searchResults.innerHTML = html;
    searchResults.style.display = 'block';
}

function selectUser(displayName) {
    // Fermer les résultats
    hideSearchResults();
    
    // Trouver la ligne dans le tableau
    const tableRows = document.querySelectorAll('#tableBody tr');
    let targetRow = null;
    
    tableRows.forEach(row => {
        const userNameCell = row.querySelector('.user-name');
        if (userNameCell && userNameCell.textContent.trim() === displayName) {
            targetRow = row;
        }
    });
    
    if (targetRow) {
        // Supprimer les anciens highlights
        removeHighlight();
        
        // Ajouter le highlight
        targetRow.classList.add('table-row-highlight');
        
        // Scroll vers la ligne
        targetRow.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Supprimer le highlight après 3 secondes
        setTimeout(() => {
            targetRow.classList.remove('table-row-highlight');
        }, 3000);
    }
}

function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    searchResults.style.display = 'none';
}

function removeHighlight() {
    document.querySelectorAll('.table-row-highlight').forEach(row => {
        row.classList.remove('table-row-highlight');
    });
}

// Exposer les fonctions globalement
window.selectUser = selectUser;

