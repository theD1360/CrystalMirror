/**
 * Created by diego on 10/18/16.
 */
var angular = require('angular');

angular.module('MirrorMirror').directive('calendar', function(){
    return {
        scope:{
            data: '='
        },
        templateUrl: '/views/calendar.html',
        controller: ['$scope', '$rootScope', '$interval', function(scope, rootScope, $interval){
            scope.time = new Date();
            scope.month = scope.time.getMonth();
            scope.year = scope.time.getYear();

            scope.monthDays = getDaysList( getDaysInMonth(scope.month, scope.year) );

            function getDaysInMonth(m, y) {
                return /8|3|5|10/.test(--m)?30:m==1?(!(y%4)&&y%100)||!(y%400)?29:28:31;
            }

            function getDaysList(count) {
                var tmp = [];
                for (var i = 0; i < count+1; ++i) {
                    tmp.push({
                        number: i+1,
                        isToday: (new Date()).getDate() == i+1
                    });
                }
                return tmp;
            };

            scope.$watch('month', function(){
                scope.monthDays = getDaysList( getDaysInMonth(scope.month, scope.year) );
            });

            scope.$watch('time', function(){
                scope.month = scope.time.getMonth();
                scope.year = scope.time.getYear();
            });

            $interval(function(){
                scope.time = new Date();
            }, 24000);

        }]
    };
});
