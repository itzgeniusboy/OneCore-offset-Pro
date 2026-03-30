// OneCore Offset Pro - FULL WORKING VERSION

let currentData = [];
let currentFilter = 'all';
let currentSearch = '';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const resultsList = document.getElementById('resultsList');
    const exportBtn = document.getElementById('exportBtn');
    const themeToggle = document.getElementById('themeToggle');
    const searchInput = document.getElementById('searchInput');
    const voiceBtn = document.getElementById('voiceBtn');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const statsBar = document.getElementById('statsBar');
    const totalCount = document.getElementById('totalCount');
    const stringCount = document.getElementById('stringCount');
    const funcCount = document.getElementById('funcCount');
    const structCount = document.getElementById('structCount');

    // File upload click
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#e94560';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#2a2a4a';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.so')) {
            loadFile(file);
        } else {
            alert('Please select a .so file');
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            loadFile(e.target.files[0]);
        }
    });

    // Load file function
    function loadFile(file) {
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const bytes = new Uint8Array(e.target.result);
            const strings = extractStrings(bytes);
            displayResults(strings);
            progressContainer.style.display = 'none';
        };
        
        reader.onerror = function() {
            progressContainer.style.display = 'none';
            alert('Error loading file');
        };
        
        reader.readAsArrayBuffer(file);
    }

    // Extract strings from bytes
    function extractStrings(bytes) {
        const strings = [];
        let current = '';
        let start = 0;
        
        for (let i = 0; i < bytes.length; i++) {
            // Update progress
            if (i % 1000000 === 0) {
                const percent = (i / bytes.length) * 100;
                progressFill.style.width = percent + '%';
                progressPercent.textContent = Math.round(percent) + '%';
            }
            
            const char = bytes[i];
            if (char >= 32 && char <= 126) {
                if (current === '') start = i;
                current += String.fromCharCode(char);
            } else {
                if (current.length >= 4) {
                    strings.push({
                        offset: start,
                        value: current,
                        type: getType(current)
                    });
                }
                current = '';
            }
        }
        
        if (current.length >= 4) {
            strings.push({
                offset: start,
                value: current,
                type: getType(current)
            });
        }
        
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        
        return strings;
    }

    // Get type of string
    function getType(value) {
        if (value.match(/^[a-z_][a-z0-9_]*$/i) && value.includes('_')) {
            return 'function';
        }
        if (value.match(/^[A-Z][a-zA-Z0-9]*$/)) {
            return 'struct';
        }
        return 'string';
    }

    // Display results
    function displayResults(data) {
        currentData = data;
        
        // Update stats
        const strings = data.filter(d => d.type === 'string').length;
        const funcs = data.filter(d => d.type === 'function').length;
        const structs = data.filter(d => d.type === 'struct').length;
        
        totalCount.textContent = data.length;
        stringCount.textContent = strings;
        funcCount.textContent = funcs;
        structCount.textContent = structs;
        statsBar.style.display = 'flex';
        exportBtn.disabled = false;
        
        renderResults();
    }

    // Render results
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
            resultsList.innerHTML = '<div style="text-align:center; padding:40px;">🔍 No results found</div>';
            return;
        }
        
        let html = '';
        for (let i = 0; i < filtered.length; i++) {
            const item = filtered[i];
            const offsetHex = '0x' + item.offset.toString(16);
            html += `
                <div style="display: grid; grid-template-columns: 120px 100px 1fr 80px; padding: 10px 15px; border-bottom: 1px solid #2a2a4a; cursor: pointer;" onclick="showDetail('${offsetHex}', '${escapeHtml(item.value)}', '${item.type}')">
                    <div style="color: #e94560; font-family: monospace;">${offsetHex}</div>
                    <div><span style="background: ${item.type === 'string' ? '#4caf50' : (item.type === 'function' ? '#2196f3' : '#ff9800')}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${item.type}</span></div>
                    <div style="font-family: monospace; word-break: break-all;">${escapeHtml(item.value)}</div>
                    <div><button onclick="event.stopPropagation(); copyOffset('${offsetHex}')" style="background: none; border: 1px solid #2a2a4a; padding: 4px 12px; border-radius: 5px; cursor: pointer;">📋 Copy</button></div>
                </div>
            `;
        }
        
        resultsList.innerHTML = html;
    }

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

    // Export
    exportBtn.addEventListener('click', () => {
        if (currentData.length === 0) {
            alert('No data to export');
            return;
        }
        
        let csv = 'Offset (Hex),Offset (Dec),Value,Type\n';
        for (const item of currentData) {
            csv += `0x${item.offset.toString(16)},${item.offset},${item.value},${item.type}\n`;
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onecore_export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        themeToggle.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
    });

    // Voice search
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        
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
});

// Global functions for onclick
function copyOffset(offset) {
    navigator.clipboard.writeText(offset);
    showToast('Copied: ' + offset);
}

function showDetail(offset, value, type) {
    const modal = document.getElementById('offsetModal');
    const modalDetails = document.getElementById('modalDetails');
    
    modalDetails.innerHTML = `
        <p><strong>Offset:</strong> <code style="color:#e94560">${offset}</code></p>
        <p><strong>Decimal:</strong> ${parseInt(offset, 16)}</p>
        <p><strong>Value:</strong> ${value}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Size:</strong> ${value.length} bytes</p>
        <button onclick="copyOffset('${offset}')" style="background:#e94560; color:white; border:none; padding:10px 20px; border-radius:8px; margin-top:10px; cursor:pointer;">📋 Copy Offset</button>
    `;
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('offsetModal').style.display = 'none';
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#4caf50';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '1000';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
