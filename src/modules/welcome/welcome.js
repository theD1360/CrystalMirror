/**
 * Created by diego on 10/18/16.
 */
var angular = require('angular');

angular.module('MirrorMirror').directive('welcome', function(){
    return {
        scope:{
            data: '='
        },
        template: require('./welcome.html'),
        controller: ['$scope', '$rootScope', function(scope, rootScope){
            scope.crystal = rootScope.crystal;
            rootScope.$watch('crystal', function(){
                scope.crystal = rootScope.crystal;

            });
        }]
    };
});
