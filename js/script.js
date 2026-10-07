const firebaseConfig = {
  apiKey: "AIzaSyCAeaYsd_kXbiAvngdmTEOInHZ7ly0P4Dc",
  authDomain: "randommapfreefire.firebaseapp.com",
  databaseURL: "https://randommapfreefire-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "randommapfreefire",
  storageBucket: "randommapfreefire.firebasestorage.app",
  messagingSenderId: "870888805581",
  appId: "1:870888805581:web:813202564d9fd2c3dcc584",
  measurementId: "G-PS2H8CFE14"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const stateRef = db.ref('esports_overlay/state');


const BOOYAH_IMG_SRC = "PG/BOOYAH_ICON.png";
const DEFAULT_LOGO = 'https://cdn-icons-png.flaticon.com/512/824/824722.png';
const STORAGE_KEY = 'esports_obs_orange_v25_saved';

const THEME_PRESETS = {
    'orange': {
        name: 'ส้ม (Orange)',
        primary: '#ff6d00',
        secondary: '#ff6d00',
        headerBg: '#ff6d00',
        frameBg: '#ff6d00',
        barBg: '#ff6d00',
        glow: 'rgba(255, 109, 0, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(255, 109, 0, 0.4) 60%, transparent 100%)'
    },
    'darkblue': {
        name: 'น้ำเงิน (Blue)',
        primary: '#4a2aff',
        secondary: '#4a2aff',
        headerBg: '#4a2aff',
        frameBg: '#4a2aff',
        barBg: '#4a2aff',
        glow: 'rgba(46, 42, 255, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(46, 42, 255, 0.3) 60%, transparent 100%)'
    },
    'pink': {
        name: 'ชมพู (Pink)',
        primary: '#ff64db',
        secondary: '#ff64db',
        headerBg: '#ff64db',
        frameBg: '#ff64db',
        barBg: '#ff64db',
        glow: 'rgba(245, 0, 200, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(245, 0, 200, 0.3) 60%, transparent 100%)'
    },
    'darkgreen': {
        name: 'เขียวเข้ม (Dark green)',
        primary: '#008000',
        secondary: '#008000',
        headerBg: '#008000',
        frameBg: '#008000',
        barBg: '#008000 ',
        glow: 'rgba(85, 255, 23, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(85, 255, 23, 0.3) 60%, transparent 100%)'
    },
    'navy-blue': {
        name: 'กรมท่า (Navy Blue)',
        primary: '#1a237e',
        secondary: '#1a237e',
        headerBg: '#1a237e',
        frameBg: '#1a237e',
        barBg: '#1a237e ',
        glow: 'rgba(54, 23, 255, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(54, 23, 255, 0.3) 60%, transparent 100%)'
    },
    'Red': {
        name: 'แดง (Red)',
        primary: '#FF0000',
        secondary: '#FF0000',
        headerBg: '#FF0000',
        frameBg: '#FF0000',
        barBg: '#FF0000 ',
        glow: 'rgba(255, 23, 23, 0.3)',
        overlayShadow: 'linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(255, 23, 23, 0.3) 60%, transparent 100%)'
    },

};

const PRESET_MAPS = {
    'RANDOM': 'PG/RANDOM.webp',
    'BERMUDA': 'PG/5.webp',
    'PURGATORY': 'PG/4.webp',
    'KALAHARI': 'PG/2.webp',
    'NEXTERRA': 'PG/1.webp',
    'SOLARA': 'PG/3.webp',
};

let state = {
    theme: 'orange',
    delay: 5,
    autoSwitch: true,
    activeGroup: '',
    groups: {}
};

let isUpdatingFromFirebase = false;
let currentScreenIndex = 0;
let autoSwitchTimer = null;

const urlParams = new URLSearchParams(window.location.search);
const isObs = urlParams.get('view') === 'obs' || urlParams.get('obs') === '1';
if (isObs) {
    document.body.classList.add('obs-mode');
}

// ==========================================================================
// PREVIEW AUTO SCALE FIT FUNCTION
// ==========================================================================
function updatePreviewScale() {
    const wrapper = document.getElementById('preview-wrapper');
    const container = document.getElementById('overlay-container');
    if (!wrapper || !container) return;

    if (document.body.classList.contains('obs-mode')) {
        container.style.transform = 'none';
        return;
    }

    const availableWidth = wrapper.clientWidth;
    const availableHeight = wrapper.clientHeight;

    const scaleX = availableWidth / 1920;
    const scaleY = availableHeight / 1080;
    const scale = Math.min(scaleX, scaleY) * 0.92;

    container.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', updatePreviewScale);

// ==========================================================================
// FIREBASE REALTIME SYNC LOGIC
// ==========================================================================
function saveAndSync() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch(e) {}

    if (!isUpdatingFromFirebase) {
        stateRef.set(state).catch(err => console.error("Firebase sync error:", err));
    }
    
    renderAll();
    startAutoRotation();
}

function initFirebaseListener() {
    const syncStatusEl = document.getElementById('syncStatus');
    
    stateRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            isUpdatingFromFirebase = true;
            state = data;
            if (!state.theme) state.theme = 'orange';
            applyTheme(state.theme);

            const isTyping = document.activeElement && 
                (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA');

            if (isObs || !isTyping) {
                renderAll();
                startAutoRotation();
            }
            isUpdatingFromFirebase = false;

            if (syncStatusEl) {
                syncStatusEl.innerText = "ONLINE";
                syncStatusEl.className = "status-badge sync-online";
            }
        } else {
            saveAndSync();
        }
    }, (error) => {
        console.error("Firebase Listener Error:", error);
        if (syncStatusEl) {
            syncStatusEl.innerText = "ERROR";
            syncStatusEl.className = "status-badge sync-error";
        }
    });
}

function applyTheme(themeKey) {
    const t = THEME_PRESETS[themeKey] || THEME_PRESETS['orange'];
    state.theme = themeKey;
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', t.primary);
    root.style.setProperty('--theme-secondary', t.secondary);
    root.style.setProperty('--theme-header-bg', t.headerBg);
    root.style.setProperty('--theme-frame-bg', t.frameBg);
    root.style.setProperty('--theme-bar-bg', t.barBg);
    root.style.setProperty('--theme-glow', t.glow);
    root.style.setProperty('--theme-overlay-shadow', t.overlayShadow);

    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = state.theme;
}

function changeTheme(themeKey) {
    applyTheme(themeKey);
    saveAndSync();
}

function updateState() {
    state.theme = document.getElementById('themeSelect').value || 'orange';
    state.delay = parseInt(document.getElementById('delayInput').value) || 5;
    state.autoSwitch = document.getElementById('autoSwitchCheck').checked;
    applyTheme(state.theme);
    saveAndSync();
}

function createGroup() {
    const nameInput = document.getElementById('newGroupName');
    const gName = nameInput.value.trim().toUpperCase();
    if (!gName || (state.groups && state.groups[gName])) return;

    if (!state.groups) state.groups = {};

    state.groups[gName] = {
        teams: [],
        matches: [
            { labelType: 'ROUND', labelVal: 'ROUND 1', map: 'RANDOM', status: 'normal', booyahTeam: '' },
            { labelType: 'ROUND', labelVal: 'ROUND 2', map: 'RANDOM', status: 'normal', booyahTeam: '' },
            { labelType: 'ROUND', labelVal: 'ROUND 3', map: 'RANDOM', status: 'normal', booyahTeam: '' },
            { labelType: 'ROUND', labelVal: 'ROUND 4', map: 'RANDOM', status: 'normal', booyahTeam: '' },
            { labelType: 'ROUND', labelVal: 'ROUND 5', map: 'RANDOM', status: 'normal', booyahTeam: '' }
        ]
    };
    state.activeGroup = gName;
    nameInput.value = '';
    saveAndSync();
}

function switchGroup(gName) {
    if (state.groups && state.groups[gName]) {
        state.activeGroup = gName;
        saveAndSync();
    }
}

function deleteCurrentGroup() {
    if (!state.activeGroup || !state.groups) return;
    delete state.groups[state.activeGroup];
    const remaining = Object.keys(state.groups);
    state.activeGroup = remaining.length > 0 ? remaining[0] : '';
    saveAndSync();
}

function compressImage(file, maxDimension, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
            } else {
                if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/png', 0.85));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function addTeam() {
    if (!state.activeGroup || !state.groups || !state.groups[state.activeGroup]) return alert('กรุณาสร้างหรือเลือกกลุ่มก่อนครับ');
    const teams = state.groups[state.activeGroup].teams || [];
    if (teams.length >= 12) return alert('เพิ่มทีมได้สูงสุด 12 ทีมต่อกลุ่มครับ');

    const nameInput = document.getElementById('teamNameInput');
    const fileInput = document.getElementById('teamLogoFileInput');
    const name = nameInput.value.trim();

    if (!name) return alert('กรุณากรอกชื่อทีมด้วยครับ');

    const doSave = (logoData) => {
        if (!state.groups[state.activeGroup].teams) state.groups[state.activeGroup].teams = [];
        state.groups[state.activeGroup].teams.push({ name: name, logo: logoData });
        nameInput.value = '';
        fileInput.value = '';
        saveAndSync();
    };

    if (fileInput.files && fileInput.files[0]) {
        compressImage(fileInput.files[0], 220, doSave);
    } else {
        doSave(DEFAULT_LOGO);
    }
}

function deleteTeam(index) {
    if (state.activeGroup && state.groups && state.groups[state.activeGroup]) {
        state.groups[state.activeGroup].teams.splice(index, 1);
        saveAndSync();
    }
}

function addMatchSlot() {
    if (!state.activeGroup || !state.groups || !state.groups[state.activeGroup]) return;
    if (!state.groups[state.activeGroup].matches) state.groups[state.activeGroup].matches = [];
    const matches = state.groups[state.activeGroup].matches;

    matches.push({
        labelType: 'ROUND',
        labelVal: `ROUND ${matches.length + 1}`,
        map: 'RANDOM',
        status: 'normal',
        booyahTeam: ''
    });
    saveAndSync();
}

function deleteMatchSlot(index) {
    if (state.activeGroup && state.groups && state.groups[state.activeGroup]) {
        state.groups[state.activeGroup].matches.splice(index, 1);
        saveAndSync();
    }
}

function updateMatchLabel(index, type, value) {
    if (state.activeGroup && state.groups && state.groups[state.activeGroup]) {
        const match = state.groups[state.activeGroup].matches[index];
        if (type !== undefined) match.labelType = type;
        if (value !== undefined) match.labelVal = value;
        saveAndSync();
    }
}

function updateMatchMap(index, mapName) {
    if (state.activeGroup && state.groups && state.groups[state.activeGroup]) {
        state.groups[state.activeGroup].matches[index].map = mapName;
        saveAndSync();
    }
}

function setMatchStatus(matchIndex, newStatus) {
    if (!state.activeGroup || !state.groups || !state.groups[state.activeGroup]) return;
    const matches = state.groups[state.activeGroup].matches;

    if (newStatus === 'upcoming') {
        matches.forEach(m => { if (m.status === 'upcoming') m.status = 'normal'; });
    }
    
    matches[matchIndex].status = newStatus;
    saveAndSync();
}

function updateWinner(matchIndex, teamName) {
    if (!state.activeGroup || !state.groups || !state.groups[state.activeGroup]) return;
    const matches = state.groups[state.activeGroup].matches;

    matches[matchIndex].booyahTeam = teamName;
    if (teamName !== '') {
        matches[matchIndex].status = 'booyah';
    }
    saveAndSync();
}

function renderAll() {
    document.getElementById('themeSelect').value = state.theme || 'orange';
    document.getElementById('delayInput').value = state.delay || 5;
    document.getElementById('autoSwitchCheck').checked = state.autoSwitch;

    const groupKeys = state.groups ? Object.keys(state.groups) : [];
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = groupKeys.length === 0 
        ? '<option value="">-- ยังไม่มีกลุ่ม --</option>' 
        : groupKeys.map(g => `<option value="${g}" ${g === state.activeGroup ? 'selected' : ''}>${g}</option>`).join('');

    const teamSec = document.getElementById('teamSection');
    const mapSec = document.getElementById('mapSection');
    const headerBanner = document.getElementById('displayGroupName');

    // กรณีที่ยังไม่ได้เพิ่มหรือเลือกกลุ่มทีม
    if (!state.activeGroup || !state.groups || !state.groups[state.activeGroup]) {
        teamSec.style.display = 'none';
        mapSec.style.display = 'none';
        if (headerBanner) headerBanner.style.display = 'none';
        
        document.getElementById('displayTeamsGrid').innerHTML = `
            <div class="empty-group-container">
                <div class="empty-group-card">
                    <div class="empty-title">ยังไม่ได้เพิ่มกลุ่มทีม</div>
                    <div class="empty-desc">โปรดสร้างหรือเลือกกลุ่มทีมจากเมนูฝั่งขวาเพื่อเริ่มต้นใช้งาน</div>
                </div>
            </div>
        `;
        document.getElementById('dynamic-map-screens').innerHTML = '';
        updatePreviewScale();
        return;
    } else {
        if (headerBanner) headerBanner.style.display = 'flex';
    }

    teamSec.style.display = 'block';
    mapSec.style.display = 'block';

    const activeData = state.groups[state.activeGroup];
    const teamsList = activeData.teams || [];
    const matchesList = activeData.matches || [];

    document.getElementById('teamCountBadge').innerText = `${teamsList.length}/12 ทีม`;
    headerBanner.innerText = state.activeGroup;

    // Admin Teams List
    document.getElementById('teamsListAdmin').innerHTML = teamsList.length === 0
        ? '<div style="font-size:11px; color:#6b7280; text-align:center; padding:8px;">ยังไม่มีทีมในกลุ่มนี้</div>'
        : teamsList.map((t, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111520; padding:6px 10px; margin-bottom:4px; border-radius:4px; border:1px solid #1f293d;">
                <span style="font-size:12px; font-weight:700;">#${i + 1} ${t.name}</span>
                <button class="btn-danger" onclick="deleteTeam(${i})">ลบ</button>
            </div>
        `).join('');

    // Admin Map Control Slots
    const mapKeys = Object.keys(PRESET_MAPS);
    document.getElementById('mapSettingsContainer').innerHTML = matchesList.map((m, i) => {
        const currentStatus = m.status || (m.booyahTeam ? 'booyah' : 'normal');
        const labelType = m.labelType || 'ROUND';
        const labelVal = m.labelVal || `ROUND ${i + 1}`;

        return `
        <div style="background:#111520; padding:10px; margin-bottom:10px; border-radius:6px; border:1px solid #1f293d;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="color:var(--theme-primary); font-weight:900; font-size:13px;">#${i + 1} - ${labelVal} (${m.map})</span>
                <button class="btn-danger" onclick="deleteMatchSlot(${i})">ลบแมทช์</button>
            </div>
            
            <div style="display:flex; gap:6px; margin-bottom:6px;">
                <div style="flex:1;">
                    <label>ประเภทป้าย</label>
                    <select onchange="updateMatchLabel(${i}, this.value, undefined)">
                        <option value="ROUND" ${labelType === 'ROUND' ? 'selected' : ''}>รอบ (ROUND/GAME)</option>
                        <option value="GROUP" ${labelType === 'GROUP' ? 'selected' : ''}>กลุ่ม (GROUP)</option>
                    </select>
                </div>
                <div style="flex:1;">
                    <label>ข้อความป้าย</label>
                    <input type="text" value="${labelVal}" onchange="updateMatchLabel(${i}, undefined, this.value)">
                </div>
            </div>

            <label>เลือกแผนที่</label>
            <select onchange="updateMatchMap(${i}, this.value)">
                ${mapKeys.map(k => `<option value="${k}" ${m.map === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>

            <label style="margin-top:6px;">สถานะแมทช์</label>
            <div class="status-segmented-ctrl">
                <button class="${currentStatus === 'normal' ? 'active-normal' : ''}" onclick="setMatchStatus(${i}, 'normal')">⚪ ปกติ</button>
                <button class="${currentStatus === 'upcoming' ? 'active-upcoming' : ''}" onclick="setMatchStatus(${i}, 'upcoming')">📌 UPCOMING</button>
                <button class="${currentStatus === 'booyah' ? 'active-booyah' : ''}" onclick="setMatchStatus(${i}, 'booyah')">👑 BOOYAH!</button>
            </div>

            ${currentStatus === 'booyah' ? `
                <div style="margin-top:6px; background:#182030; padding:8px; border-radius:6px;">
                    <label style="color:var(--theme-primary); margin-top:0;">เลือกทีมที่ชนะ BOOYAH!</label>
                    <select onchange="updateWinner(${i}, this.value)">
                        <option value="">-- เลือกทีมชนะ --</option>
                        ${teamsList.map(t => `<option value="${t.name}" ${m.booyahTeam === t.name ? 'selected' : ''}>🏆 ${t.name}</option>`).join('')}
                    </select>
                </div>
            ` : ''}
        </div>
    `}).join('');

    // Teams 3x4 Grid Display
    let teamsHtml = '';
    for (let i = 0; i < 12; i++) {
        if (i < teamsList.length) {
            const t = teamsList[i];
            teamsHtml += `
                <div class="team-card-square">
                    <div class="logo-area"><img src="${t.logo}" alt="${t.name}"></div>
                    <div class="team-name-bar">${t.name}</div>
                </div>
            `;
        } else {
            teamsHtml += `
                <div class="team-card-square">
                    <div class="logo-area"></div>
                    <div class="team-name-bar">-</div>
                </div>
            `;
        }
    }
    document.getElementById('displayTeamsGrid').innerHTML = teamsHtml;

    renderMapScreens(matchesList, teamsList);
    updatePreviewScale();
}

function renderMapScreens(matches, teams) {
    const container = document.getElementById('dynamic-map-screens');
    const MAPS_PER_PAGE = 5;
    const mapPages = [];
    for (let i = 0; i < matches.length; i += MAPS_PER_PAGE) {
        mapPages.push(matches.slice(i, i + MAPS_PER_PAGE));
    }

    const currentPages = container.querySelectorAll('.view-screen');
    if (currentPages.length !== mapPages.length) {
        container.innerHTML = '';
        mapPages.forEach((pageMatches, pageIndex) => {
            const screenDiv = document.createElement('div');
            screenDiv.className = `view-screen map-screen-page-${pageIndex + 1}`;
            screenDiv.innerHTML = `<div class="maps-stack-5"></div>`;
            container.appendChild(screenDiv);
        });
    }

    mapPages.forEach((pageMatches, pageIndex) => {
        const screenDiv = container.children[pageIndex];
        const stackDiv = screenDiv.querySelector('.maps-stack-5');
        const currentCards = stackDiv.querySelectorAll('.map-card-outer');

        if (currentCards.length !== pageMatches.length) {
            stackDiv.innerHTML = pageMatches.map(() => `
                <div class="map-card-outer">
                    <div class="map-card-inner">
                        <div class="map-image-container">
                            <div class="map-bg-img"></div>
                            <div class="map-dark-overlay"></div>
                            <div class="status-inline-container"></div>
                            <div class="winner-logo-container"></div>
                        </div>
                        <div class="map-tab-orange"></div>
                    </div>
                </div>
            `).join('');
        }

        const cards = stackDiv.querySelectorAll('.map-card-outer');
        pageMatches.forEach((m, idx) => {
            const card = cards[idx];
            const status = m.status || (m.booyahTeam ? 'booyah' : 'normal');
            const isBooyah = status === 'booyah';
            const isUpcoming = status === 'upcoming';
            const showShadow = isBooyah || isUpcoming;
            const winnerObj = teams.find(t => t.name === m.booyahTeam);
            const mapBg = PRESET_MAPS[m.map] || PRESET_MAPS['RANDOM'];
            const labelVal = m.labelVal || `ROUND ${idx + 1}`;

            const bgDiv = card.querySelector('.map-bg-img');
            if (bgDiv.style.backgroundImage !== `url("${mapBg}")`) {
                bgDiv.style.backgroundImage = `url('${mapBg}')`;
            }

            const overlay = card.querySelector('.map-dark-overlay');
            if (showShadow) {
                overlay.classList.add('active-overlay');
            } else {
                overlay.classList.remove('active-overlay');
            }

            const statusContainer = card.querySelector('.status-inline-container');
            let statusHtml = '';
            if (isUpcoming) {
                statusHtml = `<div class="upcoming-text">UPCOMING</div>`;
            } else if (isBooyah) {
                statusHtml = `<img class="booyah-embedded-img" src="${BOOYAH_IMG_SRC}" alt="BOOYAH!">`;
            }
            if (statusContainer.innerHTML !== statusHtml) {
                statusContainer.innerHTML = statusHtml;
            }

            const winnerContainer = card.querySelector('.winner-logo-container');
            let winnerHtml = (isBooyah && winnerObj) ? `<img class="winner-logo-topright" src="${winnerObj.logo}" alt="${winnerObj.name}">` : '';
            if (winnerContainer.innerHTML !== winnerHtml) {
                winnerContainer.innerHTML = winnerHtml;
            }

            const combinedLabel = `${labelVal} - ${m.map}`;
            const tagTab = card.querySelector('.map-tab-orange');
            if (tagTab.innerText !== combinedLabel) tagTab.innerText = combinedLabel;
        });
    });
}

function startAutoRotation() {
    if (autoSwitchTimer) clearInterval(autoSwitchTimer);
    if (!state.autoSwitch) return;

    autoSwitchTimer = setInterval(() => {
        const allScreens = document.querySelectorAll('.view-screen');
        if (allScreens.length <= 1) return;

        const prevIndex = currentScreenIndex;
        currentScreenIndex = (currentScreenIndex + 1) % allScreens.length;

        allScreens[prevIndex].classList.remove('active');
        allScreens[currentScreenIndex].classList.add('active');

    }, (state.delay || 5) * 1000);
}

function copyObsLink() {
    const obsUrl = window.location.origin + window.location.pathname + '?view=obs';
    navigator.clipboard.writeText(obsUrl)
        .then(() => alert('คัดลอกลิงก์สำหรับ OBS Browser Source เรียบร้อย!\n' + obsUrl));
}

function openObsPreview() {
    window.open(window.location.origin + window.location.pathname + '?view=obs', '_blank');
}

window.onload = () => {
    initFirebaseListener();
    updatePreviewScale();
};
