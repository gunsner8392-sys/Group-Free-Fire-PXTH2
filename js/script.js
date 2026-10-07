const firebaseConfig = {
  apiKey: "AIzaSyCtpuArW_VhP4Q-UNlMJ-6M8lot19gi8k8",
  authDomain: "kimoo-dfbef.firebaseapp.com",
  databaseURL: "https://kimoo-dfbef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kimoo-dfbef",
  storageBucket: "kimoo-dfbef.firebasestorage.app",
  messagingSenderId: "864165516996",
  appId: "1:864165516996:web:33cb20b8670d2e38335b91",
  measurementId: "G-DZEM9T87ZD"
};

firebase.initializeApp(firebaseConfig);
const dbRef = firebase.database().ref("maprand_pro_state");

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("obs") === "1") {
  document.documentElement.classList.add("obs-mode");
  document.body.classList.add("obs-mode");
}

const DEFAULT_MAPS = [
  { name: "BERMUDA", image: "PG/5.webp", weight: 10 },
  { name: "NEXTERRA", image: "PG/1.webp", weight: 10 },
  { name: "KALAHARI", image: "PG/2.webp", weight: 10 },
  { name: "PURGATORY", image: "PG/4.webp", weight: 10 },
  { name: "SORALA", image: "PG/3.webp", weight: 10 }
];

function preloadImages() {
  DEFAULT_MAPS.forEach(map => {
    const img = new Image();
    img.src = map.image;
  });
}
preloadImages();

const PENALTY_DECAY_FACTOR = 0.15; 

let MATCHES = [
  { state: 'idle', selectedIndex: 0, reelSequence: [] },
  { state: 'idle', selectedIndex: 0, reelSequence: [] },
  { state: 'idle', selectedIndex: 0, reelSequence: [] }
];

let mapUsageCount = [0, 0, 0, 0, 0];
let lastSpunHistory = [];
let isAutoSpinning = false;
let isCustomizedWeights = false; 
let isSyncingFromRemote = false;
let globalSpinLock = false;
const activeAnimations = {};

const gridContainer = document.getElementById("gridContainer");

function getSecureRandom() {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / 4294967296;
  }
  return Math.random();
}

function applyStateData(data) {
  if (!data) return;
  if (data.mapUsageCount) mapUsageCount = data.mapUsageCount;
  if (data.lastSpunHistory) lastSpunHistory = data.lastSpunHistory;
  if (data.weights) {
    data.weights.forEach((w, i) => {
      if (DEFAULT_MAPS[i]) DEFAULT_MAPS[i].weight = w;
    });
  }
  if (data.isCustomizedWeights !== undefined) isCustomizedWeights = data.isCustomizedWeights;

  if (data.theme) {
    document.body.setAttribute("data-theme", data.theme);
    const el = document.getElementById("themeSelect");
    if (el) el.value = data.theme;
  }
  if (data.orientation) {
    const el = document.getElementById("orientSelect");
    if (el) el.value = data.orientation;
    if (gridContainer) gridContainer.className = `grid-container ${data.orientation}`;
  }
  if (data.cardWidth) {
    const el = document.getElementById("widthRange");
    if (el) el.value = data.cardWidth;
    document.documentElement.style.setProperty('--card-width', data.cardWidth + 'px');
  }
  if (data.cardHeight) {
    const el = document.getElementById("heightRange");
    if (el) el.value = data.cardHeight;
    document.documentElement.style.setProperty('--card-height', data.cardHeight + 'px');
  }
  if (data.cardGapX !== undefined) {
    const el = document.getElementById("gapXRange");
    if (el) el.value = data.cardGapX;
    document.documentElement.style.setProperty('--card-gap-x', data.cardGapX + 'px');
  }
  if (data.cardGapY !== undefined) {
    const el = document.getElementById("gapYRange");
    if (el) el.value = data.cardGapY;
    document.documentElement.style.setProperty('--card-gap-y', data.cardGapY + 'px');
  }

  if (data.cooldown) {
    const el = document.getElementById("cooldownSelect");
    if (el) el.value = data.cooldown;
  }

  if (data.matches) {
    MATCHES = data.matches;
  }
}

function saveStateToFirebase() {
  if (isSyncingFromRemote) return;
  const currentTheme = document.body.getAttribute("data-theme") || "orange";
  const orientation = document.getElementById("orientSelect")?.value || "horizontal";
  const cardWidth = document.getElementById("widthRange")?.value || "290";
  const cardHeight = document.getElementById("heightRange")?.value || "350";
  const cardGapX = document.getElementById("gapXRange")?.value || "16";
  const cardGapY = document.getElementById("gapYRange")?.value || "16";
  const cooldown = document.getElementById("cooldownSelect")?.value || "3";
  const weights = DEFAULT_MAPS.map(m => m.weight);

  const payload = {
    matches: MATCHES,
    mapUsageCount,
    lastSpunHistory,
    weights,
    theme: currentTheme,
    orientation,
    cardWidth,
    cardHeight,
    cardGapX,
    cardGapY,
    cooldown,
    isCustomizedWeights,
    updatedAt: Date.now()
  };

  try {
    localStorage.setItem("maprand_pro_state", JSON.stringify(payload));
  } catch (e) {}

  dbRef.set(payload).catch(err => {
    console.error("Firebase Sync Error:", err);
  });
}

try {
  const savedLocal = localStorage.getItem("maprand_pro_state");
  if (savedLocal) {
    applyStateData(JSON.parse(savedLocal));
  }
} catch(e) {}

dbRef.on("value", (snapshot) => {
  if (globalSpinLock) return;

  const data = snapshot.val();
  if (!data) {
    saveStateToFirebase();
    return;
  }
  isSyncingFromRemote = true;
  applyStateData(data);
  render();

  if (data.matches) {
    data.matches.forEach((m, idx) => {
      if (m.state === 'rolling' && !activeAnimations[idx]) {
        startReelAnimation(idx, m.reelSequence, 3000, true);
      }
    });
  }

  if (document.getElementById("rateModal").classList.contains("active")) {
    renderRateModal();
  }

  isSyncingFromRemote = false;
});

function openRateModal() {
  renderRateModal();
  document.getElementById("rateModal").classList.add("active");
}

function closeRateModal() {
  document.getElementById("rateModal").classList.remove("active");
}

function renderRateModal() {
  const container = document.getElementById("rateSlidersContainer");
  const badge = document.getElementById("modalStatusBadge");
  container.innerHTML = "";

  const effectiveWeights = DEFAULT_MAPS.map((m, idx) => {
    const count = mapUsageCount[idx] || 0;
    return m.weight * Math.pow(PENALTY_DECAY_FACTOR, count);
  });

  const totalWeight = effectiveWeights.reduce((sum, w) => sum + w, 0);

  if (isCustomizedWeights) {
    badge.className = "modal-status-badge custom-mode";
    badge.innerText = "⚙ สถานะ: กำหนดเอง (น้ำหนัก x 0.15^จำนวนครั้งที่เคยออก)";
  } else {
    badge.className = "modal-status-badge default-mode";
    badge.innerText = "📉 กฎลดโอกาสซ้ำแบบรุนแรง (ออก 1 ครั้ง เหลือ 15%, ออก 2 ครั้ง เหลือ 2.25%)";
  }

  DEFAULT_MAPS.forEach((map, idx) => {
    const effW = effectiveWeights[idx];
    let chancePct = 0;
    if (totalWeight > 0) {
      chancePct = ((effW / totalWeight) * 100).toFixed(1);
      if (chancePct.endsWith('.0')) chancePct = Math.round(chancePct);
    }

    const count = mapUsageCount[idx] || 0;
    const row = document.createElement("div");
    row.className = "map-rate-item";
    
    let displayStatus = `${chancePct}% (ออก ${count} ครั้ง)`;
    if (map.weight === 0) {
      displayStatus = `0% 🚫`;
    }

    row.innerHTML = `
      <span class="map-rate-name" style="${map.weight === 0 ? 'opacity: 0.35; color: #ff5252;' : ''}">${map.name}</span>
      <input type="range" class="map-rate-slider" min="0" max="20" value="${map.weight}" oninput="updateMapWeight(${idx}, this.value)">
      <span class="map-rate-val" style="${map.weight === 0 ? 'color: #ff5252;' : ''}">${displayStatus}</span>
    `;
    container.appendChild(row);
  });
}

function updateMapWeight(index, value) {
  DEFAULT_MAPS[index].weight = parseInt(value) || 0;
  isCustomizedWeights = true; 
  renderRateModal();
  saveStateToFirebase();
}

function resetRatesToEqual() {
  DEFAULT_MAPS.forEach(m => m.weight = 10);
  isCustomizedWeights = false; 
  renderRateModal();
  saveStateToFirebase();
}

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTickSound(pitch = 600) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
  } catch(e){}
}

function playWinSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.18, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.5);
    });
  } catch(e){}
}

function renderReelItemHTML(mapObj) {
  if (!mapObj) return `<div class="reel-item"></div>`;
  return `
    <div class="reel-item">
      <img class="map-svg-art" src="${mapObj.image}" loading="eager" decoding="async">
    </div>
  `;
}

function render() {
  gridContainer.innerHTML = "";

  const isAnyRolling = globalSpinLock || MATCHES.some(m => m.state === 'rolling');
  
  const btnSpinNext = document.getElementById("btnSpin");
  const btnAdd = document.getElementById("btnAddMatch");
  const btnRemove = document.getElementById("btnRemoveMatch");
  if (btnSpinNext) btnSpinNext.disabled = isAnyRolling;
  if (btnAdd) btnAdd.disabled = isAnyRolling;
  if (btnRemove) btnRemove.disabled = isAnyRolling;

  MATCHES.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "match-card";

    let displayName = "READY";
    let nameClass = "map-name placeholder";
    let reelHTML = "";

    if (m.state === 'idle') {
      displayName = "READY";
      nameClass = "map-name placeholder";
      reelHTML = `<div class="reel-item"></div>`;
    } else if (m.state === 'rolling') {
      displayName = "RANDOMIZING...";
      nameClass = "map-name spinning";
      if (m.reelSequence && m.reelSequence.length > 0) {
        m.reelSequence.forEach(mapObj => {
          reelHTML += renderReelItemHTML(mapObj);
        });
      }
    } else if (m.state === 'done') {
      const selectedMap = DEFAULT_MAPS[m.selectedIndex] || DEFAULT_MAPS[0];
      displayName = selectedMap.name;
      nameClass = "map-name";
      reelHTML = renderReelItemHTML(selectedMap);
    }

    const matchNoStr = String(i + 1).padStart(2, '0');

    card.innerHTML = `
      <div class="card-badge">MATCH ${matchNoStr}</div>
      <button class="card-reset-btn" title="รีเซ็ตแมตช์นี้" onclick="resetSingleMatch(${i})">🔄</button>

      <div class="map-viewport">
        <div class="map-reel" id="reel-${i}">
          ${reelHTML}
        </div>
        <div class="map-shade"></div>
      </div>

      <div class="card-bottom-bar">
        <div class="map-info">
          <div class="map-label">SELECTED MAP</div>
          <div class="${nameClass}" id="name-${i}">${displayName}</div>
        </div>
      </div>
    `;
    gridContainer.appendChild(card);
  });
}

function startReelAnimation(i, sequence, durationMs = 3000, isRemote = false) {
  if (activeAnimations[i]) return;
  activeAnimations[i] = true;

  setTimeout(() => {
    const reelEl = document.getElementById(`reel-${i}`);
    if (reelEl && sequence && sequence.length > 0) {
      void reelEl.offsetWidth; 
      reelEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.08, 0.82, 0.17, 1)`;
      reelEl.style.transform = `translate3d(0, -${(sequence.length - 1) * 100}%, 0)`;
    }

    let tickDelay = 45;
    let elapsed = 0;
    let currentPitch = 400;

    function scheduleTick() {
      if (!activeAnimations[i] || elapsed >= durationMs - 200) return;
      playTickSound(currentPitch);
      currentPitch += 6;
      elapsed += tickDelay;
      tickDelay *= 1.08;
      setTimeout(scheduleTick, tickDelay);
    }
    scheduleTick();

    let animationFinished = false;
    const onFinish = () => {
      if (animationFinished) return;
      animationFinished = true;
      
      delete activeAnimations[i];
      globalSpinLock = false;
      MATCHES[i].state = 'done';
      playWinSound();
      render(); 
      if (!isRemote) {
        saveStateToFirebase();
      }
    };

    if (reelEl) {
      reelEl.addEventListener("transitionend", onFinish, { once: true });
    }
    setTimeout(onFinish, durationMs + 100);
  }, 50);
}

function updateTheme() {
  document.body.setAttribute("data-theme", document.getElementById("themeSelect").value);
  saveStateToFirebase();
}

function updateOrientation() {
  const orient = document.getElementById("orientSelect").value;
  gridContainer.className = `grid-container ${orient}`;
  saveStateToFirebase();
}

function updateCardWidth(val) {
  document.documentElement.style.setProperty('--card-width', val + 'px');
  saveStateToFirebase();
}

function updateCardHeight(val) {
  document.documentElement.style.setProperty('--card-height', val + 'px');
  saveStateToFirebase();
}

function updateCardGapX(val) {
  document.documentElement.style.setProperty('--card-gap-x', val + 'px');
  saveStateToFirebase();
}

function updateCardGapY(val) {
  document.documentElement.style.setProperty('--card-gap-y', val + 'px');
  saveStateToFirebase();
}

function updateCooldown() {
  saveStateToFirebase();
}

function addMatch() {
  if (globalSpinLock) return;
  MATCHES.push({ state: 'idle', selectedIndex: 0, reelSequence: [] });
  render();
  saveStateToFirebase();
}

function removeMatch() {
  if (globalSpinLock) return;
  if (MATCHES.length > 1) {
    const popped = MATCHES.pop();
    if (popped.state === 'done') {
      const idx = popped.selectedIndex;
      if (mapUsageCount[idx] && mapUsageCount[idx] > 0) mapUsageCount[idx]--;
    }
    rebuildHistory();
    render();
    saveStateToFirebase();
  }
}

function rebuildHistory() {
  lastSpunHistory = [];
  const limit = parseInt(document.getElementById("cooldownSelect").value) || 0;
  MATCHES.forEach(m => {
    if (m.state === 'done') {
      lastSpunHistory.push(m.selectedIndex);
      if (limit > 0 && lastSpunHistory.length > limit) {
        lastSpunHistory.shift();
      }
    }
  });
}

function resetSingleMatch(index) {
  if (globalSpinLock || MATCHES[index].state === 'rolling') return;
  if (MATCHES[index].state === 'done') {
    const prevIdx = MATCHES[index].selectedIndex;
    if (mapUsageCount[prevIdx] && mapUsageCount[prevIdx] > 0) {
      mapUsageCount[prevIdx]--;
    }
  }
  MATCHES[index].state = 'idle';
  MATCHES[index].selectedIndex = 0;
  MATCHES[index].reelSequence = [];
  rebuildHistory();
  render();
  saveStateToFirebase();
}

function stopAutoSpin() {
  isAutoSpinning = false;
  const btnAuto = document.getElementById("btnAutoSpin");
  if (btnAuto) {
    btnAuto.classList.remove("active");
    btnAuto.innerText = "AUTO";
  }
}

function resetAll() {
  stopAutoSpin();
  globalSpinLock = false;
  MATCHES.forEach(m => {
    m.state = 'idle';
    m.selectedIndex = 0;
    m.reelSequence = [];
  });
  lastSpunHistory = [];
  for (let i = 0; i < DEFAULT_MAPS.length; i++) {
    mapUsageCount[i] = 0;
  }
  render();
  saveStateToFirebase();
}

function getWeightedRandomMapIndex(availableIndices) {
  let validIndices = availableIndices.filter(idx => DEFAULT_MAPS[idx].weight > 0);

  if (validIndices.length === 0) {
    validIndices = DEFAULT_MAPS.map((_, idx) => idx).filter(idx => DEFAULT_MAPS[idx].weight > 0);
  }
  if (validIndices.length === 0) {
    validIndices = DEFAULT_MAPS.map((_, idx) => idx);
  }

  const weightedList = validIndices.map(idx => {
    let baseWeight = DEFAULT_MAPS[idx].weight;
    const count = mapUsageCount[idx] || 0;
    const calculatedWeight = Math.max(1e-9, baseWeight * Math.pow(PENALTY_DECAY_FACTOR, count));
    return { index: idx, weight: calculatedWeight };
  });

  const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    const randIdx = Math.floor(getSecureRandom() * validIndices.length);
    return validIndices[randIdx];
  }

  let randomVal = getSecureRandom() * totalWeight;
  for (let item of weightedList) {
    if (randomVal <= item.weight) return item.index;
    randomVal -= item.weight;
  }
  return weightedList[weightedList.length - 1].index;
}

function rollMatchCard(i, durationMs = 3000) {
  return new Promise((resolve) => {
    if (globalSpinLock || MATCHES[i].state === 'rolling') {
      return resolve();
    }

    globalSpinLock = true;
    const cooldownLimit = parseInt(document.getElementById("cooldownSelect").value) || 0;

    let availableIndices = [];
    for (let idx = 0; idx < DEFAULT_MAPS.length; idx++) {
      if (DEFAULT_MAPS[idx].weight > 0) {
        if (cooldownLimit === 0 || !lastSpunHistory.slice(-cooldownLimit).includes(idx)) {
          availableIndices.push(idx);
        }
      }
    }

    if (availableIndices.length < 1) {
      availableIndices = DEFAULT_MAPS.map((_, idx) => idx).filter(idx => DEFAULT_MAPS[idx].weight > 0);
    }
    if (availableIndices.length === 0) {
      availableIndices = DEFAULT_MAPS.map((_, idx) => idx);
    }

    const winIdx = getWeightedRandomMapIndex(availableIndices);
    
    mapUsageCount[winIdx] = (mapUsageCount[winIdx] || 0) + 1;
    lastSpunHistory.push(winIdx);
    if (cooldownLimit > 0 && lastSpunHistory.length > cooldownLimit) {
      lastSpunHistory.shift();
    }

    const sequenceLength = 20;
    const sequence = [];
    for (let s = 0; s < sequenceLength - 1; s++) {
      const randIdx = Math.floor(getSecureRandom() * DEFAULT_MAPS.length);
      sequence.push(DEFAULT_MAPS[randIdx]);
    }
    sequence.push(DEFAULT_MAPS[winIdx]);

    MATCHES[i].state = 'rolling';
    MATCHES[i].selectedIndex = winIdx;
    MATCHES[i].reelSequence = sequence;

    render();
    saveStateToFirebase();

    startReelAnimation(i, sequence, durationMs, false);

    setTimeout(() => {
      resolve();
    }, durationMs + 150);
  });
}

async function spinNextMatch() {
  if (globalSpinLock) return;
  const idleIdx = MATCHES.findIndex(m => m.state === 'idle');
  if (idleIdx !== -1) {
    await rollMatchCard(idleIdx);
  }
}

async function toggleAutoSpin() {
  const btnAuto = document.getElementById("btnAutoSpin");
  if (isAutoSpinning) {
    stopAutoSpin();
    return;
  }

  isAutoSpinning = true;
  if (btnAuto) {
    btnAuto.classList.add("active");
    btnAuto.innerText = "STOP AUTO";
  }

  runAutoSpinLoop();
}

async function runAutoSpinLoop() {
  while (isAutoSpinning) {
    const idleIdx = MATCHES.findIndex(m => m.state === 'idle');
    if (idleIdx === -1) {
      stopAutoSpin();
      break;
    }
    await rollMatchCard(idleIdx, 2500);
    if (!isAutoSpinning) break;
    await new Promise(r => setTimeout(r, 1000));
  }
}

function toggleOBSMode() {
  document.documentElement.classList.toggle("obs-mode");
  document.body.classList.toggle("obs-mode");
}

function copyDataUrl() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("obs", "1");
  navigator.clipboard.writeText(currentUrl.toString()).then(() => {
    alert("คัดลอก URL สำหรับ OBS เรียบร้อยแล้ว!");
  }).catch(err => {
    prompt("คัดลอก URL นี้ไปใส่ใน OBS Browser Source:", currentUrl.toString());
  });
}

render();