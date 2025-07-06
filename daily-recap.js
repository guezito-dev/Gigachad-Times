const DEBUG_MODE = true;
const MAX_ITEMS = 20;
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-ranking.json';

let gigachadsData = null;
let rankingData = [];
const processedActivities = new Set();

// ========== Cache System (identique à activity-widget.js) ==========
class ActivitiesCache {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }
    
    getCacheKey(userkey) {
        return `activities_${userkey}`;
    }
    
    get(userkey) {
        const key = this.getCacheKey(userkey);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            debug(`Cache hit for ${userkey}`);
            return cached.data;
        }
        
        return null;
    }
    
    set(userkey, data) {
        const key = this.getCacheKey(userkey);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
}
const activitiesCache = new ActivitiesCache();

function debug(message, data = null) {
    if (DEBUG_MODE) {
        console.log(`[DAILY-RECAP] ${message}`, data);
    }
}

// ========== Header avec image locale ==========
function renderHeader() {
    const titleElement = document.querySelector('.title-container h1');
    if (titleElement) {
        titleElement.innerHTML = 'The Giga Chad Times <img src="./gigachad.png" alt="Giga Chad" class="header-logo">';
        debug('✅ Header image added');
    }
}

function updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateElement.textContent = now.toLocaleDateString('en-US', options);
        debug('✅ Date updated successfully');
    } else {
        debug('⚠️ #current-date element not found');
    }
}

// ========== Avatar Functions ==========
function getAvatarUrl(profileId, username) {
    if (!profileId || !gigachadsData) {
        return `https://via.placeholder.com/40/cccccc/666666?text=${username.charAt(0).toUpperCase()}`;
    }
    
    const userRank = gigachadsData.ranking?.find(rank => rank.user.profileId === profileId);
    if (userRank && userRank.user.avatarUrl) {
        return userRank.user.avatarUrl;
    }
    
    const vouchAvatar = gigachadsData.vouchReceivedAvatars?.find(avatar => 
        avatar.profileId === profileId || avatar.user?.profileId === profileId
    );
    if (vouchAvatar && vouchAvatar.avatar) {
        return vouchAvatar.avatar;
    }
    
    const reviewAvatar = gigachadsData.reviewReceivedAvatars?.find(avatar => 
        avatar.profileId === profileId || avatar.user?.profileId === profileId
    );
    if (reviewAvatar && reviewAvatar.avatar) {
        return reviewAvatar.avatar;
    }
    
    return `https://via.placeholder.com/40/cccccc/666666?text=${username.charAt(0).toUpperCase()}`;
}

function getUsernameFromProfileId(profileId) {
    if (!profileId || !gigachadsData) return 'Unknown';
    
    const userRank = gigachadsData.ranking?.find(rank => rank.user.profileId === profileId);
    return userRank?.user?.username || 'Unknown';
}

function formatTimeAgo(timestamp) {
    let t = parseInt(timestamp, 10);
    if (t < 1e12) t = t * 1000;
    const now = Date.now();
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
}

function weiToEth(wei) {
    if (!wei || wei === '0') return '0.000';
    return (parseInt(wei) / 1e18).toFixed(3);
}

function getStakedAmount(activity) {
    if (activity.data?.deposited) {
        return weiToEth(activity.data.deposited);
    }
    if (activity.content?.deposited) {
        return weiToEth(activity.content.deposited);
    }
    if (activity.data?.staked) {
        return weiToEth(activity.data.staked);
    }
    if (activity.content?.stakeAmount) {
        return parseFloat(activity.content.stakeAmount).toFixed(3);
    }
    if (activity.content?.staked) {
        return weiToEth(activity.content.staked);
    }
    return '0.000';
}

function createUniqueId(activity) {
    const authorId = activity.author?.profileId || activity.authorUser?.profileId;
    const subjectId = activity.subject?.profileId || activity.subjectUser?.profileId;
    const timestamp = activity.createdAt || activity.timestamp;
    const type = activity.type;
    return `${type}-${authorId}-${subjectId}-${timestamp}`;
}

// ========== API Functions ==========
async function fetchUserActivities(userkey) {
    debug(`Fetching activities for ${userkey}`);
    
    const cachedData = activitiesCache.get(userkey);
    if (cachedData) {
        return cachedData;
    }
    
    try {
        const response = await fetch('https://api.ethos.network/api/v2/activities/profile/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userkey: userkey,
                excludeHistorical: false,
                limit: 50,
                offset: 0
            })
        });

        if (response.ok) {
            const data = await response.json();
            const result = {
                activities: data.values || [],
                total: data.total || 0
            };
            
            activitiesCache.set(userkey, result);
            return result;
        } else {
            return { activities: [], total: 0 };
        }
    } catch (error) {
        debug(`Error fetching activities for ${userkey}:`, error);
        return { activities: [], total: 0 };
    }
}

async function loadGigachadsData() {
    debug('Loading Giga Chads data...');
    try {
        const response = await fetch(GITHUB_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gigachadsData = await response.json();
        debug('Giga Chads data loaded successfully', { count: gigachadsData.ranking?.length || 0 });
    } catch (error) {
        debug('Error loading Giga Chads data:', error);
        throw error;
    }
}

// ========== Invitations Functions ==========
async function loadGigachadsForInvitations() {
    try {
        debug('Loading Gigachads data for invitations...');
        const response = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        debug('✅ Gigachads data for invitations loaded', { count: data.users?.length || 0 });
        return data;
    } catch (error) {
        debug('❌ Error loading Gigachads data for invitations:', error);
        return null;
    }
}

async function loadInvitationsData() {
    try {
        debug('Loading ALL invitations data like Ethoscope...');
        
        let allProfilesWithInvites = [];
        let offset = 0;
        const limit = 100; // Même limite qu'Ethoscope
        let hasMore = true;
        let totalFetched = 0;
        
        while (hasMore && totalFetched < 1000) { // Limite de sécurité
            debug(`Fetching profiles batch - offset: ${offset}, limit: ${limit}`);
            
            // MÊME URL QU'ETHOSCOPE avec sortField=invitesAvailable
            const apiUrl = `https://api.ethos.network/api/v1/profiles/directory?limit=${limit}&offset=${offset}&sortField=invitesAvailable`;
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; EthosClient/1.0)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.ok && data.data.values) {
                // Filtrer pour ne garder que ceux avec invitations ≥ 1
                const profilesWithInvites = data.data.values.filter(profile => 
                    profile.invitesAvailable && profile.invitesAvailable >= 1
                );
                
                allProfilesWithInvites = allProfilesWithInvites.concat(profilesWithInvites);
                totalFetched += data.data.values.length;
                
                debug(`✅ Batch fetched: ${data.data.values.length} profiles, ${profilesWithInvites.length} with invites`);
                
                // Si on a récupéré moins que la limite, on a atteint la fin
                // OU si les derniers n'ont pas d'invitations (car c'est trié), on peut arrêter
                hasMore = data.data.values.length === limit && profilesWithInvites.length > 0;
                offset += limit;
                
                // Délai entre les requêtes
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } else {
                debug('❌ Invalid response format');
                hasMore = false;
            }
        }
        
        debug('✅ All invitations data loaded', { 
            totalProfilesWithInvites: allProfilesWithInvites.length,
            totalInvites: allProfilesWithInvites.reduce((sum, p) => sum + (p.invitesAvailable || 0), 0)
        });
        
        // Debug pour toi spécifiquement
        const guezito = allProfilesWithInvites.find(p => p.actor?.profileId === 14905);
        debug('🔍 Guezito profile found:', guezito ? {
            name: guezito.actor?.displayName || guezito.actor?.username,
            profileId: guezito.actor?.profileId,
            invites: guezito.invitesAvailable
        } : 'Not found in profiles with invites');
        
        return allProfilesWithInvites;
        
    } catch (error) {
        debug('❌ Error loading invitations data:', error);
        return [];
    }
}

// ========== Fetch Recent Activities ==========
async function fetchRecentActivities() {
    debug('Starting activities fetch...');
    if (!gigachadsData || !gigachadsData.ranking) {
        throw new Error('Giga Chads data not available');
    }

    const allVouches = [];
    const allReviews = [];
    const gigachadProfileIds = new Set(gigachadsData.ranking.map(u => u.user.profileId));
    const profileIdToUser = new Map(gigachadsData.ranking.map(u => [u.user.profileId, u.user]));
    processedActivities.clear();

    debug('Giga Chads detected', { count: gigachadProfileIds.size });
    const usersToCheck = gigachadsData.ranking.slice(0, 15);

    const batchSize = 5;
    for (let i = 0; i < usersToCheck.length; i += batchSize) {
        const batch = usersToCheck.slice(i, i + batchSize);
        const promises = batch.map(async (userRank) => {
            try {
                const userkey = `profileId:${userRank.user.profileId}`;
                const result = await fetchUserActivities(userkey);

                if (result.activities.length > 0) {
                    result.activities.forEach(activity => {
                        const authorProfileId = activity.author?.profileId;
                        const subjectProfileId = activity.subject?.profileId;
                        
                        if (authorProfileId && subjectProfileId) {
                            const uniqueId = createUniqueId(activity);

                            if (!processedActivities.has(uniqueId)) {
                                processedActivities.add(uniqueId);

                                if (gigachadProfileIds.has(subjectProfileId) &&
                                    gigachadProfileIds.has(authorProfileId) &&
                                    authorProfileId !== subjectProfileId) {

                                    const subjectUser = profileIdToUser.get(subjectProfileId);
                                    const authorUser = profileIdToUser.get(authorProfileId);

                                    if (subjectUser && authorUser) {
                                        const baseActivity = {
                                            ...activity,
                                            authorUser: authorUser,
                                            subjectUser: subjectUser,
                                            uniqueId: uniqueId
                                        };

                                        if (activity.type === 'vouch') {
                                            const stakedAmount = getStakedAmount(activity);
                                            debug(`✅ Unique vouch: ${authorUser.username} -> ${subjectUser.username} (${stakedAmount} ETH)`);
                                            allVouches.push({
                                                ...baseActivity,
                                                stakedAmount
                                            });
                                        } else if (activity.type === 'review') {
                                            debug(`✅ Unique review: ${authorUser.username} -> ${subjectUser.username}`);
                                            allReviews.push(baseActivity);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (error) {
                debug(`Error for ${userRank.user.username}:`, error.message);
            }
        });

        await Promise.all(promises);
        
        if (i + batchSize < usersToCheck.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    allVouches.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    allReviews.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    
    debug('Total activities fetched', { vouches: allVouches.length, reviews: allReviews.length });
    
    return {
        vouches: allVouches.slice(0, MAX_ITEMS),
        reviews: allReviews.slice(0, MAX_ITEMS)
    };
}

// ========== Display Functions ==========
function renderVouchesSection(vouches) {
    const container = document.getElementById('vouches-list');
    
    if (!vouches || vouches.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent vouches</div>';
        return;
    }

    const recentVouches = vouches.slice(0, 5);
    
    const html = recentVouches.map(vouch => {
        const authorName = vouch.author?.name || vouch.author?.username || 'Unknown';
        const subjectName = vouch.subject?.name || vouch.subject?.username || 'Unknown';
        
        const authorAvatar = vouch.author?.avatar || 'https://via.placeholder.com/32';
        const subjectAvatar = vouch.subject?.avatar || 'https://via.placeholder.com/32';
        
        const timestamp = vouch.timestamp || vouch.createdAt;
        const timeAgo = formatTimeAgo(timestamp);
        
        const stakeAmount = getStakedAmount(vouch);
        
        // 🔗 RÉCUPÉRER L'ID CORRECT depuis data.id
        const vouchId = vouch.data?.id;
        
        // Si pas d'ID, fallback vers le profil de la personne
        let clickUrl;
        if (vouchId) {
            clickUrl = `https://app.ethos.network/activity/vouch/${vouchId}`;
        } else {
            // Fallback: lien vers le profil de la personne qui a reçu le vouch
            const subjectUsername = vouch.subject?.username;
            clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
        }
        
        console.log(`🔍 DEBUG - Vouch URL: ${clickUrl}`); // Pour debug
        
        return `
            <div class="activity-item clickable" data-type="vouch" onclick="window.open('${clickUrl}', '_blank')">
                <div class="activity-avatars">
                    <img src="${authorAvatar}" alt="${authorName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/32'">
                    <span class="activity-arrow"></span>
                    <img src="${subjectAvatar}" alt="${subjectName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/32'">
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <div class="activity-main">
                            <strong class="author">${authorName}</strong> 
                            <span class="action" data-action="vouched">vouched for</span> 
                            <strong class="subject">${subjectName}</strong>
                        </div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                    <div class="activity-details">
                        <span class="amount">${stakeAmount} ETH</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    debug(`✅ Rendered ${recentVouches.length} recent vouches with correct IDs`);
}

function renderReviewsSection(reviews) {
    const container = document.getElementById('reviews-list');
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<div class="empty-state">No recent reviews</div>';
        return;
    }

    const recentReviews = reviews.slice(0, 5);
    
    const html = recentReviews.map(review => {
        const authorName = review.author?.name || review.author?.username || 'Unknown';
        const subjectName = review.subject?.name || review.subject?.username || 'Unknown';
        
        const authorAvatar = review.author?.avatar || 'https://via.placeholder.com/32';
        const subjectAvatar = review.subject?.avatar || 'https://via.placeholder.com/32';
        
        const timestamp = review.timestamp || review.createdAt;
        const timeAgo = formatTimeAgo(timestamp);
        
        const score = review.data?.score || 'neutral';
        const scoreClass = score === 'positive' ? 'positive' : 
                          score === 'negative' ? 'negative' : 'neutral';
        const scoreText = score.charAt(0).toUpperCase() + score.slice(1);
        
        // 🔗 RÉCUPÉRER L'ID CORRECT depuis data.id
        const reviewId = review.data?.id;
        
        // Si pas d'ID, fallback vers le profil de la personne
        let clickUrl;
        if (reviewId) {
            clickUrl = `https://app.ethos.network/activity/review/${reviewId}`;
        } else {
            // Fallback: lien vers le profil de la personne qui a reçu la review
            const subjectUsername = review.subject?.username;
            clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
        }
        
        console.log(`🔍 DEBUG - Review URL: ${clickUrl}`); // Pour debug
        
        return `
            <div class="activity-item clickable" data-type="review" onclick="window.open('${clickUrl}', '_blank')">
                <div class="activity-avatars">
                    <img src="${authorAvatar}" alt="${authorName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/32'">
                    <span class="activity-arrow"></span>
                    <img src="${subjectAvatar}" alt="${subjectName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/32'">
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <div class="activity-main">
                            <strong class="author">${authorName}</strong> 
                            <span class="action" data-action="reviewed">reviewed</span> 
                            <strong class="subject">${subjectName}</strong>
                        </div>
                        <div class="activity-time-container">
                            <div class="activity-time">${timeAgo}</div>
                            <div class="review-type-inline ${scoreClass}">${scoreText}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    debug(`✅ Rendered ${recentReviews.length} recent reviews with correct IDs`);
}

function renderLeaderboardSection() {
    const container = document.getElementById('leaderboard-list');
    
    if (!gigachadsData || !gigachadsData.ranking) {
        container.innerHTML = '<div class="empty-state">No leaderboard data available</div>';
        return;
    }

    const top5 = gigachadsData.ranking.slice(0, 5);
    
    const getRankBadge = (rank) => {
        switch(rank) {
            case 1: return { class: 'gold', text: '' };
            case 2: return { class: 'silver', text: '' };
            case 3: return { class: 'bronze', text: '' };
            case 4: return { class: 'rank-4', text: '' };
            case 5: return { class: 'rank-5', text: '' };
            default: return { class: 'default', text: '' };
        }
    };

    const html = top5.map(user => {
        const rankBadge = getRankBadge(user.rank);
        const avatar = user.user.avatarUrl || 'https://via.placeholder.com/35';
        const displayName = user.user.displayName || user.user.username;
         // 🔗 LIEN VERS PROFIL ETHOS
        const profileUrl = `https://ethos.network/profile/${user.user.profileId}`;
        
        return `
            <div class="leaderboard-item ${rankBadge.class}">
                <div class="rank">${rankBadge.text}</div>
                <img src="${avatar}" alt="${displayName}" class="avatar" 
                     onerror="this.src='https://via.placeholder.com/35'">
                <div class="user-info">
                    <div class="user-name" title="${displayName}">${displayName}</div>
                    <div class="user-score">${user.stats.totalScore} points</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    debug(`✅ Rendered top 5 leaderboard`);
}

async function renderInvitationsSection() {
    const container = document.getElementById('invitations-list');
    const countElement = document.querySelector('#invitations-section .count-badge');
    
    try {
        debug('🔄 Loading invitations data...');
        
        const [gigachadsData, allProfilesWithInvites] = await Promise.all([
            loadGigachadsForInvitations(),
            loadInvitationsData()
        ]);
        
        if (!gigachadsData || !allProfilesWithInvites || allProfilesWithInvites.length === 0) {
            container.innerHTML = '<div class="empty-state">No invitation data available</div>';
            return;
        }
        
        // Créer un Set des profileIds des Gigachads
        const gigachadProfileIds = new Set(
            gigachadsData.users
                .filter(user => user.profileId !== null && user.profileId !== undefined)
                .map(user => user.profileId)
        );
        
        debug('📊 Gigachads found:', gigachadProfileIds.size);
        
        // 🔧 CORRECTION: Déduplication plus stricte
        const seenProfileIds = new Set();
        const seenUsernames = new Set(); // Ajout d'un Set pour les usernames
        
        const gigachadsWithInvites = allProfilesWithInvites
            .filter(profile => {
                const profileId = profile.actor?.profileId;
                const username = profile.actor?.name?.toLowerCase();
                
                // Vérifier si c'est un Gigachad avec des invitations
                if (!profileId || !gigachadProfileIds.has(profileId) || profile.invitesAvailable < 1) {
                    return false;
                }
                
                // 🔧 DOUBLE VÉRIFICATION: profileId ET username
                if (seenProfileIds.has(profileId) || seenUsernames.has(username)) {
                    debug(`🔄 Duplicate found - ProfileId: ${profileId}, Username: ${username}`);
                    return false;
                }
                
                seenProfileIds.add(profileId);
                seenUsernames.add(username);
                return true;
            })
            .sort((a, b) => b.invitesAvailable - a.invitesAvailable)
            .slice(0, 5); // LIMITE À 5 LIGNES
        
        debug('✅ Unique Gigachads with invites found:', gigachadsWithInvites.length);
        
        // 🔧 DEBUG: Afficher les utilisateurs trouvés
        gigachadsWithInvites.forEach((profile, index) => {
            const gigachad = gigachadsData.users.find(user => user.profileId === profile.actor.profileId);
            debug(`${index + 1}. ProfileId: ${profile.actor.profileId}, Username: ${gigachad?.username || profile.actor?.name}, Invites: ${profile.invitesAvailable}`);
        });
        
        // Mettre à jour le compteur
        if (countElement) {
            countElement.textContent = gigachadsWithInvites.length;
        }
        
        if (gigachadsWithInvites.length === 0) {
            container.innerHTML = '<div class="empty-state">No Gigachads with invitations found</div>';
            return;
        }
        
        // Créer le HTML
        const html = gigachadsWithInvites.map(profile => {
            const gigachad = gigachadsData.users.find(user => user.profileId === profile.actor.profileId);
            
            const displayName = gigachad?.displayName || profile.actor?.name || 'Unknown';
            const avatarUrl = gigachad?.avatarUrl || profile.actor?.avatar || 'https://via.placeholder.com/35';
            const inviteCount = profile.invitesAvailable || 0;
            const username = gigachad?.username || profile.actor?.name || displayName;
            
            // 🔗 LIEN VERS TWITTER/X
            const xUrl = `https://x.com/${username}`;
            
            return `
                <div class="leaderboard-item clickable" onclick="window.open('${xUrl}', '_blank')">
                    <div class="rank">🎫</div>
                    <img src="${avatarUrl}" alt="${displayName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/35'">
                    <div class="user-info">
                        <div class="user-name">${displayName}</div>
                        <div class="user-score">${inviteCount} invite${inviteCount > 1 ? 's' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        debug(`✅ Rendered ${gigachadsWithInvites.length} unique Gigachads with invitations`);
        
    } catch (error) {
        debug('❌ Error rendering invitations section:', error);
        container.innerHTML = '<div class="empty-state">Error loading invitations</div>';
    }
}


async function renderNewGigachadsSection() {
    const container = document.getElementById('new-gigachads-list');
    
    try {
        debug('🔄 Loading new gigachads data...');
        
        const gigachadsData = await loadGigachadsForInvitations();
        
        if (!gigachadsData || !gigachadsData.users || gigachadsData.users.length === 0) {
            container.innerHTML = '<div class="empty-state">No Gigachads data available</div>';
            return;
        }
        
        // Prendre les Gigachads avec les profileIds les plus élevés (= plus récents)
        const recentGigachads = gigachadsData.users
            .filter(user => user.profileId) // S'assurer qu'il y a un profileId
            .sort((a, b) => b.profileId - a.profileId) // Trier par profileId décroissant
            .slice(0, 10); // Prendre les 10 plus récents pour avoir plus de chances d'en récupérer 5
        
        debug('✅ Recent Gigachads found:', recentGigachads.length);
        
        if (recentGigachads.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent Gigachads found</div>';
            return;
        }
        
        // Récupérer les vraies dates d'inscription depuis l'API Ethos
        const profileIds = recentGigachads.map(g => g.profileId);
        
        try {
            const response = await fetch('https://api.ethos.network/api/v1/profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ids: profileIds,
                    limit: 10,
                    offset: 0,
                    useCache: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const profilesData = await response.json();
            debug('✅ Profiles data fetched:', profilesData);
            
            if (!profilesData.ok || !profilesData.data || !profilesData.data.values) {
                throw new Error('Invalid profiles data structure');
            }
            
            // Associer les données des profils avec les gigachads
            const gigachadsWithRealDates = recentGigachads.map(gigachad => {
                const profileData = profilesData.data.values.find(p => p.id === gigachad.profileId);
                if (profileData && profileData.createdAt) {
                    return {
                        ...gigachad,
                        realCreatedAt: profileData.createdAt * 1000 // Convertir timestamp Unix en milliseconds
                    };
                }
                return null;
            }).filter(Boolean); // Enlever les null
            
            // Trier par vraie date de création (plus récent en premier)
            const sortedGigachads = gigachadsWithRealDates
                .sort((a, b) => b.realCreatedAt - a.realCreatedAt)
                .slice(0, 5); // Prendre les 5 plus récents
            
            debug('✅ Sorted Gigachads with real dates:', sortedGigachads.length);
            
            if (sortedGigachads.length === 0) {
                container.innerHTML = '<div class="empty-state">No Gigachads with valid dates found</div>';
                return;
            }
            
            // Fonction pour calculer le temps écoulé
            const getTimeAgo = (timestamp) => {
                const now = Date.now();
                const createdDate = timestamp;
                const diffInMs = now - createdDate;
                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
                const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                
                if (diffInDays > 0) {
                    return `${diffInDays}d ago`;
                } else if (diffInHours > 0) {
                    return `${diffInHours}h ago`;
                } else if (diffInMinutes > 0) {
                    return `${diffInMinutes}m ago`;
                } else {
                    return 'Just now';
                }
            };
            
            // Créer le HTML avec liens vers profils Ethos
            const html = sortedGigachads.map(gigachad => {
                const displayName = gigachad.displayName || gigachad.username || 'Unknown';
                const avatarUrl = gigachad.avatarUrl || 'https://via.placeholder.com/35';
                const timeAgo = getTimeAgo(gigachad.realCreatedAt);
                const username = gigachad.username || displayName;
                
                // 🔗 LIEN VERS PROFIL ETHOS
                const profileUrl = `https://app.ethos.network/profile/x/${username}`;
                
                return `
                    <div class="leaderboard-item clickable" onclick="window.open('${profileUrl}', '_blank')">
                        <div class="rank">🔥</div>
                        <img src="${avatarUrl}" alt="${displayName}" class="avatar" 
                             onerror="this.src='https://via.placeholder.com/35'">
                        <div class="user-info">
                            <div class="user-name">${displayName}</div>
                            <div class="user-score">${timeAgo}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            container.innerHTML = html;
            debug(`✅ Rendered ${sortedGigachads.length} new Gigachads with profile links`);
            
        } catch (apiError) {
            debug('❌ Error fetching profiles from API:', apiError);
            container.innerHTML = '<div class="empty-state">Error loading profile data</div>';
        }
        
    } catch (error) {
        debug('❌ Error rendering new gigachads section:', error);
        container.innerHTML = '<div class="empty-state">Error loading new Gigachads</div>';
    }
}

async function renderRankChangesSection() {
    const container = document.getElementById('rank-changes-list');
    
    try {
        debug('🔄 Loading rank changes data...');
        
        // Récupérer les activités récentes  
        const activitiesData = await fetchRecentActivities();
        
        const vouches = activitiesData.vouches || [];
        const reviews = activitiesData.reviews || [];
        
        if (!vouches || !reviews) {
            throw new Error('No recent activities data available');
        }
        
        debug('✅ Recent activities loaded:', vouches.length, 'vouches,', reviews.length, 'reviews');
        
        // Fonction pour vérifier si une activité est d'aujourd'hui
        const isToday = (timestamp) => {
            if (!timestamp) return false;
            
            // Convertir le timestamp Unix en date
            const activityDate = new Date(timestamp * 1000); // timestamp est en secondes, pas millisecondes
            const today = new Date();
            
            console.log('🔍 DEBUG - Comparing dates:', {
                timestamp: timestamp,
                activityDate: activityDate.toDateString(),
                today: today.toDateString(),
                isToday: today.toDateString() === activityDate.toDateString()
            });
            
            return today.toDateString() === activityDate.toDateString();
        };
        
        // Filtrer les activités d'aujourd'hui seulement
        const todayVouches = vouches.filter(vouch => isToday(vouch.timestamp));
        const todayReviews = reviews.filter(review => isToday(review.timestamp));
        
        console.log('🔍 DEBUG - Today vouches:', todayVouches.length);
        console.log('🔍 DEBUG - Today reviews:', todayReviews.length);
        
        // Si pas d'activités aujourd'hui, prendre les dernières 24h
        let finalVouches = todayVouches;
        let finalReviews = todayReviews;
        
        if (todayVouches.length === 0 && todayReviews.length === 0) {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            finalVouches = vouches.filter(vouch => {
                const activityDate = new Date(vouch.timestamp * 1000);
                return activityDate >= oneDayAgo;
            });
            
            finalReviews = reviews.filter(review => {
                const activityDate = new Date(review.timestamp * 1000);
                return activityDate >= oneDayAgo;
            });
            
            console.log('🔍 DEBUG - No activities today, taking last 24h');
            console.log('🔍 DEBUG - Recent vouches (24h):', finalVouches.length);
            console.log('🔍 DEBUG - Recent reviews (24h):', finalReviews.length);
        }
        
        // Dictionnaire pour stocker les points gagnés par chaque utilisateur
        const todayPoints = {};
        
        // Fonction pour ajouter des points à un utilisateur
        const addPoints = (userName, points, reason, avatarUrl) => {
            console.log('🔍 DEBUG - Adding points FOR TODAY:', userName, points, reason);
            
            if (!userName) return;
            
            if (!todayPoints[userName]) {
                todayPoints[userName] = {
                    displayName: userName,
                    avatarUrl: avatarUrl || 'https://via.placeholder.com/35',
                    points: 0,
                    activities: []
                };
            }
            todayPoints[userName].points += points;
            todayPoints[userName].activities.push(reason);
        };
        
        // Traiter les vouches d'aujourd'hui
        finalVouches.forEach((vouch, index) => {
            const activityDate = new Date(vouch.timestamp * 1000);
            console.log(`🔍 DEBUG - Processing TODAY vouch ${index}:`, vouch.authorUser?.displayName, '->', vouch.subjectUser?.displayName, 'at', activityDate.toLocaleString());
            
            if (vouch.authorUser && vouch.subjectUser) {
                // Points pour celui qui a donné le vouch (10 points)
                addPoints(vouch.authorUser.displayName, 10, `Vouch given (+10pts)`, vouch.authorUser.avatarUrl);
                // Points pour celui qui a reçu le vouch (5 points)
                addPoints(vouch.subjectUser.displayName, 5, `Vouch received (+5pts)`, vouch.subjectUser.avatarUrl);
            }
        });
        
        // Traiter les reviews d'aujourd'hui
        finalReviews.forEach((review, index) => {
            const activityDate = new Date(review.timestamp * 1000);
            console.log(`🔍 DEBUG - Processing TODAY review ${index}:`, review.authorUser?.displayName, '->', review.subjectUser?.displayName, 'at', activityDate.toLocaleString());
            
            if (review.authorUser && review.subjectUser) {
                // Points pour celui qui a donné le review (2 points)
                addPoints(review.authorUser.displayName, 2, `Review given (+2pts)`, review.authorUser.avatarUrl);
                // Points pour celui qui a reçu le review (1 point)
                addPoints(review.subjectUser.displayName, 1, `Review received (+1pt)`, review.subjectUser.avatarUrl);
            }
        });
        
        console.log('🔍 DEBUG - Today points calculated:', todayPoints);
        
        // Convertir en array et trier par points gagnés
        const topGainersToday = Object.values(todayPoints)
            .filter(userData => userData.points > 0) // Seulement ceux qui ont gagné des points
            .sort((a, b) => b.points - a.points) // Trier par points décroissant
            .slice(0, 5); // Prendre les 5 premiers
        
        console.log('🔍 DEBUG - Top gainers today:', topGainersToday);
        
        if (topGainersToday.length === 0) {
            container.innerHTML = '<div class="empty-state">No points gained today</div>';
            return;
        }
        
        // Créer le HTML
        const html = topGainersToday.map((userData, index) => {
            const displayName = userData.displayName || 'Unknown';
            const avatarUrl = userData.avatarUrl || 'https://via.placeholder.com/35';
            const points = userData.points;
            
            // Icône selon la position
            const rankIcon = index === 0 ? '🚀' : index === 1 ? '⬆️' : '📈';
            
            return `
                <div class="leaderboard-item">
                    <div class="rank">${rankIcon}</div>
                    <img src="${avatarUrl}" alt="${displayName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/35'">
                    <div class="user-info">
                        <div class="user-name">${displayName}</div>
                        <div class="user-score">+${points} pts today</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        debug(`✅ Rendered ${topGainersToday.length} rank changes for today`);
        
    } catch (error) {
        debug('❌ Error rendering rank changes section:', error);
        container.innerHTML = '<div class="empty-state">Error loading rank changes</div>';
    }
}


// ========== Main Application ==========
class DailyRecapManager {
    constructor() {
        this.init();
    }

    async init() {
        try {
            debug('🚀 Daily Recap initialization...');
            this.showLoading();
            await this.loadAllData();
            await this.renderAllSections();
            this.updateCurrentDate();
            debug('✅ Daily Recap initialized successfully');
        } catch (error) {
            console.error('❌ Daily Recap initialization failed:', error);
            this.showError('Failed to load daily recap');
        }
    }

    showLoading() {
        const sections = ['vouches', 'reviews', 'leaderboard', 'invitations', 'new-gigachads', 'rank-changes'];
        sections.forEach(section => {
            const element = document.getElementById(`${section}-list`);
            if (element) {
                element.innerHTML = '<div class="loading">Loading...</div>';
            }
        });
    }

    async loadAllData() {
        debug('🔄 Loading all data...');
        await loadGigachadsData();
        debug('✅ All data loaded');
    }

    async renderAllSections() {
        debug('📊 Rendering all sections...');
        
        // Render header avec image
        this.renderHeader();
        
        // Fetch activities
        const { vouches, reviews } = await fetchRecentActivities();
        
        // Render sections
        renderVouchesSection(vouches);
        renderReviewsSection(reviews);
        renderLeaderboardSection();
        await renderInvitationsSection(); // Await car la fonction est async
        await renderNewGigachadsSection();
        await renderRankChangesSection();
        
        debug('✅ All sections rendered');
    }

    renderHeader() {
        const titleElement = document.querySelector('.title-container h1');
        if (titleElement && !titleElement.querySelector('.header-logo')) {
            titleElement.innerHTML = 'The Giga Chad Times <img src="./gigachad.png" alt="Giga Chad" class="header-logo">';
            debug('✅ Header image added');
        }
    }

    updateCurrentDate() {
        updateCurrentDate();
    }

    showError(message) {
        const sections = ['vouches', 'reviews', 'leaderboard', 'invitations', 'new-gigachads', 'rank-changes'];
        sections.forEach(section => {
            const element = document.getElementById(`${section}-list`);
            if (element) {
                element.innerHTML = `<div class="empty-state">${message}</div>`;
            }
        });
    }
}

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM loaded, initializing Daily Recap...');
    new DailyRecapManager();
});

function refreshData() {
    debug('🔄 Refreshing data...');
    new DailyRecapManager();
}
