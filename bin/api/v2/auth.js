(function() {
  module.exports = function(app, db, mailer) {
    var computeHash, crypto, generateToken, isString, marked, randomString, sanitize;
    crypto = require('crypto');
    marked = require('marked');
    sanitize = require('mongo-sanitize');
    isString = function(value) {
      return typeof value === "string";
    };
    computeHash = function(password, salt, callback) {
      return crypto.pbkdf2(password, salt, 10000, 512, 'sha512', callback);
    };
    randomString = function() {
      return crypto.randomBytes(32).toString('base64');
    };
    generateToken = function(user, context, duration) {
      var current_time, token;
      if (duration == null) {
        duration = 60 * 60 * 24;
      }
      token = randomString();
      current_time = parseInt((new Date()).getTime() / 1000);
      db.collection('user').update({
        "email": user.email
      }, {
        "$push": {
          "token": {
            "value": token,
            "context": context,
            "expiration": current_time + duration
          }
        }
      });
      return token;
    };
    app.post('/api/v2/auth/signin', function(req, res) {
      if (!req.body.email || !req.body.password) {
        return res.status(400).send({
          "message": "missing email or password"
        });
      }
      if (!isString(req.body.email) || !isString(req.body.password)) {
        return res.status(400).send({
          "message": "malformed email or password"
        });
      }
      return db.collection('user').findOne({
        "email": sanitize(req.body.email)
      }, function(err, user) {
        if (err || !user) {
          return res.status(401).send({
            "message": "incorrect email"
          });
        }
        return computeHash(req.body.password, user.salt, function(err, hash) {
          var is_parent1, is_parent2, is_user, ref, ref1;
          is_user = hash.toString('base64') === user.password;
          is_parent1 = hash.toString('base64') === ((ref = user.parent1) != null ? ref.password : void 0);
          is_parent2 = hash.toString('base64') === ((ref1 = user.parent2) != null ? ref1.password : void 0);
          if (is_user || is_parent1 || is_parent2) {
            return res.status(200).send({
              "message": "success",
              "auth_token": generateToken(user, req.headers)
            });
          }
          return res.status(401).send({
            "message": "incorrect password"
          });
        });
      });
    });
    app.post('/api/v2/auth/signup', function(req, res) {
      if (!req.body.email || !req.body.password) {
        return res.status(400).send({
          "message": "missing email or password"
        });
      }
      if (!isString(req.body.email) || !isString(req.body.password)) {
        return res.status(400).send({
          "message": "malformed email or password"
        });
      }
      return db.collection('user').findOne({
        "email": sanitize(req.body.email)
      }, function(err, user) {
        var email, password, salt;
        if (err || user) {
          return res.status(400).send({
            "message": "email already exists"
          });
        }
        salt = randomString();
        email = req.body.email;
        password = req.body.password;
        return computeHash(password, salt, function(err, hash) {
          user = {};
          user.salt = salt;
          user.email = email;
          user.roles = ["applicant"];
          user.password = hash.toString('base64');
          db.collection('user').insert(user, function(err) {
            if (err) {
              return res.status(500).send({
                "message": "error creating user"
              });
            } else {
              return res.status(200).send({
                "message": "success",
                "auth_token": generateToken(user, req.headers)
              });
            }
          });
          return db.collection('user').find({
            "notification.application": true
          }).toArray(function(err, users) {
            var emails, i, len, message;
            emails = [];
            for (i = 0, len = users.length; i < len; i++) {
              user = users[i];
              emails.push(user.email);
            }
            message = user.email + " applied for an account";
            return mailer.sendMail({
              from: '"BAYMS.Web" <bayms.web@gmail.com>',
              to: ["bayms.web@gmail.com"],
              bcc: emails,
              subject: "Application Received",
              html: marked(message),
              text: message
            });
          });
        });
      });
    });
    app.post('/api/v2/auth/change', function(req, res) {
      var password, salt;
      if (!req.requestee) {
        return res.status(400).send({
          "message": "not authenticated"
        });
      }
      if (!req.body.password) {
        return res.status(400).send({
          "message": "missing password"
        });
      }
      if (!isString(req.body.password)) {
        return res.status(400).send({
          "message": "malformed password"
        });
      }
      salt = randomString();
      password = req.body.password;
      return computeHash(password, salt, function(err, hash) {
        hash = hash.toString('base64');
        return db.collection('user').update({
          _id: req.requestee._id
        }, {
          $set: {
            "salt": salt,
            "password": hash
          }
        }, function(err, count) {
          if (err || count !== 1) {
            return res.status(500).send({
              "message": "error changing password"
            });
          }
          return res.status(200).send({
            "message": "success"
          });
        });
      });
    });
    app.post('/api/v2/auth/revoke', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "not authenticated"
        });
      }
      return db.collection('user').findOne({
        _id: req.requestee._id
      }, function(err, doc) {
        var i, len, ref, token;
        if (err || !doc) {
          return res.status(500).send({
            "message": "error revoking tokens"
          });
        }
        ref = doc.token;
        for (i = 0, len = ref.length; i < len; i++) {
          token = ref[i];
          token.expiration = -1;
        }
        return db.collection('user').save(doc);
      });
    });
    return app.post('/api/v2/auth/reset', function(req, res) {
      if (!req.body.email) {
        return res.status(400).send({
          "message": "missing email"
        });
      }
      if (!isString(req.body.email)) {
        return res.status(400).send({
          "message": "malformed email"
        });
      }
      return db.collection('user').findOne({
        "email": sanitize(req.body.email)
      }, function(err, user) {
        var mail, message, token;
        if (err || !user) {
          return res.status(400).send({
            "message": "user not found"
          });
        }
        token = generateToken(user, req.headers, 60 * 15);
        message = "Please use the following link to reset your password: ";
        message += "`https://www.bayms.org/reset/" + token + "`";
        mail = {
          from: '"BAYMS.Web" <bayms.web@gmail.com>',
          to: [user.email],
          subject: "Password Reset Request",
          html: marked(message),
          text: message
        };
        return mailer.sendMail(mail, function(err) {
          if (err) {
            return res.status(500).send({
              "message": "error sending reset email"
            });
          }
          return res.status(200).send({
            "message": "success"
          });
        });
      });
    });
  };

}).call(this);
