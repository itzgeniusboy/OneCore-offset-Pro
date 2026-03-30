// AI Detector - Structure detection and analysis

class AIDetector {
    constructor() {
        this.apiKey = null;
        this.useAI = false;
        this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    }

    setApiKey(key) {
        this.apiKey = key;
        this.useAI = true;
    }

    async detectStructures(offsets, strings) {
        const structures = [];
        
        // First, use pattern-based detection (always available)
        const patternStructures = this.detectPatternStructures(offsets, strings);
        structures.push(...patternStructures);
        
        // If AI is enabled, enhance with Gemini
        if (this.useAI && this.apiKey) {
            try {
                const aiStructures = await this.detectWithAI(offsets, strings);
                structures.push(...aiStructures);
            } catch (error) {
                console.warn('AI detection failed:', error);
            }
        }
        
        // Find best structure
        const bestStructure = this.findBestStructure(structures);
        
        return {
            structures: structures,
            best: bestStructure,
            count: structures.length
        };
    }

    detectPatternStructures(offsets, strings) {
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
        
        // Analyze each group
        for (const [name, items] of grouped) {
            if (items.length >= 3) {
                const structure = this.analyzeStructure(name, items, offsets);
                if (structure.confidence > 0.6) {
                    structures.push(structure);
                }
            }
        }
        
        return structures;
    }

    analyzeStructure(name, items, offsets) {
        const fields = [];
        const offsetsList = items.map(i => i.offset).sort((a, b) => a - b);
        const sizes = items.map(i => i.value.length);
        
        // Detect field types
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let fieldType = 'unknown';
            let fieldSize = item.value.length;
            
            if (item.value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                if (item.value.includes('_')) {
                    fieldType = 'string';
                } else {
                    fieldType = 'identifier';
                }
            } else if (item.value.match(/^\d+$/)) {
                fieldType = 'integer';
                fieldSize = 4;
            } else if (item.value.match(/^0x[0-9A-Fa-f]+$/)) {
                fieldType = 'pointer';
                fieldSize = 8;
            } else {
                fieldType = 'string';
            }
            
            fields.push({
                name: item.value,
                offset: item.offset,
                type: fieldType,
                size: fieldSize,
                sample: item.value
            });
        }
        
        // Calculate confidence
        let confidence = 0.5;
        if (items.length >= 5) confidence += 0.2;
        if (this.hasRegularPattern(offsetsList)) confidence += 0.2;
        if (this.hasConsistentNaming(name, items)) confidence += 0.1;
        
        return {
            name: name + 'Structure',
            type: 'structure',
            fields: fields,
            fieldCount: fields.length,
            totalSize: offsetsList[offsetsList.length - 1] - offsetsList[0] + (fields[fields.length - 1]?.size || 0),
            confidence: Math.min(confidence, 0.95),
            items: items,
            pattern: this.getPatternFormula(offsetsList)
        };
    }

    hasRegularPattern(offsets) {
        if (offsets.length < 2) return false;
        const gaps = [];
        for (let i = 1; i < offsets.length; i++) {
            gaps.push(offsets[i] - offsets[i - 1]);
        }
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        return gaps.every(g => Math.abs(g - avgGap) < avgGap * 0.2);
    }

    hasConsistentNaming(prefix, items) {
        const pattern = new RegExp(`^${prefix}[_0-9]*$`, 'i');
        const matching = items.filter(i => pattern.test(i.value));
        return matching.length / items.length > 0.7;
    }

    getPatternFormula(offsets) {
        if (offsets.length < 2) return null;
        const stride = offsets[1] - offsets[0];
        return {
            baseOffset: offsets[0],
            stride: stride,
            formula: `base + (index * ${stride})`
        };
    }

    async detectWithAI(offsets, strings) {
        const structures = [];
        
        // Prepare data for AI
        const sampleStrings = strings.slice(0, 50).map(s => s.value);
        const prompt = `Analyze these strings from a .so file and identify potential data structures. 
Strings: ${sampleStrings.join(', ')}
Return a JSON array of structures with name, purpose, and field information.`;

        try {
            const response = await fetch(`${this.geminiEndpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });
            
            const data = await response.json();
            if (data.candidates && data.candidates[0]) {
                const aiResponse = data.candidates[0].content.parts[0].text;
                const parsed = this.parseAIResponse(aiResponse);
                structures.push(...parsed);
            }
        } catch (error) {
            console.error('AI API error:', error);
        }
        
        return structures;
    }

    parseAIResponse(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('Failed to parse AI response');
        }
        return [];
    }

    findBestStructure(structures) {
        if (structures.length === 0) return null;
        
        // Score each structure
        const scored = structures.map(s => ({
            ...s,
            score: this.calculateScore(s)
        }));
        
        // Return highest scoring
        return scored.sort((a, b) => b.score - a.score)[0];
    }

    calculateScore(structure) {
        let score = 0;
        
        // More fields = higher score
        score += structure.fieldCount * 10;
        
        // Higher confidence = higher score
        score += structure.confidence * 50;
        
        // Regular pattern = higher score
        if (structure.pattern) score += 20;
        
        // Good naming = higher score
        if (structure.name.match(/[A-Z][a-z]+/)) score += 10;
        
        return score;
    }

    detectPurpose(offset, value, context) {
        const purposes = [];
        
        // Detect by pattern
        if (value.toLowerCase().includes('skin')) {
            purposes.push('skin related data');
        }
        if (value.toLowerCase().includes('gun') || value.toLowerCase().includes('weapon')) {
            purposes.push('weapon/gun related');
        }
        if (value.toLowerCase().includes('level')) {
            purposes.push('level progression data');
        }
        if (value.toLowerCase().includes('texture')) {
            purposes.push('texture/graphics data');
        }
        if (value.toLowerCase().includes('config') || value.toLowerCase().includes('setting')) {
            purposes.push('configuration data');
        }
        if (value.toLowerCase().includes('init') || value.toLowerCase().includes('load')) {
            purposes.push('initialization function');
        }
        
        // If AI is enabled, enhance detection
        if (this.useAI && this.apiKey && purposes.length === 0) {
            purposes.push('unknown - consider AI analysis');
        }
        
        return purposes.length > 0 ? purposes[0] : 'undetermined';
    }

    suggestRelatedOffsets(offset, allOffsets, maxDistance = 0x1000) {
        const related = [];
        const target = typeof offset === 'string' ? parseInt(offset, 16) : offset;
        
        for (const o of allOffsets) {
            const distance = Math.abs(o.fileOffset - target);
            if (distance > 0 && distance <= maxDistance) {
                related.push({
                    ...o,
                    distance: distance,
                    relationship: this.determineRelationship(o, target)
                });
            }
        }
        
        return related.sort((a, b) => a.distance - b.distance);
    }

    determineRelationship(offset, target) {
        const diff = offset.fileOffset - target;
        
        if (Math.abs(diff) < 16) return 'immediately adjacent';
        if (diff > 0 && diff < 0x100) return 'likely part of same structure';
        if (diff < 0 && diff > -0x100) return 'likely previous structure field';
        if (Math.abs(diff) < 0x1000) return 'probably related data';
        
        return 'possibly related';
    }
}

// Export
window.AIDetector = AIDetector;
