# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer) -> 
    mongo = require('mongodb')

    getUser = (callback) ->
        db.collection('user').find({
            $or: [
                { "waiver.a": true },
                { "waiver.b": true },
                { "waiver.c": true }
            ]
        }).toArray((err, users) ->
            for user in users
                for key, value of user
                    if key == "name"
                        continue
                    delete user[key]
            callback(users)
        )

    getEvent = (callback) ->
        db.collection('event').find({
            $or: [
                { "visible.public": true }
            ]
        }).toArray((err, events) ->
            callback(events)
        )

    app.get('/api/v2/public', (req, res) ->
        result = {}
        pending = 2
        accumulate = (name) ->
            return (data) ->
                pending -= 1
                result[name] = data
                if pending == 0
                    res.send(result)
        getUser(accumulate('user'))
        getEvent(accumulate('event'))
    )

    app.get('/api/v2/health_check', (req, res) ->
        res.status(200).send("I'm alive.")
    )
