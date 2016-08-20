(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(app, db, mailer, upload) {
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
        if (value === "true") {
          obj[key] = true;
        }
        if (typeof value === 'object') {
          booleanify(value);
        }
      }
      return obj;
    };
    app.get('/api/v2/user', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      return res.status(200).send(req.requestee);
    });
    app.post('/api/v2/user', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      delete req.body._id;
      delete req.body.roles;
      delete req.body.hours;
      delete req.body.token;
      delete req.body.password;
      return db.collection('user').update({
        _id: req.requestee._id
      }, {
        $set: booleanify(sanitize(req.body))
      }, function(err, user) {
        if (err) {
          return res.status(500).send({
            "message": "error updating user"
          });
        }
        return res.status(200).send(user);
      });
    });
    app.post('/api/v2/user/upload', upload.single('picture'), function(req, res) {
      return db.collection('user').update({
        _id: new mongo.ObjectID(req.body.user_id)
      }, {
        $set: {
          picture: '/upload/' + req.file.filename
        }
      }, function(err, user) {
        if (err) {
          return res.status(500).send({
            "message": "error updating user"
          });
        }
        return res.redirect('back');
      });
    });
    app.get('/api/v2/user/all', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      return db.collection('user').find({}).toArray(function(err, user) {
        var i, key, len, ref, u, value;
        if (err) {
          return res.status(500).send({
            "message": "error retreiving users"
          });
        }
        for (i = 0, len = user.length; i < len; i++) {
          u = user[i];
          for (key in u) {
            value = u[key];
            if (indexOf.call((ref = req.requestee) != null ? ref.roles : void 0, "admin") >= 0) {
              if (key === "picture" || key === "token") {
                delete u[key];
              }
            } else {
              if (key === "_id") {
                continue;
              }
              if (key === "name" || key === "email") {
                continue;
              }
              if (key === "phone" || key === "roles") {
                continue;
              }
              delete u[key];
            }
          }
        }
        return res.status(200).send(user);
      });
    });
    return app.post('/api/v2/user/:user_id/roles/:role', function(req, res) {
      var ref, ref1, user_id;
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      if (ref = !"admin", indexOf.call((ref1 = req.requestee) != null ? ref1.roles : void 0, ref) >= 0) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      user_id = new mongo.ObjectID(req.params.user_id);
      return db.collection('user').update({
        _id: user_id
      }, {
        $set: {
          roles: [req.params.role]
        }
      }, function(err, user) {
        if (err) {
          return res.status(500).send({
            "message": "error setting roles"
          });
        }
        return res.status(200).send(user);
      });
    });
  };

}).call(this);
