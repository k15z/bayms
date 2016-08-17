
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This handles api/news and api/news/:news_id requests. Only users with admin or 
leader roles have the ability to POST news.
 */

(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(app, db, mailer) {
    var marked, mongo, sanitize;
    mongo = require('mongodb');
    marked = require('marked');
    sanitize = require('mongo-sanitize');
    app.get('/api/news', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return db.collection('news').find({}).toArray(function(err, news) {
        if (err) {
          return res.status(500).send('Something went wrong.');
        }
        news.sort(function(a, b) {
          return parseInt(a.posted) < parseInt(b.posted);
        });
        return res.status(200).send(news.slice(0, 5));
      });
    });
    app.post('/api/news', function(req, res) {
      var news;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      news = sanitize(req.body);
      news.writer = req.requestee._id;
      news.posted = parseInt((new Date()).getTime() / 1000);
      news.updated = parseInt((new Date()).getTime() / 1000);
      db.collection('news').insert(news, function(err) {
        if (err) {
          return res.status(500).send('invalid email/password');
        } else {
          return res.status(200).send({
            "message": "success",
            "event": news
          });
        }
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
          console.log(emails);
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
    app.post('/api/news/:news_id', function(req, res) {
      var news;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      news = sanitize(req.body);
      delete news._id;
      news.writer = req.requestee._id;
      news.updated = parseInt((new Date()).getTime() / 1000);
      return db.collection('news').update({
        _id: new mongo.ObjectID(req.params.news_id)
      }, {
        $set: news
      }, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send({
          message: "success"
        });
      });
    });
    return app.post('/api/news/:news_id/delete', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      return db.collection('news').remove({
        _id: new mongo.ObjectID(req.params.news_id)
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
