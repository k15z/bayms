
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This implements the api/user endpoint, providing GET and POST methods for both 
retrieving and updating the current signed-in user's profile.
 */

(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(app, db, mailer) {
    var booleanify, mongo, sanitize;
    mongo = require('mongodb');
    sanitize = require('mongo-sanitize');
    booleanify = function(obj) {
      var key, value;
      for (key in obj) {
        value = obj[key];
        if (value === "false") {
          obj[key] = false;
        }
        if (typeof value === 'object') {
          booleanify(value);
        }
      }
      return obj;
    };
    app.get('/api/user', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return res.status(200).send(req.requestee);
    });
    app.post('/api/user', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      delete req.body._id;
      delete req.body.roles;
      delete req.body.token;
      delete req.body.password;
      return db.collection('user').update({
        _id: req.requestee._id
      }, {
        $set: booleanify(sanitize(req.body))
      }, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send({
          message: "success",
          user: req.body
        });
      });
    });
    app.get('/api/user/all', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return db.collection('user').find({}).toArray(function(err, user) {
        var i, key, len, ref, u, value;
        if (err) {
          return res.status(500).send('something went wrong');
        }
        if (indexOf.call((ref = req.requestee) != null ? ref.roles : void 0, "admin") >= 0) {
          return res.status(200).send(user);
        } else {
          for (i = 0, len = user.length; i < len; i++) {
            u = user[i];
            for (key in u) {
              value = u[key];
              if (key !== "_id" && key !== "name" && key !== "email" && key !== "phone" && key !== "roles") {
                delete u[key];
              }
            }
          }
          return res.status(200).send(user);
        }
      });
    });
    return app.post('/api/user/:user_id/roles/:role', function(req, res) {
      var ref, ref1, user_id;
      if (ref = !"admin", indexOf.call((ref1 = req.requestee) != null ? ref1.roles : void 0, ref) >= 0) {
        return res.status(401).send('access denied');
      }
      console.log(req.params);
      user_id = new mongo.ObjectID(req.params.user_id);
      return db.collection('user').update({
        _id: user_id
      }, {
        $set: {
          roles: [req.params.role]
        }
      }, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send({
          message: "success",
          user: req.body
        });
      });
    });
  };

}).call(this);
