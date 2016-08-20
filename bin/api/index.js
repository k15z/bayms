(function() {
  module.exports = function(app) {
    var fs, mailer, mongo, multer, upload, url;
    fs = require('fs');
    mongo = require('mongodb').MongoClient;
    mailer = require('nodemailer').createTransport(fs.readFileSync(__dirname + "/../../smtps.auth", "utf8"));
    multer = require('multer');
    upload = multer({
      dest: __dirname + "/../upload/"
    });
    url = 'mongodb://localhost:27017/bayms';
    return mongo.connect(url, function(err, db) {
      if (err) {
        throw new Error("No database connection.");
      }
      app.use("/api", function(req, res, next) {
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.header("Pragma", "no-cache");
        res.header("Expires", 0);
        req.requestee = false;
        if (req.headers['x-bayms-token']) {
          return db.collection('user').find({
            "token": {
              $elemMatch: {
                "value": req.headers['x-bayms-token'],
                "expiration": {
                  $gt: parseInt((new Date()).getTime() / 1000)
                }
              }
            }
          }).toArray(function(err, user) {
            if (!err && user.length === 1) {
              req.requestee = user[0];
            }
            return next();
          });
        } else {
          return next();
        }
      });
      require('./v2/auth')(app, db, mailer, upload);
      require('./v2/event')(app, db, mailer, upload);
      require('./v2/piece')(app, db, mailer, upload);
      require('./v2/news')(app, db, mailer, upload);
      require('./v2/public')(app, db, mailer, upload);
      require('./v2/timesheet')(app, db, mailer, upload);
      return require('./v2/user')(app, db, mailer, upload);
    });
  };

}).call(this);
