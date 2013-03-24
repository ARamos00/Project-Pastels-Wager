/*
The MIT License (MIT)
Copyright (c) 2013 Calvin Montgomery
 
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const SYNC_THRESHOLD = 2;
var LEADER = false;
var PLAYER = false;
var MEDIATYPE = "yt";
var POSITION = -1;
var RANK = 0;
var OPENQUEUE = false;
var CHANNELOPTS = {};
var uname = readCookie("sync_uname");
var pw = readCookie("sync_pw");

var Rank = {
    Guest: 0,
    Member: 1,
    Moderator: 2,
    Owner: 3,
    Siteadmin: 255
};

var socket = io.connect(IO_URL);
initCallbacks();

var params = {};
if(window.location.search) {
    var parameters = window.location.search.substring(1).split("&");
    for(var i = 0; i < parameters.length; i++) {
        var s = parameters[i].split("=");
        if(s.length != 2)
            continue;
        params[s[0]] = s[1];
    }
}

if(params["novideo"] != undefined) {
    $(".span7").remove();
}

if(params["channel"] == undefined) {
    var main = $($(".container")[1]);
    var container = $("<div/>").addClass("container").insertBefore(main);
    var row = $("<div/>").addClass("row").appendTo(container);
    var div = $("<div/>").addClass("span6").appendTo(row);
    main.css("display", "none");
    var label = $("<label/>").text("Enter Channel:").appendTo(div);
    var entry = $("<input/>").attr("type", "text").appendTo(div);
    entry.keydown(function(ev) {
        if(ev.keyCode == 13) {
            document.location = document.location + "?channel=" + entry.val();
            socket.emit("joinChannel", {
                name: entry.val()
            });
            container.remove();
            main.css("display", "");
        }
    });
}
else if(!params["channel"].match(/^[a-zA-Z0-9]+$/)) {
    $("<div/>").addClass("alert alert-error")
        .insertAfter($(".row")[0])[0]
        .innerHTML = "<h3>Invalid Channel Name</h3><p>Channel names must conain only numbers and letters</p>";

}
else {
    socket.emit("joinChannel", {
        name: params["channel"]
    });
}


// Load the youtube iframe API
var tag = document.createElement("script");
tag.src = "http://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Load the Dailymotion iframe API

/*
var tag = document.createElement("script");
tag.src = "http://api.dmcdn.net/all.js";
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
*/



if(uname != null && pw != null && pw != "false") {
    socket.emit("login", {
        name: uname,
        sha256: pw
    });
}

var sendVideoUpdate = function() { }
setInterval(function() {
    sendVideoUpdate();
}, 5000);

$("#queue_end").click(function() {
    var parsed = parseVideoURL($("#mediaurl").val());
    var id = parsed[0];
    var type = parsed[1];
    if(id) {
        $("#mediaurl").val("");
    }
    socket.emit("queue", {
        id: id,
        pos: "end",
        type: type
    });
});

$("#queue_next").click(function() {
    var parsed = parseVideoURL($("#mediaurl").val());
    var id = parsed[0];
    var type = parsed[1];
    if(id) {
        $("#mediaurl").val("");
    }
    socket.emit("queue", {
        id: id,
        pos: "next",
        type: type
    });
});

$("#play_next").click(function() {
    socket.emit("playNext");
});

$("#qlockbtn").click(function() {
    socket.emit("queueLock", {
        locked: OPENQUEUE
    });
});

function loginClick() {
    uname = $("#username").val();
    if($("#password").val() == "")
        pw = "";
    else
        pw = SHA256($("#password").val());
    socket.emit("login", {
        name: uname,
        sha256: pw
    });
};

$("#login").click(loginClick);
$("#username").keydown(function(ev) {
    if(ev.key == 13)
        loginClick();
});
$("#password").keydown(function(ev) {
    if(ev.key == 13)
        loginClick();
});

$("#logout").click(function() {
    eraseCookie("sync_uname");
    eraseCookie("sync_pw");
    document.location.reload(true);
});

$("#register").click(function() {
    uname = $("#username").val();
    if($("#password").val() == "")
        pw = "";
    else
        pw = SHA256($("#password").val());
    socket.emit("register", {
        name: uname,
        sha256: pw
    });
});

$("#chatline").keydown(function(ev) {
    if(ev.keyCode == 13 && $("#chatline").val() != "") {
        socket.emit("chatMsg", {
            msg: $("#chatline").val()
        });
        $("#chatline").val("");
    }
    else if(ev.keyCode == 9) { // Tab completion
        var words = $("#chatline").val().split(" ");
        var current = words[words.length - 1].toLowerCase();
        var users = $("#userlist").children();
        var match = null;
        for(var i = 0; i < users.length; i++) {
            var name = users[i].children[1].innerHTML.toLowerCase();
            if(name.indexOf(current) == 0 && match == null) {
                match = users[i].children[1].innerHTML;
            }
            else if(name.indexOf(current) == 0) {
                match = null;
                break;
            }
        }
        if(match != null) {
            words[words.length - 1] = match;
            if(words.length == 1)
                words[0] += ": ";
            else
                words[words.length - 1] += " ";
            $("#chatline").val(words.join(" "));
        }
        ev.preventDefault();
        return false;
    }
});

$("#opt_submit").click(function() {
    var ptitle = $("#opt_pagetitle").val();
    if(ptitle == "")
        ptitle = $("#opt_pagetitle").attr("placeholder")
    opts = {
        qopen_allow_qnext: $("#opt_qopen_allow_qnext").prop("checked"),
        qopen_allow_move: $("#opt_qopen_allow_move").prop("checked"),
        qopen_allow_delete: $("#opt_qopen_allow_delete").prop("checked"),
        qopen_allow_playnext: $("#opt_qopen_allow_playnext").prop("checked"),
        pagetitle: ptitle,
        customcss: $("#opt_customcss").val()
    };
    socket.emit("channelOpts", opts);
});

$("#show_chancontrols").click(function() {
    $("#show_chancontrols").parent().addClass("active");
    $("#show_banlist").parent().removeClass("active");
    $("#banlist").hide();
    $("#chancontrols").show();
});

$("#show_banlist").click(function() {
    $("#show_chancontrols").parent().removeClass("active");
    $("#show_banlist").parent().addClass("active");
    $("#banlist").show();
    $("#chancontrols").hide();
});

function searchLibrary() {
    socket.emit("searchLibrary", {
        query: $("#library_query").val()
    });
}
$("#library_search").click(searchLibrary);
$("#library_query").keydown(function(ev) {
    if(ev.key == 13)
        searchLibrary();
});

function onYouTubeIframeAPIReady() {
    PLAYER = new YT.Player("ytapiplayer", {
        height: "390",
        width: "640",
        videoId: "",
        playerVars: {
            "autoplay": 0,
            "controls": 1,
        },
        events: {
            "onReady": onPlayerReady,
            "onStateChange": onPlayerStateChange
        }
    });
}

function onPlayerReady() {
    socket.emit("playerReady");
}

function onPlayerStateChange(state) {
    if(LEADER && state.data == YT.PlayerState.ENDED) {
        socket.emit("playNext");
    }
    else if(LEADER && state.data == YT.PlayerState.PAUSED) {
        socket.emit("mediaUpdate", {
            id: parseYTURL(PLAYER.getVideoUrl()),
            seconds: PLAYER.getCurrentTime(),
            type: "yt",
            paused: true
        });
    }
    if(LEADER && state.data == YT.PlayerState.PLAYING) {
        socket.emit("mediaUpdate", {
            id: parseYTURL(PLAYER.getVideoUrl()),
            seconds: PLAYER.getCurrentTime(),
            type: "yt",
            paused: false
        });
    }
}

function createCookie(name,value,days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==" ") c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,"",-1);
}
