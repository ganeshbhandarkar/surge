const express = require("express"); // requirement adding to use express
const path = require("path");  // express path
var app = express();   // create express app
var server = app.listen(3000, function(){
    console.log("Listing on 3000");
});   // using port 3000 for server

const io = require("socket.io")(server,{
    allowEIO3 : true,
});    // joins the express to socket.io
app.use(express.static(path.join(__dirname,"")));  // defining whole directory as static if set at other directory the only that directory will be used.

var userConnections = [];

// new user connect loaded !important
io.on("connection",(socket)=>{
    console.log("socket id is",socket.id);  // will show when connected from client side too
    socket.on("userconnect",(data)=>{    // getting data in server and checking at server and client
        console.log("userconnect", data.displayName, data.meetingid)
        var other_users = userConnections.filter(
            (p) => p.meeting_id == data.meetingid
        );

        userConnections.push({
            connectionId : socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid
        });

        other_users.forEach((v)=> {
            socket.to(v.connectionId).emit("inform_others_about_me",{
                other_user_id:data.displayName,
                connId: socket.id
            })
        })

        socket.emit("inform_me_about_other_user", other_users);

    });

    socket.on("SDPProcess", (data)=>{
        socket.to(data.to_connid).emit("SDPProcess",{
            message: data.message,
            from_connid: socket.id,
        });
    })
})





