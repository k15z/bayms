###
Copyright 2016, Kevin Zhang <kevz@mit.edu>
-------------------------------------------------------------------------------
This creates an instance of the Express web server on port 3000 and uses it to
serve both the RESTful API and the website.
###

path = require('path')
express = require('express')
bodyParser = require('body-parser')
cookieParser = require('cookie-parser')

app = express()
app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())

app.use(express.static(path.join(__dirname, './www')))
app.use('/upload', express.static(path.join(__dirname, './upload')))

app.get('/app', (req, res) ->
    res.sendFile(path.join(__dirname, './www/app.html'))
)
app.get('/auth', (req, res) ->
    res.sendFile(path.join(__dirname, './www/auth.html'))
)
app.get('/reset', (req, res) ->
    res.sendFile(path.join(__dirname, './www/reset.html'))
)
app.get('/reset/:auth_token', (req, res) ->
    res.sendFile(path.join(__dirname, './www/reset.html'))
)
app.get('/program/:program_id', (req, res) ->
    res.sendFile(path.join(__dirname, './www/program.html'))
)

require('./api')(app)
app.listen(3000)
