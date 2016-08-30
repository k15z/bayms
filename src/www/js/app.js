Vue.use(VueCharts);
Vue.config.debug = true;
var vm = new Vue({
    el: "body",
    created: function () {
        var self = this;
        if (!sessionStorage.getItem('token'))
            window.location.href = "/auth"

        window.onhashchange = function () {
            var hash = window.location.hash.substr(1);
            if (!hash)
                hash = "home"
            self.state.tab = hash;
        };
        window.onhashchange();

        $(window).bind('beforeunload', function(){
            if (!self.ajax.inprogress)
                return undefined
            return "Please give us a moment to save the changes.";
        });
        $( document ).ajaxSend(function() {
            self.ajax.total++;
            self.ajax.percent = 100.0 * self.ajax.complete / self.ajax.total +  "%";
        });
        $( document ).ajaxComplete(function() {
            self.ajax.complete++;
            self.ajax.percent = 100.0 * self.ajax.complete / self.ajax.total +  "%";
        });
        $( document ).ajaxStart(function() {
            self.ajax.total = 0;
            self.ajax.complete = 0;
            self.ajax.percent = "0%";
            self.ajax.inprogress = true;
        });
        $( document ).ajaxStop(function() {
            self.ajax.total = 0;
            self.ajax.complete = 0;
            self.ajax.percent = "100%";
            self.ajax.inprogress = false;
        });

        $.get('/api/v2/user')
            .done(function (obj) {
                if (!obj.picture)
                    obj.picture = false
                self.model.user = obj;
                self.ready = true
            })
            .fail(function (xhr) {
                sessionStorage.clear()
                window.location.href = "/auth";
            })
        $.get('/api/v2/news').done(function (obj) { self.model.news = obj; });
        $.get('/api/v2/event').done(function (obj) { self.model.events = obj;});
        $.get('/api/v2/user/all').done(function (obj) { self.model.users = obj; });
    },
    data: {
        ready: false,
        ajax: {
            total: 0,
            complete: 0,
            percent: "100%",
            inprogress: false
        },
        state: {
            tab: "home",
            menu: false,
            event_id: "",
            event: {},
            piece: {},
            overlay: false,
            post: {
                title: "",
                content: ""
            }
        },
        model: {
            user: {},
            news: [],
            events: [],
            users: []
        }
    },
    computed: {
        timesheetRows: function () {
            var rows = []
            var history = this.model.user.timesheet.history
            for (var i = 0; i < history.length; i++)
                if (history[i].reported_on) {
                    var date = (new Date(parseInt(history[i].reported_on*1000))).toLocaleDateString()
                    var hours = parseInt(history[i].time) / (60*60)
                    rows.push([date, hours])
                }
            return rows
        },
        timesheetColumns: function () {
            return [{
                    'type': 'string',
                    'label': 'Date'
                }, {
                    'type': 'number',
                    'label': 'Hours'
                }]
        },
        timesheetOptions: function () {
            return {
                hAxis: {
                    title: 'Date'
                },
                vAxis: {
                    title: 'Hours'
                }
            }
        }
    },
    methods: {
        signout: function () {
            sessionStorage.clear();
            window.location.href = "/";
        },
        changePassword: function () {
            var pass = prompt("New password:");
            if (pass && pass == prompt("Confirm password:"))
                $.ajax({
                    method: "POST",
                    url: "/api/v2/auth/change",
                    data: {
                        password: pass
                    }
                });
        },
        changePicture: function () {
            var self = this;
            $('input[type=file]').trigger('click');
            $('input[type=file]')[0].onchange = function(evt) {
                $('input[type=file]')[0].onchange = false;
                $("#picture").submit()
            };
        },
        hasRole: function (role, other) {
            if (this.model.user.roles.indexOf(role) >= 0)
                return true;
            if (other && this.model.user.roles.indexOf(other) >= 0)
                return true;
            return false;
        },
        setRole: function (user_id, role) {
            var self = this;
            $.ajax({
                method: "POST", 
                url: "/api/v2/user/" + user_id + "/roles/" + role
            }).done(function () {
                $.get('/api/v2/user/all')
                    .done(function (obj) { 
                        self.model.users = obj; 
                    });
            })
        },
        resetParent: function (parent) {
            var self = this
            if (!parent || !parent.email)
                alert("This parent doesn't exist...")
            else if (confirm("Send reset request to " + parent.email + "?"))
                $.ajax({
                    method: "POST", 
                    url: "/api/v2/auth/reset",
                    data: {
                        email: parent.email
                    }
                });
        },
        giveHours: function (user_id) {
            var self = this
            var hours = prompt("How many hours?")
            var reason = prompt("Why?")
            if (!hours || !reason)
                return
            $.ajax({
                method: "POST", 
                url: "/api/v2/user/" + user_id + "/timesheet/history",
                data: {
                    time: hours*60*60,
                    reason: reason
                }
            });
        },
        startHours: function (user_id) {
            var self = this
            var reason = prompt("Why?")
            if (!reason)
                return
            $.ajax({
                method: "POST", 
                url: "/api/v2/user/" + user_id + "/timesheet/active",
                data: {
                    reason: reason
                }
            }).done(function () {
                $.get('/api/v2/user/all')
                    .done(function (obj) { 
                        self.model.users = obj; 
                    });
            })
        },
        stopHours: function (user_id) {
            var self = this
            $.ajax({
                method: "POST", 
                url: "/api/v2/user/" + user_id + "/timesheet/inactive"
            }).done(function () {
                $.get('/api/v2/user/all')
                    .done(function (obj) { 
                        self.model.users = obj; 
                    });
            })
        },
        deleteUser: function (user_id) {
            var self = this
            $.ajax({
                method: "POST", 
                url: "/api/v2/user/" + user_id + "/delete"
            }).done(function () {
                $.get('/api/v2/user/all')
                    .done(function (obj) {
                        self.model.users = obj;
                    });
            });
        },
        parentPassword: function (number) {
            var self = this;
            var password = prompt("Parent " + number + " password:");
            if (!password)
                return;
            $.ajax({
                method: "POST", 
                url: "/api/v2/auth/parent/" + number,
                data:{password:password}
            }).done(function () {
                $.get('/api/v2/user')
                    .done(function (obj) {
                        self.model.user = obj;
                        self.ready = true
                    })
            })
        },
        markDown: function (text) {
            return filterXSS(marked(text))
        },
        clampText: function (text, length) {
            if (text.length > length)
                return text.substr(0, length - 3) + "...";
            return text;
        },
        dateString: function (unix) {
            return (new Date(unix * 1000)).toLocaleDateString();
        },
        timeString: function (unix) {
            return (new Date(unix * 1000)).toLocaleTimeString();
        },
        stringDateTime: function (str) {
            return parseInt((new Date(str)).getTime()/1000);
        },
        showEditor: function (news) {
            var self = this;
            self.state.post = $.extend({},news)
            self.state.overlay = 'news'
        },
        postArticle: function () {
            var self = this
            target = "/api/v2/news/"
            if (self.state.post._id)
                target += self.state.post._id
            $.ajax({
                method: "POST", 
                url: target,
                data: self.state.post
            }).done(function () {
                self.state.overlay = false
                $.get('/api/v2/news')
                    .done(function (obj) {
                        self.model.news = obj
                    })
            })
        },
        totalHours: function (history) {
            var hours = 0
            for (var i = 0; i < history.length; i++) 
                hours += parseFloat(history[i].time) / (60*60)
            return Math.round(hours)
        },
        computeAge: function (birthday) {
            ms = ((new Date()) - (new Date(birthday)))
            yr = ms / (1000 * 60 * 60 * 24 * 365)
            return parseInt(yr)
        },
        awardDescription: function (hours, age) {
            if (5 <= age && age <= 10) {
                if (hours >= 75)
                    return "Gold"
                if (hours >= 50)
                    return "Silver"
                if (hours >= 26)
                    return "Bronze"
            }
            if (11 <= age && age <= 15) {
                if (hours >= 100)
                    return "Gold"
                if (hours >= 75)
                    return "Silver"
                if (hours >= 50)
                    return "Bronze"
            }
            if (16 <= age && age <= 25) {
                if (hours >= 250)
                    return "Gold"
                if (hours >= 175)
                    return "Silver"
                if (hours >= 100)
                    return "Bronze"
            }
            return "no awards"
        },
        deleteArticle: function () {
            var self = this
            if (!self.state.post._id)
                return
            $.ajax({
                method: "POST", 
                url: "/api/v2/news/" + self.state.post._id + "/delete"
            }).done(function () {
                self.state.overlay = false
                $.get('/api/v2/news')
                    .done(function (obj) {
                        self.model.news = obj
                    })
            })
        },
        createEvent: function (update) {
            var self = this
            target = "/api/v2/event/"
            if (self.state.event._id)
                target += self.state.event._id
            $.ajax({
                method: "POST", 
                url: target,
                data: self.state.event
            }).done(function () {
                if (update)
                    $.get('/api/v2/event')
                        .done(function (obj) {
                            self.model.events = obj
                            self.loadEvent(self.state.event_id)
                        })
            })
        },
        createPiece: function () {
            var self = this
            var eid = self.state.event._id
            target = "/api/v2/event/" + eid + "/piece"
            if (self.state.piece._id)
                target += "/" + self.state.piece._id
            $.ajax({
                method: "POST", 
                url: target,
                data: self.state.piece
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.state.piece = {}
                        self.model.events = obj
                        self.loadEvent(self.state.event_id)
                    })
            })
        },
        approvePiece: function (pid, approve) {
            var self = this
            var eid = self.state.event._id
            $.ajax({
                method: "POST", 
                url: "/api/v2/event/" + eid + "/piece/" + pid + "/approve"
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.state.piece = {}
                        self.model.events = obj
                        self.loadEvent(self.state.event_id)
                    })
            })
        },
        disapprovePiece: function (pid, approve) {
            var self = this
            var eid = self.state.event._id
            $.ajax({
                method: "POST", 
                url: "/api/v2/event/" + eid + "/piece/" + pid + "/disapprove",
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.state.piece = {}
                        self.model.events = obj
                        self.loadEvent(self.state.event_id)
                    })
            })
        },
        editPiece: function (piece) {
            var self = this
            self.overlay = "piece"
            self.state.piece = piece
        },
        movePieceUp: function (piece_index) {
            var self = this
            if (piece_index == 0)
                return
            var temp = self.state.event.piece[piece_index]
            self.state.event.piece.$set(piece_index, self.state.event.piece[piece_index-1])
            self.state.event.piece.$set(piece_index-1, temp)
            self.createEvent()
        },
        movePieceDown: function (piece_index) {
            var self = this
            if (piece_index == self.state.event.length - 1)
                return
            var temp = self.state.event.piece[piece_index]
            self.state.event.piece.$set(piece_index, self.state.event.piece[piece_index+1])
            self.state.event.piece.$set(piece_index+1, temp)
            self.createEvent()
        },
        deletePiece: function (pid) {
            var self = this
            var eid = self.state.event._id
            $.ajax({
                method: "POST", 
                url: "/api/v2/event/" + eid + "/piece/" + pid + "/delete",
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.state.piece = {}
                        self.model.events = obj
                        self.loadEvent(self.state.event_id)
                    })
            })
        },
        loadEvent: function (eid) {
            var self = this;
            if (eid == 'create') {
                self.state.event = {}
            } else {
                for (var i = 0 ; i < self.model.events.length; i++)
                    if (self.model.events[i]._id == eid)
                        self.state.event = self.model.events[i];
            }
        },
        showUser: function (user) {
            var self = this;
            self.state.user = user;
            self.state.overlay = 'user';
        },
        printEvent: function () {
            var self = this;
            var event_id = self.state.event._id;
            var printWindow = window.open("/program/" + event_id, "print program");
            var printAndClose = function () {
                if (printWindow.document.readyState == 'complete') {
                    clearInterval(sched);
                    printWindow.print();
                }
            }
            var sched = setInterval(printAndClose, 200);

        },
        deleteEvent: function () {
            var self = this
            if (!self.state.event._id)
                return
            target = "/api/v2/event/"
            target += self.state.event._id
            target += "/delete"
            $.ajax({
                method: "POST", 
                url: target
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.model.events = obj
                        self.state.event_id = obj[0]._id
                        self.loadEvent(self.state.event_id)
                    })
            })
        },
        importPieces: function (src_event_id) {
            var self = this
            target = "/api/v2/event/"
            target += self.state.event._id
            target += "/import/"
            target += src_event_id
            $.ajax({
                method: "POST", 
                url: target
            }).done(function () {
                $.get('/api/v2/event')
                    .done(function (obj) {
                        self.model.events = obj
                        self.loadEvent(self.state.event_id)
                    })
            })
        }
    },
    watch: {
        'state.tab': {
            handler: function (value, oldValue) {
                window.location.hash = value;
            }
        },
        'model.user': {
            deep: true,
            handler: function (value, oldValue) {
                var self = this;
                $.ajax({
                    method: "POST",
                    url: "/api/v2/user",
                    data: self.model.user
                });
            }
        },
        'state.event_id': {
            handler: function (value, oldValue) {
                var self = this;
                self.loadEvent(value)
            }
        },
        'state.event': {
            deep: true,
            handler: function (value, oldValue) {
                var self = this;
                if (self.state.event._id)
                    self.createEvent(false)
            }
        }
    }
});
jQuery(window).resize(function () {
    vm.$broadcast('redrawChart');
});
