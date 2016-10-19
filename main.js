require('dotenv').config({silent: true});

var express = require('express');
var app = express();
var stringify = require('stringify');
var expressBrowserify = require('express-browserify');

var browserify =expressBrowserify('./src/app.js', {watch:true});
    // b is the expressBrowserify instance.
browserify.browserify.transform(stringify, {
            appliesTo: { includeExtensions: ['.hjs', '.html', '.whatever'] }
});


app.get('/main.js', browserify);


app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.get('*', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.use(express.static('public'));


app.listen(process.env.PORT, function(){
    console.log('listening on *:'+process.env.PORT);
});
