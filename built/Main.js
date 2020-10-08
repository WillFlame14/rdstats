'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const Level_js_1 = require("./Level.js");
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");
const levelPath = path.resolve(__dirname, '../../../', 'Rhythm Doctor', 'Levels');
const folders = fs.readdirSync(levelPath);
let statsString = '';
for (const folderName of folders) {
    // Make a duplicate of the rdlevel, then change it to JSON
    fs.copyFileSync(path.resolve(levelPath, folderName, 'main.rdlevel'), './copy.rdlevel');
    fs.renameSync('./copy.rdlevel', './main.json5');
    let data, level;
    try {
        data = fs.readFileSync('./main.json5', "utf8");
        data = data.replace(/(\r\n|\n|\r|\t)/gm, '');
        level = new Level_js_1.Level(JSON5.parse(data));
        statsString += level.getStats() + '\n-----------------------------------------\n';
    }
    catch (error) {
        if (level) {
            console.log(`${level.song} - ${level.author}`);
        }
        console.log(error);
    }
    fs.unlinkSync('./main.json5');
}
fs.writeFileSync('./stats.txt', statsString);
