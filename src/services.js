/**
 * Created by diego on 10/19/16.
 */
var angular = require('angular');
window.annyang = require('annyang');

var app = angular.module("MirrorMirror");

app.service('layout', ['localStorageService', function(storage){
    // multi dimensional array of rows and columns
    var layout =  storage.get('layout') || [
            [
                {name:'welcome', size:5, data:{}},
                {name:'empty', size:4},
                {name:'time', size:3}
            ],
            [
                {name:'empty', size:4},
                {name:'empty', size:4},
                {name:'empty', size:4}
            ],
            [
                {name:'empty', size:5},
                {name:'empty', size:4},
                {name:'calendar', size:3}
            ]
        ];

    layout.addRow = function(colCount){
        layout.push([
            {name:'empty', size:3},
            {name:'empty', size:3},
            {name:'empty', size:3},
            {name:'empty', size:3}
        ]);
    };


    layout.addCell = function(row){
        layout[row].push(
            {name:'empty', size:3}
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
                        if (layout[r][c].name == 'empty') {
                            --layout[r][c].size;
                        }
                    }

                }
            } else {
                for(var c in layout[r]){
                    if (_.reduce(_.pluck(layout[r], 'size'), sum) < 12) {
                        if (layout[r][c].name == 'empty') {
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
