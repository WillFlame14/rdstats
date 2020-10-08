interface RDEvent {
	// ----- General -----
	bar: number,
	beat: number,
	type: string,
	active?: boolean,
	row?: number,

	// ----- Audio -----

	// Play Song
	bpm?: number,

	// Set Beats Per Minute
	beatsPerMinute?: number,

	// Set Crochets Per Bar
	crochetsPerBar?: number,

	// ----- Beats -----
	tick?: number

	// Add Oneshot Beat
	loops?: number,
	interval?: number,
	delay?: number

	// Add/Pulse Freetime Beat
	action?: string,
	pulse?: number,
	customPulse?: number
}
