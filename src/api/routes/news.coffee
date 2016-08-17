###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This handles api/news and api/news/:news_id requests. Only users with admin or 
leader roles have the ability to POST news.
###
module.exports = (app, db, mailer) -> 
    mongo = require('mongodb')
    marked = require('marked')
    sanitize = require('mongo-sanitize')

    # Get all news articles
    app.get('/api/news', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        db.collection('news').find({}).toArray((err, news) ->
            if err
                return res.status(500).send('Something went wrong.')
            news.sort((a, b) -> parseInt(a.posted) < parseInt(b.posted))
            res.status(200).send(news.slice(0, 5))
        )
    )

    # Post a new article
    app.post('/api/news', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        news = sanitize(req.body)
        news.writer = req.requestee._id
        news.posted = parseInt((new Date()).getTime()/1000)
        news.updated = parseInt((new Date()).getTime()/1000)
        db.collection('news').insert(news, (err) ->
            if err
                res.status(500).send('invalid email/password')
            else
                res.status(200).send({
                    "message": "success"
                    "event": news
                })
        )
        if news.notify
            db.collection('user').find({}).toArray((err, users) -> 
                emails = []
                for user in users
                    emails.push(user.email)
                    if user.parent1?.email
                        emails.push(user.parent1.email)
                    if user.parent2?.email
                        emails.push(user.parent2.email)
                console.log(emails)
                mail = {
                    from: '"BAYMS.Web" <bayms.web@gmail.com>',
                    to: ['bayms.web@gmail.com'],
                    bcc: emails,
                    subject: news.title,
                    text: news.content,
                    html: marked(news.content)
                }
                mailer.sendMail(mail)
            )
    )

    # Update existing article
    app.post('/api/news/:news_id', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        news = sanitize(req.body)
        delete news._id
        news.writer = req.requestee._id
        news.updated = parseInt((new Date()).getTime()/1000)
        db.collection('news').update(
            { _id: new mongo.ObjectID(req.params.news_id)},
            { $set: news },
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({message: "success"})
        )
    )

    # Delete existing article
    app.post('/api/news/:news_id/delete', (req, res) ->
        if !req.requestee
            return res.status(401).send('access denied')
        if "admin" not in req.requestee.roles
            if "leader" not in req.requestee.roles
                return res.status(401).send('access denied')

        db.collection('news').remove(
            { _id: new mongo.ObjectID(req.params.news_id)},
            (err) ->
                if (err)
                    return res.status(500).send('something went wrong')
                res.status(200).send({message: "success"})
        )
    )
