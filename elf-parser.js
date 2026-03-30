// ELF Parser - 32-bit and 64-bit support

class ELFParser {
    constructor(bytes) {
        this.bytes = bytes;
        this.is64Bit = false;
        this.sections = [];
        this.strings = [];
    }

    parse() {
        if (!this.isValidELF()) {
            throw new Error('Invalid ELF file');
        }
        
        this.detectArchitecture();
        this.parseSections();
        this.extractStrings();
        
        return {
            is64Bit: this.is64Bit,
            sections: this.sections,
            strings: this.strings,
            architecture: this.getArchitecture(),
            entryPoint: this.getEntryPoint()
        };
    }

    isValidELF() {
        if (this.bytes.length < 16) return false;
        return this.bytes[0] === 0x7F && 
               this.bytes[1] === 0x45 && 
               this.bytes[2] === 0x4C && 
               this.bytes[3] === 0x46;
    }

    detectArchitecture() {
        // EI_CLASS at byte 4: 1 = 32-bit, 2 = 64-bit
        this.is64Bit = this.bytes[4] === 2;
    }

    getArchitecture() {
        // EI_DATA at byte 5, EI_VERSION at 6, EI_OSABI at 7
        const machine = this.getMachineType();
        const arch = this.is64Bit ? '64-bit' : '32-bit';
        
        if (machine === 0x28) return `ARM ${arch}`;
        if (machine === 0xB7) return `ARM64 ${arch}`;
        if (machine === 0x03) return `x86 ${arch}`;
        if (machine === 0x3E) return `x86_64 ${arch}`;
        return `Unknown ${arch}`;
    }

    getMachineType() {
        // e_machine at offset 18 (32-bit) or 18 (64-bit same offset)
        if (this.bytes.length < 20) return 0;
        return this.bytes[18] | (this.bytes[19] << 8);
    }

    getEntryPoint() {
        // e_entry offset: 24 for 32-bit, 24 for 64-bit
        if (this.bytes.length < 28) return 0;
        
        if (this.is64Bit) {
            // 8-byte entry point
            let entry = 0;
            for (let i = 0; i < 8; i++) {
                entry |= (this.bytes[24 + i] << (i * 8));
            }
            return entry;
        } else {
            // 4-byte entry point
            return this.bytes[24] | (this.bytes[25] << 8) | 
                   (this.bytes[26] << 16) | (this.bytes[27] << 24);
        }
    }

    parseSections() {
        const e_shoff = this.getSectionHeaderOffset();
        const e_shentsize = this.getSectionHeaderEntrySize();
        const e_shnum = this.getSectionHeaderCount();
        
        this.sections = [];
        
        for (let i = 0; i < e_shnum; i++) {
            const offset = e_shoff + (i * e_shentsize);
            const section = this.parseSectionHeader(offset);
            if (section) {
                this.sections.push(section);
            }
        }
    }

    getSectionHeaderOffset() {
        // e_shoff at offset 32 (32-bit) or 40 (64-bit)
        const base = this.is64Bit ? 40 : 32;
        if (this.bytes.length < base + 8) return 0;
        
        if (this.is64Bit) {
            let off = 0;
            for (let i = 0; i < 8; i++) {
                off |= (this.bytes[base + i] << (i * 8));
            }
            return off;
        } else {
            return this.bytes[base] | (this.bytes[base + 1] << 8) |
                   (this.bytes[base + 2] << 16) | (this.bytes[base + 3] << 24);
        }
    }

    getSectionHeaderEntrySize() {
        // e_shentsize at offset 46 (32-bit) or 58 (64-bit)
        const base = this.is64Bit ? 58 : 46;
        if (this.bytes.length < base + 2) return 0;
        return this.bytes[base] | (this.bytes[base + 1] << 8);
    }

    getSectionHeaderCount() {
        // e_shnum at offset 48 (32-bit) or 60 (64-bit)
        const base = this.is64Bit ? 60 : 48;
        if (this.bytes.length < base + 2) return 0;
        return this.bytes[base] | (this.bytes[base + 1] << 8);
    }

    parseSectionHeader(offset) {
        if (offset + 40 > this.bytes.length) return null;
        
        const nameOffset = this.bytes[offset] | (this.bytes[offset + 1] << 8);
        const type = this.bytes[offset + 4] | (this.bytes[offset + 5] << 8);
        const flags = this.getSectionFlags(offset);
        const addr = this.getSectionAddr(offset);
        const sectionOffset = this.getSectionOffset(offset);
        const size = this.getSectionSize(offset);
        
        return {
            name: this.getSectionName(nameOffset),
            type: this.getSectionTypeName(type),
            flags: flags,
            address: addr,
            offset: sectionOffset,
            size: size
        };
    }

    getSectionFlags(offset) {
        if (this.is64Bit) {
            let flags = 0;
            for (let i = 0; i < 8; i++) {
                flags |= (this.bytes[offset + 8 + i] << (i * 8));
            }
            return flags;
        } else {
            return this.bytes[offset + 8] | (this.bytes[offset + 9] << 8);
        }
    }

    getSectionAddr(offset) {
        const base = this.is64Bit ? 16 : 12;
        if (this.is64Bit) {
            let addr = 0;
            for (let i = 0; i < 8; i++) {
                addr |= (this.bytes[offset + base + i] << (i * 8));
            }
            return addr;
        } else {
            return this.bytes[offset + base] | (this.bytes[offset + base + 1] << 8) |
                   (this.bytes[offset + base + 2] << 16) | (this.bytes[offset + base + 3] << 24);
        }
    }

    getSectionOffset(offset) {
        const base = this.is64Bit ? 24 : 20;
        if (this.is64Bit) {
            let off = 0;
            for (let i = 0; i < 8; i++) {
                off |= (this.bytes[offset + base + i] << (i * 8));
            }
            return off;
        } else {
            return this.bytes[offset + base] | (this.bytes[offset + base + 1] << 8) |
                   (this.bytes[offset + base + 2] << 16) | (this.bytes[offset + base + 3] << 24);
        }
    }

    getSectionSize(offset) {
        const base = this.is64Bit ? 32 : 28;
        if (this.is64Bit) {
            let size = 0;
            for (let i = 0; i < 8; i++) {
                size |= (this.bytes[offset + base + i] << (i * 8));
            }
            return size;
        } else {
            return this.bytes[offset + base] | (this.bytes[offset + base + 1] << 8) |
                   (this.bytes[offset + base + 2] << 16) | (this.bytes[offset + base + 3] << 24);
        }
    }

    getSectionName(nameOffset) {
        // Get from section header string table
        if (nameOffset === 0) return '';
        const shstrtab = this.getSectionHeaderStringTable();
        if (!shstrtab) return `section_${nameOffset}`;
        
        let name = '';
        let pos = shstrtab.offset + nameOffset;
        while (pos < this.bytes.length && this.bytes[pos] !== 0) {
            name += String.fromCharCode(this.bytes[pos]);
            pos++;
        }
        return name;
    }

    getSectionHeaderStringTable() {
        // e_shstrndx at offset 50 (32-bit) or 62 (64-bit)
        const base = this.is64Bit ? 62 : 50;
        if (this.bytes.length < base + 2) return null;
        const index = this.bytes[base] | (this.bytes[base + 1] << 8);
        
        if (index >= this.sections.length) return null;
        return this.sections[index];
    }

    getSectionTypeName(type) {
        const types = {
            0: 'NULL',
            1: 'PROGBITS',
            2: 'SYMTAB',
            3: 'STRTAB',
            4: 'RELA',
            5: 'HASH',
            6: 'DYNAMIC',
            7: 'NOTE',
            8: 'NOBITS',
            9: 'REL',
            10: 'SHLIB',
            11: 'DNYSYM'
        };
        return types[type] || `UNKNOWN_${type}`;
    }

    extractStrings() {
        this.strings = [];
        
        for (const section of this.sections) {
            // Only scan readable sections
            if (section.type === 'PROGBITS' || section.type === 'STRTAB') {
                const strings = this.extractStringsFromSection(section);
                this.strings.push(...strings);
            }
        }
    }

    extractStringsFromSection(section) {
        const strings = [];
        const start = section.offset;
        const end = Math.min(start + section.size, this.bytes.length);
        
        let currentString = '';
        let currentOffset = 0;
        
        for (let i = start; i < end; i++) {
            const char = this.bytes[i];
            
            // Printable ASCII
            if (char >= 32 && char <= 126) {
                if (currentString === '') currentOffset = i - start;
                currentString += String.fromCharCode(char);
            } else {
                if (currentString.length >= 4) {
                    strings.push({
                        offset: currentOffset + section.offset,
                        virtualAddr: section.address + currentOffset,
                        value: currentString,
                        section: section.name,
                        size: currentString.length
                    });
                }
                currentString = '';
            }
        }
        
        if (currentString.length >= 4) {
            strings.push({
                offset: currentOffset + section.offset,
                virtualAddr: section.address + currentOffset,
                value: currentString,
                section: section.name,
                size: currentString.length
            });
        }
        
        return strings;
    }
}

// Export for use in main script
window.ELFParser = ELFParser;
