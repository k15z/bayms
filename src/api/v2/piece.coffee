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

    app.post('/api/v2/event/:event_id/piece', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        piece = sanitize(req.body)
        piece._id = new mongo.ObjectID()
        piece.approved = ""
        piece.requestee = req.requestee._id
        db.collection('event').update(
            { _id: new mongo.ObjectID(req.params.event_id)},
            {
                "$push": {
                    "piece": piece
                }
            }
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({
                    message: "success",
                    piece: piece
                })
        )
    )

    app.post('/api/v2/event/:event_id/piece/:piece_id', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        db.collection('event').findOne(
            { _id: new mongo.ObjectID(req.params.event_id)},
            (err, doc) ->
                if (err)
                    return res.status(500).send('something went wrong')
                for i in [0...doc.piece.length]
                    if JSON.stringify(doc.piece[i]._id) == JSON.stringify(req.params.piece_id)
                        doc.piece[i] = sanitize(req.body)
                        doc.piece[i]._id = new mongo.ObjectID(req.params.piece_id)
                db.collection('event').update(
                    { _id: new mongo.ObjectID(req.params.event_id)},
                    {
                        "$set": doc
                    }
                    (err) ->
                        if (err)
                            return res.status(500).send('something went wrong')
                        res.status(200).send({message: "success"})
                )
        )
    )

    app.post('/api/v2/event/:event_id/piece/:piece_id/delete', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        pid = new mongo.ObjectID(req.params.piece_id)
        db.collection('event').update(
            { _id: new mongo.ObjectID(req.params.event_id)},
            {
                "$pull": {
                    "piece": {
                        "_id": pid
                    }
                }
            }
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({message: "success"})
        )
    )

    app.post('/api/v2/event/:event_id/piece/:piece_id/approve', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            return res.status(401).send('access denied')

        db.collection('event').findOne(
            { _id: new mongo.ObjectID(req.params.event_id)},
            (err, doc) ->
                if (err)
                    return res.status(500).send('something went wrong')
                for i in [0...doc.piece.length]
                    if JSON.stringify(doc.piece[i]._id) == JSON.stringify(req.params.piece_id)
                        doc.piece[i].approved = true
                db.collection('event').update(
                    { _id: new mongo.ObjectID(req.params.event_id)},
                    {
                        "$set": doc
                    }
                    (err) ->
                        if (err)
                            return res.status(500).send('something went wrong')
                        res.status(200).send({message: "success"})
                )
        )
    )

    app.post('/api/v2/event/:event_id/piece/:piece_id/disapprove', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            return res.status(401).send('access denied')

        db.collection('event').findOne(
            { _id: new mongo.ObjectID(req.params.event_id)},
            (err, doc) ->
                if (err)
                    return res.status(500).send('something went wrong')
                for i in [0...doc.piece.length]
                    if JSON.stringify(doc.piece[i]._id) == JSON.stringify(req.params.piece_id)
                        doc.piece[i].approved = ""
                db.collection('event').update(
                    { _id: new mongo.ObjectID(req.params.event_id)},
                    {
                        "$set": doc
                    }
                    (err) ->
                        if (err)
                            return res.status(500).send('something went wrong')
                        res.status(200).send({message: "success"})
                )
        )
    )
