###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This implements the api/user endpoint, providing GET and POST methods for both 
retrieving and updating the current signed-in user's profile.
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

    # get your user profile
    app.get('/api/user', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        res.status(200).send(req.requestee)
    )

    # update your user profile
    app.post('/api/user', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        delete req.body._id
        delete req.body.roles
        delete req.body.token
        delete req.body.password

        db.collection('user').update(
            { _id: req.requestee._id},
            { $set: booleanify(sanitize(req.body)) },
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({
                    message: "success"
                    user: req.body
                })
        )
    )

    # get all users
    app.get('/api/user/all', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        db.collection('user').find({}).toArray((err, user) ->
            if (err)
                return res.status(500).send('something went wrong')
            if "admin" in req.requestee?.roles
                for u in user
                    for key, value of u
                        if key == "picture" or key == "token"
                            delete u[key]
                res.status(200).send(user)
            else
                for u in user
                    for key, value of u
                        if key != "_id" and key != "name" and key != "email" and key != "phone" and key != "roles"
                            delete u[key]
                res.status(200).send(user)
        )
    )

    # update your user profile
    app.post('/api/user/:user_id/roles/:role', (req, res) ->
        if not "admin" in req.requestee?.roles
            return res.status(401).send('access denied')

        user_id = new mongo.ObjectID(req.params.user_id)
        db.collection('user').update(
            { _id: user_id},
            { $set: roles: [req.params.role] },
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({
                    message: "success"
                    user: req.body
                })
        )
    )

