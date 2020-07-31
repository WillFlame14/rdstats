'use strict';

const { getStats } = require('./extract.js');
const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

const levelPath = path.resolve(__dirname, '..', '..', 'Rhythm Doctor', 'Levels');
const folders = fs.readdirSync(levelPath);

let statsString = '';

folders.forEach(folderName => {
	// Make a duplicate of the rdlevel, then change it to JSON
	fs.copyFileSync(path.resolve(levelPath, folderName, 'main.rdlevel'), './copy.rdlevel');
	fs.renameSync('./copy.rdlevel', './main.json5');
	let data;
	try {
		data = fs.readFileSync('./main.json5', "utf8");
		data = data.replace(/(\r\n|\n|\r|\t)/gm, '');
		const level = JSON5.parse(data);
		statsString += getStats(level) +'\n-----------------------------------------\n';
	}
	catch(error) {
		console.log(data.substring(0, 100));
		console.log(data.charAt(52));
		console.log(error);
	}

	fs.unlinkSync('./main.json5');
});

fs.writeFileSync('./stats.txt', statsString);


