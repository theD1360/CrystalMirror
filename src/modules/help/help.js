/**
 * Created by diego on 10/19/16.
 */
var angular = require('angular');
var app = angular.module("MirrorMirror");

app.run(['$routeProvider', function($routeProvider){
    $routeProvider.when('/help', {
        template: require('./help.html'),
        controller: function(){}
    });
}]);
