/**
 * This function wraps around the jQuery ajax function, reading the sessionStorage 
 * token if it is present and sending it in the request header.
 */

var _get = $.get;
$.get = function (options) {
    if (!options.beforeSend)
        options.beforeSend = function(xhr){
            if (sessionStorage.getItem('token'))
                xhr.setRequestHeader("x-bayms-token", sessionStorage.getItem('token'));
        };
    return _get(options);
};

var _ajax = $.ajax;
$.ajax = function (options) {
    if (!options.beforeSend)
        options.beforeSend = function(xhr){
            if (sessionStorage.getItem('token'))
                xhr.setRequestHeader("x-bayms-token", sessionStorage.getItem('token'));
        };
    return _ajax(options);
};

/**
 * This sessionStorage polyfill makes our authentication system work on older 
 * browsers like Opera and IE8.
 * 
 * Based on: http://www.quirksmode.org/js/cookies.html
 * and https://github.com/wojodesign/local-storage-js/blob/master/storage.js
 * and https://gist.github.com/350433
 * License: http://www.opensource.org/licenses/MIT
 */

if (!window.sessionStorage) {
    (function(window) {
        'use strict';
        window.sessionStorage = window.sessionStorage || {
            length: 0,
            setItem: function(key, value) {
                document.cookie = key + '=' + value + '; path=/';
                this.length++;
            },
            getItem: function(key) {
                var keyEQ = key + '=';
                var ca = document.cookie.split(';');
                for (var i = 0, len = ca.length; i < len; i++) {
                    var c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    if (c.indexOf(keyEQ) === 0) return c.substring(keyEQ.length, c.length);
                }
                return null;
            },
            removeItem: function(key) {
                this.setItem(key, '', -1);
                this.length--;
            },
            clear: function() {
                // Caution: will clear all persistent cookies as well
                var ca = document.cookie.split(';');
                for (var i = 0, len = ca.length; i < len; i++) {
                    var c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    var key = c.substring(0, c.indexOf('='));
                    this.removeItem(key);
                }
                this.length = 0;
            },
            key: function(n) {
                var ca = document.cookie.split(';');
                if (n >= ca.length || isNaN(parseFloat(n)) || !isFinite(n)) return null;
                var c = ca[n];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                return c.substring(0, c.indexOf('='));
            }
        };
    })(this);
}
