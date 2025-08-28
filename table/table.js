let rankingData = [];


let currentSort = {
    column: null,
    direction: 'desc' 
};

function updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'numeric', 
            day: 'numeric' 
        };
        dateElement.textContent = now.toLocaleDateString('en-GB', options);
        debug('✅ Date updated successfully');
    } else {
        debug('⚠️ #current-date element not found');
    }
}

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
            
            currentSort = { column: 'rank', direction: 'asc' };
            renderTable(rankingData);
            updateSortArrows();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des données:', error);
        });
        updateCurrentDate();
});


function getMissingReviews(currentUser, allUsers) {
    const reviewedAvatars = new Set();
    const vouchedAvatars = new Set();
    
    console.log('=== ANALYSING USER ===');
    console.log('User:', currentUser.user.displayName);
    console.log('🔍 CURRENT USER STRUCTURE:', currentUser);
    console.log('🔍 CURRENT USER.USER:', currentUser.user);
    console.log('Reviews given:', currentUser.stats.reviewsGivenAvatars);
    console.log('Vouches given:', currentUser.stats.vouchesGivenAvatars);
    
    
    if (currentUser.stats.reviewsGivenAvatars && Array.isArray(currentUser.stats.reviewsGivenAvatars)) {
        currentUser.stats.reviewsGivenAvatars.forEach(review => {
            if (review.avatar) {
                reviewedAvatars.add(review.avatar);
            }
        });
    }
    
   
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
    
    
    if (allUsers.length > 0) {
        console.log('🔍 FIRST USER STRUCTURE:', allUsers[0]);
        console.log('🔍 FIRST USER.USER:', allUsers[0].user);
        console.log('🔍 ALL KEYS IN FIRST USER:', Object.keys(allUsers[0]));
        console.log('🔍 ALL KEYS IN FIRST USER.USER:', Object.keys(allUsers[0].user));
    }
    
    
    const missingReviews = allUsers.filter(user => {
        
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


function showMissingReviewsModal(userIndex) {
    const user = rankingData[userIndex];
    const missingReviews = getMissingReviews(user, rankingData);
    
    
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
    
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}


function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}


function escapeJsonForHtml(obj) {
    return JSON.stringify(obj).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}


function renderTable(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    data.forEach((user, index) => {
        const row = document.createElement('tr');
        
        
        const missingReviews = getMissingReviews(user, data);
        const missingCount = missingReviews.length;

       
        const vouchesGivenData = user.stats.vouchesGivenAvatars || [];
        const reviewsGivenData = user.stats.reviewsGivenAvatars || [];
        const vouchesReceivedData = user.stats.vouchesReceivedAvatars || [];
        const reviewsReceivedData = user.stats.reviewsReceivedAvatars || [];

       
        let rankDisplay;
        
        if (user.rank === 1) {
            rankDisplay = '<span class="rank-gold">#1</span>';
        } else if (user.rank === 2) {
            rankDisplay = '<span class="rank-silver">#2</span>';
        } else if (user.rank === 3) {
            rankDisplay = '<span class="rank-bronze">#3</span>';
        } else {
            
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



function sortTable(key) {
    
    if (currentSort.column === key) {
        
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        
        currentSort.column = key;
        currentSort.direction = key === 'rank' ? 'asc' : 'desc';
    }

   
    rankingData.sort((a, b) => {
        let valueA, valueB;
        
        if (key === 'rank') {
            valueA = a.rank;
            valueB = b.rank;
        } else {
            valueA = a.stats[key];
            valueB = b.stats[key];
        }
        
        
        if (currentSort.direction === 'desc') {
            return valueB - valueA; 
        } else {
            return valueA - valueB; 
        }
    });
    
    
    updateSortArrows();
    
    renderTable(rankingData);
}


function updateSortArrows() {
    
    document.querySelectorAll('.sortable-cell i').forEach(arrow => {
        arrow.className = 'fas fa-sort';
        arrow.style.opacity = '0.6';
    });
    
    
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


document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});


document.addEventListener('DOMContentLoaded', function() {
    const rankingContainer = document.querySelector('.ranking-system-container');
    const rankingText = document.querySelector('.ranking-system-text');
    
    if (rankingContainer && rankingText) {
       
        function isMobile() {
            return window.innerWidth <= 768;
        }
        
        
        rankingText.addEventListener('click', function(e) {
            if (isMobile()) {
                e.preventDefault();
                e.stopPropagation();
                rankingContainer.classList.toggle('tooltip-active');
            }
        });
        
        
        document.addEventListener('click', function(e) {
            if (isMobile() && !rankingContainer.contains(e.target)) {
                rankingContainer.classList.remove('tooltip-active');
            }
        });
        
       
        window.addEventListener('resize', function() {
            if (!isMobile()) {
                rankingContainer.classList.remove('tooltip-active');
            }
        });
    }
});




window.showMissingReviewsModal = showMissingReviewsModal;
window.closeModal = closeModal;
window.sortTable = sortTable;


let searchTimeout;

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearch');
    const clearBtn = document.getElementById('clearSearch');
    const searchResults = document.getElementById('searchResults');
    
    
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
        
        
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    
    clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        hideSearchResults();
        clearBtn.style.display = 'none';
        removeHighlight();
    });
    
    
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
    
    hideSearchResults();
    
    
    const tableRows = document.querySelectorAll('#tableBody tr');
    let targetRow = null;
    
    tableRows.forEach(row => {
        const userNameCell = row.querySelector('.user-name');
        if (userNameCell && userNameCell.textContent.trim() === displayName) {
            targetRow = row;
        }
    });
    
    if (targetRow) {
        
        removeHighlight();
        
        
        targetRow.classList.add('table-row-highlight');
        
        
        targetRow.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        
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


window.selectUser = selectUser;


