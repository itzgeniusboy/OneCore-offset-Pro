// Level Detector - Gun, X-Suit and other level systems

class LevelDetector {
    constructor() {
        this.gunLevels = [];
        this.xSuitLevels = [];
        this.customLevels = [];
        this.levelMap = new Map();
    }

    detectAllLevels(strings, offsets) {
        // Detect gun levels
        this.gunLevels = this.detectGunLevels(strings, offsets);
        
        // Detect X-Suit levels
        this.xSuitLevels = this.detectXSuitLevels(strings, offsets);
        
        // Detect other level patterns
        this.customLevels = this.detectCustomLevels(strings, offsets);
        
        // Build complete level map
        this.buildLevelMap();
        
        return {
            gun: this.gunLevels,
            xsuit: this.xSuitLevels,
            custom: this.customLevels,
            totalLevels: this.gunLevels.length + this.xSuitLevels.length + this.customLevels.length,
            levelMap: this.levelMap
        };
    }

    detectGunLevels(strings, offsets) {
        const gunPatterns = [
            /gun[_ ]level[_ ]?(\d+)/i,
            /weapon[_ ]level[_ ]?(\d+)/i,
            /ak[_ ]?(\d+)/i,
            /m4[_ ]?(\d+)/i,
            /awp[_ ]?(\d+)/i,
            /scar[_ ]?(\d+)/i,
            /rifle[_ ]level[_ ]?(\d+)/i,
            /pistol[_ ]level[_ ]?(\d+)/i,
            /sniper[_ ]level[_ ]?(\d+)/i,
            /shotgun[_ ]level[_ ]?(\d+)/i
        ];
        
        return this.extractLevels(strings, offsets, gunPatterns, 'gun');
    }

    detectXSuitLevels(strings, offsets) {
        const xsuitPatterns = [
            /xsuit[_ ]level[_ ]?(\d+)/i,
            /x[_ ]suit[_ ]level[_ ]?(\d+)/i,
            /armor[_ ]level[_ ]?(\d+)/i,
            /exosuit[_ ]level[_ ]?(\d+)/i,
            /power[_ ]suit[_ ]level[_ ]?(\d+)/i,
            /mech[_ ]level[_ ]?(\d+)/i
        ];
        
        return this.extractLevels(strings, offsets, xsuitPatterns, 'xsuit');
    }

    detectCustomLevels(strings, offsets) {
        const customPatterns = [
            /level[_ ]?(\d+)/i,
            /lv[_ ]?(\d+)/i,
            /stage[_ ]?(\d+)/i,
            /tier[_ ]?(\d+)/i,
            /rank[_ ]?(\d+)/i
        ];
        
        return this.extractLevels(strings, offsets, customPatterns, 'custom');
    }

    extractLevels(strings, offsets, patterns, type) {
        const levels = [];
        const processed = new Set();
        
        for (let i = 0; i < strings.length; i++) {
            const str = strings[i];
            const value = str.value;
            
            for (const pattern of patterns) {
                const match = value.match(pattern);
                if (match && !processed.has(value)) {
                    processed.add(value);
                    
                    const levelNum = parseInt(match[1]);
                    const offset = str.offset || (offsets[i]?.fileOffset || 0);
                    
                    levels.push({
                        level: levelNum,
                        value: value,
                        offset: offset,
                        offsetHex: '0x' + offset.toString(16),
                        type: type,
                        size: value.length,
                        originalString: value
                    });
                }
            }
        }
        
        // Sort by level number
        return levels.sort((a, b) => a.level - b.level);
    }

    buildLevelMap() {
        this.levelMap.clear();
        
        // Add gun levels
        for (const level of this.gunLevels) {
            if (!this.levelMap.has(level.level)) {
                this.levelMap.set(level.level, {
                    gun: [],
                    xsuit: [],
                    custom: []
                });
            }
            this.levelMap.get(level.level).gun.push(level);
        }
        
        // Add X-Suit levels
        for (const level of this.xSuitLevels) {
            if (!this.levelMap.has(level.level)) {
                this.levelMap.set(level.level, {
                    gun: [],
                    xsuit: [],
                    custom: []
                });
            }
            this.levelMap.get(level.level).xsuit.push(level);
        }
        
        // Add custom levels
        for (const level of this.customLevels) {
            if (!this.levelMap.has(level.level)) {
                this.levelMap.set(level.level, {
                    gun: [],
                    xsuit: [],
                    custom: []
                });
            }
            this.levelMap.get(level.level).custom.push(level);
        }
    }

    getLevelData(levelNumber) {
        return this.levelMap.get(levelNumber) || null;
    }

    getLevelRange(startLevel, endLevel) {
        const result = [];
        for (let i = startLevel; i <= endLevel; i++) {
            const data = this.getLevelData(i);
            if (data) {
                result.push({
                    level: i,
                    data: data
                });
            }
        }
        return result;
    }

    generateLevelReport() {
        const report = {
            summary: {
                totalGunLevels: this.gunLevels.length,
                totalXSuitLevels: this.xSuitLevels.length,
                totalCustomLevels: this.customLevels.length,
                minLevel: Math.min(...Array.from(this.levelMap.keys())),
                maxLevel: Math.max(...Array.from(this.levelMap.keys()))
            },
            gunLevels: this.groupLevelsByRange(this.gunLevels),
            xsuitLevels: this.groupLevelsByRange(this.xSuitLevels),
            customLevels: this.groupLevelsByRange(this.customLevels),
            levelDetails: this.getDetailedLevelInfo()
        };
        
        return report;
    }

    groupLevelsByRange(levels) {
        if (levels.length === 0) return [];
        
        const ranges = [];
        let currentRange = {
            start: levels[0].level,
            end: levels[0].level,
            count: 1,
            offsets: [levels[0].offsetHex],
            values: [levels[0].value]
        };
        
        for (let i = 1; i < levels.length; i++) {
            if (levels[i].level === currentRange.end + 1) {
                currentRange.end = levels[i].level;
                currentRange.count++;
                currentRange.offsets.push(levels[i].offsetHex);
                currentRange.values.push(levels[i].value);
            } else {
                ranges.push({...currentRange});
                currentRange = {
                    start: levels[i].level,
                    end: levels[i].level,
                    count: 1,
                    offsets: [levels[i].offsetHex],
                    values: [levels[i].value]
                };
            }
        }
        ranges.push(currentRange);
        
        return ranges;
    }

    getDetailedLevelInfo() {
        const details = [];
        const sortedLevels = Array.from(this.levelMap.keys()).sort((a, b) => a - b);
        
        for (const level of sortedLevels) {
            const data = this.levelMap.get(level);
            details.push({
                level: level,
                gunCount: data.gun.length,
                xsuitCount: data.xsuit.length,
                customCount: data.custom.length,
                totalItems: data.gun.length + data.xsuit.length + data.custom.length,
                offsets: [
                    ...data.gun.map(g => g.offsetHex),
                    ...data.xsuit.map(x => x.offsetHex),
                    ...data.custom.map(c => c.offsetHex)
                ]
            });
        }
        
        return details;
    }

    findOffsetFormula(levels) {
        if (levels.length < 2) return null;
        
        const offsets = levels.map(l => parseInt(l.offsetHex, 16));
        const stride = offsets[1] - offsets[0];
        const isRegular = levels.every((l, i) => {
            if (i === 0) return true;
            return (parseInt(l.offsetHex, 16) - offsets[0]) / stride === l.level - levels[0].level;
        });
        
        if (isRegular) {
            return {
                baseOffset: offsets[0],
                baseOffsetHex: '0x' + offsets[0].toString(16),
                stride: stride,
                strideHex: '0x' + stride.toString(16),
                formula: `offset = 0x${offsets[0].toString(16)} + (level - ${levels[0].level}) * 0x${stride.toString(16)}`,
                levelCount: levels.length,
                levelRange: {
                    start: levels[0].level,
                    end: levels[levels.length - 1].level
                }
            };
        }
        
        return null;
    }

    exportLevels(format = 'csv') {
        if (format === 'csv') {
            const headers = ['Type', 'Level', 'Value', 'Offset', 'Size'];
            const rows = [];
            
            for (const level of this.gunLevels) {
                rows.push(['Gun', level.level, level.value, level.offsetHex, level.size]);
            }
            for (const level of this.xSuitLevels) {
                rows.push(['X-Suit', level.level, level.value, level.offsetHex, level.size]);
            }
            for (const level of this.customLevels) {
                rows.push(['Custom', level.level, level.value, level.offsetHex, level.size]);
            }
            
            return [headers, ...rows];
        }
        
        if (format === 'json') {
            return {
                gun: this.gunLevels,
                xsuit: this.xSuitLevels,
                custom: this.customLevels
            };
        }
        
        if (format === 'txt') {
            let output = '=== GUN LEVELS ===\n';
            for (const level of this.gunLevels) {
                output += `Level ${level.level}: ${level.value} @ ${level.offsetHex}\n`;
            }
            output += '\n=== X-SUIT LEVELS ===\n';
            for (const level of this.xSuitLevels) {
                output += `Level ${level.level}: ${level.value} @ ${level.offsetHex}\n`;
            }
            output += '\n=== CUSTOM LEVELS ===\n';
            for (const level of this.customLevels) {
                output += `Level ${level.level}: ${level.value} @ ${level.offsetHex}\n`;
            }
            return output;
        }
        
        return this.levelMap;
    }
}

// Export
window.LevelDetector = LevelDetector;
