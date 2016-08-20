(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(app, db, mailer, upload) {
    var booleanify, marked, mongo, sanitize;
    mongo = require('mongodb');
    marked = require('marked');
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
    return app.post('/api/v2/user/:user_id/timesheet/', function(req, res) {
      var entry, ref, ref1, user_id;
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
      entry = sanitize(req.body);
      if (!entry.hours) {
        return res.status(400).send({
          "message": "malformed entry"
        });
      }
      entry.writer = req.requestee._id;
      entry.updated = parseInt((new Date()).getTime() / 1000);
      entry.context = req.headers;
      return db.collection('user').update({
        _id: user_id
      }, {
        "$push": {
          "timesheet": entry
        }
      }, function(err, user) {
        if (err) {
          return res.status(500).send({
            "message": "error adding entry"
          });
        }
        res.status(200).send({
          "message": "success"
        });
        return db.collection('user').findOne({
          _id: user_id
        }, function(err, user) {
          var mail, ref2, text;
          if ((ref2 = user.notification) != null ? ref2.timesheet : void 0) {
            text = "You've been credited with " + entry.hours + " volunteer hours.";
            mail = {
              from: '"BAYMS.Web" <bayms.web@gmail.com>',
              to: ['bayms.web@gmail.com'],
              bcc: user.email,
              subject: (new Date()).toLocaleDateString() + " Volunteer Hours",
              text: text,
              html: marked(text)
            };
            return mailer.sendMail(mail);
          }
        });
      });
    });
  };

}).call(this);
