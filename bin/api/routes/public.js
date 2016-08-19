
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This implements the api/public endpoint.
 */

(function() {
  module.exports = function(app, db, mailer) {
    var getEvent, getUser, mongo;
    mongo = require('mongodb');
    getUser = function(callback) {
      return db.collection('user').find({
        $or: [
          {
            "waiver.a": true
          }, {
            "waiver.b": true
          }, {
            "waiver.c": true
          }, {
            "waiver.a": "true"
          }, {
            "waiver.b": "true"
          }, {
            "waiver.c": "true"
          }, {
            "waiver.alpha": "true"
          }, {
            "waiver.beta": "true"
          }, {
            "waiver.charlie": "true"
          }
        ]
      }).toArray(function(err, users) {
        var i, key, len, user, value;
        for (i = 0, len = users.length; i < len; i++) {
          user = users[i];
          for (key in user) {
            value = user[key];
            if (key !== "name") {
              delete user[key];
            }
          }
        }
        return callback(users);
      });
    };
    getEvent = function(callback) {
      return db.collection('event').find({
        $or: [
          {
            "visible.public": true
          }, {
            "visible.public": "true"
          }
        ]
      }).toArray(function(err, events) {
        return callback(events);
      });
    };
    return app.get('/api/public', function(req, res) {
      var accumulate, pending, result;
      result = {};
      pending = 2;
      accumulate = function(name) {
        return function(data) {
          pending -= 1;
          result[name] = data;
          if (pending === 0) {
            return res.send(result);
          }
        };
      };
      getUser(accumulate('user'));
      return getEvent(accumulate('event'));
    });
  };

}).call(this);
