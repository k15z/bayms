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

    notifyUser = (user_id, hours, reason) ->
        db.collection('user').findOne(
            { _id: user_id},
            (err, user) ->
                if user.notification?.timesheet
                    text = "You've been credited with #{hours} volunteer hours for your work at #{reason}."
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

    app.post('/api/v2/user/:user_id/timesheet/active', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        reason = sanitize(req.body.reason)
        user_id = new mongo.ObjectID(req.params.user_id)

        db.collection('user').update(
            { _id: user_id},
            {
                $set: {
                    "timesheet.active": true,
                    "timesheet.reason": reason,
                    "timesheet.unixtime": parseInt((new Date()).getTime() / 1000)
                }
            },
            (err) ->
                if err
                    return res.status(500).send({"message": "failed to set active"})
                return res.status(200).send({"message": "success"})
        )
    )

    app.post('/api/v2/user/:user_id/timesheet/inactive', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)

        db.collection('user').findOne(
            { _id: user_id },
            (err, user) ->
                duration = parseInt((new Date()).getTime() / 1000) - user.timesheet.unixtime
                reason = user.timesheet.reason
                db.collection('user').update(
                    { _id: user_id},
                    { 
                        $set: {
                            "timesheet.active": false,
                            "timesheet.reason": null,
                            "timesheet.unixtime": -1
                        },
                        $push: {
                            "timesheet.history": {
                                "_id": new mongo.ObjectID()
                                "time": duration,
                                "reason": reason,
                                "approved": true,
                                "context": req.headers,
                                "reported_by": req.requestee._id,
                                "reported_on": parseInt((new Date()).getTime()/1000)
                            }
                        }
                    },
                    (err) ->
                        notifyUser(user_id, duration / (60*60), reason)
                        if err
                            return res.status(500).send({"message": "failed to set inactive"})
                        return res.status(200).send({"message": "success"})
                )
        )
    )

    app.post('/api/v2/user/:user_id/timesheet/history', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)

        entry = sanitize(req.body)
        entry._id = new mongo.ObjectID()
        if not entry.time
            return res.status(400).send({"message": "malformed entry"})
        else
            entry.time = parseInt(entry.time)
        entry.approved = true
        entry.context = req.headers
        entry.reported_by = req.requestee._id
        entry.reported_on = parseInt((new Date()).getTime()/1000)

        db.collection('user').update(
            { _id: user_id},
            { 
                "$push": {
                    "timesheet.history": entry
                }
            },
            (err, user) ->
                notifyUser(user_id, entry.time / (60*60), entry.reason)
                if (err)
                    return res.status(500).send({"message": "error adding entry"})
                res.status(200).send({"message": "success"})
        )
    )

    app.post('/api/v2/user/:user_id/timesheet/:timesheet_id/approve', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)
        db.collection('user').findOne(
            { _id: user_id },
            (err, user) ->
                for item in user.timesheet?.history
                    if item._id.equals(new mongo.ObjectID(req.params.timesheet_id))
                        item.approved = true
                db.collection('user').updateOne(
                    { _id: user_id },
                    { $set: user },
                    (err) ->
                        if err
                            return res.status(500).send({"message": "failed to set inactive"})
                        return res.status(200).send({"message": "success"})
                )
        )
    )

    app.post('/api/v2/user/:user_id/timesheet/:timesheet_id/disapprove', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)
        db.collection('user').findOne(
            { _id: user_id },
            (err, user) ->
                for item in user.timesheet?.history
                    if item._id.equals(new mongo.ObjectID(req.params.timesheet_id))
                        item.approved = false
                db.collection('user').updateOne(
                    { _id: user_id },
                    { $set: user },
                    (err) ->
                        if err
                            return res.status(500).send({"message": "failed to set inactive"})
                        return res.status(200).send({"message": "success"})
                )
        )
    )

    app.post('/api/v2/user/:user_id/timesheet/:timesheet_id/delete', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)
        db.collection('user').findOne(
            { _id: user_id },
            (err, user) ->
                for i in [0...user.timesheet.history.length]
                    item = user.timesheet.history[i]
                    if item._id.equals(new mongo.ObjectID(req.params.timesheet_id))
                        user.timesheet.history.splice(i, 1)
                        break
                db.collection('user').updateOne(
                    { _id: user_id },
                    { $set: user },
                    (err) ->
                        if err
                            return res.status(500).send({"message": "failed to set inactive"})
                        return res.status(200).send({"message": "success"})
                )
        )
    )
