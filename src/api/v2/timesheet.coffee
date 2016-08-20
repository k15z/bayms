# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer, upload) -> 
    mongo = require('mongodb')
    marked = require('marked')
    sanitize = require('mongo-sanitize')

    booleanify = (obj) ->
        for key, value of obj
            if value == "false"
                obj[key] = false
            if value == "true"
                obj[key] = true
            if typeof value  == 'object'
                booleanify(value)
        return obj

    app.post('/api/v2/user/:user_id/timesheet/', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)

        entry = sanitize(req.body)
        if not entry.hours
            return res.status(400).send({"message": "malformed entry"})
        entry.writer = req.requestee._id
        entry.updated = parseInt((new Date()).getTime()/1000)
        entry.context = req.headers

        db.collection('user').update(
            { _id: user_id},
            { 
                "$push": {
                    "timesheet": entry
                }
            },
            (err, user) ->
                if (err)
                    return res.status(500).send({"message": "error adding entry"})
                res.status(200).send({"message": "success"})
                db.collection('user').findOne(
                    { _id: user_id},
                    (err, user) ->
                        if user.notification?.timesheet
                            text = "You've been credited with " + entry.hours + " volunteer hours."
                            mail = {
                                from: '"BAYMS.Web" <bayms.web@gmail.com>',
                                to: ['bayms.web@gmail.com'],
                                bcc: user.email,
                                subject: (new Date()).toLocaleDateString() + " Volunteer Hours",
                                text: text,
                                html: marked(text)
                            }
                            mailer.sendMail(mail)
                )
        )
    )
