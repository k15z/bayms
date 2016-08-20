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
        if (value === "true") {
          obj[key] = true;
        }
        if (typeof value === 'object') {
          booleanify(value);
        }
      }
      return obj;
    };
    app.get('/api/v2/event', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      return db.collection('event').find({}).toArray(function(err, event) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        event.sort(function(a, b) {
          return new Date(a.time) > new Date(b.time);
        });
        return res.status(200).send(booleanify(event));
      });
    });
    app.get('/api/v2/event/:event_id', function(req, res) {
      return db.collection('event').findOne({
        _id: new mongo.ObjectID(req.params.event_id)
      }, function(err, event) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send(booleanify(event));
      });
    });
    app.post('/api/v2/event', function(req, res) {
      var event;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      event = sanitize(req.body);
      event.creator = req.requestee._id;
      if (!event.piece) {
        event.piece = [];
      }
      return db.collection('event').insert(event, function(err) {
        if (err) {
          return res.status(500).send('something went wrong');
        } else {
          return res.status(200).send({
            "message": "success",
            "event": event
          });
        }
      });
    });
    app.post('/api/v2/event/:event_id', function(req, res) {
      var event, i, len, piece, ref;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      event = booleanify(sanitize(req.body));
      delete event._id;
      if (event.piece) {
        ref = event.piece;
        for (i = 0, len = ref.length; i < len; i++) {
          piece = ref[i];
          piece._id = new mongo.ObjectID(piece._id);
        }
      }
      event.creator = req.requestee._id;
      return db.collection('event').update({
        _id: new mongo.ObjectID(req.params.event_id)
      }, {
        "$set": event
      }, function(err) {
        if (err) {
          console.log(err);
          return res.status(500).send('something went wrong');
        }
        event._id = req.params.event_id;
        return res.status(200).send({
          message: "success",
          event: event
        });
      });
    });
    app.post('/api/v2/event/:event_id/import/:src_event_id', function(req, res) {
      var event_id, src_event_id;
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      event_id = new mongo.ObjectID(req.params.event_id);
      src_event_id = new mongo.ObjectID(req.params.src_event_id);
      return db.collection('event').findOne({
        _id: src_event_id
      }, function(err, src_doc) {
        var i, len, piece, ref;
        ref = src_doc.piece;
        for (i = 0, len = ref.length; i < len; i++) {
          piece = ref[i];
          piece._id = new mongo.ObjectID();
        }
        return db.collection('event').update({
          _id: event_id
        }, {
          "$push": {
            "piece": {
              '$each': src_doc.piece
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
    });
    return app.post('/api/v2/event/:event_id/delete', function(req, res) {
      if (!req.requestee) {
        return res.status(401).send('access denied');
      }
      if (indexOf.call(req.requestee.roles, "admin") < 0) {
        if (indexOf.call(req.requestee.roles, "leader") < 0) {
          return res.status(401).send('access denied');
        }
      }
      return db.collection('event').remove({
        _id: new mongo.ObjectID(req.params.event_id)
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
