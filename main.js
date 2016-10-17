require('dotenv').config({silent: true});

var express = require('express');
var app = express();
var expressBrowserify = require('express-browserify');


app.get('/main.js', expressBrowserify('./src/app.js', {watch:true}));


app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('/help', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.use(express.static('public'));


app.listen(process.env.PORT, function(){
    console.log('listening on *:'+process.env.PORT);
});
