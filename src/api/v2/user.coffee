# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer, upload) -> 
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

    app.get('/api/v2/user', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        res.status(200).send(req.requestee)
    )

    app.post('/api/v2/user', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})

        delete req.body._id
        delete req.body.roles
        delete req.body.hours
        delete req.body.token
        delete req.body.password

        db.collection('user').update(
            { _id: req.requestee._id},
            { $set: booleanify(sanitize(req.body)) },
            (err, user) ->
                if (err)
                    return res.status(500).send({"message": "error updating user"})
                res.status(200).send(user)
        )
    )

    app.post('/api/v2/user/upload', upload.single('picture'), (req, res) ->
        db.collection('user').update(
            { _id: new mongo.ObjectID(req.body.user_id)},
            { 
                $set: {
                    picture: '/upload/' + req.file.filename
                }
            },
            (err, user) ->
                if (err)
                    return res.status(500).send({"message": "error updating user"})
                res.redirect('back')
        )
    )

    app.get('/api/v2/user/all', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})

        db.collection('user').find({}).toArray((err, user) ->
            if (err)
                return res.status(500).send({"message": "error retreiving users"})
            for u in user
                for key, value of u
                    if "admin" in req.requestee?.roles
                        if key == "picture" or key == "token"
                            delete u[key]
                    else
                        if key == "_id"
                            continue
                        if key == "name" or key == "email" 
                            continue
                        if key == "phone" or key == "roles"
                            continue
                        delete u[key]
            res.status(200).send(user)
        )
    )

    app.post('/api/v2/user/:user_id/roles/:role', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if not "admin" in req.requestee?.roles
            return res.status(401).send({"message": "access denied"})

        user_id = new mongo.ObjectID(req.params.user_id)
        db.collection('user').update(
            { _id: user_id},
            { $set: roles: [req.params.role] },
            (err, user) ->
                if (err)
                    return res.status(500).send({"message": "error setting roles"})
                res.status(200).send(user)
        )
    )
