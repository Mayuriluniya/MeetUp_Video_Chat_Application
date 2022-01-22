import * as store from "./store.js";
import * as ui from "./ui.js";
import * as webRTCHandler from "./webRTCHandler.js";
import * as constants from "./constants.js";


let socketIO = null;

export const registerSocketEvents = (socket) => {
    socketIO = socket;
    socket.on("connect" , () => {
        
        console.log("successfully connected to socket.io server");
        store.setSocketId(socket.id);
        ui.updatePersonalCode(socket.id);
        
      
      });
      socket.on("pre-offer" , (data) => {
          
          webRTCHandler.handlePreOffer(data);



      });

      socket.on("pre-offer-answer", (data) => {
          webRTCHandler.handlePreOfferAnswer(data);
      });

      socket.on("user-hanged-up", () =>{
          webRTCHandler.handleConnectedUserHangedUp();
      }); 
      socket.on("webRTC-signaling", (data) => {
          switch (data.type){
              case constants.webRTCSignaling.OFFER:
                  webRTCHandler.handlewebRTCOffer(data);
                  break;
              case constants.webRTCSignaling.ANSWER:
                  webRTCHandler.handlewebRTCAnswer(data);
                  break;
              case constants.webRTCSignaling.ICE_CANDIDATE:
                  webRTCHandler.handleWebRTCCandidate(data);
                  break;
              default:
                  return;
          }


      });


};

export const sendPreOffer = (data) => {
    console.log("emitting to server pre offer event ");
    socketIO.emit("pre-offer", data);


};

export const sendPreOfferAnswer = (data) => {
    socketIO.emit("pre-offer-answer", data);

};

export const sendDataUsingWebRTCSignaling = (data) => {
    socketIO.emit("webRTC-signaling",data);
};

export const sendUserHangedUp = (data) => {
    socketIO.emit("user-hanged-up",data);
};