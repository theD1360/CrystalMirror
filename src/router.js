/**
 * Created by diego on 10/19/16.
 */
var angular = require('angular');
var app = angular.module("MirrorMirror");

app.config(['$provide','$routeProvider','$locationProvider' ,'localStorageServiceProvider' ,function ($provide, $routeProvider, $locationProvider,localStorageServiceProvider) {

    $routeProvider
        .when('/', {
            template: require('./main.html'),
            controller: function(){}
        });

    // configure html5 to get links working on jsfiddle
    $locationProvider.html5Mode(true);

    localStorageServiceProvider
        .setPrefix('MirrorMirror')
        .setNotify(true, true)

    // this is a hack to allow modules to add their own routes
    $provide.factory('$routeProvider', function () {
        return $routeProvider;
    });

}]);
