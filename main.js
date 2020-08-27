const { Socket } = require("phoenix-channels");

// url = 'wss://lucid-ardent.reticulum.io/?roomId=T8NTTNr&peerId=ee2e4691-f948-42ee-abca-1c2cee5fa56e
const url = "wss://relaxed-werewolf.reticulum.io/socket";
const socket = new Socket(url);
console.log(`Connecting to ${url}`);
socket.connect();
console.log(`Connected`);

const channel = socket.channel("hub_id:T8NTTNr");
channel
  .join()
  .receive("ok", res => console.log("Joined successfully", res))
  .receive("err", res => console.log("Unable to join", res));
