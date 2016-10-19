'use strict';

var angular = require("angular");
var moment = require('moment');
var _ = require('underscore');

require('angular-local-storage');
require('angular-route');

var app = angular.module("MirrorMirror", ['LocalStorageModule', 'ngRoute']);

/**
 * Router split out
 */
require('./router');

/**
 * services split out
 */
require('./services');

/**
 * Main application logic
 */
app.run(['$window', '$location', '$rootScope', 'annyang' ,'layout', 'states', 'materialize', function(window, location ,scope, annyang, layout, states, material){

    // TODO: Move these dependencies into services
    var synth = require('./libs/text-to-speech');
    var botController = require('./bot-helper')();
    var GoogleSearch = require('google-search');

    // start the speech synthesis helper
    var speaker = new synth("Google US English");

    // configure the google search module
    var googleSearch = new GoogleSearch({
        key: 'AIzaSyDlW-v-95FixjfVysJWlnquMaGJCoOERzY',
        cx: '009559986388052249737:4vu6h-gj9oe'
    });

    scope.layout = layout;
    scope.states = states;

    scope.crystal = {
        botname : botController.get('botname'),
        username: botController.get('username'),
        error: null,
        heard: null,
        said: null
    };


    // before speaking
    speaker.onBefore(function(text){
        scope.crystal.said = text;
        material.toast($("<span><i class=\"material-icons\">question_answer</i>"+scope.crystal.said+"</span>"), 4000);

        if (annyang.isListening())
            annyang.pause();
    });

    // after speaking
    speaker.onAfter(function(msg){
        if (!annyang.isListening())
            annyang.resume();
    });


    // speech recognition event handlers
    annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
        scope.crystal.heard = userSaid;
        material.toast($("<span><i class=\"material-icons\">hearing</i> "+scope.crystal.heard+"</span>"), 4000);
    });

    annyang.addCallback('resultNoMatch', function(userSaid, commandText, phrases) {
        scope.crystal.error = "Sorry, I couldn't understand you.";
        scope.crystal.heard = userSaid.pop();
        material.toast($("<span><i class=\"material-icons\">hearing</i> "+scope.crystal.heard+"</span>"), 4000);
        material.toast($("<span><i class=\"material-icons\">error</i> "+scope.crystal.error+"</span>"), 4000);

    });

    annyang.addCallback('error', function() {
        scope.crystal.error = "Speech recognition error.";
        material.toast($("<span><i class=\"material-icons\">error</i> "+scope.crystal.error+"</span>"), 4000);

    });

    // anything command
    var anything = {
        "*anything": function(convo){
            speaker.speak(botController.replyTo(convo));
        }
    };

    // search function for bot search function
    function search(term) {
        botController.replyTo('tell me about'+ term);

        googleSearch.build({
            q: term,
            num: 3 // Number of search results to return between 1 and 10, inclusive
        }, function(error, response) {

            var snippet = "";
            if (response.items) {
                // teach the bot something
                for(var i in response.items) {
                    snippet = response.items[i].snippet.replace(/\.\.\.|\n|\s\s+/g, " ");
                    var sentences = snippet.match(/(\w|\s|\d|'|,|\(|\))*[\!|\.|\?]/g);
                    for(var s in sentences) {
                        // this is pretty funny but probably not very useful
                        botController.replyTo(sentences[s]);
                    }
                }
            } else {
                speaker.speak("I don't know anything about, "+thing);
                return;
            }

            speaker.speak(response.items[0].snippet);
        });
    }

    var commands = {
        // navigation and help commands
        "(show) help": function(){
            location.path("/help");
        },
        "go back": function(){
            window.history.back();
        },
        "restart": function(){
            speaker.speak("Restarting");

            window.location.reload(true);
        },
        // grid and layout commands
        "show grid" : function(){
            states.showColumns = true;
            speaker.speak("Showing grid.");
        },
        "hide grid" : function(){
            states.showColumns = false;
            speaker.speak("Hiding grid.");
        },
        'set (cell) :cell to :module': function(cell, module){
            layout.setCellToModule({
                row:cell.split('')[1],
                column:cell.split('')[0]
            }, module);
        },
        'make (cell) :cell smaller': function(cell, size){
            layout.decreaseWidth({
                row:cell.split('')[1],
                column:cell.split('')[0]
            });
        },
        'make (cell) :cell bigger': function(cell, size){
            layout.increaseWidth({
                row:cell.split('')[1],
                column:cell.split('')[0]
            });
        },
        'add row': function(){
            layout.addRow();
            speaker.speak("Row added");
        },
        'add cell to (row) :index': function(row){
            layout.addCell(row);
            speaker.speak("Cell added to row "+ row);

        },
        'remove row :index': function(row){
            layout.removeRow(row);

        },
        'remove cell :index': function(cell){
            layout.removeCell({
                row:cell.split('')[1],
                column:cell.split('')[0]
            });
            speaker.speak("cell "+ cell+ " removed");

        },
        "swap (cell) :cell and (cell) :cellD" : function(cell, cellD){
            layout.swapCell(
                {
                    row:cell.split('')[1],
                    column:cell.split('')[0]
                },
                {
                    row:cellD.split('')[1],
                    column:cellD.split('')[0]
                });
            speaker.speak("Cells "+cell+ " and "+cellD+" swapped");
        },
        "swap row :row and (row) :rowD" : function(sRow, tRow){
            layout.swapRow({row:sRow}, {row:tRow});
            speaker.speak("Rows " + sRow + " and " + tRow + "swapped");

        },
        "save layout": function(){
            layout.save();
            speaker.speak("Layout saved.");

        },
        // crystal chatting commands
        "(no) my name is :name": function(name){
            botController.changeUsername(name);
            speaker.speak(botController.replyTo("My name is "+name));
        },
        "let's chat" : function() {
            annyang.addCommands(anything);
            speaker.speak(botController.replyTo("Hey!"));

        },
        '(okay) shut up': function() {
            annyang.removeCommands(["*anything"]);
            botController.replyTo("Okay, shut up!");
            speaker.speak("Ok, bye bye.");
        },
        '(okay) I\'m done': function() {
            annyang.removeCommands(["*anything"]);
            botController.replyTo("I'm done.");
            speaker.speak("Ok, bye bye.");
        },
        'good job': function(){
            botController.save();
            speaker.speak(botController.replyTo('Good job!'));
        },
        'tell me *thing': search
    };

// Add our commands to annyang
    annyang.addCommands(commands);

    try {
        // Start listening. You can call this here, or attach this call to an event, button, etc.
        annyang.start();
    } catch (e) {
        console.log(e);
    }


}]);

app.directive('card', function($compile) {
    return {
        scope: {
            card: '='
        },
        link: function(scope, element) {
            var generatedTemplate = '<div ' + scope.card.name + ' card-data="card.data"></div>';
            element.append($compile(generatedTemplate)(scope));
        }
    };
});


/**
 * Modularized pieces of the app.
 * This makes developing new features less messy.
 */
require('./modules/help/help');
require('./modules/welcome/welcome');
require('./modules/calendar/calendar');
require('./modules/time/time');



