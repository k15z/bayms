###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This implements the api/auth/signin and api/auth/signup endpoints, and returns
an authentication token to be used in future requests. The auth token is saved
in the user's profile and expires 24 hours after it is created.
###
module.exports = (app, db, mailer) ->
    crypto = require('crypto')
    marked = require('marked')
    sanitize = require('mongo-sanitize')

    # Generate and save an auth token
    authToken = (user, details = "", temporary = false) -> 
        token = crypto.randomBytes(16).toString('base64')
        unix_time = parseInt((new Date()).getTime()/1000)
        expiration = unix_time + 60 * 60 * 24
        if temporary
            expiration = unix_time + 60 * 15 # 15 minutes
        db.collection('user').update(
            {"email": user.email}, 
            {
                "$push": {
                    "token": {
                        "value": token
                        "details": details
                        "expiration": expiration
                    }
                }
            }
        )
        return token

    # Sign in and return an auth token
    app.post('/api/auth/signin', (req, res) ->
        if (!req.body.email || !req.body.password)
            return res.status(401).send('missing email/password')

        email = sanitize(req.body.email)
        password = sanitize(req.body.password)
        db.collection('user').find({
            "email": email
        }).toArray((err, user) ->
            if (err || !user || user.length == 0)
                return res.status(401).send('invalid email/password')
            user = user[0]
            crypto.pbkdf2(password, user.salt, 10000, 512, 'sha512', (err, hash) ->
                is_user = hash.toString('base64') == user.password
                is_parent1 = hash.toString('base64') == user.parent1?.password
                is_parent2 = hash.toString('base64') == user.parent2?.password
                if (is_user || is_parent1 || is_parent2)
                    return res.status(200).send({
                        "message": "success"
                        "user_id": user._id
                        "auth_token": authToken(user, req.headers)
                    })
                return res.status(403).send("invalid email/password")
            )
        )
    )

    # Sign up and return an auth token
    app.post('/api/auth/signup', (req, res) ->
        if (!req.body.email || !req.body.password)
            return res.status(401).send('missing email/password')

        email = req.body.email
        password = req.body.password
        db.collection('user').find({
            "email": email
        }).toArray((err, user) ->
            if (err || user?.length > 0)
                return res.status(401).send('invalid email/password')
            salt = crypto.randomBytes(16).toString('base64')
            crypto.pbkdf2(password, salt, 10000, 512, 'sha512', (err, hash) ->
                user = {}
                user.salt = salt
                user.email = email
                user.roles = ["applicant"]
                user.password = hash.toString('base64')
                db.collection('user').insert(user, (err) ->
                    if err
                        return res.status(500).send('invalid email/password')
                    else
                        return res.status(200).send({
                            "message": "success"
                            "user_id": user._id
                            "auth_token": authToken(user, req.headers)
                        })
                )
            )
        )
    )

    # Reset a password, send auth token to email
    app.post('/api/auth/reset', (req, res) ->
        if (!req.body.email)
            return res.status(401).send('missing email')

        email = sanitize(req.body.email)
        db.collection('user').find({
            "email": email
        }).toArray((err, user) ->
            if (err || !user || user.length == 0)
                return res.status(200).send({"message": "success"})
            token = authToken(user[0], req.headers, true)
            message = "Please use the following link to reset your password: "
            message += "`https://www.bayms.org/reset#" + token + "`"
            mail = {
                from: '"BAYMS.Web" <bayms.web@gmail.com>',
                to: [user[0].email],
                subject: "Password Reset Request",
                text: message,
                html: marked(message)
            }
            mailer.sendMail(mail, (err) ->
                if err
                    console.log(err)
                    return res.status(500).send('something went wrong')
                return res.status(200).send({"message": "success"})
            )
        )
    )

    # Change the password (assuming x-bayms-token was set)
    app.post('/api/auth/change', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        email = req.requestee.email
        password = sanitize(req.body.password)
        salt = crypto.randomBytes(128).toString('base64')
        crypto.pbkdf2(password, salt, 10000, 512, 'sha512', (err, hash) ->
            hash = hash.toString('base64')
            db.collection('user').update(
                { _id: req.requestee._id},
                { 
                    $set: { 
                        salt: salt,
                        password: hash
                    }
                },
                (err) ->
                    if (err)
                        return res.status(500).send('something went wrong')
                    res.status(200).send({message: "success"})
            )
        )
    )

    # Set parentN password (assuming x-bayms-token was set)
    app.post('/api/auth/parent/:number', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        salt = req.requestee.salt
        email = req.requestee.email
        password = sanitize(req.body.password)
        crypto.pbkdf2(password, salt, 10000, 512, 'sha512', (err, hash) ->
            hash = hash.toString('base64')
            doc = {}
            doc["parent" + req.params.number + ".password"] = hash

            console.log(doc)

            db.collection('user').update(
                { _id: req.requestee._id},
                {
                    $set: doc
                },
                (err) ->
                    if (err)
                        console.log(err)
                        return res.status(500).send('something went wrong')
                    res.status(200).send({message: "success"})
            )
        )
    )

    # Clear all tokens
    # $.ajax({method: "POST", url: "/api/auth/clear"});
    app.post('/api/auth/clear', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')

        db.collection('user').update(
            { _id: req.requestee._id},
            { 
                $set: { 
                    token: []
                }
            },
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({message: "success"})
        )
    )
