"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Level = void 0;
class Level {
    constructor(level_data) {
        this.minBPM = 999999;
        this.maxBPM = -999999;
        this.currentBPM = null;
        this.totalBPMChange = 0;
        this.secondCounter = 0;
        this.lastBPMChange = 0;
        this.crochetsPerBar = 8;
        this.lastCrochetChangeBar = 0;
        this.beatCounter = 0;
        this.finishLevelEvents = 0;
        this.hits = new Map();
        this.totalHits = 0;
        this.uniqueHits = 0;
        this.totalJumps = 0;
        this.freetimes = [];
        const { version, song, author, difficulty, rankMaxMistakes } = level_data.settings;
        this.version = version;
        this.song = song;
        this.author = author;
        this.difficulty = difficulty;
        this.rankMaxMistakes = rankMaxMistakes;
        this.events = level_data.events;
        this.parse();
    }
    parse() {
        this.events.forEach((event) => {
            // Ignore disabled events
            if (event.active !== undefined) {
                return;
            }
            let { bar, beat } = event;
            // Change bar and beat to 0-indexed
            bar--;
            beat--;
            // Beats since the start of the level
            const startBeat = this.beatCounter + (bar - this.lastCrochetChangeBar) * this.crochetsPerBar + beat;
            switch (event.type) {
                case 'PlaySong': {
                    const newBPM = event.bpm;
                    if (newBPM < this.minBPM) {
                        this.minBPM = newBPM;
                    }
                    if (newBPM > this.maxBPM) {
                        this.maxBPM = newBPM;
                    }
                    if (this.currentBPM !== null) {
                        this.totalBPMChange += Math.abs(newBPM - this.currentBPM);
                    }
                    this.currentBPM = newBPM;
                    break;
                }
                case 'SetBeatsPerMinute': {
                    const newBPM = event.beatsPerMinute;
                    if (newBPM < this.minBPM) {
                        this.minBPM = newBPM;
                    }
                    if (newBPM > this.maxBPM) {
                        this.maxBPM = newBPM;
                    }
                    if (this.currentBPM !== null) {
                        this.totalBPMChange += Math.abs(newBPM - this.currentBPM);
                    }
                    this.currentBPM = newBPM;
                    const elapsedBeats = startBeat - this.lastBPMChange;
                    this.secondCounter += elapsedBeats * 60 / this.currentBPM;
                    this.lastBPMChange = startBeat;
                    break;
                }
                case 'SetCrochetsPerBar': {
                    const elapsedBeats = (bar - this.lastCrochetChangeBar) * this.crochetsPerBar;
                    this.beatCounter += elapsedBeats;
                    this.lastCrochetChangeBar = bar;
                    this.crochetsPerBar = event.crochetsPerBar;
                    break;
                }
                case 'AddClassicBeat':
                    this.addHit(startBeat + 6 * event.tick, event.tick);
                    break;
                case 'AddOneshotBeat': {
                    const { tick, loops = 0, interval = 0 } = event;
                    for (let i = 0; i <= loops; i++) {
                        this.addHit(startBeat + tick + (i * interval), (i === 0 ? tick : interval));
                    }
                    break;
                }
                case 'AddFreeTimeBeat': {
                    const { pulse, row } = event;
                    if (pulse === 6) {
                        this.addHit(startBeat, 0);
                    }
                    else {
                        if (!this.freetimes[row]) {
                            this.freetimes[row] = [];
                        }
                        this.freetimes[row].push({ pulse, totalDifference: pulse, startBeat });
                    }
                    break;
                }
                case 'PulseFreeTimeBeat': {
                    const { action, customPulse, row } = event;
                    if (action === 'Custom') {
                        if (customPulse === 6) {
                            this.freetimes[row].forEach(freetime => {
                                // Do not hit freetimes that have just started
                                if (freetime.startBeat !== startBeat) {
                                    this.addHit(startBeat, freetime.totalDifference / 7);
                                    freetime = null; // Mark freetime for deletion
                                }
                            });
                            // Delete freetimes that have been hit
                            this.freetimes[row] = this.freetimes[row].filter(freetime => freetime !== null);
                        }
                        else {
                            this.freetimes[row].forEach(freetime => {
                                freetime.totalDifference += Math.abs(freetime.pulse - customPulse);
                                freetime.pulse = customPulse;
                            });
                        }
                    }
                    else if (action === 'Increment') {
                        this.freetimes[row].forEach(freetime => {
                            if (freetime.pulse === 5) {
                                this.addHit(startBeat, freetime.totalDifference / 7);
                                freetime = null; // Mark freetime for deletion
                            }
                            else {
                                freetime.pulse++;
                                freetime.totalDifference++;
                            }
                        });
                        // Delete freetimes that have been hit
                        this.freetimes[row] = this.freetimes[row].filter(freetime => freetime !== null);
                    }
                    else if (action === 'Decrement') {
                        this.freetimes[row].forEach(freetime => {
                            freetime.pulse--;
                            if (freetime.pulse < 0) {
                                freetime.pulse = 0;
                            }
                            freetime.totalDifference++;
                        });
                    }
                    else if (action === 'Remove') {
                        this.freetimes[row].forEach(freetime => {
                            // Do not remove freetimes that have just started
                            if (freetime.startBeat !== startBeat) {
                                freetime = null;
                            }
                        });
                        // Remove trashed freetimes
                        this.freetimes[row] = this.freetimes[row].filter(freetime => freetime !== null);
                    }
                    else {
                        console.log(`weird action ${action} encountered`);
                    }
                    break;
                }
                case 'FinishLevel':
                    this.finishLevelEvents++;
                    if (this.finishLevelEvents === 3) {
                        this.totalBeats = startBeat;
                        // Either:
                        //  - We know the remaining number of beats, and BPM does not change, or
                        //  - We're missing some beats, but we know the time taken by those beats (so we can ignore them)
                        this.levelLength = this.secondCounter + (this.totalBeats - this.lastBPMChange) * 60 / this.currentBPM;
                    }
                    break;
                default:
                // console.log(event.type);
            }
        });
    }
    addHit(beat, tick) {
        // Filtering of badly placed events
        beat = this.filterBeat(beat);
        if (this.hits.has(beat)) {
            const old = this.hits.get(beat);
            if (old.numHits === 1) {
                this.totalJumps++;
            }
            old.ticks.push(tick);
            this.hits.set(beat, { numHits: old.numHits + 1, ticks: old.ticks });
        }
        else {
            this.hits.set(beat, { numHits: 1, ticks: [tick] });
            this.uniqueHits++;
        }
        this.totalHits++;
    }
    filterBeat(beat) {
        if (Math.abs(beat - Math.round(beat)) <= 0.05) {
            return Math.round(beat);
        }
        if (Math.abs(beat * 2 - Math.round(beat * 2)) <= 0.05) {
            return Math.round(beat * 2) / 2;
        }
        if (Math.abs(beat * 3 - Math.round(beat * 3)) <= 0.05) {
            return Math.round(beat * 3) / 3;
        }
        if (Math.abs(beat * 4 - Math.round(beat * 4)) <= 0.05) {
            return Math.round(beat * 4) / 4;
        }
    }
    getStats() {
        const hitLocations = Array.from(this.hits.keys()).sort((a, b) => a - b);
        let leftIndex = 0;
        let rightIndex = 0;
        let maxHits = 0;
        let currentHits = 0;
        let irregularTotal = 0;
        for (let i = 0; i < this.hits.size - 1; i++) {
            // Voltage Calculation
            rightIndex++;
            currentHits += this.hits.get(hitLocations[rightIndex]).numHits > 1 ? 2 : 1;
            // If the beat distance becomes larger than 4, move the left pointer forwards
            if (hitLocations[rightIndex] - hitLocations[leftIndex] > 4) {
                currentHits -= this.hits.get(hitLocations[leftIndex]).numHits > 1 ? 2 : 1;
                leftIndex++;
            }
            if (currentHits > maxHits) {
                maxHits = currentHits;
            }
            // Chaos Calculation
            const { ticks, numHits } = this.hits.get(hitLocations[i]);
            ticks.forEach(tick => {
                if (tick === 1) {
                    irregularTotal += 0;
                }
                else if (tick === 0) {
                    irregularTotal += 10;
                }
                else if (tick === 0.5) {
                    irregularTotal += 8 * numHits * 0.5;
                }
                else if (tick * 3 - Math.round(tick * 3) <= 0.05) {
                    irregularTotal += 12 * numHits * 0.75;
                }
                else if (tick * 4 - Math.round(tick * 4) <= 0.05) {
                    irregularTotal += 16 * numHits;
                }
                else {
                    irregularTotal += (4 / tick) * numHits * 1.25;
                }
            });
        }
        const irregularityDegree = irregularTotal * (1 + (60 * this.totalBPMChange / this.levelLength) / 1500);
        const stream = Math.round(60 * this.uniqueHits / this.levelLength);
        const voltage = Math.round((60 * this.totalBeats / this.levelLength) * maxHits / 4);
        const air = Math.round(60 * this.totalJumps / this.levelLength);
        const chaos = Math.round(100 * irregularityDegree / this.levelLength);
        let statsString = '';
        statsString += `${this.song} by ${this.author}\n`;
        statsString += '=================================\n';
        statsString += `Difficulty: ${this.difficulty}\tBPM: ${this.minBPM + ((this.minBPM === this.maxBPM) ? '' : `-${this.maxBPM}`)}\n`;
        statsString += `Stream: ${(stream > 300) ? Math.round((stream - 139) * 100 / 161) : Math.round(stream / 3)}\n`;
        statsString += `Voltage: ${(voltage > 600) ? Math.round((voltage + 594) * 100 / 1194) : Math.round(voltage / 6)}\n`;
        statsString += `Air: ${(air > 55) ? Math.round((air + 36) * 100 / 91) : Math.round(air * 20 / 11)}\n`;
        statsString += `Chaos: ${(chaos > 2000) ? Math.round((chaos + 16628) * 100 / 18628) : Math.round(chaos / 20)}\n`;
        statsString += '=================================\n';
        statsString += `Total hits: ${this.totalHits}\n`;
        statsString += 'Rank margins: [';
        for (let i = 0; i < 4; i++) {
            statsString += `${Math.round(this.rankMaxMistakes[i] / this.totalHits * 100)}%, `;
        }
        statsString = statsString.substring(0, statsString.length - 2) + ']';
        return statsString;
    }
}
exports.Level = Level;
