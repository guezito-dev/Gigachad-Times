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

// ✨ TYPEWRITER GIGA CHAD - TABLE PAGE

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Typewriter Giga Chad chargé (TABLE PAGE)');
    
    // MASQUER IMMÉDIATEMENT les éléments
    hideElementsForAnimation();
    
    // Démarrer l'animation rapidement
    setTimeout(() => {
        startGigaChadTypewriter();
    }, 50);
});

function hideElementsForAnimation() {
    const title = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    
    if (title) {
        title.style.opacity = '0';
        title.style.visibility = 'hidden';
        console.log('📝 Titre masqué pour préparation (TABLE)');
    }
    
    if (subtitle) {
        subtitle.style.opacity = '0';
        subtitle.style.visibility = 'hidden';
        console.log('📝 Sous-titre masqué pour préparation (TABLE)');
    }
}

function startGigaChadTypewriter() {
    const title = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    
    if (!title) {
        console.log('❌ Titre non trouvé (TABLE)');
        return;
    }
    
    console.log('📝 Démarrage animation Giga Chad (TABLE)...');
    
    // Sauvegarder l'image
    const img = title.querySelector('img');
    const imgHTML = img ? img.outerHTML : '';
    
    // Texte à animer
    const titleText = 'The Giga Chad Times ';
    
    // Préparer le titre
    title.textContent = '';
    title.style.opacity = '1';
    title.style.visibility = 'visible';
    title.style.display = 'inline-block';
    
    // Ajouter la classe curseur
    title.classList.add('typewriter-cursor');
    
    let i = 0;
    const titleTimer = setInterval(() => {
        if (i < titleText.length) {
            title.textContent += titleText.charAt(i);
            i++;
        } else {
            clearInterval(titleTimer);
            
            // Ajouter l'image
            if (imgHTML) {
                title.innerHTML += imgHTML;
            }
            
            // Supprimer le curseur du titre
            title.classList.remove('typewriter-cursor');
            title.style.display = 'block';
            
            // Démarrer l'animation du sous-titre
            setTimeout(() => {
                animateGigaChadSubtitle(subtitle);
            }, 300);
        }
    }, 80);
}

function animateGigaChadSubtitle(subtitle) {
    if (!subtitle) {
        console.log('✅ Animation terminée (pas de sous-titre) (TABLE)');
        return;
    }
    
    const originalText = subtitle.textContent;
    
    // Préparer le sous-titre
    subtitle.textContent = '';
    subtitle.style.opacity = '1';
    subtitle.style.visibility = 'visible';
    subtitle.style.display = 'block';
    
    // AJOUTER LA CLASSE CURSEUR SOUS-TITRE
    subtitle.classList.add('typewriter-cursor-subtitle');
    
    let i = 0;
    const subtitleTimer = setInterval(() => {
        if (i < originalText.length) {
            subtitle.textContent += originalText.charAt(i);
            i++;
        } else {
            clearInterval(subtitleTimer);
            
            // SUPPRIMER LE CURSEUR après 1.5 secondes
            setTimeout(() => {
                subtitle.classList.remove('typewriter-cursor-subtitle');
                console.log('✅ Animation Giga Chad terminée (TABLE) !');
            }, 1500);
        }
    }, 60);
}

// Fonction pour redémarrer l'animation
function restartGigaChadTypewriter() {
    console.log('🔄 Redémarrage Giga Chad Typewriter (TABLE)...');
    
    const title = document.querySelector('h1');
    const subtitle = document.querySelector('.subtitle');
    
    // Nettoyer les classes
    if (title) {
        title.classList.remove('typewriter-cursor');
    }
    if (subtitle) {
        subtitle.classList.remove('typewriter-cursor-subtitle');
    }
    
    // Redémarrer
    hideElementsForAnimation();
    setTimeout(() => {
        startGigaChadTypewriter();
    }, 100);
}


// Exposer les fonctions globalement pour les événements onclick
window.showMissingReviewsModal = showMissingReviewsModal;
window.closeModal = closeModal;
window.sortTable = sortTable;
