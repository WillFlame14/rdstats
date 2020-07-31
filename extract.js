'use strict';

function getStats(level) {
	const { song, author, difficulty, rankMaxMistakes } = level.settings;

	const events = level.events;

	let minBPM = 9999999, maxBPM = -999999, currentBPM = null;
	let totalBPMChange = 0;
	let secondCounter = 0;
	let lastBPMChange = 0;

	let crochetsPerBar = 8;
	let lastCrochetChange = 0;
	let beatCounter = 0;

	let finishLevelEvents = 0;
	let levelLength;
	let totalBeats;

	const hits = new Map();
	let totalHits = 0;
	let uniqueHits = 0;
	let totalJumps = 0;

	const freetimes = {};

	function addHit(beat, tick) {
		// Filtering of badly placed events
		if(Math.abs(beat - Math.round(beat)) <= 0.05) {
			beat = Math.round(beat);
		}

		if(Math.abs(beat * 2 - Math.round(beat * 2)) <= 0.05) {
			beat = Math.round(beat * 2) / 2;
		}

		if(Math.abs(beat * 3 - Math.round(beat * 3)) <= 0.05) {
			beat = Math.round(beat * 3) / 3;
		}

		if(Math.abs(beat * 4 - Math.round(beat * 4)) <= 0.05) {
			beat = Math.round(beat * 4) / 4;
		}

		if(hits.has(beat)) {
			const old = hits.get(beat);
			if(old.numHits === 1) {
				totalJumps++;
			}
			old.ticks.push(tick);
			hits.set(beat, { numHits: old.numHits + 1, ticks: old.ticks });
		}
		else {
			hits.set(beat, { numHits: 1, ticks: [tick] });
			uniqueHits++;
		}
		totalHits++;
	}

	events.forEach(event => {
		if(event.active === false) {
			return;
		}
		let{ bar, beat } = event;
		bar--;
		beat--;
		const startBeat = beatCounter + (bar - lastCrochetChange) * crochetsPerBar + beat;

		switch(event.type) {
			case 'PlaySong': {
				const newBPM = event.bpm;
				if(newBPM < minBPM) {
					minBPM = newBPM;
				}
				if(newBPM > maxBPM) {
					maxBPM = newBPM;
				}
				if(currentBPM !== null) {
					totalBPMChange += Math.abs(newBPM - currentBPM);
				}
				currentBPM = newBPM;
				break;
			}
			case 'SetBeatsPerMinute': {
				const newBPM = event.beatsPerMinute;
				if(newBPM < minBPM) {
					minBPM = newBPM;
				}
				if(newBPM > maxBPM) {
					maxBPM = newBPM;
				}
				if(currentBPM !== null) {
					totalBPMChange += Math.abs(newBPM - currentBPM);
				}
				currentBPM = newBPM;

				const elapsedBeats = startBeat - lastBPMChange;
				secondCounter += elapsedBeats * 60 / currentBPM;
				lastBPMChange = startBeat;
				break;
			}
			case 'SetCrochetsPerBar': {
				const elapsedBeats = (bar - lastCrochetChange) * crochetsPerBar;
				beatCounter += elapsedBeats;
				lastCrochetChange = bar;
				crochetsPerBar = event.crochetsPerBar;
				break;
			}
			case 'AddClassicBeat':
				addHit(startBeat + 6 * event.tick, event.tick);
				break;
			case 'AddOneshotBeat': {
				const { tick } = event;
				const loops = event.loops || 0;
				const interval = event.interval || 0;

				for(let i = 0; i <= loops; i++) {
					addHit(startBeat + tick + (i * interval), (i === 0 ? tick : interval));
				}
				break;
			}
			case 'AddFreeTimeBeat': {
				const { pulse, row } = event;
				if(pulse === 6) {
					addHit(startBeat, 0);
				}
				else {
					if(!freetimes[row]) {
						freetimes[row] = [];
					}
					freetimes[row].push({ pulse, totalDifference: pulse, startBeat });
				}
				break;
			}
			case 'PulseFreeTimeBeat': {
				const { action, customPulse, row } = event;
				if(action === 'Custom') {
					if(customPulse === 6) {
						freetimes[row].forEach(freetime => {
							// Do not hit freetimes that have just started
							if(freetime.startBeat !== startBeat) {
								addHit(startBeat, freetime.totalDifference / 7);
								freetime = null;	// Mark freetime for deletion
							}
						});
						// Delete freetimes that have been hit
						freetimes[row] = freetimes[row].filter(freetime => freetime !== null);
					}
					else {
						freetimes[row].forEach(freetime => {
							freetime.totalDifference += Math.abs(freetime.pulse - customPulse);
							freetime.pulse = customPulse;
						});
					}
				}
				else if(action === 'Increment') {
					if(freetimes[row].pulse === 5) {
						freetimes[row].forEach(freetime => {
							// Do not hit freetimes that have just started
							if(freetime.startBeat !== startBeat) {
								addHit(startBeat, freetime.totalDifference / 7);
								freetime = null;	// Mark freetime for deletion
							}
						});
						// Delete freetimes that have been hit
						freetimes[row] = freetimes[row].filter(freetime => freetime !== null);
					}
					else {
						freetimes[row].forEach(freetime => {
							freetime.pulse++;
							freetime.totalDifference++;
						});
					}
				}
				else if(action === 'Decrement') {
					freetimes[row].forEach(freetime => {
						freetime.pulse--;
						if(freetime.pulse < 0) {
							freetime.pulse = 0;
						}
						freetime.totalDifference++;
					});
				}
				else if(action === 'Remove') {
					freetimes[row].forEach(freetime => {
						// Do not remove freetimes that have just started
						if(freetime.startBeat !== startBeat) {
							freetime = null;
						}
					});
					// Remove trashed freetimes
					freetimes[row] = freetimes[row].filter(freetime => freetime !== null);
				}
				else {
					console.log(`weird action ${action} encountered`);
				}
				break;
			}
			case 'FinishLevel':
				finishLevelEvents++;
				if(finishLevelEvents === 3) {
					totalBeats = startBeat;
					// Either:
					//  - We know the remaining number of beats, and BPM does not change, or
					//  - We're missing some beats, but we know the time taken by those beats (so we can ignore them)
					levelLength = secondCounter + (totalBeats - lastBPMChange) * 60 / currentBPM;
				}
				break;
		}
	});

	const hitLocations = Array.from(hits.keys()).sort((a, b) => a - b);

	let leftIndex = 0;
	let rightIndex = 0;
	let maxHits = 0;
	let currentHits = 0;

	let irregularTotal = 0;

	for(let i = 0; i < hits.size - 1; i++) {
		// Voltage Calculation
		rightIndex++;
		currentHits += hits.get(hitLocations[rightIndex]).numHits > 1 ? 2 : 1;

		// If the beat distance becomes larger than 4, move the left pointer forwards
		if(hitLocations[rightIndex] - hitLocations[leftIndex] > 4) {
			currentHits -= hits.get(hitLocations[leftIndex]).numHits > 1 ? 2 : 1;
			leftIndex++;
		}

		if(currentHits > maxHits) {
			maxHits = currentHits;
		}

		// Chaos Calculation
		const { ticks, numHits } = hits.get(hitLocations[i]);

		ticks.forEach(tick => {
			if(tick === 1) {
				irregularTotal += 0;
			}
			else if(tick === 0) {
				irregularTotal += 10;
			}
			else if(tick === 0.5) {
				irregularTotal += 8 * numHits * 0.5;
			}
			else if(tick * 3 - Math.round(tick * 3) <= 0.05) {
				irregularTotal += 12 * numHits * 0.75;
			}
			else if(tick * 4 - Math.round(tick * 4) <= 0.05) {
				irregularTotal += 16 * numHits;
			}
			else {
				irregularTotal += (4 / tick) * numHits * 1.25;
			}
		});
	}

	const irregularityDegree = irregularTotal * (1 + (60 * totalBPMChange / levelLength) / 1500);

	const stream = Math.round(60 * uniqueHits / levelLength);
	const voltage = Math.round((60 * totalBeats / levelLength) * maxHits / 4);
	const air = Math.round(60 * totalJumps / levelLength);
	const chaos = Math.round(100 * irregularityDegree / levelLength);

	let statsString = '';

	statsString += `${song} by ${author}\n`;
	statsString += '=================================\n';
	statsString += `Difficulty: ${difficulty}\tBPM: ${minBPM + ((minBPM === maxBPM) ? '' : `-${maxBPM}`)}\n`;
	statsString += `Stream: ${(stream > 300) ? Math.round((stream - 139) * 100/161) : Math.round(stream / 3)}\n`;
	statsString += `Voltage: ${(voltage > 600) ? Math.round((voltage + 594) * 100/1194) : Math.round(voltage / 6)}\n`;
	statsString += `Air: ${(air > 55) ? Math.round((air + 36) * 100/91) : Math.round(air * 20/11)}\n`;
	statsString += `Chaos: ${(chaos > 2000) ? Math.round((chaos + 16628) * 100/18628) : Math.round(chaos / 20)}\n`;
	statsString += '=================================\n';
	statsString += `Total hits: ${totalHits}\n`;
	statsString += 'Rank margins: [';
	for(let i = 0; i < 4; i++) {
		statsString += `${Math.round(rankMaxMistakes[i] / totalHits * 100)}%, `;
	}
	statsString = statsString.substring(0, statsString.length - 2) + ']';

	return statsString;
}

module.exports = {
	getStats
};
