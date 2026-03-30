// OneCore Offset Pro - Main JavaScript

let currentData = [];
let originalData = [];
let currentFilter = 'all';
let currentSearch = '';
let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
let currentFile = null;
let isPaused = false;
let shouldCancel = false;
let worker = null;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressSpeed = document.getElementById('progressSpeed');
const progressTime = document.getElementById('progressTime');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const searchInput = document.getElementById('searchInput');
const voiceBtn = document.getElementById('voiceBtn');
const filterBtns = document.querySelectorAll('.filter-btn');
const statsBar = document.getElementById('statsBar');
const totalCount = document.getElementById('totalCount');
const stringCount = document.getElementById('stringCount');
const funcCount = document.getElementById('funcCount');
const structCount = document.getElementById('structCount');
const resultsList = document.getElementById('resultsList');
const exportBtn = document.getElementById('exportBtn');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const themeToggle = document.getElementById('themeToggle');

// File Upload Handlers
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border)';
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.so')) {
        loadFile(file);
    } else {
        showToast('Please select a .so file', 'error');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0]);
});

async function loadFile(file) {
    currentFile = file;
    shouldCancel = false;
    isPaused = false;
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';
    progressContainer.style.display = 'block';
    
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const chunks = Math.ceil(file.size / chunkSize);
    let processedChunks = 0;
    let allData = [];
    
    const startTime = Date.now();
    
    for (let i = 0; i < chunks; i++) {
        if (shouldCancel) {
            showToast('Processing cancelled', 'warning');
            progressContainer.style.display = 'none';
            return;
        }
        
        while (isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (shouldCancel) return;
        }
        
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const chunkData = await readChunk(chunk);
        
        allData.push(...chunkData);
        processedChunks++;
        
        const percent = (processedChunks / chunks) * 100;
        progressFill.style.width = percent + '%';
        progressPercent.textContent = Math.round(percent) + '%';
        
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (file.size / elapsed / 1024 / 1024).toFixed(1);
        progressSpeed.textContent = `${speed} MB/s`;
        
        const remaining = (elapsed / processedChunks) * (chunks - processedChunks);
        progressTime.textContent = `${Math.round(remaining)} sec remaining`;
    }
    
    processExtractedData(allData);
}

function readChunk(chunk) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const bytes = new Uint8Array(e.target.result);
            const strings = extractStringsFromBytes(bytes);
            resolve(strings);
        };
        reader.readAsArrayBuffer(chunk);
    });
}

function extractStringsFromBytes(bytes) {
    const strings = [];
    let currentString = '';
    let startOffset = 0;
    
    for (let i = 0; i < bytes.length; i++) {
        const char = bytes[i];
        if (char >= 32 && char <= 126) {
            if (currentString === '') startOffset = i;
            currentString += String.fromCharCode(char);
        } else {
            if (currentString.length >= 4) {
                strings.push({
                    offset: startOffset,
                    value: currentString,
                    type: detectType(currentString)
                });
            }
            currentString = '';
        }
    }
    return strings;
}

function detectType(value) {
    if (value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        if (value.includes('_') || value.match(/^[a-z]/)) return 'function';
        return 'string';
    }
    return 'string';
}

function processExtractedData(data) {
    originalData = data;
    currentData = [...originalData];
    updateStats();
    renderResults();
    exportBtn.disabled = false;
    bookmarkBtn.disabled = false;
    progressContainer.style.display = 'none';
    showToast(`Loaded ${data.length} strings/offsets`, 'success');
}

function updateStats() {
    const strings = currentData.filter(d => d.type === 'string').length;
    const funcs = currentData.filter(d => d.type === 'function').length;
    const structs = currentData.filter(d => d.type === 'struct').length;
    
    totalCount.textContent = currentData.length;
    stringCount.textContent = strings;
    funcCount.textContent = funcs;
    structCount.textContent = structs;
    statsBar.style.display = 'flex';
}

function renderResults() {
    let filtered = currentData;
    
    if (currentSearch) {
        filtered = filtered.filter(d => 
            d.value.toLowerCase().includes(currentSearch.toLowerCase())
        );
    }
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(d => d.type === currentFilter);
    }
    
    if (filtered.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No results found</p></div>';
        return;
    }
    
    resultsList.innerHTML = filtered.map(item => `
        <div class="result-item" data-offset="${item.offset}" data-value="${item.value}" data-type="${item.type}">
            <div class="result-offset">0x${item.offset.toString(16)}</div>
            <div><span class="result-type type-${item.type}">${item.type}</span></div>
            <div class="result-value">${escapeHtml(item.value)}</div>
            <div><button class="copy-btn-small" onclick="copyOffset('0x${item.offset.toString(16)}', event)">📋 Copy</button></div>
        </div>
    `).join('');
    
    document.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!e.target.classList.contains('copy-btn-small')) {
                showOffsetDetails(el.dataset);
            }
        });
    });
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function copyOffset(offset, event) {
    event.stopPropagation();
    navigator.clipboard.writeText(offset);
    showToast(`Copied: ${offset}`, 'success');
}

function showOffsetDetails(data) {
    const modal = document.getElementById('offsetModal');
    const modalDetails = document.getElementById('modalDetails');
    const offset = data.offset;
    const value = data.value;
    const type = data.type;
    
    modalDetails.innerHTML = `
        <p><strong>Offset:</strong> ${offset}</p>
        <p><strong>Decimal:</strong> ${parseInt(offset, 16)}</p>
        <p><strong>Value:</strong> ${escapeHtml(value)}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Size:</strong> ${value.length} bytes</p>
    `;
    
    modal.style.display = 'flex';
    document.getElementById('copyModalBtn').onclick = () => {
        navigator.clipboard.writeText(offset);
        showToast(`Copied: ${offset}`, 'success');
    };
}

document.querySelector('.close').onclick = () => {
    document.getElementById('offsetModal').style.display = 'none';
};

// Search
searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderResults();
});

// Filters
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderResults();
    });
});

// Voice Input
if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    
    voiceBtn.addEventListener('click', () => {
        recognition.start();
        voiceBtn.textContent = '🎤 Listening...';
    });
    
    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript;
        searchInput.value = command;
        currentSearch = command;
        renderResults();
        voiceBtn.textContent = '🎤';
    };
    
    recognition.onend = () => {
        voiceBtn.textContent = '🎤';
    };
}

// Theme Toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light');
    themeToggle.textContent = '🌙 Dark Mode';
}

// Pause/Resume/Cancel
pauseBtn.addEventListener('click', () => {
    isPaused = true;
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'inline-block';
});

resumeBtn.addEventListener('click', () => {
    isPaused = false;
    pauseBtn.style.display = 'inline-block';
    resumeBtn.style.display = 'none';
});

cancelBtn.addEventListener('click', () => {
    shouldCancel = true;
    isPaused = false;
});

// Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Export Placeholder
exportBtn.addEventListener('click', () => {
    showToast('Export feature coming in next update!', 'info');
});

bookmarkBtn.addEventListener('click', () => {
    showToast('Bookmark feature coming in next update!', 'info');
});
