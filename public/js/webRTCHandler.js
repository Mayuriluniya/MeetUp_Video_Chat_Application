import * as wss from "./wss.js";
import * as constants from "./constants.js";
import * as ui from "./ui.js";
import * as store from "./store.js";
let connectedUserDetails;
let peerConnection;
let dataChannel;
const defaultConstraints = {
    audio : true,
    video : true,
};

const configuration = {
    iceServers : [ {'urls': 'stun:stun.l.google.com:19302'}]
};
export const getLocalPreview = () => {
    navigator.mediaDevices.getUserMedia(defaultConstraints).then((stream) => {
        ui.updateLocalVideo(stream);
        //ui.showVideoCallButtons();
        //store.setCallState(constants.callState.CALL_AVAILABLE);
        store.setLocalStream(stream);

    }).catch((err) => {
        console.log("error occured when trying to get an access camera");
        console.log(err);
    });
};

const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(configuration);
    dataChannel = peerConnection.createDataChannel("chat");

    peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannel.onopen = () => {
            console.log("peer connection is ready to recieve data channel meassages");
        };
        dataChannel.onmessage = (event) => {
            console.log("message came from data channel");
            const message = JSON.parse(event.data);
            ui.appendMessage(message);
           

        };

    };
    peerConnection.onicecandidate = (event) => {
        console.log("getting ice candidates from stun server");
        if(event.candidate){
            
            wss.sendDataUsingWebRTCSignaling({
                connectedUserSocketId : connectedUserDetails.socketId,
                type : constants.webRTCSignaling.ICE_CANDIDATE,
                candidate: event.candidate,
            });


        }
    };
    peerConnection.onconnectionstatechange = (event) => {
        if(peerConnection.connectionState === 'connected'){
            console.log("successfully connected with other peer");
        }

    };
    const remoteStream = new MediaStream();
    store.setRemoteStream(remoteStream);
    ui.updateRemoteVideo(remoteStream);
    peerConnection.ontrack = (event) => {
        remoteStream.addTrack(event.track);
    };
    if(connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE)
    {
        
        const localStream = store.getState().localStream;
        for(const track of localStream.getTracks()) {
            peerConnection.addTrack(track, localStream);
        }

    }


};

export const sendMessageUsingDataChannel = (message) => {
    const stringifiedMessage = JSON.stringify(message);
    dataChannel.send(stringifiedMessage);
};



export const sendPreOffer = (callType, calleePersonalCode) => {
    connectedUserDetails = {
        callType,
        socketId : calleePersonalCode

    };

    if(callType === constants.callType.VIDEO_PERSONAL_CODE)
    {
        const data = {
            callType,
            calleePersonalCode
        };
        ui.showCallingDialog(callingDialogRejectCallHandler);
        wss.sendPreOffer(data);
    }



    

};

export const handlePreOffer = (data) => {
    const { callType, callerSocketId } = data;
    connectedUserDetails = {
        socketId : callerSocketId,
        callType, 
    };

    if (
        callType === constants.callType.VIDEO_PERSONAL_CODE 
    ) {
        ui.showIncomingCallDialog(callType, acceptCallHandler, rejectCallHandler); 

    }
};

const acceptCallHandler = () => {
    console.log("call accepted");
    createPeerConnection();
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
    ui.showCallElements(connectedUserDetails.callType);

};

const rejectCallHandler = () => {
    console.log("call rejected");
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);

};

const callingDialogRejectCallHandler = () => {
    console.log("rejecting the call");
};

const sendPreOfferAnswer = (preOfferAnswer) => {
    const data = {
        callerSocketId : connectedUserDetails.socketId,
        preOfferAnswer,

    };
    ui.removeAllDialogs();


    wss.sendPreOfferAnswer(data);
};

export const handlePreOfferAnswer = (data) => {
    const { preOfferAnswer } = data;
    ui.removeAllDialogs();
    

    if (preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) {
        ui.showInfoDialog(preOfferAnswer);

    }
    if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
        ui.showInfoDialog(preOfferAnswer);

    }
    if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
        ui.showInfoDialog(preOfferAnswer);

    }
    if (preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) {
        ui.showCallElements(connectedUserDetails.callType);
        createPeerConnection();
        sendWebRTCOffer();

    }
};
const sendWebRTCOffer = async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.OFFER,
        offer:offer,
    });

};
export const handlewebRTCOffer = async (data) => {
    await peerConnection.setRemoteDescription(data.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId : connectedUserDetails.socketId,
        type : constants.webRTCSignaling.ANSWER,
        answer : answer,
    });

};

export const handlewebRTCAnswer = async (data) => {
    console.log("handling webRTC answer");
    await peerConnection.setRemoteDescription(data.answer);
};

export const handleWebRTCCandidate = async (data) => {
    console.log("handling webRTC incoming candidates");
    try {
        await peerConnection.addIceCandidate(data.candidate);
    } catch (err) {
        console.error("error occured when trying to add received ice candidate" , err);
        }

 

};

let screenSharingStream;
export const switchBetweenCameraAndScreenSharing = async (screenSharingActive) => {
    if ( screenSharingActive) {
        const localStream = store.getState().localStream;
        const senders = peerConnection.getSenders();
        const sender = senders.find((sender) => {
            return (
                sender.track.kind === localStream.getVideoTracks()[0].kind

            );
            
        });
        if (sender)
        {
            sender.replaceTrack(localStream.getVideoTracks()[0]);
        }
        store.getState().screenSharingStream.getTracks().forEach(track => track.stop());
            
        
        store.setScreenSharingActive(!screenSharingActive);
        ui.updateLocalVideo(localStream);

    } else {
        console.log("switching for screen sharing");
        try {
            screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
                video : true
            });
            store.setScreenSharingStream(screenSharingStream);
            const senders = peerConnection.getSenders();
            const sender = senders.find((sender) => {
                return (
                    sender.track.kind === screenSharingStream.getVideoTracks()[0].kind

                );
                
            });
            if (sender)
            {
                sender.replaceTrack(screenSharingStream.getVideoTracks()[0]);
            }
            store.setScreenSharingActive(!screenSharingActive);
            ui.updateLocalVideo(screenSharingStream);
            

            
        } catch(err) {
            console.error("error occured while trying to get screen sharing stream", err);

        }
    }

};

export const handleHangUp = () => {
    console.log("hanging up the call");
    const data = {
        connectedUserSocketId : connectedUserDetails.socketId,
    };
    wss.sendUserHangedUp(data);
};

export const handleConnectedUserHangedUp = () => {
    console.log("connected peer hanged up");
    closePeerConnectionAndResetState();

};
const closePeerConnectionAndResetState = () => {
    if(peerConnection){
        peerConnection.close();
        peerConnection = null;
    }

    if( connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE)
    {
        store.getState().localStream.getVideoTracks()[0].enabled = true;
        store.getState().localStream.getAudioTracks()[0].enabled = true;
        
        
    }
    ui.updateUIAfterHangUp(connectedUserDetails.callType);
    connectedUserDetails = null;

};








//const socket = io();
//const peer = new RTCPeerConnection();
//let dataChannel;
