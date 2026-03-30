// Export Manager - CSV, JSON, TXT, IDA Script, Frida Script

class ExportManager {
    constructor() {
        this.data = null;
        this.offsets = null;
        this.levels = null;
        this.structures = null;
    }

    setData(data) {
        this.data = data;
        this.offsets = data.offsets || [];
        this.levels = data.levels || [];
        this.structures = data.structures || [];
    }

    exportToCSV() {
        if (!this.offsets.length) return null;
        
        const headers = ['File Offset', 'Virtual Address', 'Value', 'Type', 'Size', 'Section'];
        const rows = this.offsets.map(o => [
            o.fileOffsetHex || '0x' + o.offset?.toString(16) || '',
            o.virtualAddressHex || '',
            o.value || '',
            o.type || 'string',
            o.size || (o.value?.length || 0),
            o.section || 'unknown'
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    exportToJSON() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            summary: {
                totalOffsets: this.offsets.length,
                totalLevels: this.levels?.length || 0,
                totalStructures: this.structures?.length || 0
            },
            offsets: this.offsets,
            levels: this.levels,
            structures: this.structures
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    exportToTXT() {
        let output = '========================================\n';
        output += 'OneCore Offset Pro - Export Report\n';
        output += `Exported: ${new Date().toLocaleString()}\n`;
        output += '========================================\n\n';
        
        // Summary
        output += 'SUMMARY\n';
        output += `Total Offsets: ${this.offsets.length}\n`;
        output += `Total Levels: ${this.levels?.length || 0}\n`;
        output += `Total Structures: ${this.structures?.length || 0}\n\n`;
        
        // Offsets
        output += '========================================\n';
        output += 'OFFSETS\n';
        output += '========================================\n\n';
        
        for (const o of this.offsets) {
            output += `${o.fileOffsetHex || '0x' + o.offset?.toString(16)} | `;
            output += `${o.type || 'string'} | `;
            output += `${o.value || ''} | `;
            output += `Size: ${o.size || o.value?.length || 0}\n`;
        }
        
        // Levels
        if (this.levels && this.levels.length > 0) {
            output += '\n========================================\n';
            output += 'LEVELS\n';
            output += '========================================\n\n';
            
            for (const level of this.levels) {
                output += `Level ${level.level}: ${level.value} @ ${level.offsetHex}\n`;
            }
        }
        
        return output;
    }

    exportToIDAScript() {
        let script = '// ========================================\n';
        script += '// OneCore Offset Pro - IDA Python Script\n';
        script += `// Generated: ${new Date().toISOString()}\n`;
        script += '// ========================================\n\n';
        script += 'import idc\n';
        script += 'import idaapi\n';
        script += 'import ida_name\n\n';
        
        script += 'def create_structures():\n';
        script += '    """Auto-generated structures from OneCore Offset Pro"""\n\n';
        
        // Add offsets as comments
        script += '    # ===== OFFSETS =====\n';
        for (const o of this.offsets.slice(0, 100)) {
            const addr = o.virtualAddress || o.offset;
            const safeName = this.sanitizeName(o.value || `offset_${addr}`);
            script += `    idc.MakeName(0x${addr?.toString(16) || '0'}, "${safeName}")\n`;
            script += `    idc.MakeComm(0x${addr?.toString(16) || '0'}, "Type: ${o.type || 'string'} | Size: ${o.size || o.value?.length || 0}")\n\n`;
        }
        
        script += '\n    # ===== LEVELS =====\n';
        if (this.levels) {
            for (const level of this.levels) {
                script += `    idc.MakeComm(0x${level.offsetHex.replace('0x', '')}, "Level ${level.level}: ${level.value}")\n`;
            }
        }
        
        script += '\nif __name__ == "__main__":\n';
        script += '    create_structures()\n';
        script += '    print("[+] OneCore Offset Pro structures loaded!")\n';
        
        return script;
    }

    exportToFridaScript() {
        let script = '// ========================================\n';
        script += '// OneCore Offset Pro - Frida Script\n';
        script += `// Generated: ${new Date().toISOString()}\n`;
        script += '// ========================================\n\n';
        
        script += 'Java.perform(function() {\n';
        script += '    console.log("[+] OneCore Offset Pro Frida script loaded");\n\n';
        script += '    // Get module base address\n';
        script += '    var module = Process.getModuleByName("libgame.so");\n';
        script += '    if (!module) {\n';
        script += '        console.log("[-] libgame.so not found");\n';
        script += '        return;\n';
        script += '    }\n';
        script += '    var base = module.base;\n';
        script += '    console.log("[+] libgame.so base: " + base);\n\n';
        
        // Add offset readings
        script += '    // ===== READ STRINGS =====\n';
        const stringOffsets = this.offsets.filter(o => o.type === 'string').slice(0, 50);
        for (const o of stringOffsets) {
            const offset = o.fileOffset || o.offset;
            const safeName = this.sanitizeName(o.value || `offset_${offset}`);
            script += `    var ${safeName} = base.add(0x${offset?.toString(16) || '0'}).readCString();\n`;
            script += `    console.log("${safeName}: " + ${safeName});\n`;
        }
        
        script += '\n    // ===== HOOK FUNCTIONS =====\n';
        script += '    // Uncomment to enable hooks\n';
        script += '    /*\n';
        
        const functionOffsets = this.offsets.filter(o => o.type === 'function').slice(0, 10);
        for (const o of functionOffsets) {
            const offset = o.fileOffset || o.offset;
            const safeName = this.sanitizeName(o.value || `func_${offset}`);
            script += `    Interceptor.attach(base.add(0x${offset?.toString(16) || '0'}), {\n`;
            script += `        onEnter: function(args) {\n`;
            script += `            console.log("[+] ${safeName} called");\n`;
            script += `        },\n`;
            script += `        onLeave: function(retval) {\n`;
            script += `            console.log("[-] ${safeName} returned: " + retval);\n`;
            script += `        }\n`;
            script += `    });\n`;
        }
        
        script += '    */\n';
        script += '});\n';
        
        return script;
    }

    exportToHTML() {
        let html = `<!DOCTYPE html>
<html>
<head>
    <title>OneCore Offset Pro - Report</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #e94560; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #2a2a4a; padding: 8px; text-align: left; }
        th { background: #0f3460; }
        .offset { color: #e94560; }
        .string { color: #4caf50; }
        .function { color: #2196f3; }
        .struct { color: #ff9800; }
    </style>
</head>
<body>
    <h1>🔧 OneCore Offset Pro - Analysis Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Summary</h2>
    <ul>
        <li>Total Offsets: ${this.offsets.length}</li>
        <li>Total Levels: ${this.levels?.length || 0}</li>
        <li>Total Structures: ${this.structures?.length || 0}</li>
    </ul>
    
    <h2>Offsets</h2>
    <table>
        <thead>
            <tr><th>Offset</th><th>Type</th><th>Value</th><th>Size</th></tr>
        </thead>
        <tbody>`;
        
        for (const o of this.offsets.slice(0, 200)) {
            const offset = o.fileOffsetHex || '0x' + o.offset?.toString(16);
            const typeClass = o.type === 'string' ? 'string' : (o.type === 'function' ? 'function' : 'struct');
            html += `<tr>
                <td class="offset">${offset}</td>
                <td class="${typeClass}">${o.type || 'string'}</td>
                <td>${this.escapeHtml(o.value || '')}</td>
                <td>${o.size || o.value?.length || 0}</td>
            </tr>`;
        }
        
        html += `</tbody></table></body></html>`;
        
        return html;
    }

    sanitizeName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    download(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportAndDownload(format) {
        let content = null;
        let filename = `onecore_export_${Date.now()}`;
        let mimeType = 'text/plain';
        
        switch(format) {
            case 'csv':
                content = this.exportToCSV();
                filename += '.csv';
                mimeType = 'text/csv';
                break;
            case 'json':
                content = this.exportToJSON();
                filename += '.json';
                mimeType = 'application/json';
                break;
            case 'txt':
                content = this.exportToTXT();
                filename += '.txt';
                break;
            case 'ida':
                content = this.exportToIDAScript();
                filename += '_ida.py';
                mimeType = 'text/x-python';
                break;
            case 'frida':
                content = this.exportToFridaScript();
                filename += '_frida.js';
                mimeType = 'text/javascript';
                break;
            case 'html':
                content = this.exportToHTML();
                filename += '.html';
                mimeType = 'text/html';
                break;
            default:
                return;
        }
        
        if (content) {
            this.download(content, filename, mimeType);
            return true;
        }
        return false;
    }
}

// Export
window.ExportManager = ExportManager;
