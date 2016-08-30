# Copyright 2016, All Rights Reserverd
# Kevin Zhang <kevz@mit.edu>
module.exports = (app, db, mailer) -> 
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

    app.get('/api/v2/news', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        db.collection('news').find({}).toArray((err, news) ->
            if err
                return res.status(500).send({"message": "error retrieving news"})
            news.sort((a, b) -> parseInt(a.posted) < parseInt(b.posted))
            res.status(200).send(news.slice(0, 5))
        )
    )

    app.post('/api/v2/news', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if "admin" not in req.requestee.roles
            return res.status(401).send({"message": "access denied"})

        news = booleanify(sanitize(req.body))
        news.writer = req.requestee._id
        news.posted = parseInt((new Date()).getTime()/1000)
        news.updated = parseInt((new Date()).getTime()/1000)
        db.collection('news').insert(news, (err) ->
            if err
                return res.status(500).send({"message": "error inserting news"})
            return res.status(200).send(news)
        )

        # send email notifications
        mail = {
            from: '"BAYMS.Web" <bayms.web@gmail.com>',
            to: ['bayms.web@gmail.com'],
            subject: news.title,
            text: news.content,
            html: marked(news.content)
        }
        if news.notification?.active
            db.collection('user').find({
                roles: {$nin: ["alumni"]}
            }).toArray((err, users) -> 
                emails = []
                for user in users
                    emails.push(user.email)
                    if user.parent1?.email
                        emails.push(user.parent1.email)
                    if user.parent2?.email
                        emails.push(user.parent2.email)
                mail.bcc = emails
                mailer.sendMail(mail)
            )
        if news.notification?.alumni
            db.collection('user').find({
                roles: {$in: ["alumni"]}
            }).toArray((err, users) -> 
                emails = []
                for user in users
                    emails.push(user.email)
                    if user.parent1?.email
                        emails.push(user.parent1.email)
                    if user.parent2?.email
                        emails.push(user.parent2.email)
                mail.bcc = emails
                mailer.sendMail(mail)
            )
    )

    app.post('/api/v2/news/:news_id', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if "admin" not in req.requestee.roles
            return res.status(401).send({"message": "access denied"})

        news = booleanify(sanitize(req.body))
        news.writer = req.requestee._id
        news.updated = parseInt((new Date()).getTime()/1000)
        delete news._id

        db.collection('news').update(
            { _id: new mongo.ObjectID(req.params.news_id)},
            { $set: news },
            (err) ->
                if (err)
                    return res.status(500).send({"message": "error editing news"})
                res.status(200).send(news)
        )
    )

    app.post('/api/v2/news/:news_id/delete', (req, res) ->
        if !req.requestee
            return res.status(401).send({"message": "access denied"})
        if "admin" not in req.requestee.roles
            return res.status(401).send({"message": "access denied"})

        db.collection('news').remove(
            { _id: new mongo.ObjectID(req.params.news_id)},
            (err) ->
                if (err)
                    return res.status(500).send({"message": "error editing news"})
                res.status(200).send({"message": "success"})
        )
    )
