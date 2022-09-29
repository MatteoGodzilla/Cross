import { Database, RunResult } from "sqlite3";

export interface Stem{
    name: string;
    artist: string;
}

export interface Custom{
    id:number|null; //used by the database, shouldn't be provided by user when creating
    idTag:string;
    downloadLink: string;
    songs:Stem[];
    bpm:number;
    charter:string;
    mixer:string;
    difficulties:{
        general:number;
        tap:number;
        crossfade:number;
        scratch:number;
    };
    availableCharts:{
        beginner:boolean;
        easy:boolean;
        medium:boolean;
        hard:boolean;
        expert:boolean;
    };
    deckSpeeds:{
        beginner:number;
        easy:number;
        medium:number;
        hard:number;
        expert:number;
    };
    videoLink:string;
    lastUpdate: number;
    visible:boolean;
}

export enum DBErrorCode{
    CLOSED_DATABASE,
    COULD_NOT_ADD_CUSTOM,
    CANNOT_RETRIEVE_CUSTOM_ID,
    CANNOT_RETRIEVE_STEM,
    CANNOT_RETRIEVE_LATEST,
    NO_CUSTOM,
    NO_STEMS,
}

export class DBError{
    public type:DBErrorCode;
    public message:string
    public header = "ERROR";
    public databaseError:Error|undefined = undefined;

    constructor(t:DBErrorCode, msg:string, sqliteError : Error | undefined){
        this.type = t;
        this.message = msg;
        this.databaseError = sqliteError;
    }
}

export class DBManager{
    public open = false;
    database:Database;
    constructor(path:string){
        this.database = new Database(path,(err)=>{
            if(err != null) {
                console.error(`Could not Open the database: ${err}`);
                return;
            }

            this.open = true;

            this.database.serialize(()=>{
                //check if table is created
                this.database.run("PRAGMA foreign_keys = ON;",(db:RunResult,err:Error|null)=>{
                   if(err != null) console.error(`Error while enabling foreign keys in the database`);
                });

                this.database.run(`CREATE TABLE IF NOT EXISTS customs ${customsSchema}`,(db:RunResult,err:Error|null)=>{
                    if(err != null) console.error(`Error while creating 'customs' table: ${err}`);
                });

                this.database.run(`CREATE TABLE IF NOT EXISTS stems ${stemSchema}`,(db:RunResult,err:Error|null)=>{
                    if(err != null) console.error(`Error while creating 'stems' table: ${err}`);
                });

                console.log("Database Successfully initialized");
            });
        });
    }

    AddCustom(custom:Custom) : Promise<number>{
        return new Promise((resolve,reject)=>{
            if(!this.open) {
                reject(new DBError(DBErrorCode.CLOSED_DATABASE,"Database is closed",undefined)); return;
            }

            let query = `INSERT INTO customs VALUES (
                $ID, $IDTag, $downloadLink, $bpm, $charter, $mixer,
                $generalDiff, $tapDiff,$crossfadeDiff, $scratchDiff,
                $availableCharts,
                $deckSpeedB, $deckSpeedE, $deckSpeedM, $deckSpeedH, $deckSpeedX,
                $videoLink, $lastUpdate, $visible
            );`

            //beginner is index 0, expert is index 4

            let availableCharts:number = 0;
            if(custom.availableCharts.beginner)
                availableCharts |= 1 << 0;
            if(custom.availableCharts.easy)
                availableCharts |= 1 << 1;
            if(custom.availableCharts.medium)
                availableCharts |= 1 << 2;
            if(custom.availableCharts.hard)
                availableCharts |= 1 << 3;
            if(custom.availableCharts.expert)
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
            this.database.run(query,data,(err)=>{
                if(err != null){
                    reject(new DBError(DBErrorCode.COULD_NOT_ADD_CUSTOM,"Error: Could not add Custom to database:",err))
                    return;
                }
                console.log("Successfully added custom! Hurray");
                //command 2
                this.database.get("SELECT MAX(id) FROM customs;",(err,row)=>{
                    if(err != null){
                        reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_CUSTOM_ID,"Custom was added but could not get its id",err));
                        return;
                    }
                    newID = row["MAX(id)"];

                    //prepare query with the right amount of placeholder positions
                    let placeholders:string[] = new Array(custom.songs.length).fill("(?,?,?)");
                    let stemQuery = `INSERT INTO stems (name, artist, customID) VALUES ${placeholders.join(",")}`;

                    let stemData = []
                    //flatten the objects into a single array with the values to add
                    for(let stem of custom.songs){
                        stemData.push(stem.name);
                        stemData.push(stem.artist);
                        stemData.push(newID);
                    }

                    //command 3
                    this.database.run(stemQuery,stemData,(err)=>{
                        if(err != null){
                            reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_STEM,"Error: Could not add Stem data to database:",err)); return;
                        }
                        console.log("Successfully added all data of custom to database! 🎉");
                        resolve(newID);
                    });
                });
            });
        });
    }

    GetCustom(id:number) : Promise<Custom>{
        return new Promise((resolve,reject)=>{
            //create a new Custom object that is sent to the user

            let query1 = "SELECT * FROM customs WHERE id = $id AND visible = 1";
            let query2 = "SELECT * FROM stems WHERE customID = $id";

            let data = {
                $id:id
            };

            this.database.serialize(()=>{
                let track:any = {};
                let songs:any[] = [];

                this.database.get(query1,data,(err:Error|undefined,row:any)=>{
                    if(err != undefined || row == undefined) {
                        reject(new DBError(DBErrorCode.NO_CUSTOM,"Could not find Custom",err)); return;
                    }

                    console.log(row);
                    track = row;
                    //resolve(row);

                    //vvvv this should only run if the previous command was successful vvvv
                    this.database.all(query2,data,(err:Error,rows:any[])=>{
                        if(err != undefined || rows.length == 0) {
                            reject(new DBError(DBErrorCode.NO_STEMS,"Could not find Song Data", err)); return;
                        }

                        //if the previous command was successful, that means that a custom with id is visible,
                        //so the stems should also be valid, right?
                        songs = rows;

                        //final callback here is sure to have track and songs with valid data
                        let custom:Custom = {
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
                                artist:song.artist,
                                name:song.name
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
    GetLatestIds(maxTime:number|undefined) : Promise<number[]> {
        return new Promise((resolve,reject) => {
            let query = "SELECT id FROM customs WHERE lastUpdate < $maxTime ORDER BY lastUpdate DESC LIMIT 50;"

            let data = {
                $maxTime: maxTime || new Date().getTime()
            }

            console.log(data);

            this.database.all(query,data,(err:Error,rows:any[]) =>{
                if(err != undefined || rows.length == 0) {
                    reject(new DBError(DBErrorCode.CANNOT_RETRIEVE_LATEST,"Could not get latest songs",err)); return;
                }

                let flattenedRows:number[] = [];
                rows.forEach(row => flattenedRows.push(row.id));

                resolve(flattenedRows);
            });
        })
    }
}

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