/**
 * Created by diego on 10/18/16.
 */
var angular = require('angular');

angular.module('MirrorMirror').directive('welcome', function(){
    return {
        scope:{
            data: '='
        },
        templateUrl: '/views/welcome.html',
        controller: ['$scope', '$rootScope', function(scope, rootScope){
            scope.penny = rootScope.penny;
            rootScope.$watch('penny', function(){
                scope.penny = rootScope.penny;

            });
        }]
    };
});
