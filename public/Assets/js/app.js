// const { Socket } = require("socket.io");

const e = require("cors");


//the app process is helping function to make it more easy to use with other methods so to use 
//the function in other function we have to use below syntax which returns the function and can be used

var AppProcess = (function(){


    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];
    var serverProcess;
    var local_div;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var video_states = {
        None: 0,
        Camera: 1,
        ScreenShare: 2
    }
    var video_st = videostates.None;
    async function _init(SDP_function, my_connId){
        
        serverProcess = SDP_function;
        my_connection_id = my_connId;
        eventProcess();
        local_div = document.getElementById("localVideoPlayer");

    }

    function eventProcess(){
        $("#micMuteUnmute").on("click", async function(){
            if(audio){
                await loadAudio();
            }
            if(!audio){
                alert("Audio permission not added");
                return;
            }
            if(isAudioMute){
                audio.enabled = true;
                $(this).html("<span class='material-icons'>mic</span>");
                updateMediaSenders(audio,rtp_aud_senders);
            }else{
                audio.enabled = false;
                $(this).html("<span class='material-icons'>mic_off</span>");
                removeMediaSenders(rtp_aud_senders);
            }
            isAudioMute = !isAudioMute;

        })

        $("#videoCamOnOff").on("click", async function(){
            if(video_st == video_states.Camera){
                await videoProcess(video_states.None)
            }else{
                await videoProcess(video_states.Camera)
            }
        })

        $("#ScreenShareOnOff").on("click", async function(){
            if(video_st == video_states.ScreenShare){
                await videoProcess(video_states.None)
            }else{
                await videoProcess(video_states.ScreenShare)
            }
        })

    }

    // will store ip addr and other user computer information
    var iceConfiguration = {
        iceServers:[
            {
                urls:"stun:stun.l.google.com:19302",  
            },
            {
                urls:"stun:stun1.l.google.com:19302",
            },
        ]
    }
    // WEBRTC connection block
    async function setConnection(connid){
        var connection = new RTCPeerConnection(iceConfiguration);

        connection.onnegotiationneeded = async function(event) {
            await setOffer(connid);
        }
        connection.onicecandidate = function(event){
            if(event.candidate){
                serverProcess(JSON.stringify({icecandidate:event.candidate}), connid)
            }
        }
        connection.ontrack = function(event){
            if(!remote_vid_stream[connid]){
                remote_vid_stream[connid] = new MediaStream();
            }
            if(!remote_aud_stream[connid]){
                remote_aud_stream[connid] = new MediaStream();
            }

            if(event.track.kind == "video"){
                remote_vid_stream[connid]
                .getVideoTracks()
                .forEach((t) => {
                    remote_vid_stream[connid].removeTrack(t);
                })
                remote_vid_stream[connid].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_"+connid);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connid];
                remoteVideoPlayer.load();
            }else if(event.track.kind == "audio"){
                remote_vid_stream[connid]
                .getAudioTracks()
                .forEach((t) => {
                    remote_aud_stream[connid].removeTrack(t);
                })
                remote_aud_stream[connid].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_"+connid);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connid];
                remoteAudioPlayer.load();
            }
        }

        peers_connection_ids[connid] = connid;
        peers_connection[connid] = connection;

        return connection;
        }

    async function setOffer(connid){

        var connection = peers_connection[connid];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }), connid);
    }

    async function SDPProcess(message, from_connid){
        message = JSON.parse(message);
        if(message.answer){
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer));
        }else if(message.offer){
            if(!peers_connection[from_connid]){
                await setConnection(from_connid)
            }
            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.offer));
            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);
            serverProcess(
                JSON.stringify({
                answer: answer,
            }), from_connid
            );
        }else if(message.icecandidate){
            if(!peers_connection[from_connid]){
                await setConnection(from_connid);
            }
            try{
                await peers_connection[from_connid].addIceCandidate(message.icecandidate);
            }catch(e){
                console.log(e);
            }
        }
    }

    return {
        setNewConnection: async function(connid){
            await setConnection(connid);
        },
        init: async function(SDP_function, my_connId){
            await _init(SDP_function, my_connId);
        },
        processClientFunc: async function(data, from_connid){
            await SDPProcess(data, from_connid);
        },
    };

})();
// ^
// |  it is immediate invoke method useful for start invoke 

var MyApp = (function(){
    var user_id = ""; // not assigning anything will return undefined so assigned empty string |
    var meeting_id = "";                                                    //               <-|
    function init(uid,mid){
        //alert("From app js");
        user_id = uid;
        meeting_id = mid;
        event_process_for_signaling_server();
    }

    var socket = null;
    function event_process_for_signaling_server(){
        socket = io.connect();

        var SDP_function = function(data, to_connid){
            socket.emit("SDPProcess",{
                message:data,
                to_connid:to_connid
            })
        }

        socket.on("connect",()=> {
            // alert("socket connected to client side");
            if(socket.connected){
                AppProcess.init(SDP_function,socket.id);
                if(user_id != "" && meeting_id != ""){
                    socket.emit("userconnect",{         // emit() function is send function used to send info to server
                        displayName : user_id,
                        meetingid : meeting_id
                    })
                }
            }
        });

        // other users my sent info

        socket.on("inform_others_about_me", function(data){
            addUser(data.other_user_id, data.connId);
            AppProcess.setNewConnection(data.connId);
        });
        socket.on("inform_me_about_other_user", function(other_users){
            if(other_users){
                for(var i =0;i<other_users.length;i++){
                    addUser(other_users[i].user_id, other_users[i].connectionId);
                    AppProcess.setNewConnection(other_users[i].connectionId);

                }
            }
            //addUser(data.other_user_id, data.connId);
            //AppProcess.setNewConnection(data.connId);
        });
        socket.on("SDPProcess", async function(data){
            await AppProcess.processClientFunc(data.message, data.from_connid);
        })
    }

    function addUser(other_user_id, connId){
        var newDivId = $("otherTemplate").clone();
        newDivId = newDivId.attr("id", connId).addClass("other");
        newDivId.find("h2").text(other_user_id);
        newDivId.find("video").text("id","v_"+connId);
        newDivId.find("audio").text("id","a_"+connId);
        newDivId.show();
        $("#divUsers").append(newDivId);
    }
    return {
        _init: function(uid,mid){
            init(uid,mid);
        },
    };
})(); 

// ^
// |  it is immediate invoke method useful for start invoke 