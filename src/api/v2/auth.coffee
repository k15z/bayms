# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer) ->
    crypto = require('crypto')
    marked = require('marked')
    sanitize = require('mongo-sanitize')

    isString = (value) ->
        return typeof value == "string"

    computeHash = (password, salt, callback) ->
        crypto.pbkdf2(password, salt, 10000, 512, 'sha512', callback)

    randomString = () ->
        return crypto.randomBytes(32).toString('base64')

    generateToken = (user, context, is_parent = false, duration = 60 * 60 * 24) -> 
        token = randomString()
        current_time = parseInt((new Date()).getTime()/1000)
        db.collection('user').update(
            {"email": user.email}, 
            {
                "$push": {
                    "token": {
                        "value": token
                        "context": context
                        "is_parent": is_parent
                        "expiration": current_time + duration
                    }
                }
            }
        )
        return token

    app.post('/api/v2/auth/signin', (req, res) ->
        if !req.body.email or !req.body.password
            return res.status(400).send({"message": "missing email or password"})
        if !isString(req.body.email) or !isString(req.body.password)
            return res.status(400).send({"message": "malformed email or password"})

        db.collection('user').findOne(
            {"email": sanitize(req.body.email)}
            (err, user) ->
                if err or !user
                    return res.status(401).send({"message": "incorrect email"})

                computeHash(req.body.password, user.salt, (err, hash) ->
                    is_user = hash.toString('base64') == user.password
                    is_parent1 = hash.toString('base64') == user.parent1?.password
                    is_parent2 = hash.toString('base64') == user.parent2?.password
                    if is_user or is_parent1 or is_parent2
                        return res.status(200).send({
                            "message": "success"
                            "auth_token": generateToken(user, req.headers, is_parent1 || is_parent2, 60 * 60 * 24)
                        })
                    return res.status(401).send({"message": "incorrect password"})
                )
        )
    )

    app.post('/api/v2/auth/signup', (req, res) ->
        if !req.body.email or !req.body.password
            return res.status(400).send({"message": "missing email or password"})
        if !isString(req.body.email) or !isString(req.body.password)
            return res.status(400).send({"message": "malformed email or password"})

        db.collection('user').findOne(
            {"email": sanitize(req.body.email)}
            (err, user) ->
                if err or user
                    return res.status(400).send({"message": "email already exists"})

                salt = randomString()
                email = req.body.email
                password = req.body.password

                computeHash(password, salt, (err, hash) ->
                    user = {}
                    user.salt = salt
                    user.email = email
                    user.roles = ["applicant"]
                    user.password = hash.toString('base64')
                    user.timesheet = {active: false}

                    db.collection('user').insert(user, (err) ->
                        if err
                            return res.status(500).send({"message": "error creating user"})
                        else
                            return res.status(200).send({
                                "message": "success"
                                "auth_token": generateToken(user, req.headers)
                            })
                    )

                    db.collection('user').find({
                        "notification.application": true
                    }).toArray((err, users) ->
                        emails = []
                        for user in users
                            emails.push(user.email)
                        message = "#{user.email} applied for an account"
                        mailer.sendMail({
                            from: '"BAYMS.Web" <bayms.web@gmail.com>'
                            to: ["bayms.web@gmail.com"]
                            bcc: emails
                            subject: "Application Received"
                            html: marked(message)
                            text: message
                        })
                    )
                )
        )
    )

    app.post('/api/v2/auth/change', (req, res) ->
        if !req.requestee
            return res.status(400).send({"message": "not authenticated"})
        if !req.body.password
            return res.status(400).send({"message": "missing password"})
        if !isString(req.body.password)
            return res.status(400).send({"message": "malformed password"})

        salt = randomString()
        password = req.body.password

        computeHash(password, salt, (err, hash) ->
            hash = hash.toString('base64')
            db.collection('user').update(
                { _id: req.requestee._id}
                { 
                    $set: {
                        "salt": salt,
                        "password": hash
                    }
                },
                (err, count) ->
                    if err or count != 1
                        return res.status(500).send({"message": "error changing password"})
                    return res.status(200).send({"message": "success"})
            )
        )
    )

    app.post('/api/v2/auth/revoke', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "not authenticated"})

        db.collection('user').findOne(
            { _id: req.requestee._id }
            (err, doc) ->
                if err or !doc
                    return res.status(500).send({"message": "error revoking tokens"})
                for token in doc.token
                    token.expiration = -1
                db.collection('user').save(doc)
        )
    )

    app.post('/api/v2/auth/reset', (req, res) ->
        if !req.body.email
            return res.status(400).send({"message": "missing email"})
        if !isString(req.body.email)
            return res.status(400).send({"message": "malformed email"})

        req.body.email = sanitize(req.body.email)

        db.collection('user').findOne(
            {
                $or: [
                    {"email": req.body.email},
                    {"parent1.email": req.body.email},
                    {"parent2.email": req.body.email}
                ]
            },
            (err, user) ->
                if err or !user
                    return res.status(400).send({"message": "user not found"})

                token = generateToken(user, req.headers, req.body.email != user.email, 60 * 15)
                message = "Please use the following link to reset your password: "
                message += "`https://www.bayms.org/reset/" + token + "`"
                mail = {
                    from: '"BAYMS.Web" <bayms.web@gmail.com>'
                    to: [req.body.email]
                    subject: "Password Reset Request"
                    html: marked(message)
                    text: message
                }
                mailer.sendMail(mail, (err) ->
                    if err
                        return res.status(500).send({"message": "error sending reset email"})
                    return res.status(200).send({"message": "success"})
                )
        )
    )

    app.post('/api/v2/auth/parent/:number', (req, res) ->
        if !req.requestee or !req.requestee.is_parent
            return res.status(401).send('access denied')

        salt = req.requestee.salt
        email = req.requestee.email
        password = sanitize(req.body.password)
        crypto.pbkdf2(password, salt, 10000, 512, 'sha512', (err, hash) ->
            hash = hash.toString('base64')
            doc = {}
            doc["parent" + req.params.number + ".password"] = hash

            db.collection('user').update(
                { _id: req.requestee._id},
                {
                    $set: doc
                },
                (err) ->
                    if (err)
                        return res.status(500).send('something went wrong')
                    res.status(200).send({message: "success"})
            )
        )
    )
