# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer) ->
    mongo = require('mongodb')
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

    app.get('/api/v2/event', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        db.collection('event').find({}).toArray((err, event) ->
            if (err)
                return res.status(500).send('something went wrong')
            event.sort((a, b) -> new Date(a.time) > new Date(b.time))
            res.status(200).send(booleanify(event))
        )
    )

    app.get('/api/v2/event/:event_id', (req, res) ->
        db.collection('event').findOne({
            _id: new mongo.ObjectID(req.params.event_id)
        }, (err, event) ->
            if (err)
                return res.status(500).send('something went wrong')
            res.status(200).send(booleanify(event))
        )
    )

    app.post('/api/v2/event', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        event = sanitize(req.body)
        event.creator = req.requestee._id
        if (!event.piece)
            event.piece = []
        db.collection('event').insert(event, (err) ->
            if err
                return res.status(500).send('something went wrong')
            else
                return res.status(200).send({
                    "message": "success"
                    "event": event
                })
        )
    )

    app.post('/api/v2/event/:event_id', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        event = booleanify(sanitize(req.body))
        delete event._id
        if event.piece
            for piece in event.piece
                piece._id = new mongo.ObjectID(piece._id)
        event.creator = req.requestee._id
        db.collection('event').update(
            { _id: new mongo.ObjectID(req.params.event_id)},
            {
                "$set": event
            }
            (err) ->
                if (err)
                    console.log(err)
                    return res.status(500).send('something went wrong')
                event._id = req.params.event_id
                res.status(200).send({
                    message: "success",
                    event: event
                })
        )
    )

    app.post('/api/v2/event/:event_id/import/:src_event_id', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        event_id = new mongo.ObjectID(req.params.event_id)
        src_event_id = new mongo.ObjectID(req.params.src_event_id)

        db.collection('event').findOne(
            { _id: src_event_id },
            (err, src_doc) ->
                for piece in src_doc.piece
                    piece._id = new mongo.ObjectID()
                db.collection('event').update(
                    { _id: event_id},
                    {
                        "$push": {
                            "piece": {
                                '$each': src_doc.piece
                            }
                        }
                    },
                    (err) ->
                        if (err)
                            return res.status(500).send('something went wrong')
                        res.status(200).send({
                            message: "success"
                        })
                )
        )
    )

    app.post('/api/v2/event/:event_id/delete', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        db.collection('event').remove(
            { _id: new mongo.ObjectID(req.params.event_id)}
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({message: "success"})
        )
    )
