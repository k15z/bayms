###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This is the main entry point for the BAYMS.Web API. It implements a middleware 
function to authenticate users using the `x-bayms-token` header.
###
module.exports = (app) ->
    fs = require('fs')
    mongo = require('mongodb').MongoClient
    mailer = require('nodemailer').createTransport(fs.readFileSync(__dirname + "/../../smtps.auth", "utf8"))

    url = 'mongodb://localhost:27017/bayms-web'
    mongo.connect(url, (err, db) ->
        if err
            throw new Error("No database connection.")

        # Authentication middleware
        app.use("/api", (req, res, next) -> 
            res.header("Cache-Control", "no-cache, no-store, must-revalidate")
            res.header("Pragma", "no-cache")
            res.header("Expires", 0)

            req.requestee = false
            if (req.headers['x-bayms-token'])
                db.collection('user').find({
                    "token": {
                        $elemMatch: {
                            "value": req.headers['x-bayms-token']
                            "expiration": {
                                $gt: parseInt((new Date()).getTime()/1000)
                            }
                        }
                    }
                }).toArray((err, user) ->
                    if (!err && user.length == 1)
                        req.requestee = user[0]
                    next()
                )
            else
                next()
        )

        # Health check endpoint
        app.all('/api', (req, res) ->
            res.send({
                query: req.query
                headers: req.headers
                requestee: req.requestee
            })
        )

        # Route handlers
        require('./routes/auth')(app, db, mailer)
        require('./routes/event')(app, db, mailer)
        require('./routes/news')(app, db, mailer)
        require('./routes/user')(app, db, mailer)
    )
