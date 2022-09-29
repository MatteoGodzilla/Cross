import bodyParser from "body-parser";
import express from "express";
import { Custom, DBManager } from "./DBManager";

const app = express();
const dbManager = new DBManager("customs.db");

//only used as debug
app.use(express.static("dist/webpage"));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.get("/api/status",(req,res)=>{
    if(dbManager.open){
        res.status(200);
        res.send("Database is ready!\n");
    } else {
        res.status(500);
        res.send("NOT READY\n");
    }
});

//get single track -> GET
app.get("/api/v1/custom/:id(\\d+)",(req,res)=>{
    console.log("GET ID IS CALLED");
    dbManager.GetCustom(Number(req.params.id))
        .then((value:any) => res.send(value))
        .catch((err) => res.status(500).send(err));

    //res.send(dbManager.GetCustom(Number(req.params.id)));
    //should return a 'Custom' object
    //if id is invalid, should return an error code in the header
});

//add a track -> POST
app.post("/api/v1/custom/new",(req,res)=>{
    //should return the id of the newly created custom
    let newCustom:Custom = {
        id:null,
        idTag: req.body.idTag || "",
        downloadLink:"",
        songs:[{
            name: "song",
            artist: "artist"
        },{
            name: "song 2",
            artist: "artist 2"
        }],
        bpm:4321,
        charter:"matteo",
        mixer:"not matteo",
        difficulties:{
            general: 10,
            tap: 20,
            crossfade: 30,
            scratch: 40
        },
        availableCharts:{
            beginner:false,
            easy:false,
            medium:false,
            hard:false,
            expert:true
        },
        deckSpeeds:{
            beginner:1,
            easy:2,
            medium:3,
            hard:4,
            expert:5,
        },
        lastUpdate:Date.now(),
        videoLink:"it doesn't exists",
        visible:true
    };

    dbManager.AddCustom(newCustom)
        .then(id => res.send(id.toString()))
        .catch(err => res.status(500).send(err));

    //res.send(newCustom);
});


//get list of all tracks -> GET

//get N most recent tracks -> GET
app.get("/api/v1/latest",(req,res)=>{

    //console.log(req.query);
    //res.send({message:"it is working"});

    dbManager.GetLatestIds(Number(req.query["maxTime"]))
        .then(ids => res.send(ids))
        .catch(err => res.status(500).send(err));

});


//search a custom -> GET

//----ADMIN----
//delete a track (protected by some kind of password) -> DELETE

app.listen(3050,()=>console.log("Listening at port 3050"));
