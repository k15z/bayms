(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(app, db, mailer) {
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
    app.get('/api/v2/news', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      return db.collection('news').find({}).toArray(function(err, news) {
        if (err) {
          return res.status(500).send({
            "message": "error retrieving news"
          });
        }
        news.sort(function(a, b) {
          return parseInt(a.posted) < parseInt(b.posted);
        });
        return res.status(200).send(news.slice(0, 5));
      });
    });
    app.post('/api/v2/news', function(req, res) {
      var news;
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send({
            "message": "access denied"
          });
        }
      }
      news = booleanify(sanitize(req.body));
      news.writer = req.requestee._id;
      news.posted = parseInt((new Date()).getTime() / 1000);
      news.updated = parseInt((new Date()).getTime() / 1000);
      db.collection('news').insert(news, function(err) {
        if (err) {
          return res.status(500).send({
            "message": "error inserting news"
          });
        }
        return res.status(200).send(news);
      });
      if (news.notify) {
        return db.collection('user').find({}).toArray(function(err, users) {
          var emails, i, len, mail, ref, ref1, user;
          emails = [];
          for (i = 0, len = users.length; i < len; i++) {
            user = users[i];
            emails.push(user.email);
            if ((ref = user.parent1) != null ? ref.email : void 0) {
              emails.push(user.parent1.email);
            }
            if ((ref1 = user.parent2) != null ? ref1.email : void 0) {
              emails.push(user.parent2.email);
            }
          }
          mail = {
            from: '"BAYMS.Web" <bayms.web@gmail.com>',
            to: ['bayms.web@gmail.com'],
            bcc: emails,
            subject: news.title,
            text: news.content,
            html: marked(news.content)
          };
          return mailer.sendMail(mail);
        });
      }
    });
    app.post('/api/v2/news/:news_id', function(req, res) {
      var news;
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send({
            "message": "access denied"
          });
        }
      }
      news = booleanify(sanitize(req.body));
      news.writer = req.requestee._id;
      news.updated = parseInt((new Date()).getTime() / 1000);
      delete news._id;
      return db.collection('news').update({
        _id: new mongo.ObjectID(req.params.news_id)
      }, {
        $set: news
      }, function(err) {
        if (err) {
          return res.status(500).send({
            "message": "error editing news"
          });
        }
        return res.status(200).send(news);
      });
    });
    return app.post('/api/v2/news/:news_id/delete', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send({
          "message": "access denied"
        });
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send({
            "message": "access denied"
          });
        }
      }
      return db.collection('news').remove({
        _id: new mongo.ObjectID(req.params.news_id)
      }, function(err) {
        if (err) {
          return res.status(500).send({
            "message": "error editing news"
          });
        }
        return res.status(200).send({
          "message": "success"
        });
      });
    });
  };

}).call(this);
