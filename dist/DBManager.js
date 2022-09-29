"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBManager = exports.DBError = exports.DBErrorCode = void 0;
const sqlite3_1 = require("sqlite3");
var DBErrorCode;
(function (DBErrorCode) {
    DBErrorCode[DBErrorCode["CLOSED_DATABASE"] = 0] = "CLOSED_DATABASE";
    DBErrorCode[DBErrorCode["COULD_NOT_ADD_CUSTOM"] = 1] = "COULD_NOT_ADD_CUSTOM";
    DBErrorCode[DBErrorCode["CANNOT_RETRIEVE_CUSTOM_ID"] = 2] = "CANNOT_RETRIEVE_CUSTOM_ID";
    DBErrorCode[DBErrorCode["CANNOT_RETRIEVE_STEM"] = 3] = "CANNOT_RETRIEVE_STEM";
    DBErrorCode[DBErrorCode["CANNOT_RETRIEVE_LATEST"] = 4] = "CANNOT_RETRIEVE_LATEST";
    DBErrorCode[DBErrorCode["NO_CUSTOM"] = 5] = "NO_CUSTOM";
    DBErrorCode[DBErrorCode["NO_STEMS"] = 6] = "NO_STEMS";
})(DBErrorCode = exports.DBErrorCode || (exports.DBErrorCode = {}));
class DBError {
    type;
    message;
    header = "ERROR";
    databaseError = undefined;
    constructor(t, msg, sqliteError) {
        this.type = t;
        this.message = msg;
        this.databaseError = sqliteError;
    }
}
exports.DBError = DBError;
class DBManager {
    open = false;
    database;
    constructor(path) {
        this.database = new sqlite3_1.Database(path, (err) => {
            if (err != null) {
                console.error(`Could not Open the database: ${err}`);
                return;
            }
            this.open = true;
            this.database.serialize(() => {
                //check if table is created
                this.database.run("PRAGMA foreign_keys = ON;", (db, err) => {
                    if (err != null)
                        console.error(`Error while enabling foreign keys in the database`);
                });
                this.database.run(`CREATE TABLE IF NOT EXISTS customs ${customsSchema}`, (db, err) => {
                    if (err != null)
                        console.error(`Error while creating 'customs' table: ${err}`);
                });
                this.database.run(`CREATE TABLE IF NOT EXISTS stems ${stemSchema}`, (db, err) => {
                    if (err != null)
                        console.error(`Error while creating 'stems' table: ${err}`);
                });
                console.log("Database Successfully initialized");
            });
        });
    }
    AddCustom(custom) {
        return new Promise((resolve, reject) => {
            if (!this.open) {
                reject(new DBError(DBErrorCode.CLOSED_DATABASE, "Database is closed", undefined));
                return;
            }
            let query = `INSERT INTO customs VALUES (
                $ID, $IDTag, $downloadLink, $bpm, $charter, $mixer,
                $generalDiff, $tapDiff,$crossfadeDiff, $scratchDiff,
                $availableCharts,
                $deckSpeedB, $deckSpeedE, $deckSpeedM, $deckSpeedH, $deckSpeedX,
                $videoLink, $lastUpdate, $visible
            );`;
            //beginner is index 0, expert is index 4
            let availableCharts = 0;
            if (custom.availableCharts.beginner)
                availableCharts |= 1 << 0;
            if (custom.availableCharts.easy)
                availableCharts |= 1 << 1;
            if (custom.availableCharts.medium)
                availableCharts |= 1 << 2;
            if (custom.availableCharts.hard)
                availableCharts |= 1 << 3;
            if (custom.availableCharts.expert)
                availableCharts |= 1 << 4;
            let data = {
                $IDTag: custom.idTag,
                $downloadLink: custom.downloadLink,
                $bpm: custom.bpm,
                $charter: custom.charter,
                $mixer: custom.mixer,
                $generalDiff: custom.difficulties.general,
                $tapDiff: custom.difficulties.tap,
                $crossfadeDiff: custom.difficulties.crossfade,
                $scratchDiff: custom.difficulties.scratch,
                $availableCharts: availableCharts,
                $deckSpeedB: custom.deckSpeeds.beginner,
                $deckSpeedE: custom.deckSpeeds.easy,
                $deckSpeedM: custom.deckSpeeds.medium,
                $deckSpeedH: custom.deckSpeeds.hard,
                $deckSpeedX: custom.deckSpeeds.expert,
                $videoLink: custom.videoLink,
                $lastUpdate: Date.now(),
                $visible: custom.visible
            };
            let newID = -1;
            //this is truly callback hell
            //command 1
            this.database.run(query, data, (err) => {
                if (err != null) {
                    reject(new DBError(DBErrorCode.COULD_NOT_ADD_CUSTOM, "Error: Could not add Custom to database:", err));
                    return;
                }
                console.log("Successfully added custom! Hurray");
                //command 2
                this.database.get("SELECT MAX(id) FROM customs;", (err, row) => {
                    if (err != null) {
                        reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_CUSTOM_ID, "Custom was added but could not get its id", err));
                        return;
                    }
                    newID = row["MAX(id)"];
                    //prepare query with the right amount of placeholder positions
                    let placeholders = new Array(custom.songs.length).fill("(?,?,?)");
                    let stemQuery = `INSERT INTO stems (name, artist, customID) VALUES ${placeholders.join(",")}`;
                    let stemData = [];
                    //flatten the objects into a single array with the values to add
                    for (let stem of custom.songs) {
                        stemData.push(stem.name);
                        stemData.push(stem.artist);
                        stemData.push(newID);
                    }
                    //command 3
                    this.database.run(stemQuery, stemData, (err) => {
                        if (err != null) {
                            reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_STEM, "Error: Could not add Stem data to database:", err));
                            return;
                        }
                        console.log("Successfully added all data of custom to database! 🎉");
                        resolve(newID);
                    });
                });
            });
        });
    }
    GetCustom(id) {
        return new Promise((resolve, reject) => {
            //create a new Custom object that is sent to the user
            let query1 = "SELECT * FROM customs WHERE id = $id AND visible = 1";
            let query2 = "SELECT * FROM stems WHERE customID = $id";
            let data = {
                $id: id
            };
            this.database.serialize(() => {
                let track = {};
                let songs = [];
                this.database.get(query1, data, (err, row) => {
                    if (err != undefined || row == undefined) {
                        reject(new DBError(DBErrorCode.NO_CUSTOM, "Could not find Custom", err));
                        return;
                    }
                    console.log(row);
                    track = row;
                    //resolve(row);
                    //vvvv this should only run if the previous command was successful vvvv
                    this.database.all(query2, data, (err, rows) => {
                        if (err != undefined || rows.length == 0) {
                            reject(new DBError(DBErrorCode.NO_STEMS, "Could not find Song Data", err));
                            return;
                        }
                        //if the previous command was successful, that means that a custom with id is visible,
                        //so the stems should also be valid, right?
                        songs = rows;
                        //final callback here is sure to have track and songs with valid data
                        let custom = {
                            id: track.id,
                            idTag: track.IDTag,
                            downloadLink: track.downloadLink,
                            //songs are added afterwards
                            songs: [],
                            bpm: track.bpm,
                            charter: track.charter,
                            mixer: track.mixer,
                            difficulties: {
                                general: track.generalDiff,
                                tap: track.tapDiff,
                                crossfade: track.crossfadeDiff,
                                scratch: track.scratchDiff
                            },
                            //charts are added afterwards
                            availableCharts: {
                                beginner: false,
                                easy: false,
                                medium: false,
                                hard: false,
                                expert: false
                            },
                            deckSpeeds: {
                                beginner: track.deckSpeedB,
                                easy: track.deckSpeedE,
                                medium: track.deckSpeedM,
                                hard: track.deckSpeedH,
                                expert: track.deckSpeedX
                            },
                            videoLink: track.videoLink,
                            lastUpdate: track.lastUpdate,
                            visible: track.visible
                        };
                        //add songs
                        songs.forEach(song => {
                            custom.songs.push({
                                artist: song.artist,
                                name: song.name
                            });
                        });
                        //calculate available charts the right way
                        custom.availableCharts.beginner = ((track.availableCharts & (1 << 0)) > 0);
                        custom.availableCharts.easy = ((track.availableCharts & (1 << 1)) > 0);
                        custom.availableCharts.medium = ((track.availableCharts & (1 << 2)) > 0);
                        custom.availableCharts.hard = ((track.availableCharts & (1 << 3)) > 0);
                        custom.availableCharts.expert = ((track.availableCharts & (1 << 4)) > 0);
                        resolve(custom);
                    });
                });
            });
        });
    }
    //this only sends the ids of the latest customs, not the data itself
    //so a programmer has to chain multiple calls after this
    GetLatestIds(maxTime) {
        return new Promise((resolve, reject) => {
            let query = "SELECT id FROM customs WHERE lastUpdate < $maxTime ORDER BY lastUpdate DESC LIMIT 50;";
            let data = {
                $maxTime: maxTime || new Date().getTime()
            };
            console.log(data);
            this.database.all(query, data, (err, rows) => {
                if (err != undefined || rows.length == 0) {
                    reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_LATEST, "Could not get latest songs", err));
                    return;
                }
                let flattenedRows = [];
                rows.forEach(row => flattenedRows.push(row.id));
                resolve(flattenedRows);
            });
        });
    }
}
exports.DBManager = DBManager;
const customsSchema = `(
    id INTEGER PRIMARY KEY ON CONFLICT ABORT AUTOINCREMENT,
    IDTag TEXT,
    downloadLink TEXT,
    bpm REAL,
    charter TEXT,
    mixer TEXT,
    generalDiff REAL DEFAULT 0,
    tapDiff REAL DEFAULT 0,
    crossfadeDiff REAL DEFAULT 0,
    scratchDiff REAL DEFAULT 0,
    availableCharts INTEGER,
    deckSpeedB REAL DEFAULT 1,
    deckSpeedE REAL DEFAULT 1,
    deckSpeedM REAL DEFAULT 1,
    deckSpeedH REAL DEFAULT 1,
    deckSpeedX REAL DEFAULT 1,
    videoLink TEXT,
    lastUpdate INTEGER,
    visible INTEGER DEFAULT 1
)`;
const stemSchema = `(
    id INTEGER PRIMARY KEY ON CONFLICT ABORT AUTOINCREMENT,
    name TEXT,
    artist TEXT,
    customID INTEGER,
    FOREIGN KEY(customID) REFERENCES customs(id)
)`;
