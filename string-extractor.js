// String Extractor - Advanced string detection

class StringExtractor {
    constructor() {
        this.strings = [];
        this.minLength = 4;
        this.maxLength = 256;
    }

    extractFromBytes(bytes, baseOffset = 0) {
        const strings = [];
        let currentString = '';
        let currentOffset = 0;
        let currentType = 'ascii';

        for (let i = 0; i < bytes.length; i++) {
            const char = bytes[i];
            
            // ASCII printable
            if (char >= 32 && char <= 126) {
                if (currentString === '') {
                    currentOffset = i;
                    currentType = 'ascii';
                }
                currentString += String.fromCharCode(char);
            }
            // Unicode (UTF-16LE) - check for null bytes
            else if (char === 0 && i + 1 < bytes.length && bytes[i + 1] >= 32 && bytes[i + 1] <= 126) {
                if (currentString === '') {
                    currentOffset = i;
                    currentType = 'unicode';
                }
                currentString += String.fromCharCode(bytes[i + 1]);
                i++; // skip next byte
            }
            else {
                if (currentString.length >= this.minLength) {
                    strings.push({
                        offset: baseOffset + currentOffset,
                        value: currentString,
                        type: currentType,
                        size: currentString.length,
                        endOffset: baseOffset + i
                    });
                }
                currentString = '';
            }
        }

        if (currentString.length >= this.minLength) {
            strings.push({
                offset: baseOffset + currentOffset,
                value: currentString,
                type: currentType,
                size: currentString.length
            });
        }

        return strings;
    }

    filterByKeyword(strings, keyword) {
        if (!keyword) return strings;
        const lowerKeyword = keyword.toLowerCase();
        return strings.filter(s => 
            s.value.toLowerCase().includes(lowerKeyword)
        );
    }

    filterByType(strings, type) {
        if (type === 'all') return strings;
        return strings.filter(s => s.type === type);
    }

    getStatistics(strings) {
        const stats = {
            total: strings.length,
            ascii: strings.filter(s => s.type === 'ascii').length,
            unicode: strings.filter(s => s.type === 'unicode').length,
            avgLength: 0,
            unique: new Set(strings.map(s => s.value)).size,
            longest: null,
            shortest: null
        };

        if (strings.length > 0) {
            stats.avgLength = strings.reduce((sum, s) => sum + s.value.length, 0) / strings.length;
            
            const sorted = [...strings].sort((a, b) => b.value.length - a.value.length);
            stats.longest = sorted[0];
            stats.shortest = sorted[sorted.length - 1];
        }

        return stats;
    }

    findPatterns(strings) {
        const patterns = {
            functionNames: [],
            classNames: [],
            variables: [],
            constants: [],
            paths: [],
            urls: [],
            emails: [],
            numbers: []
        };

        for (const str of strings) {
            const value = str.value;
            
            // Function name pattern (e.g., load_skin, initGame)
            if (value.match(/^[a-z_][a-z0-9_]*$/i) && value.includes('_')) {
                patterns.functionNames.push(str);
            }
            // Class name pattern (e.g., SkinObject, PlayerController)
            else if (value.match(/^[A-Z][a-zA-Z0-9]*$/)) {
                patterns.classNames.push(str);
            }
            // Variable pattern (e.g., g_skin, m_player)
            else if (value.match(/^[gm]_[a-z][a-z0-9_]*$/i)) {
                patterns.variables.push(str);
            }
            // Constant pattern (e.g., MAX_SKIN, SKIN_DEFAULT)
            else if (value.match(/^[A-Z][A-Z0-9_]*$/)) {
                patterns.constants.push(str);
            }
            // File path pattern
            else if (value.match(/^[\/\\][a-zA-Z0-9\/\\_.-]+$/)) {
                patterns.paths.push(str);
            }
            // URL pattern
            else if (value.match(/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
                patterns.urls.push(str);
            }
            // Email pattern
            else if (value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
                patterns.emails.push(str);
            }
            // Number pattern
            else if (value.match(/^\d+$/)) {
                patterns.numbers.push(str);
            }
        }

        return patterns;
    }

    detectStructures(strings, threshold = 3) {
        const structures = [];
        const grouped = new Map();

        // Group by common prefixes
        for (const str of strings) {
            const prefix = str.value.split(/[_0-9]/)[0];
            if (prefix && prefix.length > 2) {
                if (!grouped.has(prefix)) {
                    grouped.set(prefix, []);
                }
                grouped.get(prefix).push(str);
            }
        }

        // Find potential structures
        for (const [prefix, items] of grouped) {
            if (items.length >= threshold) {
                structures.push({
                    name: prefix,
                    count: items.length,
                    items: items,
                    pattern: this.detectPattern(items)
                });
            }
        }

        return structures;
    }

    detectPattern(items) {
        if (items.length < 2) return null;

        const offsets = items.map(i => i.offset);
        const gaps = [];
        
        for (let i = 1; i < offsets.length; i++) {
            gaps.push(offsets[i] - offsets[i - 1]);
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const isRegular = gaps.every(g => Math.abs(g - avgGap) < 10);

        if (isRegular && avgGap > 0) {
            return {
                type: 'array',
                stride: Math.round(avgGap),
                startOffset: offsets[0],
                count: items.length
            };
        }

        return null;
    }

    findLevelPatterns(strings) {
        const levelPatterns = {
            gun: [],
            xsuit: [],
            other: []
        };

        for (const str of strings) {
            const value = str.value.toLowerCase();
            
            // Gun level patterns
            if (value.match(/gun[_ ]level[_ ]?\d+/i) || 
                value.match(/weapon[_ ]level[_ ]?\d+/i) ||
                value.match(/ak[_ ]?\d+|m4[_ ]?\d+|awp[_ ]?\d+/i)) {
                levelPatterns.gun.push(str);
            }
            // X-Suit level patterns
            else if (value.match(/xsuit[_ ]level[_ ]?\d+/i) ||
                     value.match(/x[_ ]suit[_ ]?\d+/i) ||
                     value.match(/armor[_ ]level[_ ]?\d+/i)) {
                levelPatterns.xsuit.push(str);
            }
            // Other level patterns
            else if (value.match(/level[_ ]?\d+/i)) {
                levelPatterns.other.push(str);
            }
        }

        return levelPatterns;
    }

    generateLevelMap(patterns) {
        const levelMap = new Map();

        for (const pattern of patterns) {
            const match = pattern.value.match(/\d+/);
            if (match) {
                const level = parseInt(match[0]);
                if (!levelMap.has(level)) {
                    levelMap.set(level, []);
                }
                levelMap.get(level).push(pattern);
            }
        }

        return levelMap;
    }

    calculateOffsetFormula(levelMap) {
        if (levelMap.size < 2) return null;

        const levels = Array.from(levelMap.keys()).sort((a, b) => a - b);
        const firstLevel = levels[0];
        const secondLevel = levels[1];
        
        const firstOffsets = levelMap.get(firstLevel).map(s => s.offset);
        const secondOffsets = levelMap.get(secondLevel).map(s => s.offset);
        
        if (firstOffsets.length === 0 || secondOffsets.length === 0) return null;
        
        const stride = secondOffsets[0] - firstOffsets[0];
        
        return {
            baseOffset: firstOffsets[0],
            stride: stride,
            formula: `offset = 0x${firstOffsets[0].toString(16)} + (level - ${firstLevel}) * 0x${stride.toString(16)}`,
            levels: levels,
            levelCount: levels.length
        };
    }
}

// Export
window.StringExtractor = StringExtractor;
