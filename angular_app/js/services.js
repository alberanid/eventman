'use strict';

/* Services that are used to interact with the backend. */
var eventManServices = angular.module('eventManServices', ['ngResource']);


/* Modify, in place, an object to convert datetime. */
function convert_dates(obj) {
    if (obj['begin-date']) {
        obj['begin-date'] = obj['begin_date'] = obj['begin-date'].getTime();
    }
    if (obj['end-date']) {
        obj['end-date'] = obj['end_date'] = obj['end-date'].getTime();
    }
    return obj;
}


eventManServices.factory('Event', ['$resource', '$rootScope',
    function($resource, $rootScope) {
        return $resource('events/:id', {id: '@_id'}, {

            all: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: true,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    if (data.error) {
                        return data;
                    }
                    angular.forEach(data.events || [], function(event_, event_idx) {
                        convert_dates(event_);
                    });

                    return data.events;
                }
            },

            get: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    convert_dates(data);
                    // strip empty keys.
                    angular.forEach(data.persons || [], function(person, person_idx) {
                        angular.forEach(person, function(value, key) {
                            if (value === "") {
                                delete person[key];
                            }
                        });
                    });
                    return data;
                }
            },

            update: {
                method: 'PUT',
                interceptor : {responseError: $rootScope.errorHandler}
            },

            group_persons: {
                method: 'GET',
                url: 'events/:id/group_persons',
                isArray: true,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    return data.persons || [];
                }
            }
        });
    }]
);


eventManServices.factory('EventTicket', ['$resource', '$rootScope',
    function($resource, $rootScope) {
        return $resource('events/:id/tickets', {event_id: '@event_id', ticket_id: '@_id'}, {

            get: {
                method: 'GET',
                url: 'events/:id/tickets/:ticket_id',
                interceptor : {responseError: $rootScope.errorHandler},
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    return data.person;
                }
            },

            all: {
                method: 'GET',
                url: '/tickets',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: true,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    if (data.error) {
                        return data;
                    }
                    return data.persons;
                }
            },

            add: {
                method: 'POST',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: false,
                url: 'events/:event_id/tickets',
                params: {uuid: $rootScope.app_uuid},
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    return data.person;
                }
            },

            update: {
                method: 'PUT',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: false,
                url: 'events/:event_id/tickets/:ticket_id',
                params: {uuid: $rootScope.app_uuid},
                transformResponse: function(data, headers) {
                    return angular.fromJson(data);
                }
            },

            'delete': {
                method: 'DELETE',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: false,
                url: 'events/:event_id/tickets/:ticket_id',
                params: {uuid: $rootScope.app_uuid},
                transformResponse: function(data, headers) {
                    return angular.fromJson(data);
                }
            }
        });
    }]
);


eventManServices.factory('Setting', ['$resource', '$rootScope',
    function($resource, $rootScope) {
        return $resource('settings/', {}, {

            query: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: true,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    if (data.error) {
                        return data;
                    }
                    return data.settings;
                }
            },

            update: {
                method: 'PUT',
                interceptor : {responseError: $rootScope.errorHandler}
            }
        });
    }]
);


eventManServices.factory('Info', ['$resource', '$rootScope',
    function($resource, $rootScope) {
        return $resource('info/', {}, {
            get: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: false,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    if (data.error) {
                        return data;
                    }
                    return data.info || {};
                }
            }
        });
    }]
);


eventManServices.factory('User', ['$resource', '$rootScope',
    function($resource, $rootScope) {
        return $resource('users/:id', {id: '@_id'}, {
            all: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                isArray: true,
                transformResponse: function(data, headers) {
                    data = angular.fromJson(data);
                    if (data.error) {
                        return data;
                    }
                    return data.users;
                }
            },

            get: {
                method: 'GET',
                interceptor : {responseError: $rootScope.errorHandler},
                transformResponse: function(data, headers) {
                    return angular.fromJson(data);
                }
            },

            add: {
                method: 'POST',
                interceptor : {responseError: $rootScope.errorHandler}
            },

            update: {
                method: 'PUT',
                interceptor : {responseError: $rootScope.errorHandler}
            },

            login: {
                method: 'POST',
                url: '/login',
                interceptor : {responseError: $rootScope.errorHandler}
            },

            logout: {
                method: 'GET',
                url: '/logout',
                interceptor : {responseError: $rootScope.errorHandler}
            }
        });
    }]
);


/* WebSocket collection used to update the list of persons of an Event. */
eventManApp.factory('EventUpdates', ['$websocket', '$location', '$log',
    function($websocket, $location, $log) {

        var dataStream = null;

        var data = {};

        var methods = {
            data: data,
            close: function() {
                $log.debug('close WebSocket connection');
                dataStream.close();
            },
            open: function() {
                $log.debug('open WebSocket connection');
                dataStream && dataStream.close();
                var proto = $location.protocol() == 'https' ? 'wss' : 'ws';
                dataStream = $websocket(proto + '://' + $location.host() + ':' + $location.port() +
                                    '/ws/' + $location.path() + '/updates');
                dataStream.onMessage(function(message) {
                    $log.debug('EventUpdates message received');
                    data.update = angular.fromJson(message.data);
                });
            }
        };

        return methods;
    }]
);

