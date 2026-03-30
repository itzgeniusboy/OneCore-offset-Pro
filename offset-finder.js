// Offset Finder - Advanced offset calculation and management

class OffsetFinder {
    constructor() {
        this.offsets = [];
        this.virtualAddresses = new Map();
        this.fileOffsets = new Map();
    }

    calculateOffsets(strings, baseAddress = 0, fileBase = 0) {
        const offsets = [];
        
        for (const str of strings) {
            const fileOffset = str.offset + fileBase;
            const virtualAddr = str.virtualAddr ? str.virtualAddr : baseAddress + str.offset;
            
            offsets.push({
                fileOffset: fileOffset,
                fileOffsetHex: '0x' + fileOffset.toString(16),
                virtualAddress: virtualAddr,
                virtualAddressHex: '0x' + virtualAddr.toString(16),
                value: str.value,
                type: str.type || 'string',
                size: str.size || str.value.length,
                section: str.section || 'unknown'
            });
            
            this.fileOffsets.set(fileOffset, str);
            this.virtualAddresses.set(virtualAddr, str);
        }
        
        this.offsets = offsets;
        return offsets;
    }

    findOffsetByValue(value) {
        return this.offsets.find(o => o.value === value);
    }

    findOffsetsByPattern(pattern) {
        const regex = new RegExp(pattern, 'i');
        return this.offsets.filter(o => regex.test(o.value));
    }

    findOffsetsByRange(start, end, isVirtual = false) {
        if (isVirtual) {
            return this.offsets.filter(o => 
                o.virtualAddress >= start && o.virtualAddress <= end
            );
        } else {
            return this.offsets.filter(o => 
                o.fileOffset >= start && o.fileOffset <= end
            );
        }
    }

    getOffsetGroups(groupSize = 0x1000) {
        const groups = new Map();
        
        for (const offset of this.offsets) {
            const group = Math.floor(offset.fileOffset / groupSize);
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group).push(offset);
        }
        
        return groups;
    }

    findRelatedOffsets(offset, maxDistance = 0x100) {
        const related = [];
        const target = typeof offset === 'string' ? parseInt(offset, 16) : offset;
        
        for (const o of this.offsets) {
            const distance = Math.abs(o.fileOffset - target);
            if (distance > 0 && distance <= maxDistance) {
                related.push({
                    ...o,
                    distance: distance
                });
            }
        }
        
        return related.sort((a, b) => a.distance - b.distance);
    }

    detectOffsetPattern() {
        if (this.offsets.length < 2) return null;
        
        const offsets = this.offsets.map(o => o.fileOffset).sort((a, b) => a - b);
        const gaps = [];
        
        for (let i = 1; i < offsets.length; i++) {
            gaps.push(offsets[i] - offsets[i - 1]);
        }
        
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const commonGap = this.findMostCommonGap(gaps);
        
        const isRegular = gaps.every(g => Math.abs(g - commonGap) < commonGap * 0.1);
        
        return {
            isRegular: isRegular,
            commonGap: commonGap,
            avgGap: avgGap,
            startOffset: offsets[0],
            endOffset: offsets[offsets.length - 1],
            count: offsets.length,
            pattern: isRegular ? `offset = 0x${offsets[0].toString(16)} + (index * 0x${commonGap.toString(16)})` : null
        };
    }

    findMostCommonGap(gaps) {
        const freq = new Map();
        for (const gap of gaps) {
            freq.set(gap, (freq.get(gap) || 0) + 1);
        }
        
        let maxCount = 0;
        let mostCommon = gaps[0];
        
        for (const [gap, count] of freq) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = gap;
            }
        }
        
        return mostCommon;
    }

    getOffsetStatistics() {
        if (this.offsets.length === 0) return null;
        
        const offsets = this.offsets.map(o => o.fileOffset);
        const min = Math.min(...offsets);
        const max = Math.max(...offsets);
        const totalSize = max - min;
        
        const sections = {};
        for (const o of this.offsets) {
            if (!sections[o.section]) {
                sections[o.section] = [];
            }
            sections[o.section].push(o);
        }
        
        return {
            totalOffsets: this.offsets.length,
            minOffset: min,
            minOffsetHex: '0x' + min.toString(16),
            maxOffset: max,
            maxOffsetHex: '0x' + max.toString(16),
            totalSize: totalSize,
            totalSizeHex: '0x' + totalSize.toString(16),
            sections: Object.keys(sections).map(s => ({
                name: s,
                count: sections[s].length,
                minOffset: Math.min(...sections[s].map(o => o.fileOffset)),
                maxOffset: Math.max(...sections[s].map(o => o.fileOffset))
            })),
            avgSize: this.offsets.reduce((sum, o) => sum + o.size, 0) / this.offsets.length
        };
    }

    exportOffsets(format = 'csv') {
        if (format === 'csv') {
            const headers = ['File Offset', 'Virtual Address', 'Value', 'Type', 'Size', 'Section'];
            const rows = this.offsets.map(o => [
                o.fileOffsetHex,
                o.virtualAddressHex,
                o.value,
                o.type,
                o.size,
                o.section
            ]);
            return [headers, ...rows];
        }
        
        if (format === 'json') {
            return this.offsets;
        }
        
        if (format === 'txt') {
            return this.offsets.map(o => 
                `${o.fileOffsetHex}\t${o.virtualAddressHex}\t${o.value}\t${o.type}\t${o.size}\t${o.section}`
            ).join('\n');
        }
        
        return this.offsets;
    }

    generateIDAScript() {
        let script = '// Auto-generated IDA Python script\n';
        script += 'import idc\nimport idaapi\n\n';
        
        for (const o of this.offsets) {
            const safeName = o.value.replace(/[^a-zA-Z0-9_]/g, '_');
            script += `idc.MakeName(0x${o.virtualAddress.toString(16)}, "${safeName}")\n`;
            script += `idc.MakeComm(0x${o.virtualAddress.toString(16)}, "Size: ${o.size} bytes | Type: ${o.type}")\n\n`;
        }
        
        return script;
    }

    generateFridaScript() {
        let script = '// Auto-generated Frida script\n';
        script += 'Java.perform(function() {\n';
        script += '    var module = Module.findBaseAddress("libgame.so");\n\n';
        
        for (const o of this.offsets) {
            if (o.type === 'string') {
                script += `    // String at offset ${o.fileOffsetHex}\n`;
                script += `    var str_${o.value.replace(/[^a-zA-Z0-9_]/g, '_')} = module.add(0x${o.fileOffset.toString(16)}).readCString();\n`;
                script += `    console.log("Found: " + str_${o.value.replace(/[^a-zA-Z0-9_]/g, '_')});\n\n`;
            }
        }
        
        script += '});\n';
        return script;
    }

    searchByKeyword(keyword) {
        const lowerKeyword = keyword.toLowerCase();
        return this.offsets.filter(o => 
            o.value.toLowerCase().includes(lowerKeyword)
        );
    }

    getOffsetAtAddress(address, isVirtual = true) {
        if (isVirtual) {
            return this.virtualAddresses.get(address);
        } else {
            return this.fileOffsets.get(address);
        }
    }

    getOffsetsByType(type) {
        return this.offsets.filter(o => o.type === type);
    }
}

// Export
window.OffsetFinder = OffsetFinder;
