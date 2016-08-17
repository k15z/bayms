
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This implements the api/auth/signin and api/auth/signup endpoints, and returns
an authentication token to be used in future requests. The auth token is saved
in the user's profile and expires 24 hours after it is created.
 */

(function() {
  module.exports = function(app, db, mailer) {
    var authToken, crypto, marked, sanitize;
    crypto = require('crypto');
    marked = require('marked');
    sanitize = require('mongo-sanitize');
    authToken = function(user, details, temporary) {
      var expiration, token, unix_time;
      if (details == null) {
        details = "";
      }
      if (temporary == null) {
        temporary = false;
      }
      token = crypto.randomBytes(16).toString('base64');
      unix_time = parseInt((new Date()).getTime() / 1000);
      expiration = unix_time + 60 * 60 * 24;
      if (temporary) {
        expiration = unix_time + 60 * 15;
      }
      db.collection('user').update({
        "email": user.email
      }, {
        "$push": {
          "token": {
            "value": token,
            "details": details,
            "expiration": expiration
          }
        }
      });
      return token;
    };
    app.post('/api/auth/signin', function(req, res) {
      var email, password;
      if (!req.body.email || !req.body.password) {
        return res.status(401).send('missing email/password');
      }
      email = sanitize(req.body.email);
      password = sanitize(req.body.password);
      return db.collection('user').find({
        "email": email
      }).toArray(function(err, user) {
        if (err || !user || user.length === 0) {
          return res.status(401).send('invalid email/password');
        }
        user = user[0];
        return crypto.pbkdf2(password, user.salt, 10000, 512, 'sha512', function(err, hash) {
          var is_parent1, is_parent2, is_user, ref, ref1;
          is_user = hash.toString('base64') === user.password;
          is_parent1 = hash.toString('base64') === ((ref = user.parent1) != null ? ref.password : void 0);
          is_parent2 = hash.toString('base64') === ((ref1 = user.parent2) != null ? ref1.password : void 0);
          if (is_user || is_parent1 || is_parent2) {
            return res.status(200).send({
              "message": "success",
              "user_id": user._id,
              "auth_token": authToken(user, req.headers)
            });
          }
          return res.status(403).send("invalid email/password");
        });
      });
    });
    app.post('/api/auth/signup', function(req, res) {
      var email, password;
      if (!req.body.email || !req.body.password) {
        return res.status(401).send('missing email/password');
      }
      email = req.body.email;
      password = req.body.password;
      return db.collection('user').find({
        "email": email
      }).toArray(function(err, user) {
        var salt;
        if (err || (user != null ? user.length : void 0) > 0) {
          return res.status(401).send('invalid email/password');
        }
        salt = crypto.randomBytes(16).toString('base64');
        return crypto.pbkdf2(password, salt, 10000, 512, 'sha512', function(err, hash) {
          user = {};
          user.salt = salt;
          user.email = email;
          user.roles = ["applicant"];
          user.password = hash.toString('base64');
          return db.collection('user').insert(user, function(err) {
            if (err) {
              return res.status(500).send('invalid email/password');
            } else {
              return res.status(200).send({
                "message": "success",
                "user_id": user._id,
                "auth_token": authToken(user, req.headers)
              });
            }
          });
        });
      });
    });
    app.post('/api/auth/reset', function(req, res) {
      var email;
      if (!req.body.email) {
        return res.status(401).send('missing email');
      }
      email = sanitize(req.body.email);
      return db.collection('user').find({
        "email": email
      }).toArray(function(err, user) {
        var mail, message, token;
        if (err || !user || user.length === 0) {
          return res.status(200).send({
            "message": "success"
          });
        }
        token = authToken(user[0], req.headers, true);
        message = "Please use the following link to reset your password: ";
        message += "`https://www.bayms.org/reset#" + token + "`";
        mail = {
          from: '"BAYMS.Web" <bayms.web@gmail.com>',
          to: [user[0].email],
          subject: "Password Reset Request",
          text: message,
          html: marked(message)
        };
        return mailer.sendMail(mail, function(err) {
          if (err) {
            console.log(err);
            return res.status(500).send('something went wrong');
          }
          return res.status(200).send({
            "message": "success"
          });
        });
      });
    });
    app.post('/api/auth/change', function(req, res) {
      var email, password, salt;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      email = req.requestee.email;
      password = sanitize(req.body.password);
      salt = crypto.randomBytes(128).toString('base64');
      return crypto.pbkdf2(password, salt, 10000, 512, 'sha512', function(err, hash) {
        hash = hash.toString('base64');
        return db.collection('user').update({
          _id: req.requestee._id
        }, {
          $set: {
            salt: salt,
            password: hash
          }
        }, function(err) {
          if (err) {
            return res.status(500).send('something went wrong');
          }
          return res.status(200).send({
            message: "success"
          });
        });
      });
    });
    app.post('/api/auth/parent/:number', function(req, res) {
      var email, password, salt;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      salt = req.requestee.salt;
      email = req.requestee.email;
      password = sanitize(req.body.password);
      return crypto.pbkdf2(password, salt, 10000, 512, 'sha512', function(err, hash) {
        var doc;
        hash = hash.toString('base64');
        doc = {};
        doc["parent" + req.params.number + ".password"] = hash;
        console.log(doc);
        return db.collection('user').update({
          _id: req.requestee._id
        }, {
          $set: doc
        }, function(err) {
          if (err) {
            console.log(err);
            return res.status(500).send('something went wrong');
          }
          return res.status(200).send({
            message: "success"
          });
        });
      });
    });
    return app.post('/api/auth/clear', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return db.collection('user').update({
        _id: req.requestee._id
      }, {
        $set: {
          token: []
        }
      }, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send({
          message: "success"
        });
      });
    });
  };

}).call(this);
