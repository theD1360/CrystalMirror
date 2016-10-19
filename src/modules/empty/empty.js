/**
 * Created by diego on 10/19/16.
 */
var angular = require('angular');
var app = angular.module("MirrorMirror");

// default empty slot
app.directive('empty', function(){
    return {
        template: require('./slot.html')
    };
});
