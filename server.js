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

// new user connect loaded !important
io.on("connection",(socket)=>{
    console.log("socket id is",socket.id);  // will show when connected from client side too
})





