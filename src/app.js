'use strict';

var angular = require("angular");
var moment = require('moment');
var _ = require('underscore');
window.annyang = require('./libs/annyang');

require('angular-local-storage');
require('angular-route');

var app = angular.module("MirrorMirror", ['LocalStorageModule', 'ngRoute']);

app.config(['$routeProvider','$locationProvider' ,'localStorageServiceProvider' ,function ($routeProvider, $locationProvider,localStorageServiceProvider) {

    $routeProvider
        .when('/help', {
            templateUrl: '/views/help.html',
            controller: function(){}
        })
        .when('/', {
            templateUrl: '/views/main.html',
            controller: function(){}
        });

    // configure html5 to get links working on jsfiddle
    $locationProvider.html5Mode(true);

    localStorageServiceProvider
        .setPrefix('MirrorMirror')
        .setNotify(true, true)

}]);

app.service('layout', ['localStorageService', function(storage){
    // mutli dimensional array of rows and columns
    var layout =  storage.get('layout') || [
        [
            {name:'welcome', size:5, data:{}},
            {name:'empty-slot', size:4},
            {name:'time', size:3}
        ],
        [
            {name:'empty-slot', size:4},
            {name:'empty-slot', size:4},
            {name:'empty-slot', size:4}
        ],
        [
            {name:'empty-slot', size:5},
            {name:'empty-slot', size:4},
            {name:'calendar', size:3}
        ]
    ];

    layout.addRow = function(colCount){
        layout.push([
            {name:'empty-slot', size:3},
            {name:'empty-slot', size:3},
            {name:'empty-slot', size:3},
            {name:'empty-slot', size:3}
        ]);
    };


    layout.addCell = function(row){
        layout[row].push(
            {name:'empty-slot', size:3}
        );
        layout.fixCells();
    };

    layout.removeCell = function(cell){
        layout[cell.row].splice(cell.column, 1);
        layout.fixCells();
    };

    layout.swapCell = function(subject, target){

        var targetTmp = layout[target.row][target.column];

        layout[target.row][target.column] = layout[subject.row][subject.column];
        layout[subject.row][subject.column] = targetTmp;

        layout.fixCells();
    };

    layout.setCellToModule = function(cell, module){
        layout[cell.row][cell.column].name = module;
    };

    layout.resizeCell = function(cell, size){
        layout[cell.row][cell.column].size = size;
        layout.fixCells();
    };

    layout.increaseWidth = function(cell){
        ++layout[cell.row][cell.column].size;
        layout.fixCells();
    };

    layout.decreaseWidth = function(cell){
        --layout[cell.row][cell.column].size;
        layout.fixCells();
    };


    layout.swapRow = function(subject, target){

        var targetTmp = layout[target.row];

        layout[target.row] = layout[subject.row];
        layout[subject.row] = targetTmp;

    };

    layout.fixCells = function(){
        var sum = function(a, b){return a+b};
        for(var r in layout){
            if(_.reduce(_.pluck(layout[r], 'size'), sum) > 12) {

                for(var c in layout[r]){
                    if (_.reduce(_.pluck(layout[r], 'size'), sum) > 12) {
                        if (layout[r][c].name == 'empty-slot') {
                            --layout[r][c].size;
                        }
                    }

                }
            } else {
                for(var c in layout[r]){
                    if (_.reduce(_.pluck(layout[r], 'size'), sum) < 12) {
                        if (layout[r][c].name == 'empty-slot') {
                            ++layout[r][c].size;
                        }
                    }

                }
            }

        }
    };

    layout.removeRow = function(row){

        layout.splice(row, 1);

    };

    layout.save = function(){
      storage.set('layout', layout);
    };


    return layout;

}]);

app.service('states', function(){
    var states = {
        showColumns: false
    };

    return states;
});

// pass the toast
app.service('materialize', ['$window', function(window){
    return window.Materialize;
}]);

// pass the toast
app.service('annyang', ['$window', function(window){
    return window.annyang;
}]);

app.run(['$window', '$location', '$rootScope', 'annyang' ,'layout', 'states', 'materialize', function(window, location ,scope, annyang, layout, states, material){

    var synth = require('./libs/text-to-speech');

    var botController = require('./bot-helper')();
    var speaker = new synth("Google US English");

    var GoogleSearch = require('google-search');
    var googleSearch = new GoogleSearch({
        key: 'AIzaSyDlW-v-95FixjfVysJWlnquMaGJCoOERzY',
        cx: '009559986388052249737:4vu6h-gj9oe'
    });

    scope.layout = layout;
    scope.states = states;

    scope.penny = {
        botname : botController.get('botname'),
        username: botController.get('username'),
        error: null,
        heard: null,
        said: null
    };


    speaker.onBefore(function(text){
        scope.penny.said = text;
        material.toast($("<span><i class=\"material-icons\">question_answer</i>"+scope.penny.said+"</span>"), 4000);

        if (annyang.isListening())
            annyang.pause();
    });

    speaker.onAfter(function(msg){
        if (!annyang.isListening())
            annyang.resume();
    });



    annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
        scope.penny.heard = userSaid;
        material.toast($("<span><i class=\"material-icons\">hearing</i> "+scope.penny.heard+"</span>"), 4000);
    });

    annyang.addCallback('resultNoMatch', function(userSaid, commandText, phrases) {
        scope.penny.error = "Sorry, I couldn't understand you.";
        scope.penny.heard = userSaid.pop();
        material.toast($("<span><i class=\"material-icons\">hearing</i> "+scope.penny.heard+"</span>"), 4000);
        material.toast($("<span><i class=\"material-icons\">error</i> "+scope.penny.error+"</span>"), 4000);

    });

    annyang.addCallback('error', function() {
        scope.penny.error = "Speech recognition error.";
        material.toast($("<span><i class=\"material-icons\">error</i> "+scope.penny.error+"</span>"), 4000);

    });

    var anything = {
        "*anything": function(convo){
            speaker.speak(botController.replyTo(convo));
        }
    };

    function search(term) {
        botController.replyTo('tell me about'+ term);

        googleSearch.build({
            q: term,
            num: 3 // Number of search results to return between 1 and 10, inclusive
        }, function(error, response) {

            var snippet = "";
            if (response.items) {
                for(var i in response.items) {
                    snippet = response.items[i].snippet.replace(/\.\.\.|\n|\s\s+/g, " ");
                    var sentences = snippet.match(/(\w|\s|\d|'|,|\(|\))*[\!|\.|\?]/g);
                    for(var s in sentences) {
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

// default empty slot
app.directive('emptySlot', function(){
    return {
        templateUrl: '/views/slot.html'
    };
});

require('./modules/welcome');
require('./modules/calendar');
require('./modules/time');



