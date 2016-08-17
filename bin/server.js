
/*
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This creates an instance of the Express web server on port 3000 and uses it to
serve both the RESTful API and the website.
 */

(function() {
  var app, bodyParser, cookieParser, express, path;

  path = require('path');

  express = require('express');

  bodyParser = require('body-parser');

  cookieParser = require('cookie-parser');

  app = express();

  app.use(bodyParser.json({
    limit: '50mb'
  }));

  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
  }));

  app.use(cookieParser());

  app.use(express["static"](path.join(__dirname, './www')));

  app.get('/app', function(req, res) {
    return res.sendFile(path.join(__dirname, './www/app.html'));
  });

  app.get('/auth', function(req, res) {
    return res.sendFile(path.join(__dirname, './www/auth.html'));
  });

  app.get('/reset', function(req, res) {
    return res.sendFile(path.join(__dirname, './www/reset.html'));
  });

  require('./api')(app);

  app.listen(3000);

}).call(this);
