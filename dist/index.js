"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const DBManager_1 = require("./DBManager");
const app = (0, express_1.default)();
const dbManager = new DBManager_1.DBManager("customs.db");
//only used as debug
app.use(express_1.default.static("dist/webpage"));
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json());
app.get("/api/status", (req, res) => {
    if (dbManager.open) {
        res.status(200);
        res.send("Database is ready!\n");
    }
    else {
        res.status(500);
        res.send("NOT READY\n");
    }
});
//get single track -> GET
app.get("/api/v1/custom/:id(\\d+)", (req, res) => {
    console.log("GET ID IS CALLED");
    dbManager.GetCustom(Number(req.params.id))
        .then((value) => res.send(value))
        .catch((err) => res.status(500).send(err));
    //res.send(dbManager.GetCustom(Number(req.params.id)));
    //should return a 'Custom' object
    //if id is invalid, should return an error code in the header
});
//add a track -> POST
app.post("/api/v1/custom/new", (req, res) => {
    //should return the id of the newly created custom
    let newCustom = {
        id: null,
        idTag: req.body.idTag || "",
        downloadLink: "",
        songs: [{
                name: "song",
                artist: "artist"
            }, {
                name: "song 2",
                artist: "artist 2"
            }],
        bpm: 4321,
        charter: "matteo",
        mixer: "not matteo",
        difficulties: {
            general: 10,
            tap: 20,
            crossfade: 30,
            scratch: 40
        },
        availableCharts: {
            beginner: false,
            easy: false,
            medium: false,
            hard: false,
            expert: true
        },
        deckSpeeds: {
            beginner: 1,
            easy: 2,
            medium: 3,
            hard: 4,
            expert: 5,
        },
        lastUpdate: Date.now(),
        videoLink: "it doesn't exists",
        visible: true
    };
    dbManager.AddCustom(newCustom)
        .then(id => res.send(id.toString()))
        .catch(err => res.status(500).send(err));
    //res.send(newCustom);
});
//get list of all tracks -> GET
//get N most recent tracks -> GET
app.get("/api/v1/latest", (req, res) => {
    //console.log(req.query);
    //res.send({message:"it is working"});
    dbManager.GetLatestIds(Number(req.query["maxTime"]))
        .then(ids => res.send(ids))
        .catch(err => res.status(500).send(err));
});
//search a custom -> GET
//----ADMIN----
//delete a track (protected by some kind of password) -> DELETE
app.listen(3050, () => console.log("Listening at port 3050"));
