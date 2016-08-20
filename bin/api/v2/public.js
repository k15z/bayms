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
          }
        ]
      }).toArray(function(err, users) {
        var i, key, len, ref, ref1, ref2, user, value;
        for (i = 0, len = users.length; i < len; i++) {
          user = users[i];
          for (key in user) {
            value = user[key];
            if (((ref = user.waiver) != null ? ref.a : void 0) && (key === "name")) {
              continue;
            }
            if (((ref1 = user.waiver) != null ? ref1.b : void 0) && (key === "interest" || key === "instruments")) {
              continue;
            }
            if (((ref2 = user.waiver) != null ? ref2.c : void 0) && (key === "biography" || key === "experience")) {
              continue;
            }
            delete user[key];
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
          }
        ]
      }).toArray(function(err, events) {
        return callback(events);
      });
    };
    app.get('/api/v2/public', function(req, res) {
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
    return app.get('/api/v2/health_check', function(req, res) {
      return res.status(200).send("I'm alive.");
    });
  };

}).call(this);
