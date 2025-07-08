const DEBUG_MODE = true;
const MAX_ITEMS = 20;
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-ranking.json';

let gigachadsData = null;
let rankingData = [];
const processedActivities = new Set();

class ActivitiesCache {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; 
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
        
        
        const vouchId = vouch.data?.id;
        
        
        let clickUrl;
        if (vouchId) {
            clickUrl = `https://app.ethos.network/activity/vouch/${vouchId}`;
        } else {
            
            const subjectUsername = vouch.subject?.username;
            clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
        }
        
        console.log(`🔍 DEBUG - Vouch URL: ${clickUrl}`); 
        
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
    return html;
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
        
        
        const reviewId = review.data?.id;
        
        
        let clickUrl;
        if (reviewId) {
            clickUrl = `https://app.ethos.network/activity/review/${reviewId}`;
        } else {
            
            const subjectUsername = review.subject?.username;
            clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
        }
        
        console.log(`🔍 DEBUG - Review URL: ${clickUrl}`); 
        
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
    return html;
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
    return html;
}

async function renderInvitationsSection() {
    const container = document.getElementById('invitations-list');
    const countElement = document.querySelector('#invitations-section .count-badge');
    
    try {
        debug('🔄 Loading invitations data from JSON...');
        
        
        const response = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/invitations-data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        
        if (!jsonData || !jsonData.data || jsonData.data.length === 0) {
            container.innerHTML = '<div class="empty-state">No invitation data available</div>';
            return;
        }
        
        debug('✅ Invitations JSON loaded:', {
            gigachadsWithInvites: jsonData.gigachadsWithInvites,
            totalInvites: jsonData.totalInvites,
            lastUpdated: jsonData.lastUpdated
        });
        
        
        if (countElement) {
            countElement.textContent = jsonData.data.length;
        }
        
       
        const html = jsonData.data.map(gigachad => {
            return `
                <div class="leaderboard-item clickable" onclick="window.open('${gigachad.xUrl}', '_blank')">
                    <div class="rank">🎫</div>
                    <img src="${gigachad.avatarUrl}" alt="${gigachad.displayName}" class="avatar" 
                         onerror="this.src='https://via.placeholder.com/35'">
                    <div class="user-info">
                        <div class="user-name">${gigachad.displayName}</div>
                        <div class="user-score">${gigachad.inviteText}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        debug(`✅ Rendered ${jsonData.data.length} Gigachads with invitations (from JSON)`);
        return html;
        
    } catch (error) {
        debug('❌ Error loading invitations JSON:', error);
        container.innerHTML = '<div class="empty-state">Error loading invitations</div>';
    }
}

async function renderNewGigachadsSection() {
    const container = document.getElementById('new-gigachads-list');
    
    try {
        debug('🔄 Loading new gigachads data...');
        
       
        const response = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const gigachadsData = await response.json();
        
        if (!gigachadsData || !gigachadsData.users || gigachadsData.users.length === 0) {
            container.innerHTML = '<div class="empty-state">No Gigachads data available</div>';
            return;
        }
        
        const recentGigachads = gigachadsData.users
            .filter(user => user.profileId) 
            .sort((a, b) => b.profileId - a.profileId) 
            .slice(0, 10); 
        
        debug('✅ Recent Gigachads found:', recentGigachads.length);
        
        if (recentGigachads.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent Gigachads found</div>';
            return;
        }
        
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
            
            const gigachadsWithRealDates = recentGigachads.map(gigachad => {
                const profileData = profilesData.data.values.find(p => p.id === gigachad.profileId);
                if (profileData && profileData.createdAt) {
                    return {
                        ...gigachad,
                        realCreatedAt: profileData.createdAt * 1000 
                    };
                }
                return null;
            }).filter(Boolean); 
            
            const sortedGigachads = gigachadsWithRealDates
                .sort((a, b) => b.realCreatedAt - a.realCreatedAt)
                .slice(0, 5); 
            
            debug('✅ Sorted Gigachads with real dates:', sortedGigachads.length);
            
            if (sortedGigachads.length === 0) {
                container.innerHTML = '<div class="empty-state">No Gigachads with valid dates found</div>';
                return;
            }
            
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
            
            const html = sortedGigachads.map(gigachad => {
                const displayName = gigachad.displayName || gigachad.username || 'Unknown';
                const avatarUrl = gigachad.avatarUrl || 'https://via.placeholder.com/35';
                const timeAgo = getTimeAgo(gigachad.realCreatedAt);
                const username = gigachad.username || displayName;
                
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
            return html;
            
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
        
        
        const activitiesData = await fetchRecentActivities();
        
        const vouches = activitiesData.vouches || [];
        const reviews = activitiesData.reviews || [];
        
        if (!vouches || !reviews) {
            throw new Error('No recent activities data available');
        }
        
        debug('✅ Recent activities loaded:', vouches.length, 'vouches,', reviews.length, 'reviews');
        
        
        const isToday = (timestamp) => {
            if (!timestamp) return false;
            
            
            const activityDate = new Date(timestamp * 1000); 
            const today = new Date();
            
            console.log('🔍 DEBUG - Comparing dates:', {
                timestamp: timestamp,
                activityDate: activityDate.toDateString(),
                today: today.toDateString(),
                isToday: today.toDateString() === activityDate.toDateString()
            });
            
            return today.toDateString() === activityDate.toDateString();
        };
        
        
        const todayVouches = vouches.filter(vouch => isToday(vouch.timestamp));
        const todayReviews = reviews.filter(review => isToday(review.timestamp));
        
        console.log('🔍 DEBUG - Today vouches:', todayVouches.length);
        console.log('🔍 DEBUG - Today reviews:', todayReviews.length);
        
        
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
        
        
        const todayPoints = {};
        
        
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
        
        
        finalVouches.forEach((vouch, index) => {
            const activityDate = new Date(vouch.timestamp * 1000);
            console.log(`🔍 DEBUG - Processing TODAY vouch ${index}:`, vouch.authorUser?.displayName, '->', vouch.subjectUser?.displayName, 'at', activityDate.toLocaleString());
            
            if (vouch.authorUser && vouch.subjectUser) {
                
                addPoints(vouch.authorUser.displayName, 10, `Vouch given (+10pts)`, vouch.authorUser.avatarUrl);
                
                addPoints(vouch.subjectUser.displayName, 5, `Vouch received (+5pts)`, vouch.subjectUser.avatarUrl);
            }
        });
        
        
        finalReviews.forEach((review, index) => {
            const activityDate = new Date(review.timestamp * 1000);
            console.log(`🔍 DEBUG - Processing TODAY review ${index}:`, review.authorUser?.displayName, '->', review.subjectUser?.displayName, 'at', activityDate.toLocaleString());
            
            if (review.authorUser && review.subjectUser) {
                
                addPoints(review.authorUser.displayName, 2, `Review given (+2pts)`, review.authorUser.avatarUrl);
                
                addPoints(review.subjectUser.displayName, 1, `Review received (+1pt)`, review.subjectUser.avatarUrl);
            }
        });
        
        console.log('🔍 DEBUG - Today points calculated:', todayPoints);
        
        
        const topGainersToday = Object.values(todayPoints)
            .filter(userData => userData.points > 0) 
            .sort((a, b) => b.points - a.points) 
            .slice(0, 5); 
        
        console.log('🔍 DEBUG - Top gainers today:', topGainersToday);
        
        if (topGainersToday.length === 0) {
            container.innerHTML = '<div class="empty-state">No points gained today</div>';
            return;
        }
        
        
        const html = topGainersToday.map((userData, index) => {
            const displayName = userData.displayName || 'Unknown';
            const avatarUrl = userData.avatarUrl || 'https://via.placeholder.com/35';
            const points = userData.points;
            
            
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
        return html;
        
    } catch (error) {
        debug('❌ Error rendering rank changes section:', error);
        container.innerHTML = '<div class="empty-state">Error loading rank changes</div>';
    }
}

async function showMissingIdsModal() {
    const modal = document.getElementById('missingIdsModal');
    const listContainer = document.getElementById('missingIdsList');
    
    
    modal.style.display = 'flex';
    
   
    listContainer.innerHTML = '<div class="loading">Loading missing IDs...</div>';
    
    try {
        
        const missingUsers = await fetchMissingIds();
        
        
        renderMissingIdsSystem(missingUsers);
        
    } catch (error) {
        console.error('Error loading missing IDs:', error);
        listContainer.innerHTML = '<div class="error-state">❌ Error loading missing IDs</div>';
    }
}

function closeMissingIdsModal() {
    const modal = document.getElementById('missingIdsModal');
    modal.style.display = 'none';
}

async function fetchMissingIds() {
    try {
        debug('🔍 Fetching missing IDs...');
        
        
        const response = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-data.json');
        if (!response.ok) throw new Error('Failed to fetch gigachads data');
        
        const data = await response.json();
        const users = data.users || [];
        
        debug('📊 Total users:', users.length);
        
        
        const missingIds = users.filter(user => {
            const hasId = user.profileId && user.profileId !== null && user.profileId !== undefined;
            return !hasId;
        });
        
        debug('❌ Users without ID:', missingIds.length);
        
        return missingIds;
        
    } catch (error) {
        debug('❌ Error fetching missing IDs:', error);
        throw error;
    }
}

function renderMissingIdsSystem(missingUsers) {
    const listContainer = document.getElementById('missingIdsList');
    
    if (missingUsers.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle" style="color: #4caf50; font-size: 2em; margin-bottom: 15px;"></i>
                <p>✅ All Gigachads have profile IDs!</p>
            </div>
        `;
        return;
    }
    
    const html = missingUsers.map(user => {
        const displayName = user.displayName || user.username || 'Unknown';
        const username = user.username || 'no-username';
        
        
        const avatarSources = [
            `https://unavatar.io/x/${username}`,
            `https://unavatar.io/twitter/${username}`,
            user.avatarUrl || user.avatar || '',
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=40`
        ].filter(url => url !== '');
        
        return `
            <tr>
                <td class="simple-user-cell">
                    <div class="simple-user-profile">
                        <img src="${avatarSources[0]}" 
                             alt="${displayName}" 
                             class="simple-user-avatar"
                             data-sources='${JSON.stringify(avatarSources)}'
                             data-current-index="0"
                             onerror="tryNextAvatarSource(this, '${displayName}')">
                        <div class="simple-user-info">
                            <div class="simple-user-name">${displayName}</div>
                        </div>
                    </div>
                </td>
                <td class="simple-action-cell">
                    <a href="https://x.com/${username}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="simple-x-profile-link"
                       title="View ${displayName}'s X profile">
                        X Profile
                    </a>
                </td>
            </tr>
        `;
    }).join('');
    
    listContainer.innerHTML = `
        <div class="simple-missing-alert">
            <strong>⚠️ Found ${missingUsers.length} users without profile ID</strong>
        </div>
        <table class="simple-missing-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>X Profile</th>
                </tr>
            </thead>
            <tbody>
                ${html}
            </tbody>
        </table>
    `;
    
    debug('✅ Missing IDs list rendered:', missingUsers.length, 'users');
}

function tryNextAvatarSource(img, displayName) {
    if (img.dataset.errorHandled) return;
    
    const sources = JSON.parse(img.dataset.sources || '[]');
    const currentIndex = parseInt(img.dataset.currentIndex || '0');
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < sources.length) {
        img.dataset.currentIndex = nextIndex;
        img.src = sources[nextIndex];
        return;
    }
    
    
    img.dataset.errorHandled = 'true';
    generateSvgAvatar(img, displayName);
}

function fixAvatarError(img, displayName) {
    const firstLetter = displayName.charAt(0).toUpperCase();
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    img.src = `data:image/svg+xml;base64,${btoa(`
        <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="${randomColor}"/>
            <text x="20" y="28" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">${firstLetter}</text>
        </svg>
    `)}`;
    
    img.onerror = null; 
}

function initializeMissingIdsEvents() {
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMissingIdsModal();
        }
    });

    
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('missingIdsModal');
        if (e.target === modal) {
            closeMissingIdsModal();
        }
    });

    
    window.showMissingIdsModal = showMissingIdsModal;
    window.closeMissingIdsModal = closeMissingIdsModal;
}

class DailyRecapManager {
    constructor() {
        this.cache = new Map(); 
        this.cacheExpiry = 5 * 60 * 1000; 
        this.clearExpiredCache(); 
        this.init();
    }


    async init() {
        try {
            debug('🚀 Daily Recap initialization...');
            
           
            await this.loadFromCache();
            
            
            this.loadFreshDataInBackground();
            
            this.updateCurrentDate();
            debug('✅ Daily Recap initialized successfully');
        } catch (error) {
            console.error('❌ Daily Recap initialization failed:', error);
            this.showError('Failed to load daily recap');
        }
    }

   
    async loadFromCache() {
        debug('📦 Loading from cache...');
        this.renderHeader();
        
        const sections = [
            'vouches', 'reviews', 'leaderboard', 
            'new-gigachads', 'rank-changes', 'invitations'
        ];
        
        let hasCache = false;
        
        for (const section of sections) {
            const cachedHtml = this.getFromCache(section);
            if (cachedHtml) {
                this.renderCachedSection(section, cachedHtml);
                hasCache = true;
            } else {
                this.showLoadingForSection(section);
            }
        }
        
        if (!hasCache) {
            debug('📦 No cache found, loading fresh data immediately');
            await this.loadAllData();
            await this.renderAllSections();
        }
    }

    
    async loadFreshDataInBackground() {
        debug('🔄 Loading fresh data in background...');
        
        try {
            await this.loadAllData();
            await this.renderAllSectionsWithCache();
        } catch (error) {
            debug('❌ Error loading fresh data:', error);
        }
    }

    
    saveToCache(key, html) {
    const cacheData = {
        html: html,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(`daily-recap-cache-${key}`, JSON.stringify(cacheData));
        debug(`💾 Saved ${key} to localStorage cache`);
    } catch (error) {
        debug(`❌ Error saving ${key} to cache:`, error);
    }
    }

 
    getFromCache(key) {
    try {
        const cached = localStorage.getItem(`daily-recap-cache-${key}`);
        if (cached) {
            const cacheData = JSON.parse(cached);
            if (Date.now() - cacheData.timestamp < this.cacheExpiry) {
                debug(`✅ ${key} loaded from localStorage cache`);
                return cacheData.html;
            } else {
               
                localStorage.removeItem(`daily-recap-cache-${key}`);
                debug(`🗑️ ${key} cache expired and removed`);
            }
        }
    } catch (error) {
        debug(`❌ Error loading ${key} from cache:`, error);
    }
    return null;
    }

        clearExpiredCache() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('daily-recap-cache-')) {
                    try {
                        const cached = localStorage.getItem(key);
                        if (cached) {
                            const cacheData = JSON.parse(cached);
                            if (Date.now() - cacheData.timestamp >= this.cacheExpiry) {
                                localStorage.removeItem(key);
                                debug(`🗑️ Removed expired cache: ${key}`);
                            }
                        }
                    } catch (error) {
                        localStorage.removeItem(key);
                        debug(`🗑️ Removed corrupted cache: ${key}`);
                    }
                }
            });
        }

   
    renderCachedSection(sectionName, cachedHtml) {
        const element = document.getElementById(`${sectionName}-list`);
        if (element) {
            element.innerHTML = cachedHtml;
            debug(`✅ ${sectionName} displayed from cache`);
        }
    }

    
    showLoadingForSection(sectionName) {
        const element = document.getElementById(`${sectionName}-list`);
        if (element) {
            element.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    showLoading() {
        const sections = ['vouches', 'reviews', 'leaderboard', 'invitations', 'new-gigachads', 'rank-changes'];
        sections.forEach(section => {
            this.showLoadingForSection(section);
        });
    }

    async loadAllData() {
        debug('🔄 Loading all data...');
        await loadGigachadsData();
        debug('✅ All data loaded');
    }

    async renderAllSectionsWithCache() {
        debug('📊 Rendering all sections with cache...');
        
      
        const { vouches, reviews } = await fetchRecentActivities();
        
        
        const vouchesHtml = renderVouchesSection(vouches);
        this.updateSectionAndCache('vouches', vouchesHtml);
        
        const reviewsHtml = renderReviewsSection(reviews);
        this.updateSectionAndCache('reviews', reviewsHtml);
        
        const leaderboardHtml = renderLeaderboardSection();
        this.updateSectionAndCache('leaderboard', leaderboardHtml);
        
       
        const newGigachadsHtml = await renderNewGigachadsSection();
        this.updateSectionAndCache('new-gigachads', newGigachadsHtml);
        
        const rankChangesHtml = await renderRankChangesSection();
        this.updateSectionAndCache('rank-changes', rankChangesHtml);
        
        const invitationsHtml = await renderInvitationsSection();
        this.updateSectionAndCache('invitations', invitationsHtml);
        
        debug('✅ All sections rendered with cache');
    }


    
    async renderAllSections() {
        debug('📊 Rendering all sections...');
        
        
        this.renderHeader();
        
        
        const { vouches, reviews } = await fetchRecentActivities();
        
        
        renderVouchesSection(vouches);
        renderReviewsSection(reviews);
        renderLeaderboardSection();
        
       
        await renderNewGigachadsSection();
        await renderRankChangesSection();
        await renderInvitationsSection();
        
        debug('✅ All sections rendered');
    }

    
    updateSectionAndCache(sectionName, newHtml) {
        const element = document.getElementById(`${sectionName}-list`);
        if (element && newHtml) {
            const oldContent = element.innerHTML;
            if (oldContent !== newHtml) {
                element.innerHTML = newHtml;
                element.classList.add('updated');
                setTimeout(() => element.classList.remove('updated'), 1000);
                this.saveToCache(sectionName, newHtml);
                debug(`✨ ${sectionName} updated and cached`);
            }
        }
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

document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 DOM loaded, initializing Daily Recap...');
    new DailyRecapManager();
    initializeMissingIdsEvents();
});

function refreshData() {
    debug('🔄 Refreshing data...');
    new DailyRecapManager();
}
