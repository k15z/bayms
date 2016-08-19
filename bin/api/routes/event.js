
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This handles api/event, api/event/:event_id/delete, api/event/:event_id/piece, 
and api/event/:event_id/piece/:piece_id requests. Only users with admin and/or
leader roles can create/delete events, but any user can create/edit pieces.
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
        if (value === "true") {
          obj[key] = true;
        }
        if (typeof value === 'object') {
          booleanify(value);
        }
      }
      return obj;
    };
    app.get('/api/event', function(req, res) {
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
    app.get('/api/event/:event_id', function(req, res) {
      return db.collection('event').findOne({
        _id: new mongo.ObjectID(req.params.event_id)
      }, function(err, event) {
        if (err) {
          return res.status(500).send('something went wrong');
        }
        return res.status(200).send(booleanify(event));
      });
    });
    app.post('/api/event', function(req, res) {
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
    app.post('/api/event/:event_id', function(req, res) {
      var event, j, len, piece, ref;
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
        for (j = 0, len = ref.length; j < len; j++) {
          piece = ref[j];
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
    app.post('/api/event/:event_id/import/:src_event_id', function(req, res) {
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
        var j, len, piece, ref;
        ref = src_doc.piece;
        for (j = 0, len = ref.length; j < len; j++) {
          piece = ref[j];
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
    app.post('/api/event/:event_id/delete', function(req, res) {
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
    app.post('/api/event/:event_id/piece', function(req, res) {
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
    app.post('/api/event/:event_id/piece/:piece_id', function(req, res) {
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
    app.post('/api/event/:event_id/piece/:piece_id/delete', function(req, res) {
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
    app.post('/api/event/:event_id/piece/:piece_id/approve', function(req, res) {
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
            doc.piece[i].approved = true;
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
    return app.post('/api/event/:event_id/piece/:piece_id/disapprove', function(req, res) {
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
