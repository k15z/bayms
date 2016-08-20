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
    app.post('/api/v2/event/:event_id/piece', function(req, res) {
      var piece;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      piece = sanitize(req.body);
      piece._id = new mongo.ObjectID();
      piece.approved = "";
      piece.requestee = req.requestee._id;
      return db.collection('event').update({
        _id: new mongo.ObjectID(req.params.event_id)
      }, {
        "$push": {
          "piece": piece
        }
      }, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send({
          message: "success",
          piece: piece
        });
      });
    });
    app.post('/api/v2/event/:event_id/piece/:piece_id', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return db.collection('event').findOne({
        _id: new mongo.ObjectID(req.params.event_id)
      }, function(err, doc) {
        var i, j, ref;
        if (err) {
          return res.status(500).send('something went wrong');
        }
        for (i = j = 0, ref = doc.piece.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
          if (JSON.stringify(doc.piece[i]._id) === JSON.stringify(req.params.piece_id)) {
            doc.piece[i] = sanitize(req.body);
            doc.piece[i]._id = new mongo.ObjectID(req.params.piece_id);
          }
        }
        return db.collection('event').update({
          _id: new mongo.ObjectID(req.params.event_id)
        }, {
          "$set": doc
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
    app.post('/api/v2/event/:event_id/piece/:piece_id/delete', function(req, res) {
      var pid;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      pid = new mongo.ObjectID(req.params.piece_id);
      return db.collection('event').update({
        _id: new mongo.ObjectID(req.params.event_id)
      }, {
        "$pull": {
          "piece": {
            "_id": pid
          }
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
    app.post('/api/v2/event/:event_id/piece/:piece_id/approve', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        return res.status(401).send('access denied');
      }
      return db.collection('event').findOne({
        _id: new mongo.ObjectID(req.params.event_id)
      }, function(err, doc) {
        var i, j, ref, user_id;
        if (err) {
          return res.status(500).send('something went wrong');
        }
        user_id = false;
        for (i = j = 0, ref = doc.piece.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
          if (JSON.stringify(doc.piece[i]._id) === JSON.stringify(req.params.piece_id)) {
            doc.piece[i].approved = true;
            user_id = doc.piece[i].requestee;
          }
        }
        return db.collection('event').update({
          _id: new mongo.ObjectID(req.params.event_id)
        }, {
          "$set": doc
        }, function(err) {
          if (err) {
            return res.status(500).send('something went wrong');
          }
          res.status(200).send({
            message: "success"
          });
          return db.collection('user').findOne({
            _id: new mongo.ObjectID(user_id)
          }, function(err, user) {
            var mail, ref1, text;
            if ((ref1 = user.notification) != null ? ref1.approval : void 0) {
              text = "Congratulations, your piece was approved!";
              mail = {
                from: '"BAYMS.Web" <bayms.web@gmail.com>',
                to: ['bayms.web@gmail.com'],
                bcc: user.email,
                subject: (new Date()).toLocaleDateString() + " Piece Approved",
                text: text,
                html: marked(text)
              };
              return mailer.sendMail(mail);
            }
          });
        });
      });
    });
    return app.post('/api/v2/event/:event_id/piece/:piece_id/disapprove', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        return res.status(401).send('access denied');
      }
      return db.collection('event').findOne({
        _id: new mongo.ObjectID(req.params.event_id)
      }, function(err, doc) {
        var i, j, ref;
        if (err) {
          return res.status(500).send('something went wrong');
        }
        for (i = j = 0, ref = doc.piece.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
          if (JSON.stringify(doc.piece[i]._id) === JSON.stringify(req.params.piece_id)) {
            doc.piece[i].approved = "";
          }
        }
        return db.collection('event').update({
          _id: new mongo.ObjectID(req.params.event_id)
        }, {
          "$set": doc
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
  };

}).call(this);
