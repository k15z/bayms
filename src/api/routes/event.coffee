###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This handles api/event, api/event/:event_id/delete, api/event/:event_id/piece, 
and api/event/:event_id/piece/:piece_id requests. Only users with admin and/or
leader roles can create/delete events, but any user can create/edit pieces.
###
module.exports = (app, db, mailer) -> 
    mongo = require('mongodb')
    sanitize = require('mongo-sanitize')

    booleanify = (obj) ->
        for key, value of obj
            if value == "false"
                obj[key] = false
            if typeof value  == 'object'
                booleanify(value)
        return obj

    # Return all events
    app.get('/api/event', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        db.collection('event').find({}).toArray((err, event) ->
            if (err)
                return res.status(500).send('something went wrong')
            event.sort((a, b) -> new Date(a.time) > new Date(b.time))
            res.status(200).send(booleanify(event))
        )
    )

    # Return a specific event
    app.get('/api/event/:event_id', (req, res) ->
        db.collection('event').findOne({
            _id: new mongo.ObjectID(req.params.event_id)
        }, (err, event) ->
            if (err)
                return res.status(500).send('something went wrong')
            res.status(200).send(booleanify(event))
        )
    )

    # Create new event
    app.post('/api/event', (req, res) ->
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

    # Update existing event
    app.post('/api/event/:event_id', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        event = sanitize(req.body)
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

    # Delete existing event
    app.post('/api/event/:event_id/delete', (req, res) ->
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

    # Post new piece
    app.post('/api/event/:event_id/piece', (req, res) ->
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

    # Update existing piece
    app.post('/api/event/:event_id/piece/:piece_id', (req, res) ->
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

    # Delete existing piece
    app.post('/api/event/:event_id/piece/:piece_id/delete', (req, res) ->
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

    # Approve existing piece
    app.post('/api/event/:event_id/piece/:piece_id/approve', (req, res) ->
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

    # Disapprove existing piece
    app.post('/api/event/:event_id/piece/:piece_id/disapprove', (req, res) ->
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
