/**
 * Created by diego on 10/18/16.
 */
var angular = require('angular');

angular.module('MirrorMirror').directive('time', function(){
    return {
        scope:{
            data: '='
        },
        templateUrl: '/views/time.html',
        controller: ['$scope', '$rootScope', '$interval', function(scope, rootScope, $interval){
            scope.time = new Date();
            $interval(function(){
                scope.time = new Date();
            }, 1000);

        }]
    };
});
